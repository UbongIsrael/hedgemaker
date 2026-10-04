import { BPS_DENOMINATOR, sideSign } from "./constants";
import type { Side } from "./constants";

/** Mathematical ceiling division for any signed numerator and positive divisor. */
export function ceilDiv(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) throw new RangeError("Divisor must be positive.");
  const quotient = numerator / denominator; // BigInt truncates toward zero.
  const remainder = numerator % denominator;
  return remainder > 0n ? quotient + 1n : quotient;
}

/** Mathematical floor division for any signed numerator and positive divisor. */
export function floorDiv(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) throw new RangeError("Divisor must be positive.");
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  return remainder < 0n ? quotient - 1n : quotient;
}

export function maxBigInt(a: bigint, b: bigint): bigint {
  return a > b ? a : b;
}

export function absBigInt(value: bigint): bigint {
  return value < 0n ? -value : value;
}

/** Buyer-signed contractual payoff, in raw USDC, truncated toward zero. */
export function buyerPayoffRaw(
  notionalRaw: bigint,
  strikeRaw: bigint,
  rateRaw: bigint,
): bigint {
  if (notionalRaw < 0n) throw new RangeError("Notional cannot be negative.");
  if (strikeRaw <= 0n) throw new RangeError("Strike must be positive.");
  if (rateRaw <= 0n) throw new RangeError("Rate must be positive.");
  return (notionalRaw * (rateRaw - strikeRaw)) / rateRaw;
}

export function payoffRaw(
  side: Side,
  notionalRaw: bigint,
  strikeRaw: bigint,
  rateRaw: bigint,
): bigint {
  const buyerValue = buyerPayoffRaw(notionalRaw, strikeRaw, rateRaw);
  return side === "USD_BUYER" ? buyerValue : -buyerValue;
}

/** Exact signed change between two already-rounded contractual values. */
export function payoffDeltaRaw(previousRaw: bigint, nextRaw: bigint): bigint {
  return nextRaw - previousRaw;
}

export function ceilBps(amountRaw: bigint, bps: bigint): bigint {
  if (amountRaw < 0n || bps < 0n) throw new RangeError("Amount and BPS must be non-negative.");
  return ceilDiv(amountRaw * bps, BPS_DENOMINATOR);
}

/** Owner-protective tick rounding directly from the peg rational. */
export function peggedStrikeRaw(
  rateRaw: bigint,
  offsetBps: bigint,
  tickRaw: bigint,
  side: Side,
): bigint {
  if (rateRaw <= 0n) throw new RangeError("Rate must be positive.");
  if (tickRaw <= 0n) throw new RangeError("Tick size must be positive.");
  const offsetFactor = BPS_DENOMINATOR + offsetBps;
  if (offsetFactor <= 0n) throw new RangeError("Pegged strike multiplier must be positive.");
  const numerator = rateRaw * offsetFactor;
  const denominator = BPS_DENOMINATOR * tickRaw;
  const ticks = side === "USD_BUYER"
    ? numerator / denominator
    : ceilDiv(numerator, denominator);
  return ticks * tickRaw;
}

/** Check effective strike against the series' relative strike band exactly. */
export function isWithinRelativeStrikeBand(
  rateRaw: bigint,
  strikeRaw: bigint,
  strikeBandBps: bigint,
): boolean {
  if (rateRaw <= 0n || strikeRaw <= 0n || strikeBandBps < 0n) return false;
  return absBigInt(strikeRaw - rateRaw) * BPS_DENOMINATOR <=
    rateRaw * strikeBandBps;
}

export function isValidPegOffset(offsetBps: bigint, strikeBandBps: bigint): boolean {
  return strikeBandBps >= 0n && BPS_DENOMINATOR + offsetBps > 0n &&
    absBigInt(offsetBps) <= strikeBandBps;
}

/** Signed adverse portion of a payoff (zero when the entry mark helps this side). */
export function adverseMarkRaw(valueRaw: bigint, side: Side): bigint {
  return maxBigInt(0n, -sideSign(side) * valueRaw);
}
