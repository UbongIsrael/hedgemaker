import {
  createPublicClient,
  http,
  type Hex,
  type PublicClient,
} from 'viem';
import {
  marketConfigReadAbi,
  orderBookReadAbi,
  rateOracleReadAbi,
  seriesCreatedEvent,
} from './abis';
import {protocolReadConfig} from './config';

const LOG_BLOCK_RANGE = 1_000n;
const LOG_QUERY_CONCURRENCY = 8;
const REORG_RESCAN_BLOCKS = 64n;

type BookSide = 'buyer' | 'seller';

interface SeriesEventRecord {
  seriesId: Hex;
  version: bigint;
  marketId: Hex;
  fixingAt: bigint;
  blockNumber: bigint;
}

let seriesEventCache: {throughBlock: bigint; records: SeriesEventRecord[]} | undefined;

export interface BookEntry {
  side: BookSide;
  strikeRaw: bigint;
  remainingLots: bigint;
  lotNotionalRaw: bigint;
}

export interface LiveBookLevel {
  strikeRaw: bigint;
  buyerNotionalRaw: bigint;
  sellerNotionalRaw: bigint;
  cumulativeBuyerNotionalRaw: bigint;
  cumulativeSellerNotionalRaw: bigint;
  buyerOrderCount: number;
  sellerOrderCount: number;
}

export interface LiveSeriesSummary {
  seriesId: Hex;
  marketId: Hex;
  configVersion: bigint;
  fixingAt: bigint;
  expiryRoundId: bigint;
  oracleFailureDeadline: bigint;
  strikeBandBps: number;
}

export interface LiveMarketConfig {
  lotNotionalRaw: bigint;
  tickSizeRaw: bigint;
  minStrikeRaw: bigint;
  maxStrikeRaw: bigint;
  initialMarginBps: number;
  maintenanceMarginBps: number;
  effectiveTakerFeeBps: number;
  maxLotsPerOrder: number;
  maxMatchBatch: number;
  maxScanBatch: number;
  maxSyncBatch: number;
  maxOrderLifetime: number;
  maxPegLifetimeRounds: number;
  marginGracePeriodSeconds: number;
  maxOffsetBps: number;
}

export interface LiveOrderBookSnapshot {
  activeVersion: bigint;
  blockNumber: bigint;
  blockTimestamp: bigint;
  deploymentId: string;
  series: LiveSeriesSummary[];
  selectedSeries?: LiveSeriesSummary;
  levels: LiveBookLevel[];
  lotNotionalRaw?: bigint;
  tickSizeRaw?: bigint;
  roundId?: bigint;
  referenceRateRaw?: bigint;
  oracleFeedStatus?: number;
  tradingOpen: boolean;
  matchingPaused: boolean;
  config?: LiveMarketConfig;
  activeOrderCount: number;
  inactiveOrderCount: number;
  fetchedAt: number;
}

interface ChainOrder {
  lotsTotal: number;
  lotsFilled: number;
  side: number;
  status: number;
}

export class ProtocolReadConfigurationError extends Error {
  readonly missing: string[];

  constructor(missing: string[]) {
    super('Live protocol reads are not configured.');
    this.name = 'ProtocolReadConfigurationError';
    this.missing = missing;
  }
}

export function aggregateBookLevels(entries: BookEntry[]): LiveBookLevel[] {
  const byStrike = new Map<bigint, Omit<LiveBookLevel, 'cumulativeBuyerNotionalRaw' | 'cumulativeSellerNotionalRaw'>>();

  for (const entry of entries) {
    if (entry.remainingLots <= 0n || entry.lotNotionalRaw <= 0n) continue;
    const current = byStrike.get(entry.strikeRaw) ?? {
      strikeRaw: entry.strikeRaw,
      buyerNotionalRaw: 0n,
      sellerNotionalRaw: 0n,
      buyerOrderCount: 0,
      sellerOrderCount: 0,
    };
    const notional = entry.remainingLots * entry.lotNotionalRaw;
    if (entry.side === 'buyer') {
      current.buyerNotionalRaw += notional;
      current.buyerOrderCount += 1;
    } else {
      current.sellerNotionalRaw += notional;
      current.sellerOrderCount += 1;
    }
    byStrike.set(entry.strikeRaw, current);
  }

  const levels = [...byStrike.values()]
    .sort((left, right) => left.strikeRaw > right.strikeRaw ? -1 : left.strikeRaw < right.strikeRaw ? 1 : 0)
    .map((level) => ({
      ...level,
      cumulativeBuyerNotionalRaw: 0n,
      cumulativeSellerNotionalRaw: 0n,
    }));

  let buyerDepth = 0n;
  for (const level of levels) {
    buyerDepth += level.buyerNotionalRaw;
    level.cumulativeBuyerNotionalRaw = buyerDepth;
  }

  let sellerDepth = 0n;
  for (let index = levels.length - 1; index >= 0; index -= 1) {
    const level = levels[index];
    if (!level) continue;
    sellerDepth += level.sellerNotionalRaw;
    level.cumulativeSellerNotionalRaw = sellerDepth;
  }

  return levels;
}

