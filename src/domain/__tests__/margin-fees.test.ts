import { describe, expect, it } from "vitest";
import {
  cumulativeFeeRaw,
  effectiveFeeBps,
  fillAllocationPerLotRaw,
  fillFeeRaw,
  fixedAdverseEntryReservePerLotRaw,
  initialMarginPerLotRaw,
  maintenanceMarginPerLotRaw,
  maximumFeeEscrowRaw,
  orderReserve,
  peggedAdverseEntryReservePerLotRaw,
} from "../index";

const U = 1_000_000n;

describe("margin and order reserves", () => {
  it("ceiling-rounds initial and maintenance margin per lot", () => {
    expect(initialMarginPerLotRaw(1_000n * U, 500n)).toBe(50n * U);
    expect(maintenanceMarginPerLotRaw(1_000n * U, 250n)).toBe(25n * U);
    expect(initialMarginPerLotRaw(1n, 1n)).toBe(1n);
  });

  it("adds the fixed adverse-entry reserve before multiplying by lots", () => {
    const reserve = fixedAdverseEntryReservePerLotRaw(
      1_000n * U, 1_700n * U, 1_600n * U, "USD_BUYER");
    expect(reserve).toBe(62_500_000n);
    expect(orderReserve({
      notionalPerLotRaw: 1_000n * U,
      lots: 2n,
      initialMarginBps: 500n,
      maintenanceMarginBps: 250n,
      adverseEntryReservePerLotRaw: reserve,
    })).toMatchObject({
      initialMarginPerLotRaw: 50n * U,
      maintenanceMarginPerLotRaw: 25n * U,
      totalReservePerLotRaw: 112_500_000n,
      totalReserveRaw: 225_000_000n,
    });
  });

  it("computes pegged adverse reserve with side-aware offset", () => {
    expect(peggedAdverseEntryReservePerLotRaw(1_000n * U, 250n, "USD_BUYER")).toBe(25n * U);
    expect(peggedAdverseEntryReservePerLotRaw(1_000n * U, -250n, "USD_SELLER")).toBe(25n * U);
    expect(peggedAdverseEntryReservePerLotRaw(1_000n * U, 250n, "USD_SELLER")).toBe(0n);
  });

  it("allocates actual rounded entry mark plus initial margin", () => {
    expect(fillAllocationPerLotRaw({
      notionalPerLotRaw: 1_000n * U,
      strikeRaw: 1_700n * U,
      rateRaw: 1_600n * U,
      side: "USD_BUYER",
      initialMarginBps: 500n,
    })).toBe(112_500_000n);
  });
});

describe("protocol fees", () => {
  it("waives effective testnet fees and keeps maker fees at zero", () => {
    expect(effectiveFeeBps("testnet", "taker")).toBe(0n);
    expect(effectiveFeeBps("reference", "maker")).toBe(0n);
    expect(maximumFeeEscrowRaw(1_000n * U, "testnet")).toBe(0n);
    expect(maximumFeeEscrowRaw(1_000n * U, "reference")).toBe(500_000n);
  });

  it("calculates cumulative ceiling fees so splitting fills is neutral", () => {
    const bps = 5n;
    const total = 100_000n;
    expect(cumulativeFeeRaw(total, bps)).toBe(50n);
    const splitFees = fillFeeRaw(0n, 33_333n, bps) +
      fillFeeRaw(33_333n, 33_333n, bps) +
      fillFeeRaw(66_666n, 33_334n, bps);
    expect(splitFees).toBe(cumulativeFeeRaw(total, bps));
  });
});
