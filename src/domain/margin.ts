import { BPS_DENOMINATOR } from "./constants";
import type { Side } from "./constants";
import { buyerPayoffRaw, ceilDiv, maxBigInt } from "./math";

export interface OrderReserve {
  initialMarginPerLotRaw: bigint;
  maintenanceMarginPerLotRaw: bigint;
  adverseEntryReservePerLotRaw: bigint;
  totalReservePerLotRaw: bigint;
  totalReserveRaw: bigint;
}

export function initialMarginPerLotRaw(notionalPerLotRaw: bigint, initialBps: bigint): bigint {
  return marginPerLot(notionalPerLotRaw, initialBps);
}

export function maintenanceMarginPerLotRaw(notionalPerLotRaw: bigint, maintenanceBps: bigint): bigint {
  return marginPerLot(notionalPerLotRaw, maintenanceBps);
}

/** Fixed-limit entry reserve from the exact adverse entry value, ceiling-rounded per lot. */
export function fixedAdverseEntryReservePerLotRaw(
  notionalPerLotRaw: bigint,
  strikeRaw: bigint,
  rateRaw: bigint,
  side: Side,
): bigint {
  if (notionalPerLotRaw < 0n) throw new RangeError("Notional cannot be negative.");
  if (rateRaw <= 0n || strikeRaw <= 0n) throw new RangeError("Rate and strike must be positive.");
  const numerator = notionalPerLotRaw * (rateRaw - strikeRaw);
  const adverseNumerator = side === "USD_BUYER" ? -numerator : numerator;
  return ceilDiv(maxBigInt(0n, adverseNumerator), rateRaw);
}

/** Pegged reserve based only on the signed offset, not on a transient oracle round. */
export function peggedAdverseEntryReservePerLotRaw(
  notionalPerLotRaw: bigint,
  offsetBps: bigint,
  side: Side,
): bigint {
  if (notionalPerLotRaw < 0n) throw new RangeError("Notional cannot be negative.");
  const signedOffset = side === "USD_BUYER" ? offsetBps : -offsetBps;
  return ceilDiv(maxBigInt(0n, notionalPerLotRaw * signedOffset), BPS_DENOMINATOR);
}

export function orderReserve(input: {
  notionalPerLotRaw: bigint;
  lots: bigint;
  initialMarginBps: bigint;
  maintenanceMarginBps: bigint;
  adverseEntryReservePerLotRaw: bigint;
}): OrderReserve {
  const { notionalPerLotRaw, lots, initialMarginBps, maintenanceMarginBps,
    adverseEntryReservePerLotRaw } = input;
  if (lots < 0n) throw new RangeError("Lot count cannot be negative.");
  if (initialMarginBps <= maintenanceMarginBps || maintenanceMarginBps < 0n) {
    throw new RangeError("Initial margin must exceed non-negative maintenance margin.");
  }
  const initial = initialMarginPerLotRaw(notionalPerLotRaw, initialMarginBps);
  const maintenance = maintenanceMarginPerLotRaw(notionalPerLotRaw, maintenanceMarginBps);
  if (adverseEntryReservePerLotRaw < 0n) throw new RangeError("Adverse reserve cannot be negative.");
  const perLot = initial + adverseEntryReservePerLotRaw;
  return {
    initialMarginPerLotRaw: initial,
    maintenanceMarginPerLotRaw: maintenance,
    adverseEntryReservePerLotRaw,
    totalReservePerLotRaw: perLot,
    totalReserveRaw: perLot * lots,
  };
}

/** Actual fill allocation: initial margin plus the adverse rounded entry value. */
export function fillAllocationPerLotRaw(input: {
  notionalPerLotRaw: bigint;
  strikeRaw: bigint;
  rateRaw: bigint;
  side: Side;
  initialMarginBps: bigint;
}): bigint {
  const buyerValue = buyerPayoffRaw(input.notionalPerLotRaw, input.strikeRaw, input.rateRaw);
  const adverse = input.side === "USD_BUYER"
    ? maxBigInt(0n, -buyerValue)
    : maxBigInt(0n, buyerValue);
  return initialMarginPerLotRaw(input.notionalPerLotRaw, input.initialMarginBps) + adverse;
}

function marginPerLot(notionalPerLotRaw: bigint, marginBps: bigint): bigint {
  if (notionalPerLotRaw < 0n || marginBps < 0n) {
    throw new RangeError("Notional and margin BPS must be non-negative.");
  }
  return ceilDiv(notionalPerLotRaw * marginBps, BPS_DENOMINATOR);
}