async function readSeriesCreatedLogs(
  client: PublicClient,
  fromBlock: bigint,
  toBlock: bigint,
) : Promise<SeriesEventRecord[]> {
  if (toBlock < fromBlock) return [];
  if (seriesEventCache && toBlock <= seriesEventCache.throughBlock) {
    return seriesEventCache.records.filter((record) => record.blockNumber <= toBlock);
  }
  const scanFrom = seriesEventCache
    ? seriesEventCache.throughBlock - REORG_RESCAN_BLOCKS + 1n > fromBlock
      ? seriesEventCache.throughBlock - REORG_RESCAN_BLOCKS + 1n
      : fromBlock
    : fromBlock;
  const records = seriesEventCache
    ? seriesEventCache.records.filter((record) => record.blockNumber < scanFrom)
    : [];
  const ranges: Array<{start: bigint; end: bigint}> = [];
  for (let start = scanFrom; start <= toBlock; start += LOG_BLOCK_RANGE) {
    ranges.push({
      start,
      end: start + LOG_BLOCK_RANGE - 1n > toBlock ? toBlock : start + LOG_BLOCK_RANGE - 1n,
    });
  }
  for (let index = 0; index < ranges.length; index += LOG_QUERY_CONCURRENCY) {
    const pages = await Promise.all(ranges.slice(index, index + LOG_QUERY_CONCURRENCY).map(({start, end}) => (
      client.getLogs({
        address: protocolReadConfig.marketConfigAddress,
        event: seriesCreatedEvent,
        fromBlock: start,
        toBlock: end,
        strict: true,
      })
    )));
    for (const page of pages) {
      for (const log of page) {
        records.push({...log.args, blockNumber: log.blockNumber});
      }
    }
  }
  seriesEventCache = {throughBlock: toBlock, records};
  return records;
}

