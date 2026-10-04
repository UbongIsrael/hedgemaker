import type { Side } from "./constants";

export type HexAddress = `0x${string}`;
export type RawIntegerString = string;
export type TimestampSeconds = bigint;

export interface MarketSeries {
  marketId: string;
  seriesId: string;
  configVersion: bigint;
  fixingAt: TimestampSeconds;
  expiryRoundId: bigint;
  lotNotionalRaw: bigint;
  tickRaw: bigint;
  strikeBandBps: bigint;
  minStrikeRaw: bigint;
  maxStrikeRaw: bigint;
  initialMarginBps: bigint;
  maintenanceMarginBps: bigint;
}

export interface FixedOrderIntent {
  kind: "fixed";
  side: Side;
  lots: bigint;
  limitStrikeRaw: bigint;
  boundRoundId: bigint;
  validUntil: TimestampSeconds;
}

export interface PeggedOrderIntent {
  kind: "pegged";
  side: Side;
  lots: bigint;
  offsetBps: bigint;
  lastExecutableRoundId?: bigint;
  validUntil: TimestampSeconds;
}

export type OrderIntent = FixedOrderIntent | PeggedOrderIntent;

export type TransactionState =
  | "idle"
  | "preparing"
  | "awaiting_signature"
  | "submitted"
  | "confirming"
  | "confirmed"
  | "failed"
  | "unknown";

export interface BalanceSnapshot {
  walletUsdcRaw: bigint;
  reservedOrderCollateralRaw: bigint;
  reservedFeeEscrowRaw: bigint;
  lockedPositionRaw: bigint;
  claimableUsdcRaw: bigint;
}

export interface PayoffPreview {
  notionalRaw: bigint;
  strikeRaw: bigint;
  currentRateRaw: bigint;
  buyerValueRaw: bigint;
  sellerValueRaw: bigint;
  initialMarginRaw: bigint;
  maintenanceMarginRaw: bigint;
  adverseEntryReserveRaw: bigint;
  protocolFeeEscrowRaw: bigint;
}
