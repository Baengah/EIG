import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/Header";
import { formatCurrency, formatPercent, formatNumber, isPositive } from "@/lib/utils";
import { TrendingUp, TrendingDown, PieChart, BarChart3 } from "lucide-react";
import { AddTransactionButton } from "@/components/portfolio/AddTransactionButton";
import { AllocationChart } from "@/components/portfolio/AllocationChart";

export const revalidate = 300;

export default async function PortfolioPage() {
  const supabase = await createClient();

  const [holdingsRes, summaryRes] = await Promise.all([
    supabase
      .from("v_holdings_with_value")
      .select("*")
      .order("current_value", { ascending: false }),
    supabase.from("v_portfolio_summary").select("*").single(),
  ]);

  const holdings = holdingsRes.data ?? [];
  const summary = summaryRes.data;

  const stocks = holdings.filter((h) => h.asset_type === "stock");
  const funds = holdings.filter((h) => h.asset_type === "mutual_fund");

  const totalValue = summary?.total_value ?? 0;
  const totalCost = summary?.total_cost ?? 0;
  const gainLoss = summary?.total_unrealized_gain_loss ?? 0;
  const gainLossPct = summary?.overall_gain_loss_percent ?? 0;
  const positive = isPositive(gainLoss);

  // Allocation data for chart
  const allocationData = holdings.map((h) => ({
    name: h.ticker ?? h.fund_name ?? "Unknown",
    value: h.current_value ?? 0,
    type: h.asset_type,
  }));

  return (
    <div>
      <Header title="Portfolio" subtitle="Holdings, valuation, and return analysis" />
      <div className="p-6 space-y-6">

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

        {/* Allocation chart + breakdown */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-semibold text-foreground mb-1">Allocation</h3>
            <p className="text-xs text-muted-foreground mb-4">Portfolio breakdown by asset</p>
            <AllocationChart data={allocationData} />
            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">NGX Stocks</span>
                <span className="font-medium text-foreground">
                  {formatCurrency(summary?.stock_value ?? 0)}
                  <span className="text-xs text-muted-foreground ml-1">
                    ({totalValue > 0 ? (((summary?.stock_value ?? 0) / totalValue) * 100).toFixed(1) : 0}%)
                  </span>
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Mutual Funds</span>
                <span className="font-medium text-foreground">
                  {formatCurrency(summary?.fund_value ?? 0)}
                  <span className="text-xs text-muted-foreground ml-1">
                    ({totalValue > 0 ? (((summary?.fund_value ?? 0) / totalValue) * 100).toFixed(1) : 0}%)
                  </span>
                </span>
              </div>
            </div>
          </div>

          <div className="xl:col-span-2 flex flex-col gap-4">
            {/* Add transaction */}
            <div className="flex justify-end">
              <AddTransactionButton />
            </div>

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
            <th className="text-left px-5 py-2.5 text-xs font-medium text-muted-foreground">Asset</th>
            <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Units</th>
            <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Avg Cost</th>
            <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Current Price</th>
            <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Value</th>
            <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Gain/Loss</th>
            <th className="text-right px-5 py-2.5 text-xs font-medium text-muted-foreground">Weight</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {holdings.map((h) => {
            const positive = isPositive(h.unrealized_gain_loss);
            const weight = totalValue > 0 ? ((h.current_value ?? 0) / totalValue) * 100 : 0;
            return (
              <tr key={h.id} className="hover:bg-muted/20 transition-colors">
                <td className="px-5 py-3">
                  <p className="font-medium text-foreground">{h.ticker ?? h.fund_name}</p>
                  <p className="text-xs text-muted-foreground">{h.company_name ?? h.fund_type ?? h.sector ?? ""}</p>
                </td>
                <td className="px-4 py-3 text-right text-foreground">{formatNumber(h.quantity, 0)}</td>
                <td className="px-4 py-3 text-right text-foreground">{formatCurrency(h.average_cost)}</td>
                <td className="px-4 py-3 text-right">
                  <div className="text-foreground">{formatCurrency(h.current_price)}</div>
                  {h.price_date && (
                    <div className="text-xs text-muted-foreground">
                      {new Date(h.price_date).toLocaleDateString("en-NG", { day: "2-digit", month: "short" })}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-medium text-foreground">
                  {formatCurrency(h.current_value)}
                </td>
                <td className="px-4 py-3 text-right">
                  <p className={`font-medium ${positive ? "text-gain" : "text-loss"}`}>
                    {positive ? "+" : ""}{formatCurrency(h.unrealized_gain_loss)}
                  </p>
                  <p className={`text-xs ${positive ? "text-gain" : "text-loss"}`}>
                    {formatPercent(h.gain_loss_percent)}
                  </p>
                </td>
                <td className="px-5 py-3 text-right text-muted-foreground">{weight.toFixed(1)}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
