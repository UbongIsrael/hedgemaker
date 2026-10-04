// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {AccessManaged} from "@openzeppelin/contracts/access/manager/AccessManaged.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {MarketConfig} from "./MarketConfig.sol";
import {IRateOracle} from "./interfaces/IRateOracle.sol";
import {ICollateralVault} from "./interfaces/ICollateralVault.sol";
import {ForwardMath} from "./libraries/ForwardMath.sol";

/// @notice Creates and advances isolated bilateral forward positions.
/// @dev CollateralVault is the canonical source of each side's current equity.
contract PositionManager is AccessManaged, ReentrancyGuard {
    enum PositionStatus {
        None,
        Active,
        AwaitingFinalFixing,
        Matured,
        Liquidated,
        Defaulted,
        OracleClosed
    }

    struct Position {
        address buyer;
        address seller;
        bytes32 seriesId;
        uint64 configVersion;
        uint64 entryRoundId;
        uint64 lastRoundId;
        uint64 buyerCallDeadline;
        uint64 sellerCallDeadline;
        uint128 strikeRaw;
        uint256 notionalRaw;
        int256 lastValue;
        uint256 unpaidShortfall;
        PositionStatus status;
    }

    struct CreatePositionParams {
        address buyer;
        address seller;
        bytes32 seriesId;
        uint64 configVersion;
        uint64 entryRoundId;
        uint32 lots;
        uint128 strikeRaw;
        ICollateralVault.FillLeg buyerLeg;
        ICollateralVault.FillLeg sellerLeg;
    }

    MarketConfig public immutable marketConfig;
    IRateOracle public immutable rateOracle;
    ICollateralVault public immutable vault;
    address public orderBook;
    uint256 public nextPositionId = 1;

    mapping(uint256 positionId => Position) private _positions;

    event OrderBookBound(address indexed orderBook);
    event PositionCreated(
        uint256 indexed positionId,
        uint256 indexed buyerOrderId,
        uint256 indexed sellerOrderId,
        address buyer,
        address seller,
        bytes32 seriesId,
        uint64 configVersion,
        uint64 entryRoundId,
        uint32 lots,
        uint128 strikeRaw,
        int256 entryValue
    );
    event RoundSettled(
        uint256 indexed positionId,
        uint64 indexed roundId,
        uint128 rateRaw,
        int256 contractualDelta,
        uint256 paidAmount,
        uint256 shortfall
    );
    event MarginCallUpdated(
        uint256 indexed positionId,
        bool indexed buyerSide,
        bool active,
        uint64 deadline,
        uint256 equity
    );
    event MarginAdded(uint256 indexed positionId, address indexed owner, bool buyerSide, uint256 amount);
    event PositionClosed(
        uint256 indexed positionId,
        PositionStatus indexed status,
        uint64 lastRoundId,
        uint256 buyerPayout,
        uint256 sellerPayout,
        uint256 unpaidShortfall
    );

    error InvalidAddress();
    error AlreadyBound();
    error OnlyOrderBook(address caller);
    error InvalidConfiguration();
    error InvalidPosition();
    error InvalidOwner();
    error InvalidLots();
    error InvalidStrike();
    error InvalidRound();
    error FeedUnavailable();
    error InvalidEntryAllocation();
    error EntryTransferFailed();
    error SyncRequired();
    error PositionNotActive(PositionStatus status);
    error DeadlinePassed(uint64 deadline);
    error NotLiquidatable();
    error AmountOverflow();

    modifier onlyOrderBook() {
        if (msg.sender != orderBook) revert OnlyOrderBook(msg.sender);
        _;
    }

    constructor(
        address initialAuthority,
        MarketConfig marketConfig_,
        IRateOracle rateOracle_,
        ICollateralVault vault_
    ) AccessManaged(initialAuthority) {
        if (
            address(marketConfig_) == address(0) || address(rateOracle_) == address(0)
                || address(vault_) == address(0)
        ) revert InvalidAddress();
        marketConfig = marketConfig_;
        rateOracle = rateOracle_;
        vault = vault_;
    }

    function bindOrderBook(address orderBook_) external restricted {
        if (orderBook != address(0)) revert AlreadyBound();
        if (orderBook_ == address(0) || orderBook_.code.length == 0) revert InvalidAddress();
        orderBook = orderBook_;
        emit OrderBookBound(orderBook_);
    }

    function reserveOrder(uint256 orderId, address owner, uint64 configVersion, uint256 collateral, uint256 feeEscrow)
        external
        onlyOrderBook
        nonReentrant
    {
        MarketConfig.Config memory config = marketConfig.getConfig(configVersion);
        _validateDeployment(config);
        vault.reserveOrder(orderId, owner, collateral, feeEscrow);
    }

    function releaseOrder(uint256 orderId, address owner, uint64 configVersion)
        external
        onlyOrderBook
        nonReentrant
        returns (uint256)
    {
        MarketConfig.Config memory config = marketConfig.getConfig(configVersion);
        _validateDeployment(config);
        return vault.releaseOrder(orderId, owner);
    }

    function createPosition(CreatePositionParams calldata params)
        external
        onlyOrderBook
        nonReentrant
        returns (uint256 positionId)
    {
        if (params.buyer == address(0) || params.seller == address(0) || params.buyer == params.seller) {
            revert InvalidOwner();
        }
        MarketConfig.Series memory series = marketConfig.getSeries(params.seriesId);
        MarketConfig.Config memory config = marketConfig.getConfig(params.configVersion);
        _validateDeployment(config);
        if (series.configVersion != params.configVersion || block.timestamp >= series.fixingAt) {
            revert InvalidConfiguration();
        }
        if (params.entryRoundId >= series.expiryRoundId) revert InvalidRound();
        if (params.lots == 0 || params.lots > config.maxLotsPerOrder) revert InvalidLots();
        if (
            params.strikeRaw < config.minStrikeRaw || params.strikeRaw > config.maxStrikeRaw
                || params.strikeRaw % config.tickSizeRaw != 0
        ) revert InvalidStrike();

        IRateOracle.FinalizedRound memory round = rateOracle.latestFinalizedRound(params.configVersion);
        if (
            round.roundId == 0 || round.roundId != params.entryRoundId
                || !rateOracle.isTradingOpen(params.configVersion)
                || !ForwardMath.withinRelativeBand(params.strikeRaw, round.rateRaw, series.strikeBandBps)
        ) revert FeedUnavailable();

        uint256 notional = config.lotNotionalRaw * params.lots;
        if (notional > config.maxNotionalRaw || notional > uint256(type(int256).max)) revert InvalidLots();
        uint256 initialMargin = ForwardMath.ceilBps(config.lotNotionalRaw, config.initialMarginBps) * params.lots;
        int256 entryValue = ForwardMath.buyerValue(notional, round.rateRaw, params.strikeRaw);
        uint256 buyerRequired = initialMargin + (entryValue < 0 ? ForwardMath.abs(entryValue) : 0);
        uint256 sellerRequired = initialMargin + (entryValue > 0 ? uint256(entryValue) : 0);
        if (
            params.buyerLeg.positionAllocation != buyerRequired
                || params.sellerLeg.positionAllocation != sellerRequired
        ) revert InvalidEntryAllocation();

        positionId = nextPositionId++;
        vault.openPosition(positionId, params.buyer, params.seller, params.buyerLeg, params.sellerLeg);
        if (entryValue != 0) {
            (uint256 paid, bool exhausted) = vault.transferVariation(
                positionId,
                entryValue < 0,
                ForwardMath.abs(entryValue)
            );
            if (exhausted || paid != ForwardMath.abs(entryValue)) revert EntryTransferFailed();
        }

        _positions[positionId] = Position({
            buyer: params.buyer,
            seller: params.seller,
            seriesId: params.seriesId,
            configVersion: params.configVersion,
            entryRoundId: params.entryRoundId,
            lastRoundId: params.entryRoundId,
            buyerCallDeadline: 0,
            sellerCallDeadline: 0,
            strikeRaw: params.strikeRaw,
            notionalRaw: notional,
            lastValue: entryValue,
            unpaidShortfall: 0,
            status: PositionStatus.Active
        });

        _emitPositionCreated(positionId, params, entryValue);
    }

    function syncPosition(uint256 positionId, uint32 maxRounds) external nonReentrant returns (uint32 processed) {
        return _sync(positionId, maxRounds);
    }

    function settleRounds(uint256 positionId, uint32 maxRounds) external nonReentrant returns (uint32 processed) {
        return _sync(positionId, maxRounds);
    }

    function addMargin(uint256 positionId, bool buyerSide, uint256 amount, uint32 maxSyncRounds)
        external
        nonReentrant
    {
        Position storage position = _position(positionId);
        address owner = buyerSide ? position.buyer : position.seller;
        if (msg.sender != owner) revert InvalidOwner();
        _sync(positionId, maxSyncRounds);
        if (position.status != PositionStatus.Active) revert PositionNotActive(position.status);
        if (_hasProcessableRound(position)) revert SyncRequired();

        uint64 deadline = buyerSide ? position.buyerCallDeadline : position.sellerCallDeadline;
        if (deadline != 0 && block.timestamp >= deadline) revert DeadlinePassed(deadline);
        vault.addMargin(positionId, owner, buyerSide, amount);

        MarketConfig.Config memory config = marketConfig.getConfig(position.configVersion);
        uint256 lots = uint256(position.notionalRaw) / config.lotNotionalRaw;
        uint256 initialMargin = ForwardMath.ceilBps(config.lotNotionalRaw, config.initialMarginBps) * lots;
        ICollateralVault.PositionLedger memory ledger = vault.positionLedger(positionId);
        uint256 equity = buyerSide ? ledger.buyerCollateral : ledger.sellerCollateral;
        if (equity >= initialMargin) _setCall(positionId, position, buyerSide, 0, equity);
        emit MarginAdded(positionId, owner, buyerSide, amount);
    }

    function liquidate(uint256 positionId, uint32 maxSyncRounds) external nonReentrant {
        Position storage position = _position(positionId);
        _sync(positionId, maxSyncRounds);
        if (position.status != PositionStatus.Active) return;
        if (_hasProcessableRound(position)) revert SyncRequired();
        MarketConfig.Series memory series = marketConfig.getSeries(position.seriesId);
        uint64 due = _earliestCall(position);
        if (due == 0 || due >= series.fixingAt || block.timestamp < due) revert NotLiquidatable();
        _close(positionId, position, PositionStatus.Liquidated);
    }

    function getPosition(uint256 positionId) external view returns (Position memory, ICollateralVault.PositionLedger memory) {
        Position memory position = _positions[positionId];
        if (position.status == PositionStatus.None) revert InvalidPosition();
        return (position, vault.positionLedger(positionId));
    }

    function _sync(uint256 positionId, uint32 maxRounds) private returns (uint32 processed) {
        Position storage position = _position(positionId);
        if (position.status != PositionStatus.Active && position.status != PositionStatus.AwaitingFinalFixing) {
            return 0;
        }
        MarketConfig.Config memory config = marketConfig.getConfig(position.configVersion);
        MarketConfig.Series memory series = marketConfig.getSeries(position.seriesId);
        if (maxRounds == 0 || maxRounds > config.maxSyncBatch) revert InvalidLots();

        while (processed < maxRounds) {
            uint64 nextRoundId = position.lastRoundId + 1;
            if (nextRoundId > series.expiryRoundId) break;
            IRateOracle.ScheduledRound memory schedule =
                rateOracle.scheduledRound(position.configVersion, nextRoundId);
            if (!schedule.configured) revert InvalidConfiguration();
            IRateOracle.FinalizedRound memory round = rateOracle.finalizedRound(position.configVersion, nextRoundId);
            uint64 due = _earliestCall(position);
            if (round.roundId == 0) {
                if (
                    due != 0 && due < series.fixingAt && due < schedule.failureDeadline
                        && block.timestamp >= due
                ) {
                    _close(positionId, position, PositionStatus.Liquidated);
                    return processed;
                }
                if (block.timestamp >= schedule.failureDeadline) {
                    _close(positionId, position, PositionStatus.OracleClosed);
                    return processed;
                }
                break;
            }

            if (round.finalizedAt >= schedule.failureDeadline) {
                if (due != 0 && due < series.fixingAt && due < schedule.failureDeadline) {
                    _close(positionId, position, PositionStatus.Liquidated);
                } else {
                    _close(positionId, position, PositionStatus.OracleClosed);
                }
                return processed;
            }
            if (due != 0 && due < series.fixingAt && due <= round.finalizedAt) {
                _close(positionId, position, PositionStatus.Liquidated);
                return processed;
            }
            if (nextRoundId == series.expiryRoundId) {
                if (round.observationTime != series.fixingAt) {
                    if (block.timestamp < schedule.failureDeadline) break;
                    _close(positionId, position, PositionStatus.OracleClosed);
                    return processed;
                }
            }

            bool defaulted = _applyRound(positionId, position, round);
            processed++;
            if (defaulted) return processed;
            if (nextRoundId == series.expiryRoundId) {
                _close(positionId, position, PositionStatus.Matured);
                return processed;
            }

            if (round.finalizedAt < series.fixingAt) {
                _refreshMarginCalls(positionId, position, config, round.finalizedAt);
            }
        }

        if (position.status == PositionStatus.Defaulted) return processed;

        // A caller-selected work bound cannot skip earlier finalized observations.
        // Commit bounded progress and require a later call to continue before any
        // terminal decision is made.
        uint64 pendingRoundId = position.lastRoundId + 1;
        if (pendingRoundId < series.expiryRoundId) {
            IRateOracle.FinalizedRound memory nextRound =
                rateOracle.finalizedRound(position.configVersion, pendingRoundId);
            if (nextRound.roundId != 0) return processed;
        }

        // At equal timestamps oracle failure outranks maturity, then margin liquidation.
        if (block.timestamp >= series.oracleFailureDeadline) {
            IRateOracle.FinalizedRound memory finalRound =
                rateOracle.finalizedRound(position.configVersion, series.expiryRoundId);
            if (
                finalRound.roundId == 0 || finalRound.observationTime != series.fixingAt
                    || finalRound.finalizedAt >= series.oracleFailureDeadline
            ) {
                _close(positionId, position, PositionStatus.OracleClosed);
                return processed;
            }
        }
        uint64 dueNow = _earliestCall(position);
        if (dueNow != 0 && dueNow < series.fixingAt && block.timestamp >= dueNow) {
            _close(positionId, position, PositionStatus.Liquidated);
            return processed;
        }
        if (block.timestamp >= series.fixingAt) {
            position.status = PositionStatus.AwaitingFinalFixing;
        }
    }

    function _applyRound(uint256 positionId, Position storage position, IRateOracle.FinalizedRound memory round)
        private
        returns (bool defaulted)
    {
        int256 nextValue = ForwardMath.buyerValue(position.notionalRaw, round.rateRaw, position.strikeRaw);
        int256 contractualDelta = ForwardMath.delta(nextValue, position.lastValue);
        uint256 requested = ForwardMath.abs(contractualDelta);
        uint256 paid;
        bool exhausted;
        if (requested != 0) {
            (paid, exhausted) = vault.transferVariation(positionId, contractualDelta < 0, requested);
        }
        uint256 shortfall = uint256(requested) - paid;
        position.lastValue = nextValue;
        position.lastRoundId = round.roundId;
        position.unpaidShortfall += shortfall;
        emit RoundSettled(positionId, round.roundId, round.rateRaw, contractualDelta, paid, shortfall);
        if (exhausted) {
            _close(positionId, position, PositionStatus.Defaulted);
            return true;
        }
    }

    function _refreshMarginCalls(
        uint256 positionId,
        Position storage position,
        MarketConfig.Config memory config,
        uint64 finalizedAt
    ) private {
        uint256 lots = uint256(position.notionalRaw) / config.lotNotionalRaw;
        uint256 initialMargin = ForwardMath.ceilBps(config.lotNotionalRaw, config.initialMarginBps) * lots;
        uint256 maintenance = ForwardMath.ceilBps(config.lotNotionalRaw, config.maintenanceMarginBps) * lots;
        ICollateralVault.PositionLedger memory ledger = vault.positionLedger(positionId);
        _refreshSide(
            positionId,
            position,
            true,
            ledger.buyerCollateral,
            initialMargin,
            maintenance,
            finalizedAt + config.marginGracePeriodSeconds
        );
        _refreshSide(
            positionId,
            position,
            false,
            ledger.sellerCollateral,
            initialMargin,
            maintenance,
            finalizedAt + config.marginGracePeriodSeconds
        );
    }

    function _refreshSide(
        uint256 positionId,
        Position storage position,
        bool buyerSide,
        uint256 equity,
        uint256 initialMargin,
        uint256 maintenance,
        uint64 newDeadline
    ) private {
        uint64 existing = buyerSide ? position.buyerCallDeadline : position.sellerCallDeadline;
        if (existing == 0 && equity < maintenance) {
            _setCall(positionId, position, buyerSide, newDeadline, equity);
        } else if (existing != 0 && equity >= initialMargin) {
            _setCall(positionId, position, buyerSide, 0, equity);
        }
    }

    function _setCall(
        uint256 positionId,
        Position storage position,
        bool buyerSide,
        uint64 deadline,
        uint256 equity
    ) private {
        if (buyerSide) position.buyerCallDeadline = deadline;
        else position.sellerCallDeadline = deadline;
        emit MarginCallUpdated(positionId, buyerSide, deadline != 0, deadline, equity);
    }

    function _close(uint256 positionId, Position storage position, PositionStatus status) private {
        if (position.status != PositionStatus.Active && position.status != PositionStatus.AwaitingFinalFixing) return;
        (uint256 buyerPayout, uint256 sellerPayout) = vault.closePosition(positionId);
        position.status = status;
        emit PositionClosed(
            positionId,
            status,
            position.lastRoundId,
            buyerPayout,
            sellerPayout,
            position.unpaidShortfall
        );
    }

    function _hasProcessableRound(Position storage position) private view returns (bool) {
        MarketConfig.Series memory series = marketConfig.getSeries(position.seriesId);
        if (position.lastRoundId >= series.expiryRoundId) return false;
        return rateOracle.finalizedRound(position.configVersion, position.lastRoundId + 1).roundId != 0;
    }

    function _earliestCall(Position storage position) private view returns (uint64) {
        uint64 buyer = position.buyerCallDeadline;
        uint64 seller = position.sellerCallDeadline;
        if (buyer == 0) return seller;
        if (seller == 0) return buyer;
        return buyer < seller ? buyer : seller;
    }

    function _position(uint256 positionId) private view returns (Position storage position) {
        position = _positions[positionId];
        if (position.status == PositionStatus.None) revert InvalidPosition();
    }

    function _validateDeployment(MarketConfig.Config memory config) private view {
        if (
            config.vault != address(vault) || config.positionManager != address(this)
                || config.rateOracle != address(rateOracle) || config.orderBook != orderBook
                || config.settlementToken != address(vault.settlementToken())
        ) revert InvalidConfiguration();
    }

    function _emitPositionCreated(uint256 positionId, CreatePositionParams calldata params, int256 entryValue) private {
        emit PositionCreated(
            positionId,
            params.buyerLeg.orderId,
            params.sellerLeg.orderId,
            params.buyer,
            params.seller,
            params.seriesId,
            params.configVersion,
            params.entryRoundId,
            params.lots,
            params.strikeRaw,
            entryValue
        );
    }
}
