import {
  createPublicClient,
  getAddress,
  http,
  isAddress,
  type Address,
  type PublicClient,
} from 'viem';
import {ceilBps} from '@/domain';
import {
  collateralVaultAbi,
  erc20Abi,
  marketConfigReadAbi,
  mockUsdcAbi,
  orderBookReadAbi,
  orderPlacedEvent,
  positionCreatedEvent,
  positionManagerAbi,
  rateOracleReadAbi,
} from './abis';
import {protocolReadConfig} from './config';
import {ProtocolReadConfigurationError} from './orderBook';

const LOG_BLOCK_RANGE = 1_000n;
const LOG_QUERY_CONCURRENCY = 8;
const REORG_RESCAN_BLOCKS = 64n;

const ORDER_STATUS = ['unknown', 'active', 'filled', 'cancelled', 'expired', 'invalidated'] as const;
const POSITION_STATUS = [
  'unknown',
  'active',
  'awaiting_final_fixing',
  'matured',
  'liquidated',
  'defaulted',
  'oracle_closed',
] as const;

interface ChainOrder {
  owner: Address;
  seriesId: `0x${string}`;
  configVersion: bigint;
  validUntil: bigint;
  reservePerLotRaw: bigint;
  feeEscrowRemaining: bigint;
  lotsTotal: number;
  lotsFilled: number;
  side: number;
  priceType: number;
  status: number;
}

interface ChainOrderLedger {
  collateral: bigint;
  feeEscrow: bigint;
}

interface ChainPosition {
  buyer: Address;
  seller: Address;
  seriesId: `0x${string}`;
  configVersion: bigint;
  entryRoundId: bigint;
  lastRoundId: bigint;
  buyerCallDeadline: bigint;
  sellerCallDeadline: bigint;
  strikeRaw: bigint;
  notionalRaw: bigint;
  lastValue: bigint;
  unpaidShortfall: bigint;
  status: number;
}

interface ChainPositionLedger {
  buyerCollateral: bigint;
  sellerCollateral: bigint;
  active: boolean;
}

interface PositionHistoryRecord {
  positionId: bigint;
  buyer: Address;
  seller: Address;
  blockNumber: bigint;
}

interface OrderHistoryRecord {
  orderId: bigint;
  blockNumber: bigint;
}

let positionHistoryCache: {throughBlock: bigint; records: PositionHistoryRecord[]} | undefined;
const orderHistoryCache = new Map<string, {throughBlock: bigint; records: OrderHistoryRecord[]}>();

export interface MarketMakerOrderView {
  orderId: bigint;
  seriesId: `0x${string}`;
  configVersion: bigint;
  side: 'buyer' | 'seller';
  priceType: 'fixed' | 'pegged';
  status: string;
  lotsTotal: number;
  lotsFilled: number;
  lotsRemaining: number;
  validUntil: bigint;
  collateralReservedRaw: bigint;
  feeEscrowRaw: bigint;
}

export interface MarketMakerPositionView {
  positionId: bigint;
  seriesId: `0x${string}`;
  configVersion: bigint;
  buyer: Address;
  seller: Address;
  counterparty: Address;
  side: 'buyer' | 'seller';
  status: string;
  notionalRaw: bigint;
  strikeRaw: bigint;
  latestReferenceRateRaw: bigint;
  fixingAt: bigint;
  expiryRoundId: bigint;
  equityRaw: bigint;
  counterpartyEquityRaw: bigint;
  lastValueRaw: bigint;
  initialMarginRaw: bigint;
  maintenanceMarginRaw: bigint;
  cureAmountRaw: bigint;
  marginCallDeadline: bigint;
  unsettledRounds: bigint;
  lastRoundId: bigint;
  latestRoundId: bigint;
  retainedGainRaw: bigint;
  unpaidShortfall: bigint;
  maxSyncBatch: number;
}

export interface MarketMakerPortfolioSnapshot {
  owner: Address;
  blockNumber: bigint;
  blockHash: `0x${string}`;
  blockTimestamp: bigint;
  deploymentId: string;
  nativeBalanceRaw: bigint;
  walletBalanceRaw: bigint;
  faucetMintedRaw: bigint;
  faucetCapRaw: bigint;
  vaultAllowanceRaw: bigint;
  claimableRaw: bigint;
  reservedOrderCollateralRaw: bigint;
  reservedFeeEscrowRaw: bigint;
  reservedOrdersRaw: bigint;
  lockedPositionsRaw: bigint;
  openOrderNotionalRaw: bigint;
  livePositionNotionalRaw: bigint;
  marginCallCount: number;
  orders: MarketMakerOrderView[];
  positions: MarketMakerPositionView[];
  fetchedAt: number;
}

