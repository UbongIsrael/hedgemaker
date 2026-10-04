import { describe, expect, it } from "vitest";
import {
  BPS_DENOMINATOR,
  buyerPayoffRaw,
  ceilDiv,
  floorDiv,
  isWithinRelativeStrikeBand,
  isValidPegOffset,
  payoffDeltaRaw,
  payoffRaw,
  peggedStrikeRaw,
} from "../index";

const U = 1_000_000n;

describe("exact contractual arithmetic", () => {
  it("matches the specified inverse buyer payoff examples", () => {
    expect(buyerPayoffRaw(1_000n * U, 1_650n * U, 1_700n * U)).toBe(29_411_764n);
    expect(buyerPayoffRaw(1_000n * U, 1_650n * U, 1_600n * U)).toBe(-31_250_000n);
    expect(payoffRaw("USD_SELLER", 1_000n * U, 1_650n * U, 1_700n * U)).toBe(-29_411_764n);
  });

  it("truncates negative payoff toward zero and deltas telescope", () => {
    expect(buyerPayoffRaw(1n, 2n, 3n)).toBe(0n);
    const values = [1_650n, 1_700n, 1_600n, 1_673n].map(rate =>
      buyerPayoffRaw(1_000n * U, 1_650n * U, rate * U));
    const deltaSum = values.slice(1).reduce((sum, value, i) =>
      sum + payoffDeltaRaw(values[i]!, value), 0n);
    expect(deltaSum).toBe(values.at(-1)! - values[0]!);
  });

  it("implements signed mathematical floor and ceiling division", () => {
    expect(ceilDiv(11n, 10n)).toBe(2n);
    expect(ceilDiv(-11n, 10n)).toBe(-1n);
    expect(floorDiv(11n, 10n)).toBe(1n);
    expect(floorDiv(-11n, 10n)).toBe(-2n);
    expect(() => ceilDiv(1n, 0n)).toThrow();
  });

  it("rounds pegged strikes in favor of the order owner", () => {
    const rate = 101n;
    const tick = 10n;
    const offset = 0n;
    const buyerLimit = peggedStrikeRaw(rate, offset, tick, "USD_BUYER");
    const sellerLimit = peggedStrikeRaw(rate, offset, tick, "USD_SELLER");
    expect(buyerLimit).toBe(100n);
    expect(sellerLimit).toBe(110n);
    expect(buyerLimit * BPS_DENOMINATOR).toBeLessThanOrEqual(rate * (BPS_DENOMINATOR + offset));
    expect(sellerLimit * BPS_DENOMINATOR).toBeGreaterThanOrEqual(rate * (BPS_DENOMINATOR + offset));
  });

  it("rejects nonpositive peg multipliers and checks relative bands exactly", () => {
    expect(() => peggedStrikeRaw(100n, -10_000n, 1n, "USD_BUYER")).toThrow();
    expect(isWithinRelativeStrikeBand(1_000n, 1_010n, 100n)).toBe(true);
    expect(isWithinRelativeStrikeBand(1_000n, 1_011n, 100n)).toBe(false);
    expect(isValidPegOffset(-10_000n, 10_000n)).toBe(false);
    expect(isValidPegOffset(100n, 100n)).toBe(true);
    expect(isValidPegOffset(101n, 100n)).toBe(false);
  });
});
