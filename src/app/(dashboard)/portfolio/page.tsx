import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/Header";
import { formatCurrency, formatPercent, formatNumber, isPositive } from "@/lib/utils";
import { TrendingUp, TrendingDown, PieChart, BarChart3, Users, Wallet, ArrowUpDown, Info } from "lucide-react";
import { AllocationChart, type AllocationSegment } from "@/components/portfolio/AllocationChart";
import { ComputeNavButton } from "@/components/nav/ComputeNavButton";
import { AddFundValuationButton } from "@/components/nav/AddFundValuationButton";
import { NavHistoryChart } from "@/components/nav/NavHistoryChart";
import { PriceContributionsButton } from "@/components/units/PriceContributionsButton";
import { TabBar } from "@/components/layout/TabBar";

export const revalidate = 60;

const TABS = [
  { id: "holdings", label: "Holdings" },
  { id: "nav",      label: "Fund NAV" },
  { id: "units",    label: "Units" },
];

export default async function PortfolioPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab = "holdings" } = await searchParams;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };
  const isAdmin = profile?.role === "admin";

  // ── Data for all tabs fetched in parallel ──────────────────────────
  const [
    holdingsRes, summaryRes, membersRes, contribsRes,
    dividendYieldsRes, portfolioYieldRes,
    navHistoryRes, fundValuationsRes,
    balancesRes, unitTxnsRes, latestNavRes,
  ] = await Promise.all([
    supabase.from("v_holdings_with_value").select("*").order("current_value", { ascending: false }),
    supabase.from("v_portfolio_summary").select("*").single(),
    supabase.from("members").select("id, full_name, member_number").eq("is_active", true).order("full_name"),
    supabase.from("member_contributions").select("member_id, amount"),
    supabase.from("v_dividend_yield").select("ticker, yield_pct, forward_yield_pct, ttm_dps, annual_income"),
    supabase.from("v_portfolio_dividend_yield").select("*").single(),
    supabase.from("fund_nav")
      .select("id, nav_date, nav_per_unit, total_fund_value, units_in_issue, stock_equity_value, mmf_value, paramount_value, cash_at_bank, cash_at_broker, liabilities, source")
      .order("nav_date", { ascending: false })
      .limit(180),
    supabase.from("mutual_fund_valuations").select("*").order("valuation_date", { ascending: false }).limit(10),
    supabase.from("v_member_unit_balances").select("*"),
    supabase.from("unit_transactions")
      .select("id, txn_date, txn_type, cash_amount, nav_per_unit, units, running_balance, notes, member_id")
      .order("txn_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("fund_nav").select("nav_per_unit, nav_date, units_in_issue").order("nav_date", { ascending: false }).limit(1).single(),
  ]);

  // ── Holdings tab data ──────────────────────────────────────────────
  const holdings = holdingsRes.data ?? [];
  const summary = summaryRes.data;
  const members = membersRes.data ?? [];
  const contribs = contribsRes.data ?? [];
  const dividendYields = Object.fromEntries(
    (dividendYieldsRes.data ?? []).map(d => [d.ticker, { yield_pct: Number(d.yield_pct), forward_yield_pct: Number(d.forward_yield_pct) }])
  );
  const portfolioYield = portfolioYieldRes.data;
  const stocks = holdings.filter(h => h.asset_type === "stock");
  const funds = holdings.filter(h => h.asset_type === "mutual_fund");
  const totalValue = summary?.total_value ?? 0;
  const totalCost = summary?.total_cost ?? 0;
  const gainLoss = summary?.total_unrealized_gain_loss ?? 0;
  const gainLossPct = summary?.overall_gain_loss_percent ?? 0;
  const positive = isPositive(gainLoss);

  const memberMap = new Map(members.map(m => [m.id, m]));
  const memberTotals = new Map<string, number>();
  for (const c of contribs) {
    memberTotals.set(c.member_id, (memberTotals.get(c.member_id) ?? 0) + Number(c.amount));
  }
  const totalContributed = Array.from(memberTotals.values()).reduce((a, b) => a + b, 0);
  const contributorRows = Array.from(memberTotals.entries())
    .map(([memberId, contributed]) => {
      const sharePct = totalContributed > 0 ? contributed / totalContributed : 0;
      return { memberId, member: memberMap.get(memberId), contributed, sharePct, attrCost: sharePct * totalCost, attrValue: sharePct * totalValue, attrGain: sharePct * gainLoss };
    })
    .sort((a, b) => b.contributed - a.contributed);

  const sectorMap = new Map<string, number>();
  for (const h of stocks) {
    const sector = h.sector ?? "Uncategorised";
    sectorMap.set(sector, (sectorMap.get(sector) ?? 0) + (h.current_value ?? 0));
  }
  const allocationData: AllocationSegment[] = [
    ...Array.from(sectorMap.entries()).map(([sector, value]) => ({
      name: sector, value, type: "stock",
      holdings: stocks.filter(h => (h.sector ?? "Uncategorised") === sector).sort((a, b) => (b.current_value ?? 0) - (a.current_value ?? 0)).map(h => ({ name: h.ticker ?? "Unknown", subName: h.company_name ?? undefined, value: h.current_value ?? 0 })),
    })),
    ...funds.map(h => ({ name: h.fund_name ?? "Fund", value: h.current_value ?? 0, type: "mutual_fund", holdings: [{ name: h.fund_name ?? "Fund", subName: h.fund_type ?? undefined, value: h.current_value ?? 0 }] })),
  ];

  // ── NAV tab data ───────────────────────────────────────────────────
  const navHistory = navHistoryRes.data ?? [];
  const latestNav = navHistory[0] ?? null;
  const baselineNav = navHistory.find(r => r.source === "baseline");
  const fundValuations = fundValuationsRes.data ?? [];
  const navChange = latestNav && baselineNav ? Number(latestNav.nav_per_unit) - Number(baselineNav.nav_per_unit) : null;
  const navChangePct = baselineNav && navChange !== null ? (navChange / Number(baselineNav.nav_per_unit)) * 100 : null;

  // ── Units tab data ─────────────────────────────────────────────────
  const balances = balancesRes.data ?? [];
  const unitTxns = unitTxnsRes.data ?? [];
  const latestNavRecord = latestNavRes.data;
  const totalUnits = balances.reduce((s, b) => s + Number(b.units_held), 0);
  const totalUnitValue = balances.reduce((s, b) => s + Number(b.current_value), 0);
  const totalInvested = balances.reduce((s, b) => s + Number(b.total_invested), 0);
  const memberNames = Object.fromEntries(balances.map(b => [b.member_id, b.full_name]));

  const unitTypeBadge: Record<string, string> = {
    baseline: "bg-blue-100 text-blue-700",
    issue: "bg-emerald-100 text-emerald-700",
    redeem: "bg-rose-100 text-rose-700",
  };

  return (
    <div>
      <Header title="Portfolio" subtitle="Holdings, fund NAV, and unit register" />
      <div className="p-4 sm:p-6 space-y-6">

        <TabBar tabs={TABS} activeTab={tab} />

        {/* ══════════════════════════════════════════════════════════
            TAB: HOLDINGS
        ══════════════════════════════════════════════════════════ */}
        {tab === "holdings" && (
          <>
            {/* Summary banner */}
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4">
              <div className="bg-card border border-border rounded-xl p-4">
                <p className="text-xs text-muted-foreground mb-1">Total Value</p>
                <p className="text-2xl font-bold text-foreground">{formatCurrency(totalValue)}</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-4">
                <p className="text-xs text-muted-foreground mb-1">Total Cost</p>
                <p className="text-2xl font-bold text-foreground">{formatCurrency(totalCost)}</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-4">
                <p className="text-xs text-muted-foreground mb-1">Unrealized Gain/Loss</p>
                <p className={`text-2xl font-bold ${positive ? "text-gain" : "text-loss"}`}>
                  {positive ? "+" : ""}{formatCurrency(gainLoss)}
                </p>
              </div>
              <div className="bg-card border border-border rounded-xl p-4">
                <p className="text-xs text-muted-foreground mb-1">Overall Return</p>
                <div className={`flex items-center gap-1 ${positive ? "text-gain" : "text-loss"}`}>
                  {positive ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                  <p className="text-2xl font-bold">{formatPercent(gainLossPct)}</p>
                </div>
              </div>
              <div className="bg-card border border-border rounded-xl p-4">
                <p className="text-xs text-muted-foreground mb-1">Portfolio Yield</p>
                <p className="text-2xl font-bold text-foreground">
                  {portfolioYield ? `${Number(portfolioYield.portfolio_yield_pct).toFixed(2)}%` : "—"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">TTM dividend yield</p>
              </div>
            </div>

            {/* Contributor breakdown */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-border flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                <h3 className="font-semibold text-foreground">Contributor Breakdown</h3>
              </div>
              {contributorRows.length === 0 ? (
                <div className="p-10 text-center"><p className="text-sm text-muted-foreground">No contributions recorded</p></div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/30">
                      <tr>
                        <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Member</th>
                        <th className="text-right px-3 py-3 text-xs font-medium text-muted-foreground">Contributed</th>
                        <th className="hidden sm:table-cell text-right px-3 py-3 text-xs font-medium text-muted-foreground">Share %</th>
                        <th className="hidden md:table-cell text-right px-3 py-3 text-xs font-medium text-muted-foreground">Cost</th>
                        <th className="hidden sm:table-cell text-right px-3 py-3 text-xs font-medium text-muted-foreground">Value</th>
                        <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Gains</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {contributorRows.map(({ memberId, member, contributed, sharePct, attrCost, attrValue, attrGain }) => (
                        <tr key={memberId} className="hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3">
                            <p className="font-medium text-foreground">{member?.full_name ?? "Unknown"}</p>
                            <p className="text-xs text-muted-foreground">{member?.member_number ?? ""}</p>
                          </td>
                          <td className="px-3 py-3 text-right text-foreground">{formatCurrency(contributed)}</td>
                          <td className="hidden sm:table-cell px-3 py-3 text-right text-foreground">{(sharePct * 100).toFixed(2)}%</td>
                          <td className="hidden md:table-cell px-3 py-3 text-right text-foreground">{formatCurrency(attrCost)}</td>
                          <td className="hidden sm:table-cell px-3 py-3 text-right font-medium text-foreground">{formatCurrency(attrValue)}</td>
                          <td className="px-4 py-3 text-right">
                            <span className={`font-medium ${attrGain >= 0 ? "text-gain" : "text-loss"}`}>
                              {attrGain >= 0 ? "+" : ""}{formatCurrency(attrGain)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {contributorRows.length > 1 && (
                      <tfoot className="bg-muted/20 border-t border-border">
                        <tr>
                          <td className="px-4 py-3 text-xs font-semibold text-muted-foreground">Total</td>
                          <td className="px-3 py-3 text-right font-bold text-foreground">{formatCurrency(totalContributed)}</td>
                          <td className="hidden sm:table-cell px-3 py-3 text-right font-bold text-foreground">100%</td>
                          <td className="hidden md:table-cell px-3 py-3 text-right font-bold text-foreground">{formatCurrency(totalCost)}</td>
                          <td className="hidden sm:table-cell px-3 py-3 text-right font-bold text-foreground">{formatCurrency(totalValue)}</td>
                          <td className="px-4 py-3 text-right">
                            <span className={`font-bold ${gainLoss >= 0 ? "text-gain" : "text-loss"}`}>
                              {gainLoss >= 0 ? "+" : ""}{formatCurrency(gainLoss)}
                            </span>
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              )}
            </div>

            {/* Allocation + Holdings */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <div className="bg-card border border-border rounded-xl p-5">
                <h3 className="font-semibold text-foreground mb-1">Allocation</h3>
                <p className="text-xs text-muted-foreground mb-4">Portfolio breakdown by asset</p>
                <AllocationChart data={allocationData} />
              </div>
              <div className="xl:col-span-2 flex flex-col gap-4">
                {stocks.length > 0 && (
                  <div className="bg-card border border-border rounded-xl overflow-hidden">
                    <div className="px-5 py-3 border-b border-border flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-primary" />
                      <h3 className="font-semibold text-foreground">NGX Stocks</h3>
                      <span className="text-xs text-muted-foreground ml-auto">{stocks.length} positions</span>
                    </div>
                    <HoldingsTable holdings={stocks} totalValue={totalValue} dividendYields={dividendYields} />
                  </div>
                )}
                {funds.length > 0 && (
                  <div className="bg-card border border-border rounded-xl overflow-hidden">
                    <div className="px-5 py-3 border-b border-border flex items-center gap-2">
                      <PieChart className="w-4 h-4 text-purple-600" />
                      <h3 className="font-semibold text-foreground">Mutual Funds</h3>
                      <span className="text-xs text-muted-foreground ml-auto">{funds.length} positions</span>
                    </div>
                    <HoldingsTable holdings={funds} totalValue={totalValue} />
                  </div>
                )}
                {holdings.length === 0 && (
                  <div className="bg-card border border-border rounded-xl p-12 text-center">
                    <BarChart3 className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                    <p className="font-medium text-foreground">No holdings yet</p>
                    <p className="text-sm text-muted-foreground mt-1">Add transactions or upload a contract note to record holdings</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* ══════════════════════════════════════════════════════════
            TAB: FUND NAV
        ══════════════════════════════════════════════════════════ */}
        {tab === "nav" && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-card border border-border rounded-xl p-4">
                <p className="text-xs text-muted-foreground mb-1">NAV per Unit</p>
                <p className="text-2xl font-bold text-foreground">
                  {latestNav ? `₦${Number(latestNav.nav_per_unit).toFixed(4)}` : "—"}
                </p>
                {navChangePct !== null && (
                  <p className={`text-xs mt-1 font-medium ${navChangePct >= 0 ? "text-gain" : "text-loss"}`}>
                    {navChangePct >= 0 ? "+" : ""}{navChangePct.toFixed(2)}% since baseline
                  </p>
                )}
              </div>
              <div className="bg-card border border-border rounded-xl p-4">
                <p className="text-xs text-muted-foreground mb-1">Total Fund Value</p>
                <p className="text-2xl font-bold text-foreground">
                  {latestNav ? formatCurrency(latestNav.total_fund_value) : "—"}
                </p>
                {latestNav && (
                  <p className="text-xs text-muted-foreground mt-1">
                    as at {new Date(latestNav.nav_date).toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "numeric" })}
                  </p>
                )}
              </div>
              <div className="bg-card border border-border rounded-xl p-4">
                <p className="text-xs text-muted-foreground mb-1">Units in Issue</p>
                <p className="text-2xl font-bold text-foreground">
                  {latestNav ? Number(latestNav.units_in_issue).toLocaleString("en-NG", { maximumFractionDigits: 4 }) : "—"}
                </p>
              </div>
              <div className="bg-card border border-border rounded-xl p-4">
                <p className="text-xs text-muted-foreground mb-1">Baseline NAV</p>
                <p className="text-2xl font-bold text-foreground">
                  {baselineNav ? `₦${Number(baselineNav.nav_per_unit).toFixed(2)}` : "—"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Par at 31-May-2026</p>
              </div>
            </div>

            {isAdmin && (
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex flex-wrap items-center gap-3">
                <Info className="w-4 h-4 text-amber-600 shrink-0" />
                <p className="text-sm text-amber-800 dark:text-amber-300 flex-1">
                  After updating the bank balance or adding a fund valuation, recompute the NAV to reflect today&apos;s dealing price.
                </p>
                <div className="flex gap-2 flex-wrap">
                  <AddFundValuationButton />
                  <ComputeNavButton />
                </div>
              </div>
            )}

            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-foreground flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-primary" />
                    NAV per Unit — History
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Dealing price per unit over time (₦)</p>
                </div>
                <span className="text-xs text-muted-foreground">{navHistory.length} data points</span>
              </div>
              <NavHistoryChart data={navHistory} />
            </div>

            {latestNav && (
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-border flex items-center gap-2">
                  <PieChart className="w-4 h-4 text-primary" />
                  <h3 className="font-semibold text-foreground">Fund Component Breakdown</h3>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {new Date(latestNav.nav_date).toLocaleDateString("en-NG", { day: "2-digit", month: "long", year: "numeric" })}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/30">
                      <tr>
                        <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Component</th>
                        <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground">Value (₦)</th>
                        <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground">Weight</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {[
                        { label: "NGX Equity Holdings", value: latestNav.stock_equity_value },
                        { label: "CHD Money Market Fund", value: latestNav.mmf_value },
                        { label: "CHD Paramount Fund", value: latestNav.paramount_value },
                        { label: "Cash at Bank (Zenith)", value: latestNav.cash_at_bank },
                        { label: "Cash at Broker (CHD)", value: latestNav.cash_at_broker },
                        ...(Number(latestNav.liabilities) !== 0
                          ? [{ label: "Liabilities", value: -Math.abs(Number(latestNav.liabilities)) }]
                          : []),
                      ].map(({ label, value }) => {
                        const v = Number(value);
                        const pct = Number(latestNav.total_fund_value) !== 0 ? (v / Number(latestNav.total_fund_value)) * 100 : 0;
                        return (
                          <tr key={label} className="hover:bg-muted/20">
                            <td className="px-5 py-3 text-foreground">{label}</td>
                            <td className={`px-5 py-3 text-right font-medium ${v < 0 ? "text-loss" : "text-foreground"}`}>
                              {v < 0 ? `(${formatCurrency(-v)})` : formatCurrency(v)}
                            </td>
                            <td className="px-5 py-3 text-right text-muted-foreground">{pct.toFixed(1)}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-muted/20 border-t border-border">
                      <tr>
                        <td className="px-5 py-3 font-semibold text-foreground">Total Fund Value</td>
                        <td className="px-5 py-3 text-right font-bold text-foreground">{formatCurrency(latestNav.total_fund_value)}</td>
                        <td className="px-5 py-3 text-right font-bold text-foreground">100%</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-border flex items-center gap-2">
                <Wallet className="w-4 h-4 text-purple-600" />
                <h3 className="font-semibold text-foreground">CHD Fund Valuations (Manual)</h3>
              </div>
              {fundValuations.length === 0 ? (
                <p className="p-5 text-sm text-muted-foreground">No valuations recorded. Add one above.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/30">
                      <tr>
                        <th className="text-left px-5 py-2.5 text-xs font-medium text-muted-foreground">Fund</th>
                        <th className="text-left px-5 py-2.5 text-xs font-medium text-muted-foreground">Date</th>
                        <th className="text-right px-5 py-2.5 text-xs font-medium text-muted-foreground">Value</th>
                        <th className="hidden sm:table-cell text-left px-5 py-2.5 text-xs font-medium text-muted-foreground">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {fundValuations.map(v => (
                        <tr key={v.id} className="hover:bg-muted/20">
                          <td className="px-5 py-3 text-foreground font-medium">{v.fund_name}</td>
                          <td className="px-5 py-3 text-muted-foreground">
                            {new Date(v.valuation_date).toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "numeric" })}
                          </td>
                          <td className="px-5 py-3 text-right font-medium text-foreground">{formatCurrency(v.value)}</td>
                          <td className="hidden sm:table-cell px-5 py-3 text-xs text-muted-foreground">{v.notes ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* ══════════════════════════════════════════════════════════
            TAB: UNITS
        ══════════════════════════════════════════════════════════ */}
        {tab === "units" && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-card border border-border rounded-xl p-4">
                <p className="text-xs text-muted-foreground mb-1">Total Units in Issue</p>
                <p className="text-2xl font-bold text-foreground">
                  {totalUnits.toLocaleString("en-NG", { maximumFractionDigits: 4 })}
                </p>
              </div>
              <div className="bg-card border border-border rounded-xl p-4">
                <p className="text-xs text-muted-foreground mb-1">NAV per Unit</p>
                <p className="text-2xl font-bold text-foreground">
                  {latestNavRecord ? `₦${Number(latestNavRecord.nav_per_unit).toFixed(4)}` : "—"}
                </p>
                {latestNavRecord && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(latestNavRecord.nav_date).toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "numeric" })}
                  </p>
                )}
              </div>
              <div className="bg-card border border-border rounded-xl p-4">
                <p className="text-xs text-muted-foreground mb-1">Total Fund Value</p>
                <p className="text-2xl font-bold text-foreground">{formatCurrency(totalUnitValue)}</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-4">
                <p className="text-xs text-muted-foreground mb-1">Total Invested</p>
                <p className="text-2xl font-bold text-foreground">{formatCurrency(totalInvested)}</p>
              </div>
            </div>

            {isAdmin && (
              <div className="flex items-center gap-3 flex-wrap">
                <p className="text-sm text-muted-foreground flex-1">
                  Run &quot;Price Contributions&quot; after computing the NAV to issue units for any contributions not yet priced.
                </p>
                <PriceContributionsButton />
              </div>
            )}

            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-border flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                <h3 className="font-semibold text-foreground">Member Unit Register</h3>
                <span className="text-xs text-muted-foreground ml-auto">{balances.length} members</span>
              </div>
              {balances.length === 0 ? (
                <p className="p-8 text-center text-sm text-muted-foreground">No unit balances found. Seed the baseline first.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/30">
                      <tr>
                        <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Member</th>
                        <th className="text-right px-3 py-3 text-xs font-medium text-muted-foreground">Units Held</th>
                        <th className="text-right px-3 py-3 text-xs font-medium text-muted-foreground">Ownership %</th>
                        <th className="hidden sm:table-cell text-right px-3 py-3 text-xs font-medium text-muted-foreground">Total Invested</th>
                        <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Current Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {balances.map(b => (
                        <tr key={b.member_id} className="hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3">
                            <p className="font-medium text-foreground">{b.full_name}</p>
                            <p className="text-xs text-muted-foreground">{b.member_number}</p>
                          </td>
                          <td className="px-3 py-3 text-right font-medium text-foreground">
                            {Number(b.units_held).toLocaleString("en-NG", { maximumFractionDigits: 4 })}
                          </td>
                          <td className="px-3 py-3 text-right text-foreground">{Number(b.ownership_pct).toFixed(2)}%</td>
                          <td className="hidden sm:table-cell px-3 py-3 text-right text-foreground">{formatCurrency(b.total_invested)}</td>
                          <td className="px-4 py-3 text-right font-medium text-foreground">{formatCurrency(b.current_value)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-muted/20 border-t border-border">
                      <tr>
                        <td className="px-4 py-3 font-semibold text-foreground text-xs">Total</td>
                        <td className="px-3 py-3 text-right font-bold text-foreground">{totalUnits.toLocaleString("en-NG", { maximumFractionDigits: 4 })}</td>
                        <td className="px-3 py-3 text-right font-bold text-foreground">100.00%</td>
                        <td className="hidden sm:table-cell px-3 py-3 text-right font-bold text-foreground">{formatCurrency(totalInvested)}</td>
                        <td className="px-4 py-3 text-right font-bold text-foreground">{formatCurrency(totalUnitValue)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-border flex items-center gap-2">
                <ArrowUpDown className="w-4 h-4 text-primary" />
                <h3 className="font-semibold text-foreground">Unit Transaction Ledger</h3>
                <span className="text-xs text-muted-foreground ml-auto">Most recent 50</span>
              </div>
              {unitTxns.length === 0 ? (
                <p className="p-8 text-center text-sm text-muted-foreground">No transactions yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/30">
                      <tr>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Date</th>
                        <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground">Member</th>
                        <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground">Type</th>
                        <th className="text-right px-3 py-2.5 text-xs font-medium text-muted-foreground">Cash (₦)</th>
                        <th className="hidden sm:table-cell text-right px-3 py-2.5 text-xs font-medium text-muted-foreground">NAV/unit</th>
                        <th className="text-right px-3 py-2.5 text-xs font-medium text-muted-foreground">Units</th>
                        <th className="hidden md:table-cell text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {unitTxns.map(t => (
                        <tr key={t.id} className="hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3 text-muted-foreground">
                            {new Date(t.txn_date).toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "2-digit" })}
                          </td>
                          <td className="px-3 py-3 text-foreground">{memberNames[t.member_id] ?? "—"}</td>
                          <td className="px-3 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${unitTypeBadge[t.txn_type] ?? "bg-muted text-muted-foreground"}`}>
                              {{ baseline: "Opening", issue: "Issue", redeem: "Redeem" }[t.txn_type] ?? t.txn_type}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-right text-foreground">{formatCurrency(Math.abs(Number(t.cash_amount)))}</td>
                          <td className="hidden sm:table-cell px-3 py-3 text-right text-muted-foreground">₦{Number(t.nav_per_unit).toFixed(4)}</td>
                          <td className={`px-3 py-3 text-right font-medium ${Number(t.units) >= 0 ? "text-gain" : "text-loss"}`}>
                            {Number(t.units) >= 0 ? "+" : ""}{Number(t.units).toLocaleString("en-NG", { maximumFractionDigits: 4 })}
                          </td>
                          <td className="hidden md:table-cell px-4 py-3 text-right text-foreground">
                            {Number(t.running_balance).toLocaleString("en-NG", { maximumFractionDigits: 4 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function HoldingsTable({
  holdings,
  totalValue,
  dividendYields = {},
}: {
  holdings: { id: string; ticker?: string | null; fund_name?: string | null; company_name?: string | null; fund_type?: string | null; sector?: string | null; quantity: number; average_cost: number; total_cost: number; current_price?: number | null; current_value: number; unrealized_gain_loss: number; gain_loss_percent: number; price_date?: string | null }[];
  totalValue: number;
  dividendYields?: Record<string, { yield_pct: number; forward_yield_pct: number }>;
}) {
  const showYield = Object.keys(dividendYields).length > 0;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/30">
          <tr>
            <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Asset</th>
            <th className="text-right px-3 py-2.5 text-xs font-medium text-muted-foreground">Units</th>
            <th className="hidden sm:table-cell text-right px-3 py-2.5 text-xs font-medium text-muted-foreground">Avg Cost</th>
            <th className="hidden sm:table-cell text-right px-3 py-2.5 text-xs font-medium text-muted-foreground">Price</th>
            <th className="text-right px-3 py-2.5 text-xs font-medium text-muted-foreground">Value</th>
            <th className="text-right px-3 py-2.5 text-xs font-medium text-muted-foreground">Gain/Loss</th>
            {showYield && <th className="hidden lg:table-cell text-right px-3 py-2.5 text-xs font-medium text-muted-foreground">Div. Yield</th>}
            <th className="hidden md:table-cell text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Weight</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {holdings.map(h => {
            const positive = isPositive(h.unrealized_gain_loss);
            const weight = totalValue > 0 ? ((h.current_value ?? 0) / totalValue) * 100 : 0;
            const dyInfo = h.ticker ? dividendYields[h.ticker] : undefined;
            return (
              <tr key={h.id} className="hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3">
                  <p className="font-medium text-foreground">{h.ticker ?? h.fund_name}</p>
                  <p className="text-xs text-muted-foreground truncate max-w-[100px] sm:max-w-none">{h.company_name ?? h.fund_type ?? h.sector ?? ""}</p>
                </td>
                <td className="px-3 py-3 text-right text-foreground text-sm">{formatNumber(h.quantity, 0)}</td>
                <td className="hidden sm:table-cell px-3 py-3 text-right text-foreground text-sm">{formatCurrency(h.average_cost)}</td>
                <td className="hidden sm:table-cell px-3 py-3 text-right">
                  <div className="text-foreground text-sm">{formatCurrency(h.current_price)}</div>
                  {h.price_date && (
                    <div className="text-xs text-muted-foreground">
                      {new Date(h.price_date).toLocaleDateString("en-NG", { day: "2-digit", month: "short" })}
                    </div>
                  )}
                </td>
                <td className="px-3 py-3 text-right font-medium text-foreground text-sm">{formatCurrency(h.current_value)}</td>
                <td className="px-3 py-3 text-right">
                  <p className={`font-medium text-sm ${positive ? "text-gain" : "text-loss"}`}>
                    {positive ? "+" : ""}{formatCurrency(h.unrealized_gain_loss)}
                  </p>
                  <p className={`text-xs ${positive ? "text-gain" : "text-loss"}`}>{formatPercent(h.gain_loss_percent)}</p>
                </td>
                {showYield && (
                  <td className="hidden lg:table-cell px-3 py-3 text-right">
                    {dyInfo && dyInfo.yield_pct > 0 ? (
                      <>
                        <p className="text-sm font-medium text-foreground">{dyInfo.yield_pct.toFixed(2)}%</p>
                        {dyInfo.forward_yield_pct > 0 && dyInfo.forward_yield_pct !== dyInfo.yield_pct && (
                          <p className="text-xs text-muted-foreground">{dyInfo.forward_yield_pct.toFixed(2)}% fwd</p>
                        )}
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                )}
                <td className="hidden md:table-cell px-4 py-3 text-right text-muted-foreground text-sm">{weight.toFixed(1)}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
