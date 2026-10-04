// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {AccessManaged} from "@openzeppelin/contracts/access/manager/AccessManaged.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {IRateOracle} from "./interfaces/IRateOracle.sol";
import {ICollateralVault} from "./interfaces/ICollateralVault.sol";
import {ForwardMath} from "./libraries/ForwardMath.sol";

/// @notice Append-only economic configuration and listed fixing series registry.
contract MarketConfig is AccessManaged {
    struct Config {
        address settlementToken;
        uint8 tokenDecimals;
        uint256 lotNotionalRaw;
        uint256 tickSizeRaw;
        uint256 minRateRaw;
        uint256 maxRateRaw;
        uint256 minStrikeRaw;
        uint256 maxStrikeRaw;
        uint16 strikeBandBps;
        uint16 initialMarginBps;
        uint16 maintenanceMarginBps;
        uint16 referenceTakerFeeBps;
        uint16 effectiveTakerFeeBps;
        uint16 circuitBreakerBps;
        uint256 maxNotionalRaw;
        uint32 maxLotsPerOrder;
        uint32 maxOrdersPerSeries;
        uint32 maxOrdersPerWallet;
        uint32 maxOrdersPerMarket;
        uint32 maxMatchBatch;
        uint32 maxScanBatch;
        uint32 maxSyncBatch;
        uint32 maxOrderLifetime;
        uint32 maxPegLifetimeRounds;
        uint32 marginGracePeriodSeconds;
        uint16 maxOffsetBps;
        bytes32 oraclePolicyHash;
        bytes32 methodologyHash;
        bytes32 feePolicyHash;
        bytes32 sponsorshipPolicyHash;
        address vault;
        address orderBook;
        address positionManager;
        address rateOracle;
    }

    struct SeriesInput {
        bytes32 marketId;
        uint64 fixingAt;
        uint64 expiryRoundId;
        uint64 oracleFailureDeadline;
        uint16 strikeBandBps;
        bytes32 calendarHash;
        bytes32 oraclePolicyHash;
    }

    struct Series {
        bytes32 marketId;
        uint64 fixingAt;
        uint64 expiryRoundId;
        uint64 oracleFailureDeadline;
        uint16 strikeBandBps;
        bytes32 calendarHash;
        bytes32 oraclePolicyHash;
        address settlementToken;
        uint64 configVersion;
        bool exists;
    }

    uint8 public constant RATE_SCALE_DECIMALS = 6;
    uint16 public constant BPS = 10_000;
    uint64 public latestVersion;
    uint64 public activeVersion;

    mapping(uint64 version => Config) private configs;
    mapping(uint64 version => bool) public versionExists;
    mapping(uint64 version => bool) public retired;
    mapping(bytes32 seriesId => Series) private seriesById;

    error InvalidConfig();
    error UnknownVersion();
    error VersionNotActive();
    error InvalidSeries();
    error DuplicateSeries();
    error InvalidSeriesId();

    event ConfigCreated(uint64 indexed version, bytes32 indexed digest);
    event VersionActivated(uint64 indexed version);
    event VersionRetired(uint64 indexed version);
    event SeriesCreated(bytes32 indexed seriesId, uint64 indexed version, bytes32 indexed marketId, uint64 fixingAt);

    constructor(address initialAuthority) AccessManaged(initialAuthority) {}

    function createVersion(Config calldata c) external restricted returns (uint64 version) {
        _validate(c);
        version = ++latestVersion;
        configs[version] = c;
        versionExists[version] = true;
        emit ConfigCreated(version, keccak256(abi.encode(c)));
    }

    /// @notice Activating a new version permanently retires the prior active version.
    function activateVersion(uint64 version) external restricted {
        if (!versionExists[version] || retired[version]) revert UnknownVersion();
        Config storage config = configs[version];
        (
            bool policyConfigured,
            bytes32 methodologyHash,
            uint128 oracleMinRate,
            uint128 oracleMaxRate,
            uint16 circuitBreakerBps
        ) =
            IRateOracle(config.rateOracle).feedPolicy(version);
        if (
            !policyConfigured || methodologyHash != config.methodologyHash
                || config.minRateRaw < oracleMinRate || config.maxRateRaw > oracleMaxRate
                || config.circuitBreakerBps != circuitBreakerBps
                || address(ICollateralVault(config.vault).settlementToken()) != config.settlementToken
        ) revert InvalidConfig();
        uint64 old = activeVersion;
        if (old != 0 && old != version) {
            retired[old] = true;
            emit VersionRetired(old);
        }
        activeVersion = version;
        emit VersionActivated(version);
    }

    /// @notice Retire the active version to stop new exposure without activating a replacement.
    function retireActiveVersion() external restricted {
        uint64 old = activeVersion;
        if (old == 0) revert UnknownVersion();
        retired[old] = true;
        activeVersion = 0;
        emit VersionRetired(old);
    }

    function addSeries(uint64 version, bytes32 seriesId, SeriesInput calldata s) external restricted {
        if (version != activeVersion || retired[version]) revert VersionNotActive();
        if (seriesId == bytes32(0)) revert InvalidSeriesId();
        if (seriesById[seriesId].exists) revert DuplicateSeries();
        Config storage c = configs[version];
        IRateOracle.ScheduledRound memory fixingSchedule =
            IRateOracle(c.rateOracle).scheduledRound(version, s.expiryRoundId);
        if (
            s.marketId == bytes32(0) || s.fixingAt <= block.timestamp || s.expiryRoundId == 0 ||
            s.oracleFailureDeadline <= s.fixingAt ||
            s.strikeBandBps == 0 || s.strikeBandBps > c.strikeBandBps ||
            s.calendarHash == bytes32(0) || s.oraclePolicyHash != c.oraclePolicyHash ||
            !fixingSchedule.configured || fixingSchedule.observationTime != s.fixingAt ||
            fixingSchedule.failureDeadline != s.oracleFailureDeadline
        ) revert InvalidSeries();
        seriesById[seriesId] = Series({
            marketId: s.marketId,
            fixingAt: s.fixingAt,
            expiryRoundId: s.expiryRoundId,
            oracleFailureDeadline: s.oracleFailureDeadline,
            strikeBandBps: s.strikeBandBps,
            calendarHash: s.calendarHash,
            oraclePolicyHash: s.oraclePolicyHash,
            settlementToken: c.settlementToken,
            configVersion: version,
            exists: true
        });
        emit SeriesCreated(seriesId, version, s.marketId, s.fixingAt);
    }

    function getConfig(uint64 version) external view returns (Config memory) {
        if (!versionExists[version]) revert UnknownVersion();
        return configs[version];
    }

    function getSeries(bytes32 seriesId) external view returns (Series memory) {
        Series memory s = seriesById[seriesId];
        if (!s.exists) revert InvalidSeriesId();
        return s;
    }

    function isVersionActive(uint64 version) external view returns (bool) {
        return version == activeVersion && version != 0 && !retired[version];
    }

    function _validate(Config calldata c) private view {
        if (
            c.settlementToken == address(0) || c.tokenDecimals != 6 ||
            c.lotNotionalRaw == 0 || c.tickSizeRaw == 0 ||
            c.minRateRaw == 0 || c.maxRateRaw < c.minRateRaw ||
            c.minStrikeRaw == 0 || c.maxStrikeRaw < c.minStrikeRaw ||
            c.strikeBandBps == 0 || c.strikeBandBps > BPS ||
            c.initialMarginBps == 0 || c.maintenanceMarginBps == 0 ||
            c.initialMarginBps <= c.maintenanceMarginBps || c.initialMarginBps > BPS ||
            c.referenceTakerFeeBps > BPS || c.effectiveTakerFeeBps > c.referenceTakerFeeBps ||
            c.circuitBreakerBps == 0 || c.circuitBreakerBps > BPS ||
            c.maxNotionalRaw < c.lotNotionalRaw || c.maxNotionalRaw % c.lotNotionalRaw != 0 ||
            c.maxLotsPerOrder == 0 || c.maxLotsPerOrder > c.maxNotionalRaw / c.lotNotionalRaw ||
            c.maxOrdersPerSeries == 0 || c.maxOrdersPerWallet == 0 ||
            c.maxOrdersPerMarket < c.maxOrdersPerSeries || c.maxMatchBatch == 0 ||
            c.maxScanBatch < c.maxOrdersPerSeries ||
            c.maxSyncBatch == 0 ||
            c.maxOrderLifetime == 0 || c.maxPegLifetimeRounds == 0 ||
            c.marginGracePeriodSeconds == 0 ||
            c.maxOffsetBps > BPS || c.oraclePolicyHash == bytes32(0) || c.methodologyHash == bytes32(0) ||
            c.feePolicyHash == bytes32(0) || c.sponsorshipPolicyHash == bytes32(0) ||
            c.vault == address(0) || c.orderBook == address(0) ||
            c.positionManager == address(0) || c.rateOracle == address(0)
        ) revert InvalidConfig();
        if (
            c.maxRateRaw > type(uint128).max || c.maxStrikeRaw > type(uint128).max
                || c.maxNotionalRaw > uint256(type(int256).max)
        ) revert InvalidConfig();
        int256 worstBuyerLoss = ForwardMath.buyerValue(c.maxNotionalRaw, c.minRateRaw, c.maxStrikeRaw);
        int256 worstBuyerGain = ForwardMath.buyerValue(c.maxNotionalRaw, c.maxRateRaw, c.minStrikeRaw);
        if (ForwardMath.abs(worstBuyerLoss) + ForwardMath.abs(worstBuyerGain) > uint256(type(int256).max)) {
            revert InvalidConfig();
        }
        if (c.settlementToken.code.length == 0 || IERC20Metadata(c.settlementToken).decimals() != 6) {
            revert InvalidConfig();
        }
        if (
            c.vault.code.length == 0 || c.orderBook.code.length == 0 || c.positionManager.code.length == 0
                || c.rateOracle.code.length == 0
        ) revert InvalidConfig();
    }
}