async function readOwnerHistory(
  client: PublicClient,
  owner: Address,
  fromBlock: bigint,
  toBlock: bigint,
) {
  const ranges = (startBlock: bigint) => {
    const result: Array<{start: bigint; end: bigint}> = [];
    for (let start = startBlock; start <= toBlock; start += LOG_BLOCK_RANGE) {
      result.push({
        start,
        end: start + LOG_BLOCK_RANGE - 1n > toBlock ? toBlock : start + LOG_BLOCK_RANGE - 1n,
      });
    }
    return result;
  };

  const ownerKey = owner.toLowerCase();
  const existingOrders = orderHistoryCache.get(ownerKey);
  const orderScanFrom = existingOrders
    ? existingOrders.throughBlock - REORG_RESCAN_BLOCKS + 1n > fromBlock
      ? existingOrders.throughBlock - REORG_RESCAN_BLOCKS + 1n
      : fromBlock
    : fromBlock;
  const orderRecords = existingOrders
    ? existingOrders.records.filter((record) => record.blockNumber < orderScanFrom)
    : [];

  const positionScanFrom = positionHistoryCache
    ? positionHistoryCache.throughBlock - REORG_RESCAN_BLOCKS + 1n > fromBlock
      ? positionHistoryCache.throughBlock - REORG_RESCAN_BLOCKS + 1n
      : fromBlock
    : fromBlock;
  const positionRecords = positionHistoryCache
    ? positionHistoryCache.records.filter((record) => record.blockNumber < positionScanFrom)
    : [];

  const [orderRanges, positionRanges] = [ranges(orderScanFrom), ranges(positionScanFrom)];
  const batchCount = Math.max(orderRanges.length, positionRanges.length);
  for (let index = 0; index < batchCount; index += LOG_QUERY_CONCURRENCY) {
    const [orderPages, positionPages] = await Promise.all([
      Promise.all(orderRanges.slice(index, index + LOG_QUERY_CONCURRENCY).map(({start, end}) => (
        client.getLogs({
          address: protocolReadConfig.orderBookAddress,
          event: orderPlacedEvent,
          args: {owner},
          fromBlock: start,
          toBlock: end,
          strict: true,
        })
      ))),
      Promise.all(positionRanges.slice(index, index + LOG_QUERY_CONCURRENCY).map(({start, end}) => (
        client.getLogs({
          address: protocolReadConfig.positionManagerAddress,
          event: positionCreatedEvent,
          fromBlock: start,
          toBlock: end,
          strict: true,
        })
      ))),
    ]);
    for (const page of orderPages) {
      for (const log of page) orderRecords.push({orderId: log.args.orderId, blockNumber: log.blockNumber});
    }
    for (const page of positionPages) {
      for (const log of page) {
        positionRecords.push({
          positionId: log.args.positionId,
          buyer: log.args.buyer,
          seller: log.args.seller,
          blockNumber: log.blockNumber,
        });
      }
    }
  }
  orderHistoryCache.set(ownerKey, {throughBlock: toBlock, records: orderRecords});
  positionHistoryCache = {throughBlock: toBlock, records: positionRecords};
  return {
    orderIds: [...new Set(orderRecords.map((record) => record.orderId))],
    positionIds: [...new Set(positionRecords
      .filter((record) => record.buyer.toLowerCase() === ownerKey || record.seller.toLowerCase() === ownerKey)
      .map((record) => record.positionId))],
  };
}

function maxZero(value: bigint) {
  return value > 0n ? value : 0n;
}

