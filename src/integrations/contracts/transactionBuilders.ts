import {encodeFunctionData, type Address, type Hex} from 'viem';
import {
  cumulativeFeeRaw,
  fixedAdverseEntryReservePerLotRaw,
  isValidPegOffset,
  isWithinRelativeStrikeBand,
  orderReserve,
  peggedAdverseEntryReservePerLotRaw,
  peggedStrikeRaw,
  type Side,
} from '@/domain';
import {
  collateralVaultAbi,
  erc20Abi,
  orderBookReadAbi,
  positionManagerAbi,
} from './abis';
import {protocolReadConfig} from './config';
import type {LiveMarketConfig, LiveSeriesSummary} from './orderBook';

const UINT32_MAX = 4_294_967_295;
const UINT64_MAX = (1n << 64n) - 1n;
const UINT128_MAX = (1n << 128n) - 1n;
const UINT256_MAX = (1n << 256n) - 1n;

export type OrderPriceType = 'fixed' | 'pegged';
export type OrderTimeInForce = 'rest' | 'ioc';

export interface PlaceOrderDraft {
  intentId: Hex;
  seriesId: Hex;
  side: Side;
  priceType: OrderPriceType;
  timeInForce: OrderTimeInForce;
  lots: number;
  minimumImmediateFillLots: number;
  validUntil: bigint;
  submitBy: bigint;
  limitStrikeRaw: bigint;
  offsetBps: number;
  lastExecutableRoundId?: bigint;
}

export interface PlaceOrderBuildContext {
  blockNumber: bigint;
  blockTimestamp: bigint;
  configVersion: bigint;
  roundId: bigint;
  referenceRateRaw: bigint;
  tradingOpen: boolean;
  matchingPaused: boolean;
  series: LiveSeriesSummary;
  config: LiveMarketConfig;
}

export interface UnsignedTransaction {
  chainId: number;
  deploymentId: string;
  to: Address;
  data: Hex;
  value: '0';
  functionName: string;
  decodedIntent: Record<string, string | number | boolean>;
}

export interface PlaceOrderPreview {
  effectiveStrikeRaw: bigint;
  currentlyExecutable: boolean;
  initialMarginPerLotRaw: bigint;
  adverseEntryReservePerLotRaw: bigint;
  reservePerLotRaw: bigint;
  collateralReserveRaw: bigint;
  feeEscrowRaw: bigint;
  maxTokenPullRaw: bigint;
}

export interface BuiltPlaceOrder {
  transaction: UnsignedTransaction;
  preview: PlaceOrderPreview;
}

export class TransactionBuildError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TransactionBuildError';
  }
}

function deploymentTargets() {
  const {
    chainId,
    deploymentId,
    orderBookAddress,
    positionManagerAddress,
    settlementTokenAddress,
    vaultAddress,
  } = protocolReadConfig;
  if (
    !chainId || !orderBookAddress || !positionManagerAddress
      || !settlementTokenAddress || !vaultAddress
  ) {
    throw new TransactionBuildError('The trusted deployment transaction targets are incomplete.');
  }
  return {
    chainId,
    deploymentId,
    orderBookAddress,
    positionManagerAddress,
    settlementTokenAddress,
    vaultAddress,
  };
}

function assertUint32(value: number, label: string, allowZero = false) {
  if (!Number.isInteger(value) || value < (allowZero ? 0 : 1) || value > UINT32_MAX) {
    throw new TransactionBuildError(`${label} is outside the uint32 range.`);
  }
}

function assertUint64(value: bigint, label: string, allowZero = false) {
  if (value < (allowZero ? 0n : 1n) || value > UINT64_MAX) {
    throw new TransactionBuildError(`${label} is outside the uint64 range.`);
  }
}

function assertPositiveUint256(value: bigint, label: string) {
  if (value <= 0n || value > UINT256_MAX) {
    throw new TransactionBuildError(`${label} must be a positive uint256 value.`);
  }
}

function baseTransaction(
  to: Address,
  data: Hex,
  functionName: string,
  decodedIntent: UnsignedTransaction['decodedIntent'],
): UnsignedTransaction {
  const {chainId, deploymentId} = deploymentTargets();
  return {chainId, deploymentId, to, data, value: '0', functionName, decodedIntent};
}

