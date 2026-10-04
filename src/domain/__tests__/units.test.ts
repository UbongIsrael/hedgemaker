import { describe, expect, it } from "vitest";
import { formatFixed, formatUsdc, parseFixed, parseUsdc } from "../units";

describe("fixed decimal units", () => {
  it("parses six-decimal USDC exactly, including negative values", () => {
    expect(parseUsdc("1")).toBe(1_000_000n);
    expect(parseUsdc("0.000001")).toBe(1n);
    expect(parseUsdc("-12.340005")).toBe(-12_340_005n);
  });

  it("rejects exponent, separator, and excess precision inputs", () => {
    expect(() => parseUsdc("1e6")).toThrow();
    expect(() => parseUsdc("1,000")).toThrow();
    expect(() => parseUsdc("0.0000001")).toThrow();
  });

  it("formats raw values without floating point and truncates toward zero", () => {
    expect(formatFixed(1_234_567n)).toBe("1.234567");
    expect(formatUsdc(1_239_999n)).toBe("1.23");
    expect(formatUsdc(-1_239_999n)).toBe("-1.23");
    expect(formatUsdc(-1n)).toBe("0.00");
  });

  it("round trips values at the configured raw precision", () => {
    const raw = parseFixed("999999999999.120001");
    expect(parseFixed(formatFixed(raw))).toBe(raw);
    expect(formatFixed(parseFixed("12.345", 3), 3, 3)).toBe("12.345");
  });
});
