import { RAW_SCALE } from "./constants";

/** Parse a human decimal into raw six-decimal units without using Number. */
export function parseFixed(value: string, decimals = 6): bigint {
  assertDecimals(decimals);
  const text = value.trim();
  const match = /^(-?)(\d+)(?:\.(\d*))?$/.exec(text);
  if (!match) throw new Error("Enter a plain decimal amount.");

  const sign = match[1] ?? "";
  const whole = match[2];
  const fraction = match[3] ?? "";
  if (whole === undefined) throw new Error("Enter a plain decimal amount.");
  if (fraction.length > decimals) {
    throw new Error(`Amount supports at most ${decimals} decimal places.`);
  }
  const scale = 10n ** BigInt(decimals);
  const fractionalRaw = fraction.length
    ? BigInt(fraction.padEnd(decimals, "0"))
    : 0n;
  const raw = BigInt(whole) * scale + fractionalRaw;
  return sign === "-" ? -raw : raw;
}

/** Format raw units exactly, truncating excess display precision toward zero. */
export function formatFixed(raw: bigint, decimals = 6, rawDecimals = decimals): string {
  assertDecimals(decimals);
  assertDecimals(rawDecimals);
  if (decimals > rawDecimals) {
    throw new RangeError("Display precision cannot exceed the raw unit precision.");
  }
  const negative = raw < 0n;
  const absolute = negative ? -raw : raw;
  const displayUnit = 10n ** BigInt(rawDecimals - decimals);
  const displayed = absolute / displayUnit;
  const scale = 10n ** BigInt(decimals);
  const whole = displayed / scale;
  const fraction = displayed % scale;
  const sign = negative && displayed !== 0n ? "-" : "";
  if (decimals === 0) return `${sign}${whole}`;
  return `${sign}${whole}.${fraction.toString().padStart(decimals, "0")}`;
}

export function parseUsdc(value: string): bigint {
  return parseFixed(value, 6);
}

export function formatUsdc(raw: bigint, displayDecimals = 2): string {
  return formatFixed(raw, displayDecimals, 6);
}

/** Six-decimal conversion for a whole-unit integer; useful for lot configuration. */
export function wholeToRaw(value: bigint): bigint {
  return value * RAW_SCALE;
}

function assertDecimals(decimals: number): void {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 6) {
    throw new RangeError("Display precision must be an integer from 0 to 6.");
  }
}
