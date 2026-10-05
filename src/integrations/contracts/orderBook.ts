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

const LOG_BLOCK_RANGE = 50_000n;

type BookSide = 'buyer' | 'seller';

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
  matchingPaused: boolean;
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
) {
  const logs = [];
  for (let start = fromBlock; start <= toBlock; start += LOG_BLOCK_RANGE) {
    const end = start + LOG_BLOCK_RANGE - 1n > toBlock
      ? toBlock
      : start + LOG_BLOCK_RANGE - 1n;
    const page = await client.getLogs({
      address: protocolReadConfig.marketConfigAddress,
      event: seriesCreatedEvent,
      fromBlock: start,
      toBlock: end,
      strict: true,
    });
    logs.push(...page);
  }
  return logs;
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
    matchingPaused: false,
    activeOrderCount: 0,
    inactiveOrderCount: 0,
    fetchedAt: Date.now(),
  });

  if (activeVersion === 0n || blockNumber < deploymentBlock) return emptySnapshot();

  const logs = await readSeriesCreatedLogs(client, deploymentBlock, blockNumber);
  const seriesById = new Map<Hex, LiveSeriesSummary>();
  for (const log of logs) {
    const {fixingAt, marketId, seriesId, version} = log.args;
    if (version !== activeVersion || fixingAt <= block.timestamp) continue;
    seriesById.set(seriesId, {seriesId, marketId, configVersion: version, fixingAt});
  }
  const series = [...seriesById.values()].sort((left, right) => (
    left.fixingAt < right.fixingAt ? -1 : left.fixingAt > right.fixingAt ? 1 : 0
  ));
  const selectedSeries = series.find((item) => item.seriesId === selectedSeriesId) ?? series[0];
  if (!selectedSeries) return emptySnapshot(series);

  const [config, round, orderIds, matchingPaused] = await Promise.all([
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
  ]);

  if (orderIds.length === 0) {
    return {
      ...emptySnapshot(series),
      selectedSeries,
      lotNotionalRaw: config.lotNotionalRaw,
      tickSizeRaw: config.tickSizeRaw,
      roundId: round.roundId,
      referenceRateRaw: round.rateRaw,
      matchingPaused,
    };
  }

  const [orders, previews] = await Promise.all([
    client.multicall({
      allowFailure: false,
      blockNumber,
      contracts: orderIds.map((orderId) => ({
        address: orderBookAddress,
        abi: orderBookReadAbi,
        functionName: 'getOrder',
        args: [orderId],
      } as const)),
    }),
    client.multicall({
      allowFailure: false,
      blockNumber,
      contracts: orderIds.map((orderId) => ({
        address: orderBookAddress,
        abi: orderBookReadAbi,
        functionName: 'previewEffectiveLimit',
        args: [orderId],
      } as const)),
    }),
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
    matchingPaused,
    activeOrderCount: orderIds.length,
    inactiveOrderCount,
    fetchedAt: Date.now(),
  };
}