export async function loadMarketMakerPortfolio(ownerInput: string): Promise<MarketMakerPortfolioSnapshot> {
  if (!isAddress(ownerInput)) throw new Error('Enter a valid EVM wallet address.');
  const owner = getAddress(ownerInput);
  const {
    chain,
    deploymentBlock,
    marketConfigAddress,
    orderBookAddress,
    positionManagerAddress,
    rateOracleAddress,
    rpcUrl,
    settlementTokenAddress,
    vaultAddress,
  } = protocolReadConfig;
  const missing = [...protocolReadConfig.missing];
  if (!settlementTokenAddress) missing.push('settlement token address');
  if (!vaultAddress) missing.push('CollateralVault address');
  if (!positionManagerAddress) missing.push('PositionManager address');
  if (
    missing.length > 0 || !chain || !deploymentBlock || !marketConfigAddress
      || !orderBookAddress || !positionManagerAddress || !rateOracleAddress || !rpcUrl
      || !settlementTokenAddress || !vaultAddress
  ) {
    throw new ProtocolReadConfigurationError(missing);
  }

  const client = createPublicClient({chain, transport: http(rpcUrl, {timeout: 12_000})});
  const blockNumber = await client.getBlockNumber();
  const [block, latestVersion] = await Promise.all([
    client.getBlock({blockNumber}),
    client.readContract({
      address: marketConfigAddress,
      abi: marketConfigReadAbi,
      functionName: 'latestVersion',
      blockNumber,
    }),
  ]);
  const history = latestVersion !== 0n && blockNumber >= deploymentBlock
    ? await readOwnerHistory(client, owner, deploymentBlock, blockNumber)
    : {orderIds: [], positionIds: []};

  const [nativeBalanceRaw, walletBalanceRaw, faucetMintedRaw, faucetCapRaw, vaultAllowanceRaw, claimableRaw, orders, orderLedgers, positionResults] = await Promise.all([
    client.getBalance({address: owner, blockNumber}),
    client.readContract({
      address: settlementTokenAddress,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [owner],
      blockNumber,
    }),
    client.readContract({
      address: settlementTokenAddress,
      abi: mockUsdcAbi,
      functionName: 'faucetMinted',
      args: [owner],
      blockNumber,
    }),
    client.readContract({
      address: settlementTokenAddress,
      abi: mockUsdcAbi,
      functionName: 'FAUCET_CAP_PER_ADDRESS',
      blockNumber,
    }),
    client.readContract({
      address: settlementTokenAddress,
      abi: erc20Abi,
      functionName: 'allowance',
      args: [owner, vaultAddress],
      blockNumber,
    }),
    client.readContract({
      address: vaultAddress,
      abi: collateralVaultAbi,
      functionName: 'claimable',
      args: [owner],
      blockNumber,
    }),
    Promise.all(history.orderIds.map((orderId) => (
      client.readContract({
        address: orderBookAddress,
        abi: orderBookReadAbi,
        functionName: 'getOrder',
        args: [orderId],
        blockNumber,
      })
    ))),
    Promise.all(history.orderIds.map((orderId) => (
      client.readContract({
        address: vaultAddress,
        abi: collateralVaultAbi,
        functionName: 'orderLedger',
        args: [orderId],
        blockNumber,
      })
    ))),
    Promise.all(history.positionIds.map((positionId) => (
      client.readContract({
        address: positionManagerAddress,
        abi: positionManagerAbi,
        functionName: 'getPosition',
        args: [positionId],
        blockNumber,
      })
    ))),
  ]);

  const versions = new Set<bigint>();
  const seriesIds = new Set<`0x${string}`>();
  for (const order of orders) versions.add((order as ChainOrder).configVersion);
  for (const result of positionResults) {
    const position = result[0] as ChainPosition;
    versions.add(position.configVersion);
    seriesIds.add(position.seriesId);
  }
  const versionList = [...versions];
  const seriesIdList = [...seriesIds];
  const [configs, rounds, seriesResults] = await Promise.all([
    Promise.all(versionList.map((version) => (
      client.readContract({
        address: marketConfigAddress,
        abi: marketConfigReadAbi,
        functionName: 'getConfig',
        args: [version],
        blockNumber,
      })
    ))),
    Promise.all(versionList.map((version) => (
      client.readContract({
        address: rateOracleAddress,
        abi: rateOracleReadAbi,
        functionName: 'latestFinalizedRound',
        args: [version],
        blockNumber,
      })
    ))),
    Promise.all(seriesIdList.map((seriesId) => (
      client.readContract({
        address: marketConfigAddress,
        abi: marketConfigReadAbi,
        functionName: 'getSeries',
        args: [seriesId],
        blockNumber,
      })
    ))),
  ]);
  const versionData = new Map(versionList.map((version, index) => [version, {
    config: configs[index],
    round: rounds[index],
  }]));
  const seriesData = new Map(seriesIdList.map((seriesId, index) => [seriesId, seriesResults[index]]));

  const orderViews = history.orderIds.map((orderId, index): MarketMakerOrderView => {
    const order = orders[index] as ChainOrder;
    const ledger = orderLedgers[index] as ChainOrderLedger;
    return {
      orderId,
      seriesId: order.seriesId,
      configVersion: order.configVersion,
      side: order.side === 0 ? 'buyer' : 'seller',
      priceType: order.priceType === 0 ? 'fixed' : 'pegged',
      status: ORDER_STATUS[order.status] ?? 'unknown',
      lotsTotal: order.lotsTotal,
      lotsFilled: order.lotsFilled,
      lotsRemaining: order.lotsTotal - order.lotsFilled,
      validUntil: order.validUntil,
      collateralReservedRaw: ledger.collateral,
      feeEscrowRaw: ledger.feeEscrow,
    };
  });

  const positionViews = history.positionIds.map((positionId, index): MarketMakerPositionView => {
    const [positionValue, ledgerValue] = positionResults[index] as unknown as readonly [
      ChainPosition,
      ChainPositionLedger,
    ];
    const data = versionData.get(positionValue.configVersion);
    if (!data?.config || !data.round) throw new Error('Position configuration could not be reconciled.');
    const config = data.config;
    const round = data.round;
    const series = seriesData.get(positionValue.seriesId);
    if (!series?.exists) throw new Error('Position series could not be reconciled.');
    const buyerSide = positionValue.buyer.toLowerCase() === owner.toLowerCase();
    const equityRaw = buyerSide ? ledgerValue.buyerCollateral : ledgerValue.sellerCollateral;
    const counterpartyEquityRaw = buyerSide ? ledgerValue.sellerCollateral : ledgerValue.buyerCollateral;
    const lots = positionValue.notionalRaw / config.lotNotionalRaw;
    const initialMarginRaw = ceilBps(config.lotNotionalRaw, BigInt(config.initialMarginBps)) * lots;
    const maintenanceMarginRaw = ceilBps(config.lotNotionalRaw, BigInt(config.maintenanceMarginBps)) * lots;
    const status = POSITION_STATUS[positionValue.status] ?? 'unknown';
    const live = status === 'active' || status === 'awaiting_final_fixing';
    const marginCallDeadline = status === 'active'
      ? buyerSide ? positionValue.buyerCallDeadline : positionValue.sellerCallDeadline
      : 0n;
    return {
      positionId,
      seriesId: positionValue.seriesId,
      configVersion: positionValue.configVersion,
      buyer: positionValue.buyer,
      seller: positionValue.seller,
      counterparty: buyerSide ? positionValue.seller : positionValue.buyer,
      side: buyerSide ? 'buyer' : 'seller',
      status,
      notionalRaw: config.lotNotionalRaw * lots,
      strikeRaw: positionValue.strikeRaw,
      latestReferenceRateRaw: round.rateRaw,
      fixingAt: series.fixingAt,
      expiryRoundId: series.expiryRoundId,
      equityRaw,
      counterpartyEquityRaw,
      lastValueRaw: positionValue.lastValue,
      initialMarginRaw,
      maintenanceMarginRaw,
      cureAmountRaw: marginCallDeadline === 0n ? 0n : maxZero(initialMarginRaw - equityRaw),
      marginCallDeadline,
      unsettledRounds: live ? maxZero(round.roundId - positionValue.lastRoundId) : 0n,
      lastRoundId: positionValue.lastRoundId,
      latestRoundId: round.roundId,
      retainedGainRaw: maxZero(equityRaw - initialMarginRaw),
      unpaidShortfall: positionValue.unpaidShortfall,
      maxSyncBatch: config.maxSyncBatch,
    };
  });

  const reservedOrderCollateralRaw = orderViews.reduce(
    (total, order) => total + order.collateralReservedRaw,
    0n,
  );
  const reservedFeeEscrowRaw = orderViews.reduce(
    (total, order) => total + order.feeEscrowRaw,
    0n,
  );
  const reservedOrdersRaw = reservedOrderCollateralRaw + reservedFeeEscrowRaw;
  const lockedPositionsRaw = positionViews.reduce((total, position) => total + position.equityRaw, 0n);
  const openOrderNotionalRaw = orderViews.reduce((total, order) => {
    if (order.status !== 'active') return total;
    const positionConfig = versionData.get(order.configVersion)?.config;
    return positionConfig
      ? total + positionConfig.lotNotionalRaw * BigInt(order.lotsRemaining)
      : total;
  }, 0n);
  const livePositionNotionalRaw = positionViews.reduce((total, position) => (
    position.status === 'active' || position.status === 'awaiting_final_fixing'
      ? total + position.notionalRaw
      : total
  ), 0n);

  return {
    owner,
    blockNumber,
    blockHash: block.hash,
    blockTimestamp: block.timestamp,
    deploymentId: protocolReadConfig.deploymentId,
    nativeBalanceRaw,
    walletBalanceRaw,
    faucetMintedRaw,
    faucetCapRaw,
    vaultAllowanceRaw,
    claimableRaw,
    reservedOrderCollateralRaw,
    reservedFeeEscrowRaw,
    reservedOrdersRaw,
    lockedPositionsRaw,
    openOrderNotionalRaw,
    livePositionNotionalRaw,
    marginCallCount: positionViews.filter((position) => position.marginCallDeadline !== 0n).length,
    orders: orderViews.sort((left, right) => left.orderId > right.orderId ? -1 : left.orderId < right.orderId ? 1 : 0),
    positions: positionViews.sort((left, right) => left.positionId > right.positionId ? -1 : left.positionId < right.positionId ? 1 : 0),
    fetchedAt: Date.now(),
  };
}