export function buildPlaceOrder(
  draft: PlaceOrderDraft,
  context: PlaceOrderBuildContext,
): BuiltPlaceOrder {
  const targets = deploymentTargets();
  const {config, series} = context;
  if (draft.seriesId !== series.seriesId) {
    throw new TransactionBuildError('The selected series does not match the builder context.');
  }
  if (context.configVersion !== series.configVersion) {
    throw new TransactionBuildError('The selected series and configuration version do not match.');
  }
  if (!context.tradingOpen || context.matchingPaused) {
    throw new TransactionBuildError('New risk is not currently available for this configuration.');
  }
  if (context.roundId === 0n || context.roundId >= series.expiryRoundId) {
    throw new TransactionBuildError('The finalized oracle round is not eligible for new orders.');
  }
  assertUint32(draft.lots, 'Lots');
  assertUint32(draft.minimumImmediateFillLots, 'Minimum immediate fill lots', true);
  if (draft.lots > config.maxLotsPerOrder || draft.minimumImmediateFillLots > draft.lots) {
    throw new TransactionBuildError('The requested lots exceed the configured order bounds.');
  }
  assertUint64(draft.validUntil, 'Order expiry');
  assertUint64(draft.submitBy, 'Submission deadline');
  if (
    draft.validUntil <= context.blockTimestamp
      || draft.validUntil >= series.fixingAt
      || draft.validUntil > context.blockTimestamp + BigInt(config.maxOrderLifetime)
      || draft.submitBy < context.blockTimestamp
      || draft.submitBy > draft.validUntil
  ) {
    throw new TransactionBuildError('The submission or expiry time is outside the current market window.');
  }
  if (
    draft.limitStrikeRaw < config.minStrikeRaw
      || draft.limitStrikeRaw > config.maxStrikeRaw
      || draft.limitStrikeRaw % config.tickSizeRaw !== 0n
      || draft.limitStrikeRaw > UINT128_MAX
  ) {
    throw new TransactionBuildError('The rate limit is outside configured bounds or not aligned to a tick.');
  }

  let adverseEntryReservePerLotRaw: bigint;
  let effectiveStrikeRaw: bigint;
  let currentlyExecutable: boolean;
  let boundRoundId = 0n;
  const lastExecutableRoundId = draft.lastExecutableRoundId ?? 0n;
  if (draft.priceType === 'fixed') {
    if (draft.offsetBps !== 0 || lastExecutableRoundId !== 0n) {
      throw new TransactionBuildError('Fixed orders cannot carry a peg offset or peg lifetime.');
    }
    if (!isWithinRelativeStrikeBand(
      context.referenceRateRaw,
      draft.limitStrikeRaw,
      BigInt(series.strikeBandBps),
    )) {
      throw new TransactionBuildError('The fixed rate is outside the series strike band.');
    }
    boundRoundId = context.roundId;
    effectiveStrikeRaw = draft.limitStrikeRaw;
    currentlyExecutable = true;
    adverseEntryReservePerLotRaw = fixedAdverseEntryReservePerLotRaw(
      config.lotNotionalRaw,
      draft.limitStrikeRaw,
      context.referenceRateRaw,
      draft.side,
    );
  } else {
    if (
      !Number.isInteger(draft.offsetBps)
        || Math.abs(draft.offsetBps) > config.maxOffsetBps
        || !isValidPegOffset(BigInt(draft.offsetBps), BigInt(series.strikeBandBps))
    ) {
      throw new TransactionBuildError('The peg offset is outside the configured series bounds.');
    }
    if (
      lastExecutableRoundId !== 0n
        && (
          lastExecutableRoundId < context.roundId
            || lastExecutableRoundId > context.roundId + BigInt(config.maxPegLifetimeRounds)
        )
    ) {
      throw new TransactionBuildError('The pegged-order lifetime is outside the configured round window.');
    }
    effectiveStrikeRaw = peggedStrikeRaw(
      context.referenceRateRaw,
      BigInt(draft.offsetBps),
      config.tickSizeRaw,
      draft.side,
    );
    const insideBounds = effectiveStrikeRaw >= config.minStrikeRaw
      && effectiveStrikeRaw <= config.maxStrikeRaw
      && isWithinRelativeStrikeBand(
        context.referenceRateRaw,
        effectiveStrikeRaw,
        BigInt(series.strikeBandBps),
      );
    const insideOwnerLimit = draft.side === 'USD_BUYER'
      ? effectiveStrikeRaw <= draft.limitStrikeRaw
      : effectiveStrikeRaw >= draft.limitStrikeRaw;
    currentlyExecutable = insideBounds && insideOwnerLimit;
    adverseEntryReservePerLotRaw = peggedAdverseEntryReservePerLotRaw(
      config.lotNotionalRaw,
      BigInt(draft.offsetBps),
      draft.side,
    );
  }

  const reserve = orderReserve({
    notionalPerLotRaw: config.lotNotionalRaw,
    lots: BigInt(draft.lots),
    initialMarginBps: BigInt(config.initialMarginBps),
    maintenanceMarginBps: BigInt(config.maintenanceMarginBps),
    adverseEntryReservePerLotRaw,
  });
  const totalNotionalRaw = config.lotNotionalRaw * BigInt(draft.lots);
  const feeEscrowRaw = cumulativeFeeRaw(totalNotionalRaw, BigInt(config.effectiveTakerFeeBps));
  const maxTokenPullRaw = reserve.totalReserveRaw + feeEscrowRaw;
  if (reserve.totalReservePerLotRaw > UINT128_MAX || feeEscrowRaw > UINT128_MAX || maxTokenPullRaw > UINT128_MAX) {
    throw new TransactionBuildError('The order preview exceeds the deployed uint128 accounting bounds.');
  }

  const params = {
    intentId: draft.intentId,
    seriesId: draft.seriesId,
    side: draft.side === 'USD_BUYER' ? 0 : 1,
    priceType: draft.priceType === 'fixed' ? 0 : 1,
    timeInForce: draft.timeInForce === 'rest' ? 0 : 1,
    lots: draft.lots,
    minimumImmediateFillLots: draft.minimumImmediateFillLots,
    validUntil: draft.validUntil,
    submitBy: draft.submitBy,
    boundRoundId,
    lastExecutableRoundId,
    limitStrikeRaw: draft.limitStrikeRaw,
    maxTokenPullRaw,
    offsetBps: draft.offsetBps,
  } as const;
  const data = encodeFunctionData({
    abi: orderBookReadAbi,
    functionName: 'placeOrder',
    args: [params],
  });

  return {
    transaction: baseTransaction(targets.orderBookAddress, data, 'placeOrder', {
      intentId: draft.intentId,
      seriesId: draft.seriesId,
      side: draft.side,
      priceType: draft.priceType,
      timeInForce: draft.timeInForce,
      lots: draft.lots,
      minimumImmediateFillLots: draft.minimumImmediateFillLots,
      validUntil: draft.validUntil.toString(),
      submitBy: draft.submitBy.toString(),
      boundRoundId: boundRoundId.toString(),
      lastExecutableRoundId: lastExecutableRoundId.toString(),
      limitStrikeRaw: draft.limitStrikeRaw.toString(),
      maxTokenPullRaw: maxTokenPullRaw.toString(),
      offsetBps: draft.offsetBps,
      snapshotBlock: context.blockNumber.toString(),
      configVersion: context.configVersion.toString(),
      oracleRound: context.roundId.toString(),
    }),
    preview: {
      effectiveStrikeRaw,
      currentlyExecutable,
      initialMarginPerLotRaw: reserve.initialMarginPerLotRaw,
      adverseEntryReservePerLotRaw,
      reservePerLotRaw: reserve.totalReservePerLotRaw,
      collateralReserveRaw: reserve.totalReserveRaw,
      feeEscrowRaw,
      maxTokenPullRaw,
    },
  };
}

