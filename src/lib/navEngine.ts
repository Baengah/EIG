/**
 * Derives EIG fund NAV at any date from raw source data, bypassing stored
 * fund_nav records (which used current-date bank balances and all-time units,
 * causing historical NAV distortion on unit-issuance dates).
 *
 * Formula:
 *   Total Fund Value = stock_equity + CHD_funds + total_liquid_cash
 *   NAV per unit     = Total Fund Value / units_at_date
 *
 * Total liquid cash (bank + broker combined):
 *   = member contributions received up to date
 *   + dividends received from portfolio transactions
 *   + stock/fund sale proceeds
 *   - stock/fund purchase costs
 *   + net bank income/charges (excluding internal broker↔bank transfers)
 *
 * broker_transfer bank_ledger entries are excluded because they move cash
 * between the bank account and the broker account but don't change total
 * cash held by the fund.
 *
 * Units at date: SUM(unit_transactions.units WHERE txn_date <= date)
 * This is the key fix — the stored fund_nav.units_in_issue used the
 * all-time total (including future issuances), diluting historical NAVs.
 */

export const BASELINE_DATE = "2026-05-31";
export const BASELINE_NAV  = 100.0; // ₦100/unit par value at fund inception

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
  // Sort descending by date so we can use .find(p => p.price_date <= date)
  idx.forEach(arr => arr.sort((a, b) => b.price_date.localeCompare(a.price_date)));
  return idx;
}

// ── Core computation ──────────────────────────────────────────────────────────

/**
 * Compute derived NAV per unit at `date` from raw source data.
 * Returns BASELINE_NAV for dates on or before 2026-05-31 (par value date).
 * Returns null if no units are in issue at the requested date.
 */
export function computeNavAtDate(date: string, data: NavRawData): number | null {
  if (date <= BASELINE_DATE) return BASELINE_NAV;

  // 1. Units in issue — only transactions up to (and including) this date
  const units = data.unitTxns
    .filter(t => t.txn_date <= date)
    .reduce((s, t) => s + Number(t.units), 0);
  if (units <= 0) return null;

  // 2. Stock equity — reconstruct holdings from trade history, then price them
  const holdingsMap = new Map<string, number>();
  for (const txn of data.portfolioTxns) {
    if (txn.transaction_date > date || !txn.stock_id) continue;
    const delta = txn.transaction_type === "sell"
      ? -(txn.quantity ?? 0)
      :  (txn.quantity ?? 0);
    holdingsMap.set(txn.stock_id, (holdingsMap.get(txn.stock_id) ?? 0) + delta);
  }
  const priceIdx = buildPriceIdx(data.stockPrices);
  let stockEquity = 0;
  for (const [sid, qty] of Array.from(holdingsMap.entries())) {
    if (qty <= 0) continue;
    const price = (priceIdx.get(sid) ?? []).find(p => p.price_date <= date)?.closing_price ?? 0;
    stockEquity += qty * price;
  }

  // 3. CHD mutual fund values — latest available valuation on or before date
  const latestFundVal = (name: string): number =>
    [...data.fundVals]
      .filter(v => v.fund_name === name && v.valuation_date <= date)
      .sort((a, b) => b.valuation_date.localeCompare(a.valuation_date))[0]?.value ?? 0;
  const mmf   = latestFundVal("CHD Money Market Fund");
  const param = latestFundVal("CHD Paramount Fund");

  // 4. Total liquid cash (bank + broker combined)
  const contribCash = data.contributions
    .filter(c => c.contribution_date <= date)
    .reduce((s, c) => s + Number(c.amount), 0);

  const txnCash = data.portfolioTxns
    .filter(t => t.transaction_date <= date)
    .reduce((s, t) => {
      const amt = Number(t.net_amount ?? 0);
      if (t.transaction_type === "buy" || t.transaction_type === "rights_issue") return s - amt;
      if (t.transaction_type === "sell" || t.transaction_type === "dividend")    return s + amt;
      return s;
    }, 0);

  // Exclude broker_transfer entries — they're internal bank↔broker movements
  const bankCash = data.bankLedger
    .filter(e => e.entry_date <= date && e.category !== "broker_transfer")
    .reduce((s, e) => s + Number(e.amount), 0);

  const totalFundValue = stockEquity + mmf + param + contribCash + txnCash + bankCash;
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
