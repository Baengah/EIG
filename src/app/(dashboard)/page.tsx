import { createClient, createServiceClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/Header";
import { formatCurrency, formatPercent, isPositive } from "@/lib/utils";
import {
  TrendingUp, TrendingDown, BarChart3, ArrowUpRight,
  Calendar, RefreshCw, Wallet, Users, Receipt, Landmark,
} from "lucide-react";
import Link from "next/link";
import { PortfolioChart } from "@/components/dashboard/PortfolioChart";
import {
  computeCurrentNav, sumLatestFundVals, monthEnd,
  BASELINE_NAV,
} from "@/lib/navEngine";

export const revalidate = 300;

function returnBadge(pct: number | null) {
  if (pct === null) return <span className="text-muted-foreground text-xs">—</span>;
  const pos = pct >= 0;
  return (
    <span className={`text-sm font-bold ${pos ? "text-gain" : "text-loss"}`}>
      {pos ? "+" : ""}{pct.toFixed(2)}%
    </span>
  );
}

async function getDashboardData() {
  const [supabase, svc] = await Promise.all([createClient(), createServiceClient()]);

  // ── Round 1: all non-price data in parallel ────────────────────────
  const [
    summaryRes, snapshotRes, holdingsRes,
    allTxnsRes, ledgerRes, activeMembersRes,
    allContribsRes, periodRes, fundValsRes, unitTxnsRes, brokersRes,
  ] = await Promise.all([
    supabase.from("v_portfolio_summary").select("*").single(),
    supabase.from("portfolio_snapshots")
      .select("snapshot_date, total_value, gain_loss_percent")
      .order("snapshot_date", { ascending: false })
      .limit(60),
    supabase.from("v_holdings_with_value")
      .select("id, ticker, company_name, fund_name, gain_loss_percent, unrealized_gain_loss, current_value, asset_type")
      .order("gain_loss_percent", { ascending: false }),
    svc.from("transactions")
      .select("id, transaction_date, transaction_type, stock_id, mutual_fund_id, quantity, net_amount, total_fees")
      .order("transaction_date", { ascending: false }),
    svc.from("bank_ledger").select("amount, category, entry_date"),
    supabase.from("members").select("id", { count: "exact" }).eq("is_active", true),
    svc.from("member_contributions").select("amount, contribution_date"),
    supabase.from("contribution_periods")
      .select("id, year, month, amount_per_member, due_date")
      .order("year", { ascending: false })
      .order("month", { ascending: false })
      .limit(1).single(),
    svc.from("mutual_fund_valuations").select("fund_name, valuation_date, value"),
    svc.from("unit_transactions").select("txn_date, units"),
    svc.from("broker_accounts").select("cash_balance").eq("is_active", true),
  ]);

  const allTxns    = allTxnsRes.data ?? [];
  const recentFive = allTxns.slice(0, 5);

  // ── Round 2: name lookups for recent transactions only ─────────────
  const recentStockIds = Array.from(new Set(recentFive.filter(t => t.stock_id).map(t => t.stock_id!)));
  const recentFundIds  = Array.from(new Set(recentFive.filter(t => t.mutual_fund_id).map(t => t.mutual_fund_id!)));

  const [stockNamesRes, fundNamesRes] = await Promise.all([
    recentStockIds.length > 0
      ? supabase.from("stocks").select("id, ticker, company_name").in("id", recentStockIds)
      : Promise.resolve({ data: [] as { id: string; ticker: string; company_name: string }[] }),
    recentFundIds.length > 0
      ? supabase.from("mutual_funds").select("id, fund_name").in("id", recentFundIds)
      : Promise.resolve({ data: [] as { id: string; fund_name: string }[] }),
  ]);

  // ── Derived NAV (direct asset-value formula) ───────────────────────
  // stock_equity: v_portfolio_summary (holdings × current prices) — same source as P&L banner
  // CHD_funds:    latest mutual_fund_valuations per fund
  // broker_cash:  broker_accounts.cash_balance (admin-maintained; can be negative post-settlement)
  // dividends:    sum of dividend receipts — proxy for Zenith bank cash balance
  const stockEquity   = summaryRes.data?.total_value ?? 0;
  const fundVals      = (fundValsRes.data ?? []).map(v => ({
    fund_name: v.fund_name, valuation_date: v.valuation_date, value: Number(v.value),
  }));
  const CHDTotal      = sumLatestFundVals(fundVals);
  const brokerCash    = (brokersRes.data ?? []).reduce((s, b) => s + Number(b.cash_balance ?? 0), 0);
  const dividendsCash = allTxns
    .filter(t => t.transaction_type === "dividend")
    .reduce((s, t) => s + Number(t.net_amount ?? 0), 0);
  const totalUnits    = (unitTxnsRes.data ?? []).reduce((s, t) => s + Number(t.units), 0);

  const navToday = computeCurrentNav(stockEquity, CHDTotal, brokerCash, dividendsCash, totalUnits);

  // ── Daily change (latest snapshot vs prior trading day) ────────────
  const snapshots = snapshotRes.data ?? [];
  const [latestSnap, prevSnap] = snapshots;
  const dailyChange = (latestSnap && prevSnap)
    ? Number(latestSnap.total_value) - Number(prevSnap.total_value)
    : null;
  const dailyChangePercent = (dailyChange !== null && Number(prevSnap.total_value) !== 0)
    ? (dailyChange / Number(prevSnap.total_value)) * 100
    : null;

  // MTD / YTD require a stored period-end NAV — not available yet.
  // Inception is the only reliable metric: how much has NAV grown since the ₦100 par baseline.
  const today    = new Date();
  const todayStr = today.toISOString().split("T")[0];

  const returns = {
    mtd:       null as number | null,   // needs stored June-end NAV snapshot
    ytd:       null as number | null,   // fund started June 2026, pre-Jan baseline irrelevant
    inception: navToday !== null ? ((navToday - BASELINE_NAV) / BASELINE_NAV) * 100 : null,
  };

  const monthlyReturns: import("@/lib/navEngine").MonthlyReturn[] = [];
  // Monthly period returns require stored per-end NAVs (compute_and_save_fund_nav() run regularly).
  // Until those are in fund_nav, we suppress the table to avoid misleading numbers.

  // ── Aggregate metrics ──────────────────────────────────────────────
  const allContribs      = allContribsRes.data ?? [];
  const totalContributions = allContribs.reduce((s, c) => s + Number(c.amount), 0);
  const summary          = summaryRes.data;
  const holdings         = holdingsRes.data ?? [];
  const totalDividends   = allTxns
    .filter(t => t.transaction_type === "dividend")
    .reduce((s, t) => s + Number(t.net_amount ?? 0), 0);
  const unrealizedGain   = summary?.total_unrealized_gain_loss ?? 0;

  const ledger = (ledgerRes.data ?? []).map(e => ({
    entry_date: e.entry_date,
    amount: Number(e.amount),
    category: e.category,
  }));
  const bankCharges  = ledger.filter(e => e.amount < 0 && e.category === "bank_charge")
    .reduce((s, e) => s + Math.abs(e.amount), 0);
  const bankTaxes    = ledger.filter(e => e.amount < 0 && e.category === "tax")
    .reduce((s, e) => s + Math.abs(e.amount), 0);
  const totalInvFees = allTxns.reduce((s, t) => s + Number(t.total_fees ?? 0), 0);

  // ── Best / worst stocks ────────────────────────────────────────────
  const stocks      = holdings.filter(h => h.asset_type === "stock" && h.gain_loss_percent != null);
  const bestStocks  = [...stocks].sort((a, b) => (b.gain_loss_percent ?? 0) - (a.gain_loss_percent ?? 0)).slice(0, 3);
  const worstStocks = [...stocks].sort((a, b) => (a.gain_loss_percent ?? 0) - (b.gain_loss_percent ?? 0)).slice(0, 3);

  // ── Enrich recent transactions ─────────────────────────────────────
  const stockMap = Object.fromEntries((stockNamesRes.data ?? []).map(s => [s.id, s]));
  const fundMap  = Object.fromEntries((fundNamesRes.data ?? []).map(f => [f.id, f]));
  const enrichedTxns = recentFive.map(t => ({
    ...t,
    stocks:       t.stock_id      ? (stockMap[t.stock_id] ?? null)      : null,
    mutual_funds: t.mutual_fund_id ? (fundMap[t.mutual_fund_id] ?? null) : null,
  }));

  return {
    summary,
    snapshots,
    dailyChange,
    dailyChangePercent,
    dailyChangeDate:     latestSnap?.snapshot_date ?? null,
    dailyChangePrevDate: prevSnap?.snapshot_date ?? null,
    returns,
    monthlyReturns,
    navToday,
    navDate:      todayStr,
    totalContributions,
    totalDividends,
    unrealizedGain,
    bankCharges,
    bankTaxes,
    totalInvFees,
    bestStocks,
    worstStocks,
    recentTxns:   enrichedTxns,
    topHoldings:  [...holdings].sort((a, b) => (b.current_value ?? 0) - (a.current_value ?? 0)).slice(0, 5),
    memberCount:  activeMembersRes.count ?? 0,
    latestPeriod: periodRes.data ?? null,
  };
}

export default async function DashboardPage() {
  const {
    summary, snapshots, dailyChange, dailyChangePercent, dailyChangeDate, dailyChangePrevDate,
    returns, monthlyReturns, navToday, navDate,
    totalContributions, totalDividends, unrealizedGain,
    bankCharges, bankTaxes, totalInvFees,
    bestStocks, worstStocks, recentTxns, topHoldings,
    memberCount, latestPeriod,
  } = await getDashboardData();

  const portfolioValue = summary?.total_value ?? 0;
  const totalCost      = summary?.total_cost ?? 0;
  const gainLoss       = summary?.total_unrealized_gain_loss ?? 0;
  const gainLossPct    = summary?.overall_gain_loss_percent ?? 0;
  const positive       = isPositive(gainLoss);

  return (
    <div>
      <Header
        title="Dashboard"
        subtitle={`Portfolio overview — ${new Date().toLocaleDateString("en-NG", {
          weekday: "long", day: "numeric", month: "long", year: "numeric",
        })}`}
      />

      <div className="p-4 sm:p-6 space-y-6">

        {/* ── Headline stats ──────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          <div className="bg-card rounded-xl border border-border p-5">
            <div className="flex items-start justify-between mb-3">
              <p className="text-sm font-medium text-muted-foreground">Portfolio Value</p>
              <div className="w-9 h-9 bg-blue-50 dark:bg-blue-950 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-blue-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground">{formatCurrency(portfolioValue)}</p>
            <p className={`text-xs mt-1 font-medium flex items-center gap-0.5 ${positive ? "text-gain" : "text-loss"}`}>
              {positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {formatPercent(gainLossPct)} unrealized
            </p>
          </div>
          <div className="bg-card rounded-xl border border-border p-5">
            <div className="flex items-start justify-between mb-3">
              <p className="text-sm font-medium text-muted-foreground">Today&apos;s Change</p>
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                dailyChange === null ? "bg-muted" : dailyChange >= 0 ? "bg-emerald-50 dark:bg-emerald-950" : "bg-rose-50 dark:bg-rose-950"
              }`}>
                {dailyChange === null || dailyChange >= 0
                  ? <TrendingUp className={`w-4 h-4 ${dailyChange === null ? "text-muted-foreground" : "text-gain"}`} />
                  : <TrendingDown className="w-4 h-4 text-loss" />}
              </div>
            </div>
            <p className={`text-2xl font-bold ${dailyChange === null ? "text-foreground" : dailyChange >= 0 ? "text-gain" : "text-loss"}`}>
              {dailyChange !== null ? `${dailyChange >= 0 ? "+" : ""}${formatCurrency(dailyChange)}` : "—"}
            </p>
            <p className="text-xs mt-1 font-medium text-muted-foreground">
              {dailyChangePercent !== null
                ? <span className={dailyChangePercent >= 0 ? "text-gain" : "text-loss"}>{formatPercent(dailyChangePercent)}</span>
                : null}
              {" "}
              {dailyChangeDate && dailyChangePrevDate
                ? `${new Date(dailyChangePrevDate).toLocaleDateString("en-NG", { day: "2-digit", month: "short" })} → ${new Date(dailyChangeDate).toLocaleDateString("en-NG", { day: "2-digit", month: "short" })}`
                : "Not enough snapshots yet"}
            </p>
          </div>
          <div className="bg-card rounded-xl border border-border p-5">
            <div className="flex items-start justify-between mb-3">
              <p className="text-sm font-medium text-muted-foreground">Capital Deployed</p>
              <div className="w-9 h-9 bg-purple-50 dark:bg-purple-950 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-purple-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground">{formatCurrency(totalCost)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {formatCurrency(totalContributions)} raised · {summary?.total_positions ?? 0} positions
            </p>
          </div>
          <div className="bg-card rounded-xl border border-border p-5">
            <div className="flex items-start justify-between mb-3">
              <p className="text-sm font-medium text-muted-foreground">Active Members</p>
              <div className="w-9 h-9 bg-emerald-50 dark:bg-emerald-950 rounded-lg flex items-center justify-center">
                <Users className="w-4 h-4 text-emerald-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground">{memberCount}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {latestPeriod
                ? `Latest period: ${latestPeriod.month}/${latestPeriod.year}`
                : "No active period"}
            </p>
          </div>
          <div className="bg-card rounded-xl border border-border p-5">
            <div className="flex items-start justify-between mb-3">
              <p className="text-sm font-medium text-muted-foreground">NAV per Unit</p>
              <div className="w-9 h-9 bg-gold-50 dark:bg-amber-950 rounded-lg flex items-center justify-center">
                <Wallet className="w-4 h-4 text-gold-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {navToday !== null ? `₦${navToday.toFixed(4)}` : "—"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {navToday !== null
                ? `derived as at ${new Date(navDate).toLocaleDateString("en-NG", { day: "2-digit", month: "short" })}`
                : "No units in issue"}
            </p>
          </div>
        </div>

        {/* ── Performance returns ──────────────────────────────── */}
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="font-semibold text-foreground mb-1">Performance Returns</h3>
          <p className="text-xs text-muted-foreground mb-4">
            NAV per unit — computed from portfolio positions, prices, and cash flows
          </p>

          {/* Summary metric cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-5">
            {[
              {
                label: "Month to Date",
                sub:   `vs ${monthEnd(new Date().getFullYear(), new Date().getMonth())} close`,
                value: returns.mtd,
              },
              {
                label: "Year to Date",
                sub:   "from ₦100 baseline · May 2026",
                value: returns.ytd,
              },
              {
                label: "Since Inception",
                sub:   navToday !== null ? `NAV ₦${navToday.toFixed(2)} vs ₦100 par` : "from ₦100 baseline",
                value: returns.inception,
              },
            ].map(({ label, sub, value }) => {
              const pos = value !== null && value >= 0;
              return (
                <div key={label} className="bg-muted/30 rounded-xl p-4">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <div className="mt-2">{returnBadge(value)}</div>
                  <p className="text-xs text-muted-foreground mt-1">{sub}</p>
                  {value !== null && (
                    <div className={`mt-2 h-1 rounded-full ${pos ? "bg-gain/20" : "bg-loss/20"}`}>
                      <div
                        className={`h-1 rounded-full ${pos ? "bg-gain" : "bg-loss"}`}
                        style={{ width: `${Math.min(Math.abs(value) * 4, 100)}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Monthly returns breakdown */}
          {monthlyReturns.length > 0 && (
            <div className="border-t border-border pt-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Monthly Returns
              </p>
              <div className="space-y-1.5">
                {[...monthlyReturns].reverse().map(r => (
                  <div key={r.ym} className="flex items-center justify-between text-sm py-1.5 px-3 rounded-lg bg-muted/20">
                    <span className="font-medium text-foreground w-20 shrink-0">
                      {r.label}
                    </span>
                    <span className="hidden sm:block text-xs text-muted-foreground flex-1 text-center px-2">
                      ₦{r.openNav.toFixed(2)} → ₦{r.closeNav.toFixed(2)}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      {r.isPartial && (
                        <span className="text-xs text-muted-foreground">partial</span>
                      )}
                      <span className={`font-bold text-sm w-16 text-right ${r.returnPct >= 0 ? "text-gain" : "text-loss"}`}>
                        {r.returnPct >= 0 ? "+" : ""}{r.returnPct.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              {monthlyReturns.some(r => r.isPartial) && (
                <p className="text-xs text-muted-foreground mt-2">* Partial month, in progress</p>
              )}
            </div>
          )}
        </div>

        {/* ── Earnings & costs ────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-card rounded-xl border border-border p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-gain" />
              <h3 className="font-semibold text-foreground">Earnings</h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-foreground">Unrealized Gain</p>
                  <p className="text-xs text-muted-foreground">Mark-to-market on holdings</p>
                </div>
                <p className={`text-sm font-bold ${unrealizedGain >= 0 ? "text-gain" : "text-loss"}`}>
                  {unrealizedGain >= 0 ? "+" : ""}{formatCurrency(unrealizedGain)}
                </p>
              </div>
              <div className="h-px bg-border" />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-foreground">Dividends Received</p>
                  <p className="text-xs text-muted-foreground">Cash income from holdings</p>
                </div>
                <p className="text-sm font-bold text-gain">+{formatCurrency(totalDividends)}</p>
              </div>
              <div className="h-px bg-border" />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Total Earnings</p>
                </div>
                <p className={`text-sm font-bold ${(unrealizedGain + totalDividends) >= 0 ? "text-gain" : "text-loss"}`}>
                  {(unrealizedGain + totalDividends) >= 0 ? "+" : ""}{formatCurrency(unrealizedGain + totalDividends)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border p-5">
            <div className="flex items-center gap-2 mb-4">
              <Receipt className="w-4 h-4 text-muted-foreground" />
              <h3 className="font-semibold text-foreground">Costs</h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-foreground">Investment Fees</p>
                  <p className="text-xs text-muted-foreground">Brokerage, SEC, CSCS, stamp duty</p>
                </div>
                <p className="text-sm font-bold text-amber-600">−{formatCurrency(totalInvFees)}</p>
              </div>
              <div className="h-px bg-border" />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-foreground">Bank Charges</p>
                  <p className="text-xs text-muted-foreground">COT and account fees</p>
                </div>
                <p className="text-sm font-bold text-amber-600">−{formatCurrency(bankCharges)}</p>
              </div>
              <div className="h-px bg-border" />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-foreground">Taxes</p>
                  <p className="text-xs text-muted-foreground">VAT, stamp duty (bank)</p>
                </div>
                <p className="text-sm font-bold text-rose-600">−{formatCurrency(bankTaxes)}</p>
              </div>
              <div className="h-px bg-border" />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Total Costs</p>
                </div>
                <p className="text-sm font-bold text-loss">
                  −{formatCurrency(totalInvFees + bankCharges + bankTaxes)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Chart + Top Holdings ─────────────────────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="xl:col-span-2 bg-card rounded-xl border border-border p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-foreground">Portfolio Performance</h3>
                <p className="text-xs text-muted-foreground mt-0.5">60-day portfolio value history</p>
              </div>
              <Link href="/portfolio" className="text-xs text-primary hover:underline flex items-center gap-1">
                View holdings <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>
            <PortfolioChart snapshots={snapshots} />
          </div>

          <div className="bg-card rounded-xl border border-border p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground">Top Holdings</h3>
              <Link href="/portfolio" className="text-xs text-primary hover:underline">All holdings</Link>
            </div>
            {topHoldings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <BarChart3 className="w-8 h-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No holdings yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {topHoldings.map(h => {
                  const pct  = portfolioValue > 0 ? ((h.current_value ?? 0) / portfolioValue) * 100 : 0;
                  const gain = isPositive(h.unrealized_gain_loss);
                  return (
                    <div key={h.id}>
                      <div className="flex justify-between items-start mb-1">
                        <div>
                          <p className="text-sm font-medium text-foreground">{h.ticker ?? h.fund_name}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[140px]">{h.company_name ?? "Fund"}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-foreground">{formatCurrency(h.current_value)}</p>
                          <p className={`text-xs ${gain ? "text-gain" : "text-loss"}`}>{formatPercent(h.gain_loss_percent)}</p>
                        </div>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full">
                        <div className="h-1.5 bg-primary rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{pct.toFixed(1)}% of portfolio</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Best / Worst stocks ──────────────────────────────────── */}
        {(bestStocks.length > 0 || worstStocks.length > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-card rounded-xl border border-border p-5">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-4 h-4 text-gain" />
                <h3 className="font-semibold text-foreground">Best Performers</h3>
              </div>
              <div className="space-y-2">
                {bestStocks.map(s => (
                  <div key={s.id} className="flex items-center justify-between p-2.5 bg-gain/5 rounded-lg border border-gain/10">
                    <div>
                      <p className="text-sm font-medium text-foreground">{s.ticker ?? s.fund_name}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-[160px]">{s.company_name ?? ""}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gain">+{(s.gain_loss_percent ?? 0).toFixed(2)}%</p>
                      <p className="text-xs text-muted-foreground">+{formatCurrency(s.unrealized_gain_loss ?? 0)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-card rounded-xl border border-border p-5">
              <div className="flex items-center gap-2 mb-4">
                <TrendingDown className="w-4 h-4 text-loss" />
                <h3 className="font-semibold text-foreground">Worst Performers</h3>
              </div>
              <div className="space-y-2">
                {worstStocks.map(s => (
                  <div key={s.id} className="flex items-center justify-between p-2.5 bg-loss/5 rounded-lg border border-loss/10">
                    <div>
                      <p className="text-sm font-medium text-foreground">{s.ticker ?? s.fund_name}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-[160px]">{s.company_name ?? ""}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-loss">{(s.gain_loss_percent ?? 0).toFixed(2)}%</p>
                      <p className="text-xs text-muted-foreground">{formatCurrency(s.unrealized_gain_loss ?? 0)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Recent transactions ─────────────────────────────────── */}
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-foreground">Recent Transactions</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Latest portfolio activity</p>
            </div>
            <Link href="/transactions" className="text-xs text-primary hover:underline flex items-center gap-1">
              View all <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
          {recentTxns.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-sm text-muted-foreground">No transactions recorded yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 pr-4 text-xs font-medium text-muted-foreground">Date</th>
                    <th className="text-left py-2 pr-4 text-xs font-medium text-muted-foreground">Asset</th>
                    <th className="text-left py-2 pr-4 text-xs font-medium text-muted-foreground">Type</th>
                    <th className="hidden sm:table-cell text-right py-2 pr-4 text-xs font-medium text-muted-foreground">Qty</th>
                    <th className="text-right py-2 text-xs font-medium text-muted-foreground">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {recentTxns.map(txn => (
                    <tr key={txn.id} className="hover:bg-muted/40 transition-colors">
                      <td className="py-2.5 pr-4 text-muted-foreground">
                        {new Date(txn.transaction_date).toLocaleDateString("en-NG", { day: "2-digit", month: "short" })}
                      </td>
                      <td className="py-2.5 pr-4 font-medium text-foreground">
                        {(txn.stocks as { ticker?: string } | null)?.ticker
                          ?? (txn.mutual_funds as { fund_name?: string } | null)?.fund_name
                          ?? "—"}
                      </td>
                      <td className="py-2.5 pr-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          txn.transaction_type === "buy"      ? "bg-blue-100 text-blue-700" :
                          txn.transaction_type === "sell"     ? "bg-rose-100 text-rose-700" :
                          "bg-emerald-100 text-emerald-700"
                        }`}>{txn.transaction_type}</span>
                      </td>
                      <td className="hidden sm:table-cell py-2.5 pr-4 text-right text-foreground">
                        {txn.quantity?.toLocaleString() ?? "—"}
                      </td>
                      <td className="py-2.5 text-right font-medium text-foreground">
                        {formatCurrency(txn.net_amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <RefreshCw className="w-3 h-3" />
          <span>Prices updated daily at 6:00 PM WAT via NGX Exchange. Values are indicative.</span>
          <Calendar className="w-3 h-3 ml-1" />
          <Landmark className="w-3 h-3" />
          <span>equityinvestmentgroup.club</span>
        </div>
      </div>
    </div>
  );
}