export function buildSettlementTokenApproval(amountRaw: bigint): UnsignedTransaction {
  assertPositiveUint256(amountRaw, 'Approval amount');
  const targets = deploymentTargets();
  const data = encodeFunctionData({
    abi: erc20Abi,
    functionName: 'approve',
    args: [targets.vaultAddress, amountRaw],
  });
  return baseTransaction(targets.settlementTokenAddress, data, 'approve', {
    spender: targets.vaultAddress,
    amountRaw: amountRaw.toString(),
  });
}

function buildOrderIdAction(functionName: 'cancelOrder' | 'expireOrder' | 'invalidateOrder', orderId: bigint) {
  assertPositiveUint256(orderId, 'Order ID');
  const targets = deploymentTargets();
  const data = encodeFunctionData({abi: orderBookReadAbi, functionName, args: [orderId]});
  return baseTransaction(targets.orderBookAddress, data, functionName, {orderId: orderId.toString()});
}

export const buildCancelOrder = (orderId: bigint) => buildOrderIdAction('cancelOrder', orderId);
export const buildExpireOrder = (orderId: bigint) => buildOrderIdAction('expireOrder', orderId);
export const buildInvalidateOrder = (orderId: bigint) => buildOrderIdAction('invalidateOrder', orderId);

export function buildMatchOrders(
  seriesId: Hex,
  maxPairs: number,
  configuredMaximum: number,
): UnsignedTransaction {
  assertUint32(maxPairs, 'Maximum pairs');
  assertUint32(configuredMaximum, 'Configured maximum pairs');
  if (maxPairs > configuredMaximum) {
    throw new TransactionBuildError('Maximum pairs exceeds the current configuration.');
  }
  const targets = deploymentTargets();
  const data = encodeFunctionData({
    abi: orderBookReadAbi,
    functionName: 'matchOrders',
    args: [seriesId, maxPairs],
  });
  return baseTransaction(targets.orderBookAddress, data, 'matchOrders', {seriesId, maxPairs});
}

