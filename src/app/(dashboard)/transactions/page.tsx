import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/Header";
import { formatCurrency } from "@/lib/utils";
import { ArrowLeftRight } from "lucide-react";
import { AddTransactionButton } from "@/components/portfolio/AddTransactionButton";

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

  const { data: transactions } = await supabase
    .from("transactions")
    .select("*, stocks(ticker, company_name), mutual_funds(fund_name), broker_accounts(broker_name)")
    .order("transaction_date", { ascending: false })
    .limit(200);

  const txns = transactions ?? [];

  const totalBuys = txns
    .filter((t) => t.transaction_type === "buy")
    .reduce((acc, t) => acc + (t.net_amount ?? 0), 0);
  const totalSells = txns
    .filter((t) => t.transaction_type === "sell")
    .reduce((acc, t) => acc + (t.net_amount ?? 0), 0);
  const totalDivs = txns
    .filter((t) => t.transaction_type === "dividend")
    .reduce((acc, t) => acc + (t.net_amount ?? 0), 0);

  return (
    <div>
      <Header title="Transactions" subtitle="All portfolio transactions and trade history" />
      <div className="p-6 space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">Total Transactions</p>
            <p className="text-2xl font-bold text-foreground">{txns.length}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">Total Bought</p>
            <p className="text-2xl font-bold text-blue-600">{formatCurrency(totalBuys)}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">Total Sold</p>
            <p className="text-2xl font-bold text-rose-600">{formatCurrency(totalSells)}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">Dividends Received</p>
            <p className="text-2xl font-bold text-gain">{formatCurrency(totalDivs)}</p>
          </div>
        </div>

        {/* Add transaction */}
        <div className="flex justify-end">
          <AddTransactionButton />
        </div>

        {/* Transaction table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="font-semibold text-foreground">Transaction History</h3>
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
                        <td className="px-5 py-3 text-muted-foreground">
                          {new Date(txn.transaction_date).toLocaleDateString("en-NG", {
                            day: "2-digit", month: "short", year: "numeric"
                          })}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
                            {txn.transaction_type.replace("_", " ")}
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
