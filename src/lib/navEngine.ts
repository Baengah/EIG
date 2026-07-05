/**
 * Derives EIG fund NAV at any date from raw source data, bypassing stored
 * fund_nav records (which used current-date bank balances and all-time units,
 * causing historical NAV distortion on unit-issuance dates).
 *
 * Formula (baseline-anchored to avoid double-counting CHD fund subscriptions):
 *
 *   total_fund_value_d = stockEquity_d + CHD_d + cash_d
 *
 *   cash_d = baseline_cash + changes_since_baseline
 *   baseline_cash = BASELINE_TOTAL − stockEquity_baseline − CHD_baseline
 *
 * Why baseline-anchored?
 *   Some contributions went directly to CHD broker (bypassing Zenith bank) to
 *   fund the Paramount Fund initial subscription. These appear in
 *   member_contributions but have no corresponding buy transaction in the
 *   transactions table (only exchange-traded contract notes are there). Adding
 *   ALL contributions to total_liquid AND the CHD fund's current value would
 *   double-count those direct-to-CHD amounts. Anchoring to the known May-31
 *   baseline total sidesteps the issue entirely: baseline_cash implicitly
 *   absorbs all prior cash flows, and we only track incremental changes.
 */

export const BASELINE_DATE  = "2026-05-31";
export const BASELINE_NAV   = 100.0; // ₦100/unit par value at fund inception

// ── Types ─────────────────────────────────────────────────────────────────────

export interface StockPrice   { stock_id: string; price_date: string; closing_price: number }
export interface FundVal      { fund_name: string; valuation_date: string; value: number }
export interface UnitTxn      { txn_date: string; units: number }
export interface PortfolioTxn {
  transaction_date: string;
  transaction_type: string;
  stock_id: string | null;
  quantity: number | null;
  net_amount: number | null;
}
export interface ContribRow { contribution_date: string; amount: number }
export interface LedgerRow  { entry_date: string; amount: number; category: string }

export interface NavRawData {
  stockPrices:   StockPrice[];
  fundVals:      FundVal[];
  unitTxns:      UnitTxn[];
  portfolioTxns: PortfolioTxn[];
  contributions: ContribRow[];
  bankLedger:    LedgerRow[];
}

export interface MonthlyReturn {
  ym:                 string;   // "2026-06"
  label:              string;   // "Jun 2026"
  openNav:            number;
  closeNav:           number;
  returnPct:          number;
  nairaReturnPerUnit: number;   // closeNav - openNav
  isPartial:          boolean;
}

// ── Date helpers ──────────────────────────────────────────────────────────────

