/**
 * Pure NAV computation functions — no database calls.
 * Used by API routes and unit tests alike.
 */

export interface NavComponents {
  stockEquityValue: number;
  mmfValue: number;
  paramountValue: number;
  cashAtBank: number;
  cashAtBroker: number;   // can be negative (overdrawn)
  liabilities: number;    // always >= 0
}

export interface NavResult extends NavComponents {
  totalFundValue: number;
  unitsInIssue: number;
  navPerUnit: number;
}

/** Compute total fund value and NAV per unit from components + outstanding units. */
export function computeNav(
  components: NavComponents,
  unitsInIssue: number,
): NavResult {
  const totalFundValue =
    components.stockEquityValue +
    components.mmfValue +
    components.paramountValue +
    components.cashAtBank +
    components.cashAtBroker -
    components.liabilities;

  if (unitsInIssue <= 0) {
    throw new Error("units_in_issue must be > 0 to compute NAV per unit");
  }

  const navPerUnit = totalFundValue / unitsInIssue;

  return { ...components, totalFundValue, unitsInIssue, navPerUnit };
}

/**
 * Compute units to issue for a contribution.
 * Rounds to 4 decimal places (matches DB NUMERIC(18,4)).
 */
export function computeUnitsIssued(
  contributionAmount: number,
  navPerUnit: number,
): number {
  if (navPerUnit <= 0) {
    throw new Error("NAV per unit must be positive to issue units");
  }
  return roundUnits(contributionAmount / navPerUnit);
}

/**
 * Compute units to cancel for a redemption.
 * Returns a positive number; caller stores it as negative in the ledger.
 */
export function computeUnitsRedeemed(
  redemptionAmount: number,
  navPerUnit: number,
): number {
  if (navPerUnit <= 0) {
    throw new Error("NAV per unit must be positive to redeem units");
  }
  return roundUnits(redemptionAmount / navPerUnit);
}

/** Ownership percentage for a member, rounded to 6 dp. */
export function computeOwnershipPct(
  memberUnits: number,
  totalUnits: number,
): number {
  if (totalUnits <= 0) return 0;
  return roundPct(memberUnits / totalUnits * 100);
}

/**
 * Verify that the sum of per-member units equals total units in issue
 * within a tolerance of 0.0001 (rounding accumulation across members).
 */
export function verifyUnitSum(
  memberUnits: number[],
  totalUnits: number,
  toleranceUnits = 0.0001,
): boolean {
  const sum = memberUnits.reduce((a, b) => a + b, 0);
  return Math.abs(sum - totalUnits) <= toleranceUnits;
}

/**
 * Verify that member ownership percentages sum to 100% within tolerance.
 * Accepts the rounded percentages as displayed (2 dp).
 */
export function verifyOwnershipSum(
  pcts: number[],
  tolerancePct = 0.01,
): boolean {
  const sum = pcts.reduce((a, b) => a + b, 0);
  return Math.abs(sum - 100) <= tolerancePct;
}

// ── Precision helpers ─────────────────────────────────────────────────────────

/** Round to 4 decimal places (unit precision). */
export function roundUnits(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}

/** Round to 6 decimal places (ownership % storage precision). */
export function roundPct(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000;
}

/** Round to 2 decimal places (kobo precision). */
export function roundKobo(n: number): number {
  return Math.round(n * 100) / 100;
}

// ── Dividend yield helpers ────────────────────────────────────────────────────

/** Trailing-twelve-month dividend yield for a single holding. */
export function computeDividendYield(
  ttmDps: number,
  currentPrice: number,
): number {
  if (currentPrice <= 0) return 0;
  return roundPct(ttmDps / currentPrice * 100);
}

/** Weighted portfolio dividend yield = total annual income / total equity value. */
export function computePortfolioYield(
  holdings: Array<{ quantity: number; ttmDps: number; currentPrice: number }>,
): number {
  const totalIncome = holdings.reduce(
    (sum, h) => sum + h.quantity * h.ttmDps,
    0,
  );
  const totalValue = holdings.reduce(
    (sum, h) => sum + h.quantity * h.currentPrice,
    0,
  );
  if (totalValue <= 0) return 0;
  return roundPct(totalIncome / totalValue * 100);
}
