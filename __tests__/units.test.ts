import { describe, it, expect } from "vitest";
import {
  computeUnitsIssued,
  computeUnitsRedeemed,
  computeOwnershipPct,
  verifyUnitSum,
  verifyOwnershipSum,
} from "@/lib/nav";

describe("computeUnitsIssued", () => {
  it("₦100k contribution at ₦100/unit issues exactly 1,000 units", () => {
    expect(computeUnitsIssued(100_000, 100)).toBe(1000);
  });

  it("₦100k at ₦100/unit issues 1000.0000 — 4dp precision", () => {
    expect(computeUnitsIssued(100_000, 100)).toEqual(1000.0);
  });

  it("uses pre-money NAV (new money not in pricing NAV)", () => {
    // If NAV/unit is ₦105.00 (computed before contribution), a ₦50k contribution issues
    // 50000 / 105 = 476.1905 units (4dp)
    const units = computeUnitsIssued(50_000, 105);
    expect(units).toBe(476.1905);
  });

  it("rounds to 4 decimal places", () => {
    // 100000 / 101.5 = 985.2216... → 985.2217 (4dp)
    const units = computeUnitsIssued(100_000, 101.5);
    expect(units).toBe(985.2217);
  });

  it("throws for non-positive NAV per unit", () => {
    expect(() => computeUnitsIssued(100_000, 0)).toThrow();
    expect(() => computeUnitsIssued(100_000, -5)).toThrow();
  });
});

describe("computeUnitsRedeemed", () => {
  it("returns positive units for a redemption", () => {
    const units = computeUnitsRedeemed(50_000, 110);
    expect(units).toBeGreaterThan(0);
    expect(units).toBe(454.5455);
  });

  it("throws for non-positive NAV per unit", () => {
    expect(() => computeUnitsRedeemed(10_000, 0)).toThrow();
  });
});

describe("computeOwnershipPct", () => {
  it("returns 50% when member holds half of total", () => {
    expect(computeOwnershipPct(500, 1000)).toBe(50);
  });

  it("returns 0 when total units is zero", () => {
    expect(computeOwnershipPct(0, 0)).toBe(0);
  });

  it("rounds to 6 decimal places", () => {
    // 1/3 = 33.333333...%
    const pct = computeOwnershipPct(1, 3);
    expect(pct).toBe(33.333333);
  });
});

describe("verifyUnitSum", () => {
  it("passes when member units sum exactly to total", () => {
    expect(verifyUnitSum([500, 300, 200], 1000)).toBe(true);
  });

  it("passes within default tolerance of 0.0001", () => {
    // Simulate rounding across many members
    expect(verifyUnitSum([333.3333, 333.3333, 333.3333], 999.9999)).toBe(true);
  });

  it("fails when difference exceeds tolerance", () => {
    expect(verifyUnitSum([500, 300, 200], 1001)).toBe(false);
  });
});

describe("verifyOwnershipSum", () => {
  it("passes when pcts sum to 100%", () => {
    expect(verifyOwnershipSum([33.33, 33.33, 33.34])).toBe(true);
  });

  it("passes within default tolerance of 0.01%", () => {
    // Three members each with exactly 33.333333% → sum = 99.999999, diff from 100 = 0.000001
    expect(verifyOwnershipSum([33.333333, 33.333333, 33.333334])).toBe(true);
  });

  it("fails when sum deviates more than tolerance", () => {
    expect(verifyOwnershipSum([40, 40, 10])).toBe(false);
  });
});
