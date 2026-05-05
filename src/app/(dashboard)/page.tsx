import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/Header";
import { formatCurrency, formatPercent, isPositive, getMonthName } from "@/lib/utils";
import {
  TrendingUp, TrendingDown, Wallet, Users, BarChart3,
  ArrowUpRight, Calendar, RefreshCw
} from "lucide-react";
import Link from "next/link";
import { PortfolioChart } from "@/components/dashboard/PortfolioChart";

export const revalidate = 300; // Revalidate every 5 minutes

async function getDashboardData() {
  const supabase = await createClient();

  const [summary, snapshot, periodRes, recentTxns, topHoldings, activeMembersCount, contribSumRes] = await Promise.all([
    supabase.from("v_portfolio_summary").select("*").single(),
    supabase
      .from("portfolio_snapshots")
      .select("snapshot_date, total_value, gain_loss_percent")
      .order("snapshot_date", { ascending: false })
      .limit(30),
    supabase
      .from("contribution_periods")
      .select("id, year, month, amount_per_member, due_date")
      .order("year", { ascending: false })
      .order("month", { ascending: false })
      .limit(1)
      .single(),
    supabase
      .from("transactions")
      .select("id, transaction_date, transaction_type, quantity, net_amount, stock_id, mutual_fund_id")
      .order("transaction_date", { ascending: false })
      .limit(5),
    supabase
      .from("v_holdings_with_value")
      .select("*")
      .order("current_value", { ascending: false })
      .limit(5),
    supabase
      .from("members")
      .select("id", { count: "exact" })
      .eq("is_active", true),
    supabase.from("member_contributions").select("amount"),
  ]);

  // Fetch contribution counts for the latest period
  const latestPeriod = periodRes.data;
  let totalContribs = 0;
  let paidContribs = 0;
  if (latestPeriod?.id) {
    const contribStats = await supabase
      .from("contributions")
      .select("status")
      .eq("period_id", latestPeriod.id);
    totalContribs = contribStats.data?.length ?? 0;
    paidContribs = contribStats.data?.filter((c) => c.status === "paid").length ?? 0;
  }

  // Fetch stock/fund names for recent transactions
  const txns = recentTxns.data ?? [];
  const stockIds = txns.filter((t) => t.stock_id).map((t) => t.stock_id!);
  const fundIds = txns.filter((t) => t.mutual_fund_id).map((t) => t.mutual_fund_id!);
  const [stocksRes, fundsRes] = await Promise.all([
    stockIds.length > 0
      ? supabase.from("stocks").select("id, ticker, company_name").in("id", stockIds)
      : Promise.resolve({ data: [] as { id: string; ticker: string; company_name: string }[] }),
    fundIds.length > 0
      ? supabase.from("mutual_funds").select("id, fund_name").in("id", fundIds)
      : Promise.resolve({ data: [] as { id: string; fund_name: string }[] }),
  ]);
  const stockMap = Object.fromEntries((stocksRes.data ?? []).map((s) => [s.id, s]));
  const fundMap = Object.fromEntries((fundsRes.data ?? []).map((f) => [f.id, f]));
  const enrichedTxns = txns.map((t) => ({
    ...t,
    stocks: t.stock_id ? stockMap[t.stock_id] ?? null : null,
    mutual_funds: t.mutual_fund_id ? fundMap[t.mutual_fund_id] ?? null : null,
  }));

  const totalMemberContributions = (contribSumRes.data ?? []).reduce((sum, r) => sum + (r.amount ?? 0), 0);

  return {
    summary: summary.data,
    snapshots: snapshot.data ?? [],
    latestPeriod,
    totalContribs,
    paidContribs,
    recentTxns: enrichedTxns,
    topHoldings: topHoldings.data ?? [],
    memberCount: activeMembersCount.count ?? 0,
    totalMemberContributions,
  };
}