function buildPositionWorkAction(
  functionName: 'syncPosition' | 'settleRounds' | 'liquidate',
  positionId: bigint,
  maxRounds: number,
  configuredMaximum: number,
) {
  assertPositiveUint256(positionId, 'Position ID');
  assertUint32(maxRounds, 'Maximum rounds');
  assertUint32(configuredMaximum, 'Configured maximum rounds');
  if (maxRounds > configuredMaximum) {
    throw new TransactionBuildError('Maximum rounds exceeds the current configuration.');
  }
  const targets = deploymentTargets();
  const data = encodeFunctionData({
    abi: positionManagerAbi,
    functionName,
    args: [positionId, maxRounds],
  });
  return baseTransaction(targets.positionManagerAddress, data, functionName, {
    positionId: positionId.toString(),
    maxRounds,
  });
}

export const buildSyncPosition = (positionId: bigint, maxRounds: number, configuredMaximum: number) => (
  buildPositionWorkAction('syncPosition', positionId, maxRounds, configuredMaximum)
);
export const buildSettleRounds = (positionId: bigint, maxRounds: number, configuredMaximum: number) => (
  buildPositionWorkAction('settleRounds', positionId, maxRounds, configuredMaximum)
);
export const buildLiquidate = (positionId: bigint, maxRounds: number, configuredMaximum: number) => (
  buildPositionWorkAction('liquidate', positionId, maxRounds, configuredMaximum)
);

export function buildAddMargin(
  positionId: bigint,
  buyerSide: boolean,
  amountRaw: bigint,
  maxSyncRounds: number,
  configuredMaximum: number,
): UnsignedTransaction {
  assertPositiveUint256(positionId, 'Position ID');
  assertPositiveUint256(amountRaw, 'Margin amount');
  assertUint32(maxSyncRounds, 'Maximum sync rounds');
  assertUint32(configuredMaximum, 'Configured maximum sync rounds');
  if (maxSyncRounds > configuredMaximum) {
    throw new TransactionBuildError('Maximum sync rounds exceeds the current configuration.');
  }
  const targets = deploymentTargets();
  const data = encodeFunctionData({
    abi: positionManagerAbi,
    functionName: 'addMargin',
    args: [positionId, buyerSide, amountRaw, maxSyncRounds],
  });
  return baseTransaction(targets.positionManagerAddress, data, 'addMargin', {
    positionId: positionId.toString(),
    buyerSide,
    amountRaw: amountRaw.toString(),
    maxSyncRounds,
  });
}

export function buildWithdrawClaimable(amountRaw: bigint): UnsignedTransaction {
  assertPositiveUint256(amountRaw, 'Withdrawal amount');
  const targets = deploymentTargets();
  const data = encodeFunctionData({
    abi: collateralVaultAbi,
    functionName: 'withdrawClaimable',
    args: [amountRaw],
  });
  return baseTransaction(targets.vaultAddress, data, 'withdrawClaimable', {
    amountRaw: amountRaw.toString(),
  });
}
