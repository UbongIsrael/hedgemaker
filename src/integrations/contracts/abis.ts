import {parseAbi, parseAbiItem} from 'viem';

export const seriesCreatedEvent = parseAbiItem(
  'event SeriesCreated(bytes32 indexed seriesId, uint64 indexed version, bytes32 indexed marketId, uint64 fixingAt)',
);

export const marketConfigReadAbi = parseAbi([
  'function activeVersion() view returns (uint64)',
  'function getConfig(uint64 version) view returns ((address settlementToken, uint8 tokenDecimals, uint256 lotNotionalRaw, uint256 tickSizeRaw, uint256 minRateRaw, uint256 maxRateRaw, uint256 minStrikeRaw, uint256 maxStrikeRaw, uint16 strikeBandBps, uint16 initialMarginBps, uint16 maintenanceMarginBps, uint16 referenceTakerFeeBps, uint16 effectiveTakerFeeBps, uint16 circuitBreakerBps, uint256 maxNotionalRaw, uint32 maxLotsPerOrder, uint32 maxOrdersPerSeries, uint32 maxOrdersPerWallet, uint32 maxOrdersPerMarket, uint32 maxMatchBatch, uint32 maxScanBatch, uint32 maxSyncBatch, uint32 maxOrderLifetime, uint32 maxPegLifetimeRounds, uint32 marginGracePeriodSeconds, uint16 maxOffsetBps, bytes32 oraclePolicyHash, bytes32 methodologyHash, bytes32 feePolicyHash, bytes32 sponsorshipPolicyHash, address vault, address orderBook, address positionManager, address rateOracle) config)',
]);

export const orderBookReadAbi = parseAbi([
  'function activeOrderIds(bytes32 seriesId) view returns (uint256[])',
  'function getOrder(uint256 orderId) view returns ((address owner, bytes32 intentId, bytes32 marketId, bytes32 seriesId, uint64 configVersion, uint64 sequence, uint64 validUntil, uint64 boundRoundId, uint64 lastExecutableRoundId, uint128 limitStrikeRaw, uint128 reservePerLotRaw, uint128 feeEscrowRemaining, uint128 cumulativeTakerNotional, uint32 lotsTotal, uint32 lotsFilled, int16 offsetBps, uint8 side, uint8 priceType, uint8 timeInForce, uint8 status) order)',
  'function newRiskPaused() view returns (bool)',
  'function previewEffectiveLimit(uint256 orderId) view returns (uint256 priceRaw, bool executable)',
]);

export const rateOracleReadAbi = parseAbi([
  'function latestFinalizedRound(uint64 configVersion) view returns ((uint64 roundId, uint64 observationTime, uint64 finalizedAt, uint128 rateRaw, bytes32 candidateId, bytes32 sourceHash) round)',
]);
