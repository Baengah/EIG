import { describe, it, expect } from "vitest";
import {
  computeNav,
  roundKobo,
  roundUnits,
  roundPct,
} from "@/lib/nav";

describe("computeNav", () => {
  it("sums components correctly and divides by units in issue", () => {
    const result = computeNav(
      {
        stockEquityValue: 10_000_000,
        mmfValue: 214_542.64,
        paramountValue: 709_934.66,
        cashAtBank: 100_000,
        cashAtBroker: 77_720.70,
        liabilities: 0,
      },
      151_021.98,
    );
    // total = 10_000_000 + 214_542.64 + 709_934.66 + 100_000 + 77_720.70 = 11_102_198
    expect(result.totalFundValue).toBeCloseTo(11_102_198, 2);
    expect(result.navPerUnit).toBeCloseTo(result.totalFundValue / 151_021.98, 6);
  });

  it("replicates the 31-May-2026 baseline: 151,021.98 units at ₦100", () => {
    // Baseline: total fund = 15,102,198 ÷ 151,021.98 = ₦100.000...
    const result = computeNav(
      {
        stockEquityValue: 15_102_198,
        mmfValue: 0,
        paramountValue: 0,
        cashAtBank: 0,
        cashAtBroker: 0,
        liabilities: 0,
      },
      151_021.98,
    );
    expect(result.navPerUnit).toBeCloseTo(100, 4);
  });

  it("deducts liabilities from total fund value", () => {
    const withLiabilities = computeNav(
      { stockEquityValue: 1_000_000, mmfValue: 0, paramountValue: 0, cashAtBank: 0, cashAtBroker: 0, liabilities: 50_000 },
      10_000,
    );
    expect(withLiabilities.totalFundValue).toBe(950_000);
    expect(withLiabilities.navPerUnit).toBeCloseTo(95, 6);
  });

  it("throws when units in issue is zero", () => {
    expect(() =>
      computeNav(
        { stockEquityValue: 100, mmfValue: 0, paramountValue: 0, cashAtBank: 0, cashAtBroker: 0, liabilities: 0 },
        0,
      ),
    ).toThrow("units_in_issue must be > 0");
  });
});

describe("precision helpers", () => {
  it("roundKobo rounds to 2 dp", () => {
    expect(roundKobo(100.555)).toBe(100.56);
    expect(roundKobo(100.554)).toBe(100.55);
  });

  it("roundUnits rounds to 4 dp", () => {
    expect(roundUnits(1234.56789)).toBe(1234.5679);
    expect(roundUnits(100_000 / 100)).toBe(1000);
  });

  it("roundPct rounds to 6 dp", () => {
    expect(roundPct(33.3333333)).toBe(33.333333);
  });
});
