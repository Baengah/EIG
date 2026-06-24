import { describe, it, expect } from "vitest";
import { computeDividendYield, computePortfolioYield } from "@/lib/nav";

describe("computeDividendYield", () => {
  it("computes TTM yield correctly", () => {
    // GTCO: DPS ≈ ₦8.9174, price ≈ ₦101.56 → yield ≈ 8.78%
    const yield_pct = computeDividendYield(8.9174, 101.56);
    expect(yield_pct).toBeCloseTo(8.78, 1);
  });

  it("returns 0 when price is zero", () => {
    expect(computeDividendYield(5, 0)).toBe(0);
  });

  it("returns 0 when price is negative", () => {
    expect(computeDividendYield(5, -10)).toBe(0);
  });

  it("rounds to 6 decimal places", () => {
    // 1 / 3 * 100 = 33.333333...
    const y = computeDividendYield(1, 3);
    expect(y).toBe(33.333333);
  });

  it("returns 0 for zero DPS (no dividend declared)", () => {
    expect(computeDividendYield(0, 100)).toBe(0);
  });
});

describe("computePortfolioYield", () => {
  it("computes weighted yield across holdings", () => {
    // Holdings: 1000 shares @ ₦100 with DPS ₦5, 2000 shares @ ₦50 with DPS ₦2
    // Total income = 1000*5 + 2000*2 = 9000
    // Total value  = 1000*100 + 2000*50 = 200000
    // Yield = 9000/200000*100 = 4.5%
    const yield_pct = computePortfolioYield([
      { quantity: 1000, ttmDps: 5, currentPrice: 100 },
      { quantity: 2000, ttmDps: 2, currentPrice: 50 },
    ]);
    expect(yield_pct).toBeCloseTo(4.5, 4);
  });

  it("returns 0 for empty holdings array", () => {
    expect(computePortfolioYield([])).toBe(0);
  });

  it("returns 0 when total value is zero", () => {
    expect(computePortfolioYield([{ quantity: 100, ttmDps: 5, currentPrice: 0 }])).toBe(0);
  });

  it("correctly ignores holdings with zero DPS (no dilution of yield)", () => {
    // 1000 shares @ ₦100 with DPS ₦10, 1000 shares @ ₦100 with DPS ₦0
    // Income = 10000; Value = 200000; Yield = 5%
    const yield_pct = computePortfolioYield([
      { quantity: 1000, ttmDps: 10, currentPrice: 100 },
      { quantity: 1000, ttmDps: 0, currentPrice: 100 },
    ]);
    expect(yield_pct).toBe(5);
  });
});
