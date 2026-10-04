/** Shared integer units for the Naira Forward testnet domain. */
export const USDC_DECIMALS = 6;
export const RATE_DECIMALS = 6;
export const RAW_SCALE = 1_000_000n;
export const BPS_DENOMINATOR = 10_000n;

export const DEFAULT_INITIAL_MARGIN_BPS = 500n;
export const DEFAULT_MAINTENANCE_MARGIN_BPS = 250n;
export const REFERENCE_TAKER_FEE_BPS = 5n;
export const REFERENCE_MAKER_FEE_BPS = 0n;
export const TESTNET_EFFECTIVE_FEE_BPS = 0n;

export const USD_BUYER = "USD_BUYER" as const;
export const USD_SELLER = "USD_SELLER" as const;
export type Side = typeof USD_BUYER | typeof USD_SELLER;

export function sideSign(side: Side): 1n | -1n {
  return side === USD_BUYER ? 1n : -1n;
}
