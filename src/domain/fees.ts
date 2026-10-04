import { BPS_DENOMINATOR, REFERENCE_TAKER_FEE_BPS, TESTNET_EFFECTIVE_FEE_BPS } from "./constants";
import { ceilDiv } from "./math";

export type FeeEnvironment = "testnet" | "reference";
export type FeeRole = "maker" | "taker";

export function effectiveFeeBps(environment: FeeEnvironment, role: FeeRole): bigint {
  if (role === "maker") return 0n;
  return environment === "testnet" ? TESTNET_EFFECTIVE_FEE_BPS : REFERENCE_TAKER_FEE_BPS;
}

/** Cumulative fee F(T)=ceil(T*f/10000), with the empty order costing zero. */
export function cumulativeFeeRaw(cumulativeNotionalRaw: bigint, feeBps: bigint): bigint {
  if (cumulativeNotionalRaw < 0n || feeBps < 0n) {
    throw new RangeError("Notional and fee BPS must be non-negative.");
  }
  if (cumulativeNotionalRaw === 0n || feeBps === 0n) return 0n;
  return ceilDiv(cumulativeNotionalRaw * feeBps, BPS_DENOMINATOR);
}

/** Incremental fee for a fill, preserving order-level split-fill neutrality. */
export function fillFeeRaw(
  previousCumulativeNotionalRaw: bigint,
  fillNotionalRaw: bigint,
  feeBps: bigint,
): bigint {
  if (fillNotionalRaw < 0n) throw new RangeError("Fill notional cannot be negative.");
  return cumulativeFeeRaw(previousCumulativeNotionalRaw + fillNotionalRaw, feeBps) -
    cumulativeFeeRaw(previousCumulativeNotionalRaw, feeBps);
}

export function maximumFeeEscrowRaw(
  totalNotionalRaw: bigint,
  environment: FeeEnvironment,
  role: FeeRole = "taker",
): bigint {
  return cumulativeFeeRaw(totalNotionalRaw, effectiveFeeBps(environment, role));
}
