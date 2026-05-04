import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/Header";
import { formatCurrency, isPositive } from "@/lib/utils";
import { ArrowLeftRight, Upload, TrendingUp, TrendingDown, Wallet, DollarSign, Receipt, BarChart3 } from "lucide-react";
import { AddTransactionButton } from "@/components/portfolio/AddTransactionButton";
import { FileUpload } from "@/components/documents/FileUpload";

const TXN_COLORS: Record<string, string> = {
  buy: "bg-blue-100 text-blue-700",
  sell: "bg-rose-100 text-rose-700",
  dividend: "bg-emerald-100 text-emerald-700",
  rights_issue: "bg-purple-100 text-purple-700",
  bonus: "bg-amber-100 text-amber-700",
  transfer_in: "bg-teal-100 text-teal-700",
  transfer_out: "bg-orange-100 text-orange-700",
};

export const revalidate = 60;

export default async function TransactionsPage() {
  const supabase = await createClient();

  const [txnsRes, contribsRes, summaryRes, brokersRes] = await Promise.all([
    supabase
      .from("transactions")
      .select("*, stocks(ticker, company_name), mutual_funds(fund_name), broker_accounts(broker_name)")
      .order("transaction_date", { ascending: false })
      .limit(500),
    supabase.from("member_contributions").select("amount"),
    supabase.from("v_portfolio_summary").select("*").single(),
    supabase.from("broker_accounts").select("broker_name, cash_balance").eq("is_active", true),
  ]);

  const txns = txnsRes.data ?? [];
  const contribs = contribsRes.data ?? [];
  const summary = summaryRes.data;
  const brokers = brokersRes.data ?? [];

  // ── Contribution metrics ────────────────────────────────────
  const totalRaised = contribs.reduce((s, c) => s + Number(c.amount), 0);

  // ── Portfolio metrics ────────────────────────────────────────
  const portfolioValue = summary?.total_value ?? 0;
  const totalCost = summary?.total_cost ?? 0;
  const unrealizedGain = summary?.total_unrealized_gain_loss ?? 0;

  // ── Broker cash ──────────────────────────────────────────────
  const totalBrokerCash = brokers.reduce((s, b) => s + (b.cash_balance ?? 0), 0);

  // ── Transaction metrics ──────────────────────────────────────
  const buys = txns.filter(t => t.transaction_type === "buy");
  const sells = txns.filter(t => t.transaction_type === "sell");
  const dividends = txns.filter(t => t.transaction_type === "dividend");

  const totalBought = buys.reduce((s, t) => s + (t.net_amount ?? 0), 0);
  const totalSold = sells.reduce((s, t) => s + (t.net_amount ?? 0), 0);
  const totalDividends = dividends.reduce((s, t) => s + (t.net_amount ?? 0), 0);

  // ── Fee breakdown ────────────────────────────────────────────
  const totalBrokerage = txns.reduce((s, t) => s + (t.brokerage_fee ?? 0), 0);
  const totalSEC = txns.reduce((s, t) => s + (t.sec_fee ?? 0), 0);
  const totalCSCS = txns.reduce((s, t) => s + (t.cscs_fee ?? 0), 0);
  const totalStampDuty = txns.reduce((s, t) => s + (t.stamp_duty ?? 0), 0);
  const totalInvestmentFees = txns.reduce((s, t) => s + (t.total_fees ?? 0), 0);

  // ── Net P&L ──────────────────────────────────────────────────
  // (what we have now) vs (what was put in)
  const totalNow = portfolioValue + totalBrokerCash + totalDividends;
  const netPL = totalNow - totalRaised;
  const netPLPct = totalRaised > 0 ? (netPL / totalRaised) * 100 : 0;
  const plPositive = isPositive(netPL);

  return (
    <div>
      <Header title="Transactions" subtitle="Cash flows, investments, fees, and P&L" />
      <div className="p-6 space-y-6">

        {/* ── P&L Banner ─────────────────────────────────────── */}
        <div className={`rounded-xl border p-5 ${plPositive ? "bg-gain/5 border-gain/20" : "bg-loss/5 border-loss/20"}`}>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Net Return on Capital</p>
              <div className="flex items-center gap-2">
                {plPositive ? <TrendingUp className="w-5 h-5 text-gain" /> : <TrendingDown className="w-5 h-5 text-loss" />}
                <p className={`text-3xl font-bold ${plPositive ? "text-gain" : "text-loss"}`}>
                  {plPositive ? "+" : ""}{formatCurrency(netPL)}
                </p>
                <span className={`text-sm font-medium px-2 py-0.5 rounded-full ${plPositive ? "bg-gain/10 text-gain" : "bg-loss/10 text-loss"}`}>
                  {plPositive ? "+" : ""}{netPLPct.toFixed(2)}%
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                (Portfolio {formatCurrency(portfolioValue)} + Cash {formatCurrency(totalBrokerCash)} + Dividends {formatCurrency(totalDividends)}) − Capital Raised {formatCurrency(totalRaised)}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-right text-sm shrink-0">
              <div>
                <p className="text-xs text-muted-foreground">Unrealized Gain</p>
                <p className={`font-semibold ${unrealizedGain >= 0 ? "text-gain" : "text-loss"}`}>
                  {unrealizedGain >= 0 ? "+" : ""}{formatCurrency(unrealizedGain)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Fees Paid</p>
                <p className="font-semibold text-foreground">{formatCurrency(totalInvestmentFees)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Cash Flow Summary ──────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="w-3.5 h-3.5 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Total Raised</p>
            </div>
            <p className="text-xl font-bold text-foreground">{formatCurrency(totalRaised)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{contribs.length} contributions</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="w-3.5 h-3.5 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Invested (cost)</p>
            </div>
            <p className="text-xl font-bold text-foreground">{formatCurrency(totalCost)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{buys.length} buy orders</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Cash at Broker</p>
            </div>
            <p className="text-xl font-bold text-foreground">{formatCurrency(totalBrokerCash)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{brokers.length} broker{brokers.length !== 1 ? "s" : ""}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Dividends</p>
            </div>
            <p className="text-xl font-bold text-gain">{formatCurrency(totalDividends)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{dividends.length} payment{dividends.length !== 1 ? "s" : ""}</p>
          </div>
        </div>

        {/* ── Fee Breakdown ──────────────────────────────────── */}
        {totalInvestmentFees > 0 && (
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Receipt className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-foreground">Fee Breakdown</h3>
              <span className="ml-auto text-sm font-bold text-foreground">{formatCurrency(totalInvestmentFees)} total</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              {[
                { label: "Brokerage", value: totalBrokerage },
                { label: "SEC Fee", value: totalSEC },
                { label: "CSCS Fee", value: totalCSCS },
                { label: "Stamp Duty", value: totalStampDuty },
              ].map(({ label, value }) => (
                <div key={label} className="bg-muted/30 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-1">{label}</p>
                  <p className="font-semibold text-foreground">{formatCurrency(value)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Entry options ──────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Upload className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-foreground">Upload Document</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Contract notes, bank statements, or valuation reports. Holdings extracted automatically.
            </p>
            <FileUpload />
          </div>
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <ArrowLeftRight className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-foreground">Manual Entry</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Record a buy, sell, dividend, bonus, rights issue, or transfer.
            </p>
            <AddTransactionButton />
          </div>
        </div>

        {/* ── Transaction History ────────────────────────────── */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-foreground">Transaction History</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{txns.length} record{txns.length !== 1 ? "s" : ""}</p>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>Bought <span className="font-semibold text-blue-600">{formatCurrency(totalBought)}</span></span>
              <span>Sold <span className="font-semibold text-rose-600">{formatCurrency(totalSold)}</span></span>
            </div>
          </div>

          {txns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ArrowLeftRight className="w-10 h-10 text-muted-foreground mb-3" />
              <p className="font-medium text-foreground">No transactions yet</p>
              <p className="text-sm text-muted-foreground mt-1">Add transactions manually or upload a contract note</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30">
                  <tr>
                    <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Date</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground">Type</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Asset</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Broker</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Qty</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Price</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Fees</th>
                    <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground">Net Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {txns.map((txn) => {
                    const colorClass = TXN_COLORS[txn.transaction_type] ?? "bg-muted text-muted-foreground";
                    const asset = (txn.stocks as { ticker?: string } | null)?.ticker
                      ?? (txn.mutual_funds as { fund_name?: string } | null)?.fund_name
                      ?? "—";
                    const assetSub = (txn.stocks as { company_name?: string } | null)?.company_name ?? "";
                    return (
                      <tr key={txn.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-5 py-3 text-muted-foreground whitespace-nowrap">
                          {new Date(txn.transaction_date).toLocaleDateString("en-NG", {
                            day: "2-digit", month: "short", year: "numeric",
                          })}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
                            {txn.transaction_type.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-foreground">{asset}</p>
                          {assetSub && <p className="text-xs text-muted-foreground">{assetSub}</p>}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {(txn.broker_accounts as { broker_name?: string } | null)?.broker_name ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-right text-foreground">
                          {txn.quantity?.toLocaleString("en-NG") ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-right text-foreground">
                          {txn.price ? formatCurrency(txn.price) : "—"}
                        </td>
                        <td className="px-4 py-3 text-right text-muted-foreground">
                          {txn.total_fees ? formatCurrency(txn.total_fees) : "—"}
                        </td>
                        <td className="px-5 py-3 text-right font-medium text-foreground">
                          {formatCurrency(txn.net_amount)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