export default async function DashboardPage() {
  const { summary, snapshots, latestPeriod, totalContribs, paidContribs, recentTxns, topHoldings, memberCount, totalMemberContributions } = await getDashboardData();

  const portfolioValue = summary?.total_value ?? 0;
  const totalCost = summary?.total_cost ?? 0;
  const gainLoss = summary?.total_unrealized_gain_loss ?? 0;
  const gainLossPct = summary?.overall_gain_loss_percent ?? 0;
  const positive = isPositive(gainLoss);

  const pendingContribs = totalContribs - paidContribs;

  const stats = [
    {
      title: "Portfolio Value",
      value: formatCurrency(portfolioValue),
      change: formatPercent(gainLossPct),
      subtext: `${formatCurrency(gainLoss)} unrealized ${positive ? "gain" : "loss"}`,
      positive,
      icon: BarChart3,
      color: "bg-blue-50 dark:bg-blue-950",
      iconColor: "text-blue-600",
    },
    {
      title: "Total Invested",
      value: formatCurrency(totalCost),
      change: null,
      subtext: `${formatCurrency(totalMemberContributions)} raised · ${summary?.total_positions ?? 0} positions`,
      positive: true,
      icon: TrendingUp,
      color: "bg-purple-50 dark:bg-purple-950",
      iconColor: "text-purple-600",
    },
    {
      title: "Active Members",
      value: memberCount.toString(),
      change: null,
      subtext: latestPeriod
        ? `${paidContribs}/${totalContribs} paid — ${getMonthName(latestPeriod.month)} ${latestPeriod.year}`
        : "No active period",
      positive: pendingContribs === 0,
      icon: Users,
      color: "bg-emerald-50 dark:bg-emerald-950",
      iconColor: "text-emerald-600",
    },
    {
      title: "Monthly Contribution",
      value: latestPeriod ? formatCurrency(latestPeriod.amount_per_member) : "—",
      change: null,
      subtext: latestPeriod
        ? `Due ${new Date(latestPeriod.due_date).toLocaleDateString("en-NG", { day: "2-digit", month: "short" })}`
        : "No period set",
      positive: true,
      icon: Wallet,
      color: "bg-gold-50 dark:bg-amber-950",
      iconColor: "text-gold-600",
    },
  ];

  return (
    <div>
      <Header
        title="Dashboard"
        subtitle={`Portfolio overview — ${new Date().toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}`}
      />

      <div className="p-4 sm:p-6 space-y-6">
        {/* Stats grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <div key={stat.title} className="bg-card rounded-xl border border-border p-5">
              <div className="flex items-start justify-between mb-3">
                <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                <div className={`w-9 h-9 ${stat.color} rounded-lg flex items-center justify-center`}>
                  <stat.icon className={`w-4 h-4 ${stat.iconColor}`} />
                </div>
              </div>
              <p className="text-2xl font-bold text-foreground">{stat.value}</p>
              <div className="flex items-center gap-2 mt-1">
                {stat.change && (
                  <span className={`text-xs font-medium flex items-center gap-0.5 ${stat.positive ? "text-gain" : "text-loss"}`}>
                    {stat.positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {stat.change}
                  </span>
                )}
                <span className="text-xs text-muted-foreground">{stat.subtext}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Chart + Top Holdings */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="xl:col-span-2 bg-card rounded-xl border border-border p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-foreground">Portfolio Performance</h3>
                <p className="text-xs text-muted-foreground mt-0.5">30-day portfolio value history</p>
              </div>
              <Link
                href="/portfolio"
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                View holdings <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>
            <PortfolioChart snapshots={snapshots} />
          </div>

          <div className="bg-card rounded-xl border border-border p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground">Top Holdings</h3>
              <Link href="/portfolio" className="text-xs text-primary hover:underline">
                All holdings
              </Link>
            </div>
            {topHoldings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <BarChart3 className="w-8 h-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No holdings yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {topHoldings.map((h) => {
                  const pct = portfolioValue > 0 ? ((h.current_value ?? 0) / portfolioValue) * 100 : 0;
                  const gain = isPositive(h.unrealized_gain_loss);
                  return (
                    <div key={h.id}>
                      <div className="flex justify-between items-start mb-1">
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {h.ticker ?? h.fund_name}
                          </p>
                          <p className="text-xs text-muted-foreground truncate max-w-[140px]">
                            {h.company_name ?? h.fund_type}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-foreground">
                            {formatCurrency(h.current_value)}
                          </p>
                          <p className={`text-xs ${gain ? "text-gain" : "text-loss"}`}>
                            {formatPercent(h.gain_loss_percent)}
                          </p>
                        </div>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full">
                        <div
                          className="h-1.5 bg-primary rounded-full"
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{pct.toFixed(1)}% of portfolio</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Recent transactions */}
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
                  {recentTxns.map((txn) => (
                    <tr key={txn.id} className="hover:bg-muted/40 transition-colors">
                      <td className="py-2.5 pr-4 text-muted-foreground">
                        {new Date(txn.transaction_date).toLocaleDateString("en-NG", { day: "2-digit", month: "short" })}
                      </td>
                      <td className="py-2.5 pr-4 font-medium text-foreground">
                        {(txn.stocks as { ticker?: string } | null)?.ticker ?? (txn.mutual_funds as { fund_name?: string } | null)?.fund_name ?? "—"}
                      </td>
                      <td className="py-2.5 pr-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          txn.transaction_type === "buy" ? "bg-blue-100 text-blue-700" :
                          txn.transaction_type === "sell" ? "bg-rose-100 text-rose-700" :
                          "bg-emerald-100 text-emerald-700"
                        }`}>
                          {txn.transaction_type}
                        </span>
                      </td>
                      <td className="hidden sm:table-cell py-2.5 pr-4 text-right text-foreground">{txn.quantity?.toLocaleString() ?? "—"}</td>
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

        {/* Footer note */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <RefreshCw className="w-3 h-3" />
          <span>Prices updated daily at 6:00 PM WAT via NGX Exchange. Portfolio values are indicative.</span>
          <Calendar className="w-3 h-3 ml-1" />
          <span>equityinvestmentgroup.club</span>
        </div>
      </div>
    </div>
  );
}