/** Returns the last calendar day of a given month as "YYYY-MM-DD". */
export function monthEnd(year: number, month: number): string {
  return new Date(year, month, 0).toISOString().split("T")[0];
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function buildPriceIdx(prices: StockPrice[]): Map<string, StockPrice[]> {
  const idx = new Map<string, StockPrice[]>();
  for (const p of prices) {
    const arr = idx.get(p.stock_id) ?? [];
    arr.push(p);
    idx.set(p.stock_id, arr);
  }
  // Sort descending by date so .find(p => p.price_date <= date) picks most-recent
  idx.forEach(arr => arr.sort((a, b) => b.price_date.localeCompare(a.price_date)));
  return idx;
}

/** Reconstruct stock equity (₦) from trade history valued at prices ≤ date. */
function computeStockEquity(date: string, data: NavRawData): number {
  const holdingsMap = new Map<string, number>();
  for (const txn of data.portfolioTxns) {
    if (txn.transaction_date > date || !txn.stock_id) continue;
    const delta = txn.transaction_type === "sell"
      ? -(txn.quantity ?? 0)
      :  (txn.quantity ?? 0);
    holdingsMap.set(txn.stock_id, (holdingsMap.get(txn.stock_id) ?? 0) + delta);
  }
  const priceIdx = buildPriceIdx(data.stockPrices);
  let equity = 0;
  for (const [sid, qty] of Array.from(holdingsMap.entries())) {
    if (qty <= 0) continue;
    const price = (priceIdx.get(sid) ?? []).find(p => p.price_date <= date)?.closing_price ?? 0;
    equity += qty * price;
  }
  return equity;
}

/** Latest CHD fund valuation on or before date; 0 if none available. */
function latestFundValAt(name: string, date: string, data: NavRawData): number {
  return [...data.fundVals]
    .filter(v => v.fund_name === name && v.valuation_date <= date)
    .sort((a, b) => b.valuation_date.localeCompare(a.valuation_date))[0]?.value ?? 0;
}

/** Earliest CHD fund valuation across all dates (used as baseline proxy). */
function earliestFundVal(name: string, data: NavRawData): number {
  return [...data.fundVals]
    .filter(v => v.fund_name === name)
    .sort((a, b) => a.valuation_date.localeCompare(b.valuation_date))[0]?.value ?? 0;
}

// ── Core computation ──────────────────────────────────────────────────────────

/**
 * Compute derived NAV per unit at `date` from raw source data.
 * Returns BASELINE_NAV for dates on or before 2026-05-31 (par value date).
 * Returns null if no units are in issue at the requested date.
 */
export function computeNavAtDate(date: string, data: NavRawData): number | null {
  if (date <= BASELINE_DATE) return BASELINE_NAV;

  // ── Units in issue ─────────────────────────────────────────────────
  const units = data.unitTxns
    .filter(t => t.txn_date <= date)
    .reduce((s, t) => s + Number(t.units), 0);
  if (units <= 0) return null;

  // ── Known baseline total fund value ────────────────────────────────
  // Derived from the immutable 31-May-2026 seed: ₦100/unit × baseline units.
  // All contributions, investments, and cash flows up to baseline are
  // embedded in this single number — no need to re-derive them.
  const baselineUnits = data.unitTxns
    .filter(t => t.txn_date <= BASELINE_DATE)
    .reduce((s, t) => s + Number(t.units), 0);
  const BASELINE_TOTAL = BASELINE_NAV * baselineUnits; // ₦15,102,198

  // ── Stock equity ───────────────────────────────────────────────────
  const stockEquity_0 = computeStockEquity(BASELINE_DATE, data);
  const stockEquity_d = computeStockEquity(date, data);

  // ── CHD mutual fund values ─────────────────────────────────────────
  // Baseline: earliest available valuation (Jun-16 entry, proxy for May-31).
  // Current:  latest valuation on or before target date.
  // When only one valuation entry exists, CHD_0 and CHD_d are equal and
  // cancel out in the formula — correctly reducing to price-change + cash-changes.
  const CHD_0 = earliestFundVal("CHD Money Market Fund", data)
              + earliestFundVal("CHD Paramount Fund", data);
  const CHD_d = latestFundValAt("CHD Money Market Fund", date, data)
              + latestFundValAt("CHD Paramount Fund", date, data);

  // ── Baseline cash (implicitly correct — no double-counting risk) ───
  const cash_0 = BASELINE_TOTAL - stockEquity_0 - CHD_0;

  // ── Incremental cash changes since baseline only ────────────────────
  // Using > BASELINE_DATE (not >=) ensures baseline entries aren't counted.
  const newContribs = data.contributions
    .filter(c => c.contribution_date > BASELINE_DATE && c.contribution_date <= date)
    .reduce((s, c) => s + Number(c.amount), 0);

  const txnChanges = data.portfolioTxns
    .filter(t => t.transaction_date > BASELINE_DATE && t.transaction_date <= date)
    .reduce((s, t) => {
      const amt = Number(t.net_amount ?? 0);
      if (t.transaction_type === "buy" || t.transaction_type === "rights_issue") return s - amt;
      if (t.transaction_type === "sell" || t.transaction_type === "dividend")    return s + amt;
      return s;
    }, 0);

  // Exclude broker_transfer — internal bank↔broker movements don't change total cash.
  // Only non-broker entries (interest, charges, taxes) affect total fund value.
  const bankChanges = data.bankLedger
    .filter(e => e.entry_date > BASELINE_DATE && e.entry_date <= date && e.category !== "broker_transfer")
    .reduce((s, e) => s + Number(e.amount), 0);

  const totalFundValue = stockEquity_d + CHD_d + cash_0 + newContribs + txnChanges + bankChanges;
  return totalFundValue / units;
}

/**
 * Compute discrete monthly returns from fund inception (June 2026) to today.
 * Returns one entry per calendar month, oldest first; current month is partial.
 *
 * June 2026 opening = BASELINE_NAV (₦100) — first full month after par-value date.
 * Subsequent months: openNav = previous month's computed closing NAV.
 */
export function computeMonthlyReturns(today: Date, data: NavRawData): MonthlyReturn[] {
  const todayStr = today.toISOString().split("T")[0];
  const curYear  = today.getFullYear();
  const curMonth = today.getMonth() + 1;
  const results: MonthlyReturn[] = [];

  let year = 2026, month = 6; // first full calendar month after baseline

  while (year < curYear || (year === curYear && month <= curMonth)) {
    const isPartial = year === curYear && month === curMonth;
    const prevEnd   = monthEnd(year, month - 1);
    const closeDate = isPartial ? todayStr : monthEnd(year, month);

    const openNav = prevEnd <= BASELINE_DATE
      ? BASELINE_NAV
      : (computeNavAtDate(prevEnd, data) ?? BASELINE_NAV);

    const closeNav = computeNavAtDate(closeDate, data);

    if (closeNav !== null && closeNav > 0 && openNav > 0) {
      const returnPct = ((closeNav - openNav) / openNav) * 100;
      const label = new Date(year, month - 1, 1).toLocaleDateString("en-NG", {
        month: "short", year: "numeric",
      });
      results.push({
        ym: `${year}-${String(month).padStart(2, "0")}`,
        label,
        openNav,
        closeNav,
        returnPct,
        nairaReturnPerUnit: closeNav - openNav,
        isPartial,
      });
    }

    if (month === 12) { year++; month = 1; } else { month++; }
  }

  return results;
}