export async function loadLiveOrderBook(selectedSeriesId?: Hex): Promise<LiveOrderBookSnapshot> {
  const {
    chain,
    deploymentBlock,
    marketConfigAddress,
    orderBookAddress,
    rateOracleAddress,
    rpcUrl,
  } = protocolReadConfig;
  if (
    !protocolReadConfig.isConfigured || !chain || !deploymentBlock || !marketConfigAddress
      || !orderBookAddress || !rateOracleAddress || !rpcUrl
  ) {
    throw new ProtocolReadConfigurationError(protocolReadConfig.missing);
  }

  const client = createPublicClient({chain, transport: http(rpcUrl, {timeout: 12_000})});
  const blockNumber = await client.getBlockNumber();
  const [block, activeVersion] = await Promise.all([
    client.getBlock({blockNumber}),
    client.readContract({
      address: marketConfigAddress,
      abi: marketConfigReadAbi,
      functionName: 'activeVersion',
      blockNumber,
    }),
  ]);

  const emptySnapshot = (series: LiveSeriesSummary[] = []): LiveOrderBookSnapshot => ({
    activeVersion,
    blockNumber,
    blockTimestamp: block.timestamp,
    deploymentId: protocolReadConfig.deploymentId,
    series,
    levels: [],
    tradingOpen: false,
    matchingPaused: false,
    activeOrderCount: 0,
    inactiveOrderCount: 0,
    fetchedAt: Date.now(),
  });

  if (activeVersion === 0n || blockNumber < deploymentBlock) return emptySnapshot();

  const logs = await readSeriesCreatedLogs(client, deploymentBlock, blockNumber);
  const seriesById = new Map<Hex, LiveSeriesSummary>();
  for (const log of logs) {
    const {fixingAt, marketId, seriesId, version} = log;
    if (version !== activeVersion || fixingAt <= block.timestamp) continue;
    seriesById.set(seriesId, {
      seriesId,
      marketId,
      configVersion: version,
      fixingAt,
      expiryRoundId: 0n,
      oracleFailureDeadline: 0n,
      strikeBandBps: 0,
    });
  }
  const seriesSummaries = [...seriesById.values()].sort((left, right) => (
    left.fixingAt < right.fixingAt ? -1 : left.fixingAt > right.fixingAt ? 1 : 0
  ));
  if (seriesSummaries.length === 0) return emptySnapshot();
  const seriesRecords = await Promise.all(seriesSummaries.map((item) => (
    client.readContract({
      address: marketConfigAddress,
      abi: marketConfigReadAbi,
      functionName: 'getSeries',
      args: [item.seriesId],
      blockNumber,
    })
  )));
  const series = seriesSummaries.map((item, index) => {
    const record = seriesRecords[index];
    if (!record) return item;
    return {
      ...item,
      expiryRoundId: record.expiryRoundId,
      oracleFailureDeadline: record.oracleFailureDeadline,
      strikeBandBps: record.strikeBandBps,
    };
  });
  const selectedSeries = series.find((item) => item.seriesId === selectedSeriesId) ?? series[0];
  if (!selectedSeries) return emptySnapshot(series);

  const [config, round, orderIds, matchingPaused, oracleFeedStatus, tradingOpen] = await Promise.all([
    client.readContract({
      address: marketConfigAddress,
      abi: marketConfigReadAbi,
      functionName: 'getConfig',
      args: [selectedSeries.configVersion],
      blockNumber,
    }),
    client.readContract({
      address: rateOracleAddress,
      abi: rateOracleReadAbi,
      functionName: 'latestFinalizedRound',
      args: [selectedSeries.configVersion],
      blockNumber,
    }),
    client.readContract({
      address: orderBookAddress,
      abi: orderBookReadAbi,
      functionName: 'activeOrderIds',
      args: [selectedSeries.seriesId],
      blockNumber,
    }),
    client.readContract({
      address: orderBookAddress,
      abi: orderBookReadAbi,
      functionName: 'newRiskPaused',
      blockNumber,
    }),
    client.readContract({
      address: rateOracleAddress,
      abi: rateOracleReadAbi,
      functionName: 'feedStatus',
      args: [selectedSeries.configVersion],
      blockNumber,
    }),
    client.readContract({
      address: rateOracleAddress,
      abi: rateOracleReadAbi,
      functionName: 'isTradingOpen',
      args: [selectedSeries.configVersion],
      blockNumber,
    }),
  ]);

  const marketConfig: LiveMarketConfig = {
    lotNotionalRaw: config.lotNotionalRaw,
    tickSizeRaw: config.tickSizeRaw,
    minStrikeRaw: config.minStrikeRaw,
    maxStrikeRaw: config.maxStrikeRaw,
    initialMarginBps: config.initialMarginBps,
    maintenanceMarginBps: config.maintenanceMarginBps,
    effectiveTakerFeeBps: config.effectiveTakerFeeBps,
    maxLotsPerOrder: config.maxLotsPerOrder,
    maxMatchBatch: config.maxMatchBatch,
    maxScanBatch: config.maxScanBatch,
    maxSyncBatch: config.maxSyncBatch,
    maxOrderLifetime: config.maxOrderLifetime,
    maxPegLifetimeRounds: config.maxPegLifetimeRounds,
    marginGracePeriodSeconds: config.marginGracePeriodSeconds,
    maxOffsetBps: config.maxOffsetBps,
  };

  if (orderIds.length === 0) {
    return {
      ...emptySnapshot(series),
      selectedSeries,
      lotNotionalRaw: config.lotNotionalRaw,
      tickSizeRaw: config.tickSizeRaw,
      roundId: round.roundId,
      referenceRateRaw: round.rateRaw,
      oracleFeedStatus,
      tradingOpen,
      matchingPaused,
      config: marketConfig,
    };
  }

  const [orders, previews] = await Promise.all([
    Promise.all(orderIds.map((orderId) => (
      client.readContract({
        address: orderBookAddress,
        abi: orderBookReadAbi,
        functionName: 'getOrder',
        args: [orderId],
        blockNumber,
      })
    ))),
    Promise.all(orderIds.map((orderId) => (
      client.readContract({
        address: orderBookAddress,
        abi: orderBookReadAbi,
        functionName: 'previewEffectiveLimit',
        args: [orderId],
        blockNumber,
      })
    ))),
  ]);

  const entries: BookEntry[] = [];
  let inactiveOrderCount = 0;
  for (let index = 0; index < orders.length; index += 1) {
    const order = orders[index] as ChainOrder | undefined;
    const preview = previews[index];
    if (!order || !preview) continue;
    const [strikeRaw, executable] = preview;
    const remainingLots = BigInt(order.lotsTotal - order.lotsFilled);
    if (!executable || matchingPaused || order.status !== 1 || remainingLots <= 0n) {
      inactiveOrderCount += 1;
      continue;
    }
    entries.push({
      side: order.side === 0 ? 'buyer' : 'seller',
      strikeRaw,
      remainingLots,
      lotNotionalRaw: config.lotNotionalRaw,
    });
  }

  return {
    activeVersion,
    blockNumber,
    blockTimestamp: block.timestamp,
    deploymentId: protocolReadConfig.deploymentId,
    series,
    selectedSeries,
    levels: aggregateBookLevels(entries),
    lotNotionalRaw: config.lotNotionalRaw,
    tickSizeRaw: config.tickSizeRaw,
    roundId: round.roundId,
    referenceRateRaw: round.rateRaw,
    oracleFeedStatus,
    tradingOpen,
    matchingPaused,
    config: marketConfig,
    activeOrderCount: orderIds.length,
    inactiveOrderCount,
    fetchedAt: Date.now(),
  };
}
