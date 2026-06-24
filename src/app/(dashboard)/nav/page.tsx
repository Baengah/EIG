import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/Header";
import { formatCurrency } from "@/lib/utils";
import { ComputeNavButton } from "@/components/nav/ComputeNavButton";
import { AddFundValuationButton } from "@/components/nav/AddFundValuationButton";
import { NavHistoryChart } from "@/components/nav/NavHistoryChart";
import { TrendingUp, BarChart3, Wallet, PieChart, Info } from "lucide-react";

export const revalidate = 60;

export default async function NavPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };
  const isAdmin = profile?.role === "admin";

  const [navHistoryRes, fundValuationsRes] = await Promise.all([
    supabase
      .from("fund_nav")
      .select("id, nav_date, nav_per_unit, total_fund_value, units_in_issue, stock_equity_value, mmf_value, paramount_value, cash_at_bank, cash_at_broker, liabilities, source")
      .order("nav_date", { ascending: false })
      .limit(180),
    supabase
      .from("mutual_fund_valuations")
      .select("*")
      .order("valuation_date", { ascending: false })
      .limit(10),
  ]);

  const history = navHistoryRes.data ?? [];
  const latest = history[0] ?? null;
  const baseline = history.find((r) => r.source === "baseline");
  const fundValuations = fundValuationsRes.data ?? [];

  const change = latest && baseline
    ? Number(latest.nav_per_unit) - Number(baseline.nav_per_unit)
    : null;
  const changePct = baseline && change !== null
    ? (change / Number(baseline.nav_per_unit)) * 100
    : null;

  const latestMMF = fundValuations.find((v) => v.fund_name === "CHD Money Market Fund");
  const latestParamount = fundValuations.find((v) => v.fund_name === "CHD Paramount Fund");

  return (
    <div>
      <Header
        title="Fund NAV"
        subtitle="Daily dealing price, NAV history, and fund component breakdown"
      />

      <div className="p-4 sm:p-6 space-y-6">

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">NAV per Unit</p>
            <p className="text-2xl font-bold text-foreground">
              {latest ? `₦${Number(latest.nav_per_unit).toFixed(4)}` : "—"}
            </p>
            {changePct !== null && (
              <p className={`text-xs mt-1 font-medium ${changePct >= 0 ? "text-gain" : "text-loss"}`}>
                {changePct >= 0 ? "+" : ""}{changePct.toFixed(2)}% since baseline
              </p>
            )}
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">Total Fund Value</p>
            <p className="text-2xl font-bold text-foreground">
              {latest ? formatCurrency(latest.total_fund_value) : "—"}
            </p>
            {latest && (
              <p className="text-xs text-muted-foreground mt-1">
                as at {new Date(latest.nav_date).toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "numeric" })}
              </p>
            )}
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">Units in Issue</p>
            <p className="text-2xl font-bold text-foreground">
              {latest ? Number(latest.units_in_issue).toLocaleString("en-NG", { maximumFractionDigits: 4 }) : "—"}
            </p>
            {baseline && (
              <p className="text-xs text-muted-foreground mt-1">
                Baseline: {Number(baseline.units_in_issue).toLocaleString("en-NG", { maximumFractionDigits: 4 })} (31-May-2026)
              </p>
            )}
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">Baseline NAV</p>
            <p className="text-2xl font-bold text-foreground">
              {baseline ? `₦${Number(baseline.nav_per_unit).toFixed(2)}` : "—"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Par at 31-May-2026</p>
          </div>
        </div>

        {/* Admin actions */}
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

        {/* NAV history chart */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                NAV per Unit — History
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Dealing price per unit over time (₦)
              </p>
            </div>
            <span className="text-xs text-muted-foreground">{history.length} data points</span>
          </div>
          <NavHistoryChart data={history} />
        </div>

        {/* Component breakdown */}
        {latest && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center gap-2">
              <PieChart className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-foreground">Fund Component Breakdown</h3>
              <span className="text-xs text-muted-foreground ml-auto">
                {new Date(latest.nav_date).toLocaleDateString("en-NG", {
                  day: "2-digit", month: "long", year: "numeric",
                })}
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
                    { label: "NGX Equity Holdings", icon: BarChart3, value: latest.stock_equity_value },
                    { label: "CHD Money Market Fund", icon: Wallet, value: latest.mmf_value },
                    { label: "CHD Paramount Fund", icon: Wallet, value: latest.paramount_value },
                    { label: "Cash at Bank (Zenith)", icon: Wallet, value: latest.cash_at_bank },
                    { label: "Cash at Broker (CHD)", icon: Wallet, value: latest.cash_at_broker },
                    ...(Number(latest.liabilities) !== 0
                      ? [{ label: "Liabilities", icon: Wallet, value: -Math.abs(Number(latest.liabilities)) }]
                      : []),
                  ].map(({ label, value }) => {
                    const v = Number(value);
                    const pct = Number(latest.total_fund_value) !== 0
                      ? (v / Number(latest.total_fund_value)) * 100
                      : 0;
                    return (
                      <tr key={label} className="hover:bg-muted/20">
                        <td className="px-5 py-3 text-foreground">{label}</td>
                        <td className={`px-5 py-3 text-right font-medium ${v < 0 ? "text-loss" : "text-foreground"}`}>
                          {v < 0 ? `(${formatCurrency(-v)})` : formatCurrency(v)}
                        </td>
                        <td className="px-5 py-3 text-right text-muted-foreground">
                          {pct.toFixed(1)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-muted/20 border-t border-border">
                  <tr>
                    <td className="px-5 py-3 font-semibold text-foreground">Total Fund Value</td>
                    <td className="px-5 py-3 text-right font-bold text-foreground">
                      {formatCurrency(latest.total_fund_value)}
                    </td>
                    <td className="px-5 py-3 text-right font-bold text-foreground">100%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* CHD fund valuations log */}
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
                  {fundValuations.map((v) => (
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

        {/* Latest CHD fund balances banner */}
        {(latestMMF || latestParamount) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {latestMMF && (
              <div className="bg-card border border-border rounded-xl p-4">
                <p className="text-xs text-muted-foreground mb-1">CHD Money Market Fund</p>
                <p className="text-xl font-bold text-foreground">{formatCurrency(latestMMF.value)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  as at {new Date(latestMMF.valuation_date).toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "numeric" })}
                </p>
              </div>
            )}
            {latestParamount && (
              <div className="bg-card border border-border rounded-xl p-4">
                <p className="text-xs text-muted-foreground mb-1">CHD Paramount Fund</p>
                <p className="text-xl font-bold text-foreground">{formatCurrency(latestParamount.value)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  as at {new Date(latestParamount.valuation_date).toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "numeric" })}
                </p>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
