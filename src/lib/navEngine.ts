/**
 * EIG Fund NAV computation — direct asset-value approach.
 *
 * Formula:
 *   NAV per unit = (stock_equity + CHD_funds + broker_cash + dividends_in_bank) / total_units
 *
 * Each component maps to a maintained database value:
 *   stock_equity   ← v_portfolio_summary.total_value   (holdings × current prices)
 *   CHD_funds      ← mutual_fund_valuations             (latest valuation per fund)
 *   broker_cash    ← broker_accounts.cash_balance       (admin-maintained; can be negative)
 *   dividends      ← sum(transactions WHERE type='dividend')  (proxy for Zenith bank cash)
 *   total_units    ← sum(unit_transactions.units)
 *
 * Why not reconstruct from transactions?
 *   The baseline-anchored approach requires a price at the baseline date (2026-05-31).
 *   No prices exist for May 2026 in migrations; if the admin entered peak prices for that
 *   month the implied baseline_cash goes deeply negative, producing fake NAV losses even
 *   when the portfolio is up. This direct formula has no such dependency.
 */

export const BASELINE_NAV  = 100.0;  // ₦100/unit par value at fund inception
export const BASELINE_DATE = "2026-05-31";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface FundVal { fund_name: string; valuation_date: string; value: number }
export interface UnitTxn { txn_date: string; units: number }

export interface MonthlyReturn {
  ym:                 string;   // "2026-06"
  label:              string;   // "Jun 2026"
  openNav:            number;
  closeNav:           number;
  returnPct:          number;
  nairaReturnPerUnit: number;
  isPartial:          boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Returns the last calendar day of a given month as "YYYY-MM-DD". */
export function monthEnd(year: number, month: number): string {
  return new Date(year, month, 0).toISOString().split("T")[0];
}

/**
 * Sum the latest valuation for each fund, optionally capped to atDate.
 * Pass no atDate (or undefined) to use the absolute latest.
 */
export function sumLatestFundVals(fundVals: FundVal[], atDate?: string): number {
  const latest = new Map<string, FundVal>();
  for (const v of fundVals) {
    if (atDate && v.valuation_date > atDate) continue;
    const cur = latest.get(v.fund_name);
    if (!cur || v.valuation_date > cur.valuation_date) latest.set(v.fund_name, v);
  }
  return Array.from(latest.values()).reduce((s, v) => s + Number(v.value), 0);
}

// ── Core computation ───────────────────────────────────────────────────────────

/**
 * Compute fund NAV per unit from its current asset components.
 * Returns null when no units are in issue.
 *
 * @param stockEquity   v_portfolio_summary.total_value (holdings × current prices)
 * @param CHDTotal      sumLatestFundVals(fundVals) — mutual fund NAVs
 * @param brokerCash    broker_accounts.cash_balance (keep up-to-date after trades; may be negative)
 * @param dividendsCash sum of dividend transaction net_amounts (proxy for Zenith bank cash)
 * @param totalUnits    sum of unit_transactions.units
 */
export function computeCurrentNav(
  stockEquity:   number,
  CHDTotal:      number,
  brokerCash:    number,
  dividendsCash: number,
  totalUnits:    number,
): number | null {
  if (totalUnits <= 0) return null;
  return (stockEquity + CHDTotal + brokerCash + dividendsCash) / totalUnits;
}
