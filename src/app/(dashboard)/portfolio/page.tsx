import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/Header";
import { formatCurrency, formatPercent, formatNumber, isPositive } from "@/lib/utils";
import { TrendingUp, TrendingDown, PieChart, BarChart3, Users } from "lucide-react";
import { AllocationChart, type AllocationSegment } from "@/components/portfolio/AllocationChart";

export const revalidate = 300;

export default async function PortfolioPage() {
  const supabase = await createClient();

  const [holdingsRes, summaryRes, membersRes, contribsRes] = await Promise.all([
    supabase
      .from("v_holdings_with_value")
      .select("*")
      .order("current_value", { ascending: false }),
    supabase.from("v_portfolio_summary").select("*").single(),
    supabase.from("members").select("id, full_name, member_number").eq("is_active", true).order("full_name"),
    supabase.from("member_contributions").select("member_id, amount"),
  ]);

  const holdings = holdingsRes.data ?? [];
  const summary = summaryRes.data;
  const members = membersRes.data ?? [];
  const contribs = contribsRes.data ?? [];

  const stocks = holdings.filter((h) => h.asset_type === "stock");
  const funds = holdings.filter((h) => h.asset_type === "mutual_fund");

  const totalValue = summary?.total_value ?? 0;
  const totalCost = summary?.total_cost ?? 0;
  const gainLoss = summary?.total_unrealized_gain_loss ?? 0;
  const gainLossPct = summary?.overall_gain_loss_percent ?? 0;
  const positive = isPositive(gainLoss);

  // Contributor breakdown
  const memberMap = new Map(members.map(m => [m.id, m]));
  const memberTotals = new Map<string, number>();
  for (const c of contribs) {
    memberTotals.set(c.member_id, (memberTotals.get(c.member_id) ?? 0) + Number(c.amount));
  }
  const totalContributed = Array.from(memberTotals.values()).reduce((a, b) => a + b, 0);

  const contributorRows = Array.from(memberTotals.entries())
    .map(([memberId, contributed]) => {
      const sharePct = totalContributed > 0 ? contributed / totalContributed : 0;
      const attrCost = sharePct * totalCost;
      const attrValue = sharePct * totalValue;
      const attrGain = sharePct * gainLoss;
      const member = memberMap.get(memberId);
      return { memberId, member, contributed, sharePct, attrCost, attrValue, attrGain };
    })
    .sort((a, b) => b.contributed - a.contributed);

  // Allocation: stocks grouped by sector (with constituent tickers), mutual funds individually
  const sectorMap = new Map<string, number>();
  for (const h of stocks) {
    const sector = h.sector ?? "Uncategorised";
    sectorMap.set(sector, (sectorMap.get(sector) ?? 0) + (h.current_value ?? 0));
  }
  const allocationData: AllocationSegment[] = [
    ...Array.from(sectorMap.entries()).map(([sector, value]) => ({
      name: sector,
      value,
      type: "stock",
      holdings: stocks
        .filter((h) => (h.sector ?? "Uncategorised") === sector)
        .sort((a, b) => (b.current_value ?? 0) - (a.current_value ?? 0))
        .map((h) => ({ name: h.ticker ?? "Unknown", subName: h.company_name ?? undefined, value: h.current_value ?? 0 })),
    })),
    ...funds.map((h) => ({
      name: h.fund_name ?? "Fund",
      value: h.current_value ?? 0,
      type: "mutual_fund",
      holdings: [{ name: h.fund_name ?? "Fund", subName: h.fund_type ?? undefined, value: h.current_value ?? 0 }],
    })),
  ];

  return (
    <div>
      <Header title="Portfolio" subtitle="Holdings, valuation, and return analysis" />
      <div className="p-4 sm:p-6 space-y-6">

        {/* Summary banner */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
        </div>

        {/* Contributor breakdown */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            <div>
              <h3 className="font-semibold text-foreground">Contributor Breakdown</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Each member&apos;s share of cost, current valuation, and unrealized gains
              </p>
            </div>
          </div>

          {contributorRows.length === 0 ? (
            <div className="p-10 text-center">
              <Users className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm font-medium text-foreground">No contributions recorded</p>
              <p className="text-xs text-muted-foreground mt-1">Record member contributions to see the breakdown</p>
            </div>
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

        {/* Allocation chart + holdings */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-semibold text-foreground mb-1">Allocation</h3>
            <p className="text-xs text-muted-foreground mb-4">Portfolio breakdown by asset</p>
            <AllocationChart data={allocationData} />
          </div>

          <div className="xl:col-span-2 flex flex-col gap-4">
            {/* Stock holdings */}
            {stocks.length > 0 && (
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-border flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-primary" />
                  <h3 className="font-semibold text-foreground">NGX Stocks</h3>
                  <span className="text-xs text-muted-foreground ml-auto">{stocks.length} positions</span>
                </div>
                <HoldingsTable holdings={stocks} totalValue={totalValue} />
              </div>
            )}

            {/* Fund holdings */}
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
                <p className="text-sm text-muted-foreground mt-1">
                  Add transactions or upload a contract note to record holdings
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function HoldingsTable({ holdings, totalValue }: { holdings: { id: string; ticker?: string | null; fund_name?: string | null; company_name?: string | null; fund_type?: string | null; sector?: string | null; quantity: number; average_cost: number; total_cost: number; current_price?: number | null; current_value: number; unrealized_gain_loss: number; gain_loss_percent: number; price_date?: string | null }[]; totalValue: number }) {
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
            <th className="hidden md:table-cell text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Weight</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {holdings.map((h) => {
            const positive = isPositive(h.unrealized_gain_loss);
            const weight = totalValue > 0 ? ((h.current_value ?? 0) / totalValue) * 100 : 0;
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
                <td className="px-3 py-3 text-right font-medium text-foreground text-sm">
                  {formatCurrency(h.current_value)}
                </td>
                <td className="px-3 py-3 text-right">
                  <p className={`font-medium text-sm ${positive ? "text-gain" : "text-loss"}`}>
                    {positive ? "+" : ""}{formatCurrency(h.unrealized_gain_loss)}
                  </p>
                  <p className={`text-xs ${positive ? "text-gain" : "text-loss"}`}>
                    {formatPercent(h.gain_loss_percent)}
                  </p>
                </td>
                <td className="hidden md:table-cell px-4 py-3 text-right text-muted-foreground text-sm">{weight.toFixed(1)}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
