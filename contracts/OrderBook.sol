// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {AccessManaged} from "@openzeppelin/contracts/access/manager/AccessManaged.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {MarketConfig} from "./MarketConfig.sol";
import {IRateOracle} from "./interfaces/IRateOracle.sol";
import {ICollateralVault} from "./interfaces/ICollateralVault.sol";
import {PositionManager} from "./PositionManager.sol";
import {ForwardMath} from "./libraries/ForwardMath.sol";

/// @notice Fully funded, bounded on-chain order book for listed forward series.
contract OrderBook is AccessManaged, ReentrancyGuard {
    enum Side {
        Buyer,
        Seller
    }

    enum PriceType {
        Fixed,
        Pegged
    }

    enum TimeInForce {
        Rest,
        ImmediateOrCancel
    }

    enum OrderStatus {
        None,
        Active,
        Filled,
        Cancelled,
        Expired,
        Invalidated
    }

    enum CancelReason {
        User,
        ImmediateOrCancel,
        MatchLimitReached,
        SelfTradePrevented,
        Expired,
        Invalidated
    }

    struct PlaceOrderParams {
        bytes32 intentId;
        bytes32 seriesId;
        Side side;
        PriceType priceType;
        TimeInForce timeInForce;
        uint32 lots;
        uint32 minimumImmediateFillLots;
        uint64 validUntil;
        uint64 submitBy;
        uint64 boundRoundId;
        uint64 lastExecutableRoundId;
        uint128 limitStrikeRaw;
        uint128 maxTokenPullRaw;
        int16 offsetBps;
    }

    struct Order {
        address owner;
        bytes32 intentId;
        bytes32 marketId;
        bytes32 seriesId;
        uint64 configVersion;
        uint64 sequence;
        uint64 validUntil;
        uint64 boundRoundId;
        uint64 lastExecutableRoundId;
        uint128 limitStrikeRaw;
        uint128 reservePerLotRaw;
        uint128 feeEscrowRemaining;
        uint128 cumulativeTakerNotional;
        uint32 lotsTotal;
        uint32 lotsFilled;
        int16 offsetBps;
        Side side;
        PriceType priceType;
        TimeInForce timeInForce;
        OrderStatus status;
    }

    struct BestOrder {
        uint256 orderId;
        uint256 priceRaw;
        bool found;
    }

    MarketConfig public immutable marketConfig;
    IRateOracle public immutable rateOracle;
    PositionManager public immutable positionManager;

    bool public newRiskPaused;
    uint256 public nextOrderId = 1;
    uint64 public nextSequence = 1;

    mapping(uint256 orderId => Order) private _orders;
    mapping(bytes32 seriesId => uint256[]) private _activeOrders;
    mapping(uint256 orderId => uint256 indexPlusOne) private _activeIndex;
    mapping(address owner => mapping(bytes32 intentId => bool used)) public intentUsed;
    mapping(address owner => mapping(bytes32 marketId => uint32 count)) public walletMarketActiveOrders;
    mapping(bytes32 marketId => uint32 count) public marketActiveOrders;

    event NewRiskPauseUpdated(bool paused);
    event OrderPlaced(
        uint256 indexed orderId,
        address indexed owner,
        bytes32 indexed seriesId,
        Side side,
        PriceType priceType,
        uint32 lots,
        uint128 reservePerLotRaw,
        uint128 feeEscrow,
        uint64 sequence
    );
    event OrderFilled(
        uint256 indexed orderId,
        uint256 indexed positionId,
        uint32 fillLots,
        uint128 executionStrikeRaw,
        bool maker,
        uint256 feeCharged
    );
    event OrderClosed(
        uint256 indexed orderId,
        address indexed owner,
        OrderStatus status,
        CancelReason reason,
        uint32 unfilledLots,
        uint256 claimCredited
    );
    event MatchingPending(bytes32 indexed seriesId, uint32 pairsProcessed);

    error InvalidAddress();
    error NewRiskPaused();
    error InvalidOrder();
    error InvalidOwner();
    error InvalidSeries();
    error InvalidLots();
    error InvalidExpiry();
    error InvalidPrice();
    error InvalidRound();
    error FeedUnavailable();
    error CapacityReached();
    error MatchRequired();
    error MinimumFillNotMet(uint32 required, uint32 actual);
    error OrderNotActive();
    error OrderNotExpirable();
    error OrderNotInvalidatable();
    error AmountOverflow();
    error AccountingError();
    error DuplicateIntent(bytes32 intentId);
    error PullLimitExceeded(uint256 required, uint256 maximum);

    constructor(
        address initialAuthority,
        MarketConfig marketConfig_,
        IRateOracle rateOracle_,
        PositionManager positionManager_
    ) AccessManaged(initialAuthority) {
        if (
            address(marketConfig_) == address(0) || address(rateOracle_) == address(0)
                || address(positionManager_) == address(0)
        ) revert InvalidAddress();
        marketConfig = marketConfig_;
        rateOracle = rateOracle_;
        positionManager = positionManager_;
    }

    function setNewRiskPaused(bool paused) external restricted {
        newRiskPaused = paused;
        emit NewRiskPauseUpdated(paused);
    }

    function placeOrder(PlaceOrderParams calldata params) external nonReentrant returns (uint256 orderId) {
        if (newRiskPaused) revert NewRiskPaused();
        MarketConfig.Series memory series = marketConfig.getSeries(params.seriesId);
        MarketConfig.Config memory config = marketConfig.getConfig(series.configVersion);
        _validateDeployment(config);
        if (!marketConfig.isVersionActive(series.configVersion) || block.timestamp >= series.fixingAt) {
            revert InvalidSeries();
        }
        if (!rateOracle.isTradingOpen(series.configVersion)) revert FeedUnavailable();
        IRateOracle.FinalizedRound memory round = rateOracle.latestFinalizedRound(series.configVersion);
        if (round.roundId == 0 || round.roundId >= series.expiryRoundId) revert FeedUnavailable();
        if (_bookCrossed(params.seriesId, series, config, round)) revert MatchRequired();

        (uint128 reservePerLot, uint128 feeEscrow) = _validateAndQuote(params, series, config, round);
        if (_activeOrders[params.seriesId].length >= config.maxOrdersPerSeries) revert CapacityReached();
        if (
            walletMarketActiveOrders[msg.sender][series.marketId] >= config.maxOrdersPerWallet
                || marketActiveOrders[series.marketId] >= config.maxOrdersPerMarket
        ) revert CapacityReached();
        if (params.intentId == bytes32(0) || intentUsed[msg.sender][params.intentId]) {
            revert DuplicateIntent(params.intentId);
        }

        orderId = nextOrderId++;
        uint64 sequence = nextSequence++;
        intentUsed[msg.sender][params.intentId] = true;
        _orders[orderId] = Order({
            owner: msg.sender,
            intentId: params.intentId,
            marketId: series.marketId,
            seriesId: params.seriesId,
            configVersion: series.configVersion,
            sequence: sequence,
            validUntil: params.validUntil,
            boundRoundId: params.boundRoundId,
            lastExecutableRoundId: params.lastExecutableRoundId,
            limitStrikeRaw: params.limitStrikeRaw,
            reservePerLotRaw: reservePerLot,
            feeEscrowRemaining: feeEscrow,
            cumulativeTakerNotional: 0,
            lotsTotal: params.lots,
            lotsFilled: 0,
            offsetBps: params.offsetBps,
            side: params.side,
            priceType: params.priceType,
            timeInForce: params.timeInForce,
            status: OrderStatus.Active
        });
        _insertActive(params.seriesId, orderId);

        uint256 collateral = uint256(reservePerLot) * params.lots;
        uint256 totalPull = collateral + feeEscrow;
        if (totalPull > params.maxTokenPullRaw) revert PullLimitExceeded(totalPull, params.maxTokenPullRaw);
        positionManager.reserveOrder(
            orderId,
            msg.sender,
            series.configVersion,
            _toUint128(collateral),
            feeEscrow
        );
        emit OrderPlaced(
            orderId,
            msg.sender,
            params.seriesId,
            params.side,
            params.priceType,
            params.lots,
            reservePerLot,
            feeEscrow,
            sequence
        );

        _match(params.seriesId, config.maxMatchBatch, series, config, round);
        uint32 filled = _orders[orderId].lotsFilled;
        if (filled < params.minimumImmediateFillLots) {
            revert MinimumFillNotMet(params.minimumImmediateFillLots, filled);
        }
        if (_orders[orderId].status == OrderStatus.Active) {
            if (params.timeInForce == TimeInForce.ImmediateOrCancel) {
                _closeOrder(orderId, OrderStatus.Cancelled, CancelReason.ImmediateOrCancel);
            } else if (_bookCrossed(params.seriesId, series, config, round)) {
                _closeOrder(orderId, OrderStatus.Cancelled, CancelReason.MatchLimitReached);
            }
        }
    }

    function matchOrders(bytes32 seriesId, uint32 maxPairs) external nonReentrant returns (uint32 pairsProcessed) {
        if (newRiskPaused) revert NewRiskPaused();
        MarketConfig.Series memory series = marketConfig.getSeries(seriesId);
        MarketConfig.Config memory config = marketConfig.getConfig(series.configVersion);
        _validateDeployment(config);
        if (!marketConfig.isVersionActive(series.configVersion) || block.timestamp >= series.fixingAt) {
            revert InvalidSeries();
        }
        if (!rateOracle.isTradingOpen(series.configVersion)) revert FeedUnavailable();
        if (maxPairs == 0 || maxPairs > config.maxMatchBatch) revert InvalidLots();
        IRateOracle.FinalizedRound memory round = rateOracle.latestFinalizedRound(series.configVersion);
        if (round.roundId == 0 || round.roundId >= series.expiryRoundId) revert FeedUnavailable();
        return _match(seriesId, maxPairs, series, config, round);
    }

    function cancelOrder(uint256 orderId) external nonReentrant {
        Order storage order = _orders[orderId];
        if (order.owner != msg.sender) revert InvalidOwner();
        if (order.status != OrderStatus.Active) revert OrderNotActive();
        _closeOrder(orderId, OrderStatus.Cancelled, CancelReason.User);
    }

    function expireOrder(uint256 orderId) external nonReentrant {
        Order storage order = _orders[orderId];
        if (order.status != OrderStatus.Active) revert OrderNotActive();
        if (block.timestamp < order.validUntil) revert OrderNotExpirable();
        _closeOrder(orderId, OrderStatus.Expired, CancelReason.Expired);
    }

    function invalidateOrder(uint256 orderId) external nonReentrant {
        Order storage order = _orders[orderId];
        if (order.status != OrderStatus.Active) revert OrderNotActive();
        bool invalid = !marketConfig.isVersionActive(order.configVersion);
        IRateOracle.FinalizedRound memory round = rateOracle.latestFinalizedRound(order.configVersion);
        if (order.priceType == PriceType.Fixed && round.roundId != order.boundRoundId) invalid = true;
        if (
            order.priceType == PriceType.Pegged && order.lastExecutableRoundId != 0
                && round.roundId > order.lastExecutableRoundId
        ) invalid = true;
        if (!invalid) revert OrderNotInvalidatable();
        _closeOrder(orderId, OrderStatus.Invalidated, CancelReason.Invalidated);
    }

    function getOrder(uint256 orderId) external view returns (Order memory) {
        Order memory order = _orders[orderId];
        if (order.status == OrderStatus.None) revert InvalidOrder();
        return order;
    }

    function activeOrderIds(bytes32 seriesId) external view returns (uint256[] memory) {
        return _activeOrders[seriesId];
    }

    function previewEffectiveLimit(uint256 orderId) external view returns (uint256 priceRaw, bool executable) {
        Order storage order = _orders[orderId];
        if (order.status == OrderStatus.None) revert InvalidOrder();
        MarketConfig.Series memory series = marketConfig.getSeries(order.seriesId);
        MarketConfig.Config memory config = marketConfig.getConfig(order.configVersion);
        IRateOracle.FinalizedRound memory round = rateOracle.latestFinalizedRound(order.configVersion);
        (priceRaw, executable) = _effectiveLimit(order, series, config, round);
        if (newRiskPaused || !rateOracle.isTradingOpen(order.configVersion)) executable = false;
    }

    function _match(
        bytes32 seriesId,
        uint32 maxPairs,
        MarketConfig.Series memory series,
        MarketConfig.Config memory config,
        IRateOracle.FinalizedRound memory round
    ) private returns (uint32 pairsProcessed) {
        while (pairsProcessed < maxPairs) {
            BestOrder memory bid = _best(seriesId, Side.Buyer, series, config, round);
            BestOrder memory ask = _best(seriesId, Side.Seller, series, config, round);
            if (!bid.found || !ask.found || bid.priceRaw < ask.priceRaw) break;

            Order storage buyerOrder = _orders[bid.orderId];
            Order storage sellerOrder = _orders[ask.orderId];
            if (buyerOrder.owner == sellerOrder.owner) {
                uint256 newer = buyerOrder.sequence > sellerOrder.sequence ? bid.orderId : ask.orderId;
                _closeOrder(newer, OrderStatus.Cancelled, CancelReason.SelfTradePrevented);
                pairsProcessed++;
                continue;
            }

            bool buyerMaker = buyerOrder.sequence < sellerOrder.sequence;
            uint128 strikeRaw = _toUint128(buyerMaker ? bid.priceRaw : ask.priceRaw);
            uint32 buyerRemaining = buyerOrder.lotsTotal - buyerOrder.lotsFilled;
            uint32 sellerRemaining = sellerOrder.lotsTotal - sellerOrder.lotsFilled;
            uint32 fillLots = buyerRemaining < sellerRemaining ? buyerRemaining : sellerRemaining;
            _executeFill(bid.orderId, ask.orderId, fillLots, strikeRaw, buyerMaker, config, round);
            pairsProcessed++;
        }

        if (pairsProcessed == maxPairs && _bookCrossed(seriesId, series, config, round)) {
            emit MatchingPending(seriesId, pairsProcessed);
        }
    }

    function _executeFill(
        uint256 buyerOrderId,
        uint256 sellerOrderId,
        uint32 fillLots,
        uint128 strikeRaw,
        bool buyerMaker,
        MarketConfig.Config memory config,
        IRateOracle.FinalizedRound memory round
    ) private {
        Order storage buyerOrder = _orders[buyerOrderId];
        Order storage sellerOrder = _orders[sellerOrderId];
        uint256 notional = config.lotNotionalRaw * fillLots;
        uint256 initialMargin = ForwardMath.ceilBps(config.lotNotionalRaw, config.initialMarginBps) * fillLots;
        int256 entryValue = ForwardMath.buyerValue(notional, round.rateRaw, strikeRaw);
        uint128 buyerAllocation =
            _toUint128(initialMargin + (entryValue < 0 ? ForwardMath.abs(entryValue) : 0));
        uint128 sellerAllocation =
            _toUint128(initialMargin + (entryValue > 0 ? uint256(entryValue) : 0));

        ICollateralVault.FillLeg memory buyerLeg = _consumeOrderForFill(
            buyerOrder,
            buyerOrderId,
            fillLots,
            buyerAllocation,
            !buyerMaker,
            config
        );
        ICollateralVault.FillLeg memory sellerLeg = _consumeOrderForFill(
            sellerOrder,
            sellerOrderId,
            fillLots,
            sellerAllocation,
            buyerMaker,
            config
        );

        uint256 positionId = positionManager.createPosition(
            PositionManager.CreatePositionParams({
                buyer: buyerOrder.owner,
                seller: sellerOrder.owner,
                seriesId: buyerOrder.seriesId,
                configVersion: buyerOrder.configVersion,
                entryRoundId: round.roundId,
                lots: fillLots,
                strikeRaw: strikeRaw,
                buyerLeg: buyerLeg,
                sellerLeg: sellerLeg
            })
        );

        emit OrderFilled(buyerOrderId, positionId, fillLots, strikeRaw, buyerMaker, buyerLeg.feeCharged);
        emit OrderFilled(sellerOrderId, positionId, fillLots, strikeRaw, !buyerMaker, sellerLeg.feeCharged);
        _markFilledIfComplete(buyerOrderId);
        _markFilledIfComplete(sellerOrderId);
    }

    function _consumeOrderForFill(
        Order storage order,
        uint256 orderId,
        uint32 fillLots,
        uint128 positionAllocation,
        bool taker,
        MarketConfig.Config memory config
    ) private returns (ICollateralVault.FillLeg memory leg) {
        uint128 collateralConsumed = _toUint128(uint256(order.reservePerLotRaw) * fillLots);
        if (positionAllocation > collateralConsumed) revert AccountingError();
        uint256 fillNotional = config.lotNotionalRaw * fillLots;
        uint256 oldTakerNotional = order.cumulativeTakerNotional;
        uint256 newTakerNotional = taker ? oldTakerNotional + fillNotional : oldTakerNotional;
        uint256 feeCharged = taker
            ? ForwardMath.ceilBps(newTakerNotional, config.effectiveTakerFeeBps)
                - ForwardMath.ceilBps(oldTakerNotional, config.effectiveTakerFeeBps)
            : 0;

        order.lotsFilled += fillLots;
        uint256 remainingNotional = config.lotNotionalRaw * (order.lotsTotal - order.lotsFilled);
        uint256 requiredAfter = ForwardMath.ceilBps(newTakerNotional + remainingNotional, config.effectiveTakerFeeBps)
            - ForwardMath.ceilBps(newTakerNotional, config.effectiveTakerFeeBps);
        if (requiredAfter > order.feeEscrowRemaining) revert AccountingError();
        uint256 feeEscrowConsumed = order.feeEscrowRemaining - requiredAfter;
        if (feeCharged > feeEscrowConsumed) revert AccountingError();
        order.feeEscrowRemaining = _toUint128(requiredAfter);
        order.cumulativeTakerNotional = _toUint128(newTakerNotional);

        return ICollateralVault.FillLeg({
            orderId: orderId,
            collateralConsumed: collateralConsumed,
            positionAllocation: positionAllocation,
            feeEscrowConsumed: _toUint128(feeEscrowConsumed),
            feeCharged: _toUint128(feeCharged)
        });
    }

    function _validateAndQuote(
        PlaceOrderParams calldata params,
        MarketConfig.Series memory series,
        MarketConfig.Config memory config,
        IRateOracle.FinalizedRound memory round
    ) private view returns (uint128 reservePerLot, uint128 feeEscrow) {
        if (
            params.lots == 0 || params.lots > config.maxLotsPerOrder
                || params.minimumImmediateFillLots > params.lots
        ) revert InvalidLots();
        if (
            params.validUntil <= block.timestamp || params.validUntil >= series.fixingAt
                || params.validUntil > block.timestamp + config.maxOrderLifetime
                || params.submitBy < block.timestamp || params.submitBy > params.validUntil
        ) revert InvalidExpiry();
        if (
            params.limitStrikeRaw < config.minStrikeRaw || params.limitStrikeRaw > config.maxStrikeRaw
                || params.limitStrikeRaw % config.tickSizeRaw != 0
        ) revert InvalidPrice();

        uint256 initialMargin = ForwardMath.ceilBps(config.lotNotionalRaw, config.initialMarginBps);
        uint256 reserve;
        if (params.priceType == PriceType.Fixed) {
            if (params.boundRoundId != round.roundId || params.lastExecutableRoundId != 0 || params.offsetBps != 0) {
                revert InvalidRound();
            }
            if (!ForwardMath.withinRelativeBand(params.limitStrikeRaw, round.rateRaw, series.strikeBandBps)) {
                revert InvalidPrice();
            }
            reserve = ForwardMath.fixedReservePerLot(
                initialMargin,
                config.lotNotionalRaw,
                round.rateRaw,
                params.limitStrikeRaw,
                params.side == Side.Buyer
            );
        } else {
            uint256 absoluteOffset = params.offsetBps < 0
                ? uint256(-int256(params.offsetBps))
                : uint256(uint16(params.offsetBps));
            if (
                params.boundRoundId != 0 || absoluteOffset > config.maxOffsetBps
                    || absoluteOffset > series.strikeBandBps
                    || (
                        params.lastExecutableRoundId != 0
                            && (
                                params.lastExecutableRoundId < round.roundId
                                    || params.lastExecutableRoundId > round.roundId + config.maxPegLifetimeRounds
                            )
                    )
            ) revert InvalidRound();
            reserve = ForwardMath.reservePerLot(
                initialMargin,
                config.lotNotionalRaw,
                params.offsetBps,
                params.side == Side.Buyer
            );
            if (int256(10_000) + params.offsetBps <= 0) revert InvalidPrice();
        }

        uint256 totalNotional = config.lotNotionalRaw * params.lots;
        uint256 fee = ForwardMath.ceilBps(totalNotional, config.effectiveTakerFeeBps);
        reservePerLot = _toUint128(reserve);
        feeEscrow = _toUint128(fee);
    }

    function _best(
        bytes32 seriesId,
        Side side,
        MarketConfig.Series memory series,
        MarketConfig.Config memory config,
        IRateOracle.FinalizedRound memory round
    ) private view returns (BestOrder memory best) {
        uint256[] storage ids = _activeOrders[seriesId];
        if (ids.length > config.maxScanBatch) revert CapacityReached();
        for (uint256 i = 0; i < ids.length; ++i) {
            Order storage order = _orders[ids[i]];
            if (order.side != side) continue;
            (uint256 price, bool executable) = _effectiveLimit(order, series, config, round);
            if (!executable) continue;
            if (
                !best.found || (side == Side.Buyer && price > best.priceRaw)
                    || (side == Side.Seller && price < best.priceRaw)
                    || (price == best.priceRaw && order.sequence < _orders[best.orderId].sequence)
            ) {
                best = BestOrder({orderId: ids[i], priceRaw: price, found: true});
            }
        }
    }

    function _bookCrossed(
        bytes32 seriesId,
        MarketConfig.Series memory series,
        MarketConfig.Config memory config,
        IRateOracle.FinalizedRound memory round
    ) private view returns (bool) {
        BestOrder memory bid = _best(seriesId, Side.Buyer, series, config, round);
        BestOrder memory ask = _best(seriesId, Side.Seller, series, config, round);
        return bid.found && ask.found && bid.priceRaw >= ask.priceRaw;
    }

    function _effectiveLimit(
        Order storage order,
        MarketConfig.Series memory series,
        MarketConfig.Config memory config,
        IRateOracle.FinalizedRound memory round
    ) private view returns (uint256 priceRaw, bool executable) {
        if (
            order.status != OrderStatus.Active || order.configVersion != series.configVersion
                || block.timestamp >= order.validUntil || !marketConfig.isVersionActive(order.configVersion)
        ) return (0, false);
        if (order.priceType == PriceType.Fixed) {
            if (order.boundRoundId != round.roundId) return (0, false);
            return (order.limitStrikeRaw, true);
        }
        if (order.lastExecutableRoundId != 0 && round.roundId > order.lastExecutableRoundId) return (0, false);
        priceRaw = ForwardMath.peggedLimit(
            round.rateRaw,
            order.offsetBps,
            config.tickSizeRaw,
            order.side == Side.Buyer
        );
        executable = _peggedPriceExecutable(order, series, config, round, priceRaw);
    }

    function _peggedPriceExecutable(
        Order storage order,
        MarketConfig.Series memory series,
        MarketConfig.Config memory config,
        IRateOracle.FinalizedRound memory round,
        uint256 priceRaw
    ) private view returns (bool) {
        if (
            priceRaw < config.minStrikeRaw || priceRaw > config.maxStrikeRaw
                || !ForwardMath.withinRelativeBand(priceRaw, round.rateRaw, series.strikeBandBps)
        ) return false;
        if (order.side == Side.Buyer && priceRaw > order.limitStrikeRaw) return false;
        if (order.side == Side.Seller && priceRaw < order.limitStrikeRaw) return false;
        return true;
    }

    function _markFilledIfComplete(uint256 orderId) private {
        Order storage order = _orders[orderId];
        if (order.lotsFilled != order.lotsTotal) return;
        order.status = OrderStatus.Filled;
        _removeActive(order.seriesId, orderId);
    }

    function _closeOrder(uint256 orderId, OrderStatus status, CancelReason reason) private {
        Order storage order = _orders[orderId];
        if (order.status != OrderStatus.Active) revert OrderNotActive();
        uint32 unfilled = order.lotsTotal - order.lotsFilled;
        order.status = status;
        _removeActive(order.seriesId, orderId);
        uint256 credited = positionManager.releaseOrder(orderId, order.owner, order.configVersion);
        order.feeEscrowRemaining = 0;
        emit OrderClosed(orderId, order.owner, status, reason, unfilled, credited);
    }

    function _insertActive(bytes32 seriesId, uint256 orderId) private {
        _activeOrders[seriesId].push(orderId);
        _activeIndex[orderId] = _activeOrders[seriesId].length;
        Order storage order = _orders[orderId];
        walletMarketActiveOrders[order.owner][order.marketId] += 1;
        marketActiveOrders[order.marketId] += 1;
    }

    function _removeActive(bytes32 seriesId, uint256 orderId) private {
        uint256 indexPlusOne = _activeIndex[orderId];
        if (indexPlusOne == 0) return;
        uint256 index = indexPlusOne - 1;
        uint256[] storage ids = _activeOrders[seriesId];
        uint256 lastId = ids[ids.length - 1];
        if (index != ids.length - 1) {
            ids[index] = lastId;
            _activeIndex[lastId] = index + 1;
        }
        ids.pop();
        delete _activeIndex[orderId];
        Order storage order = _orders[orderId];
        walletMarketActiveOrders[order.owner][order.marketId] -= 1;
        marketActiveOrders[order.marketId] -= 1;
    }

    function _validateDeployment(MarketConfig.Config memory config) private view {
        if (
            config.orderBook != address(this) || config.positionManager != address(positionManager)
                || config.rateOracle != address(rateOracle)
        ) revert InvalidSeries();
    }

    function _toUint128(uint256 value) private pure returns (uint128) {
        if (value > type(uint128).max) revert AmountOverflow();
        return uint128(value);
    }
}
