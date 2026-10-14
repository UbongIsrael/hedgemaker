import {parseAbi, parseAbiItem} from 'viem';

export const seriesCreatedEvent = parseAbiItem(
  'event SeriesCreated(bytes32 indexed seriesId, uint64 indexed version, bytes32 indexed marketId, uint64 fixingAt)',
);

export const orderPlacedEvent = parseAbiItem(
  'event OrderPlaced(uint256 indexed orderId, address indexed owner, bytes32 indexed seriesId, uint8 side, uint8 priceType, uint32 lots, uint128 reservePerLotRaw, uint128 feeEscrow, uint64 sequence)',
);

export const positionCreatedEvent = parseAbiItem(
  'event PositionCreated(uint256 indexed positionId, uint256 indexed buyerOrderId, uint256 indexed sellerOrderId, address buyer, address seller, bytes32 seriesId, uint64 configVersion, uint64 entryRoundId, uint32 lots, uint128 strikeRaw, int256 entryValue)',
);

export const marketConfigReadAbi = parseAbi([
  'function activeVersion() view returns (uint64)',
  'function latestVersion() view returns (uint64)',
  'function getConfig(uint64 version) view returns ((address settlementToken, uint8 tokenDecimals, uint256 lotNotionalRaw, uint256 tickSizeRaw, uint256 minRateRaw, uint256 maxRateRaw, uint256 minStrikeRaw, uint256 maxStrikeRaw, uint16 strikeBandBps, uint16 initialMarginBps, uint16 maintenanceMarginBps, uint16 referenceTakerFeeBps, uint16 effectiveTakerFeeBps, uint16 circuitBreakerBps, uint256 maxNotionalRaw, uint32 maxLotsPerOrder, uint32 maxOrdersPerSeries, uint32 maxOrdersPerWallet, uint32 maxOrdersPerMarket, uint32 maxMatchBatch, uint32 maxScanBatch, uint32 maxSyncBatch, uint32 maxOrderLifetime, uint32 maxPegLifetimeRounds, uint32 marginGracePeriodSeconds, uint16 maxOffsetBps, bytes32 oraclePolicyHash, bytes32 methodologyHash, bytes32 feePolicyHash, bytes32 sponsorshipPolicyHash, address vault, address orderBook, address positionManager, address rateOracle) config)',
  'function getSeries(bytes32 seriesId) view returns ((bytes32 marketId, uint64 fixingAt, uint64 expiryRoundId, uint64 oracleFailureDeadline, uint16 strikeBandBps, bytes32 calendarHash, bytes32 oraclePolicyHash, address settlementToken, uint64 configVersion, bool exists) series)',
]);

export const orderBookReadAbi = parseAbi([
  'function activeOrderIds(bytes32 seriesId) view returns (uint256[])',
  'function getOrder(uint256 orderId) view returns ((address owner, bytes32 intentId, bytes32 marketId, bytes32 seriesId, uint64 configVersion, uint64 sequence, uint64 validUntil, uint64 boundRoundId, uint64 lastExecutableRoundId, uint128 limitStrikeRaw, uint128 reservePerLotRaw, uint128 feeEscrowRemaining, uint128 cumulativeTakerNotional, uint32 lotsTotal, uint32 lotsFilled, int16 offsetBps, uint8 side, uint8 priceType, uint8 timeInForce, uint8 status) order)',
  'function newRiskPaused() view returns (bool)',
  'function previewEffectiveLimit(uint256 orderId) view returns (uint256 priceRaw, bool executable)',
  'function placeOrder((bytes32 intentId, bytes32 seriesId, uint8 side, uint8 priceType, uint8 timeInForce, uint32 lots, uint32 minimumImmediateFillLots, uint64 validUntil, uint64 submitBy, uint64 boundRoundId, uint64 lastExecutableRoundId, uint128 limitStrikeRaw, uint128 maxTokenPullRaw, int16 offsetBps) params) returns (uint256 orderId)',
  'function cancelOrder(uint256 orderId)',
  'function matchOrders(bytes32 seriesId, uint32 maxPairs) returns (uint32 pairsProcessed)',
  'function expireOrder(uint256 orderId)',
  'function invalidateOrder(uint256 orderId)',
]);

export const rateOracleReadAbi = parseAbi([
  'function latestFinalizedRound(uint64 configVersion) view returns ((uint64 roundId, uint64 observationTime, uint64 finalizedAt, uint128 rateRaw, bytes32 candidateId, bytes32 sourceHash) round)',
  'function feedStatus(uint64 configVersion) view returns (uint8)',
  'function isTradingOpen(uint64 configVersion) view returns (bool)',
]);

export const positionManagerAbi = parseAbi([
  'function getPosition(uint256 positionId) view returns ((address buyer, address seller, bytes32 seriesId, uint64 configVersion, uint64 entryRoundId, uint64 lastRoundId, uint64 buyerCallDeadline, uint64 sellerCallDeadline, uint128 strikeRaw, uint256 notionalRaw, int256 lastValue, uint256 unpaidShortfall, uint8 status) position, (address buyer, address seller, uint256 buyerCollateral, uint256 sellerCollateral, bool active) ledger)',
  'function syncPosition(uint256 positionId, uint32 maxRounds) returns (uint32 processed)',
  'function settleRounds(uint256 positionId, uint32 maxRounds) returns (uint32 processed)',
  'function addMargin(uint256 positionId, bool buyerSide, uint256 amount, uint32 maxSyncRounds)',
  'function liquidate(uint256 positionId, uint32 maxSyncRounds)',
]);

export const collateralVaultAbi = parseAbi([
  'function claimable(address owner) view returns (uint256)',
  'function orderLedger(uint256 orderId) view returns ((address owner, uint256 collateral, uint256 feeEscrow) ledger)',
  'function withdrawClaimable(uint256 amount)',
]);

export const erc20Abi = parseAbi([
  'function balanceOf(address owner) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
]);

export const mockUsdcAbi = parseAbi([
  'function claimFaucet(uint256 amount)',
  'function faucetMinted(address owner) view returns (uint256)',
  'function FAUCET_CAP_PER_ADDRESS() view returns (uint256)',
]);
