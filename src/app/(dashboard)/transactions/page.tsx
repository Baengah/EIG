import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/Header";
import { formatCurrency, isPositive } from "@/lib/utils";
import {
  ArrowLeftRight, Upload, TrendingUp, TrendingDown,
  Wallet, DollarSign, Receipt, BarChart3, ChevronLeft, ChevronRight,
} from "lucide-react";
import { AddTransactionButton } from "@/components/portfolio/AddTransactionButton";
import { FileUpload } from "@/components/documents/FileUpload";
import Link from "next/link";
import { TabBar } from "@/components/layout/TabBar";

const TABS = [
  { id: "ledger", label: "Ledger" },
  { id: "manual", label: "Manual Entry" },
  { id: "import", label: "Import" },
];

const PAGE_SIZE = 25;

const TXN_COLORS: Record<string, string> = {
  buy:          "bg-blue-100 text-blue-700",
  sell:         "bg-rose-100 text-rose-700",
  dividend:     "bg-emerald-100 text-emerald-700",
  rights_issue: "bg-purple-100 text-purple-700",
  bonus:        "bg-amber-100 text-amber-700",
  transfer_in:  "bg-teal-100 text-teal-700",
  transfer_out: "bg-orange-100 text-orange-700",
};

export const revalidate = 60;

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; page?: string }>;
}) {
  const { tab = "ledger", page: pageStr = "1" } = await searchParams;
  const currentPage = Math.max(1, parseInt(pageStr, 10) || 1);
  const offset = (currentPage - 1) * PAGE_SIZE;

  const supabase = await createClient();

  // ── Fetch summary data (all tabs) ──────────────────────────────────
  const [contribsRes, summaryRes, brokersRes] = await Promise.all([
    supabase.from("member_contributions").select("amount"),
    supabase.from("v_portfolio_summary").select("*").single(),
    supabase.from("broker_accounts").select("broker_name, cash_balance").eq("is_active", true),
  ]);

  const contribs = contribsRes.data ?? [];
  const summary = summaryRes.data;
  const brokers = brokersRes.data ?? [];

  const totalRaised     = contribs.reduce((s, c) => s + Number(c.amount), 0);
  const portfolioValue  = summary?.total_value ?? 0;
  const totalCost       = summary?.total_cost ?? 0;
  const unrealizedGain  = summary?.total_unrealized_gain_loss ?? 0;
  const totalBrokerCash = brokers.reduce((s, b) => s + (b.cash_balance ?? 0), 0);

  // ── Ledger tab: paginated fetch ────────────────────────────────────
  let txns: {
    id: string; transaction_date: string; transaction_type: string;
    quantity: number | null; price: number | null; net_amount: number | null;
    total_fees: number | null; brokerage_fee: number | null;
    sec_fee: number | null; cscs_fee: number | null; stamp_duty: number | null;
    stocks: { ticker?: string; company_name?: string } | null;
    mutual_funds: { fund_name?: string } | null;
    broker_accounts: { broker_name?: string } | null;
  }[] = [];
  let totalCount = 0;

  if (tab === "ledger") {
    const [countRes, dataRes] = await Promise.all([
      supabase.from("transactions").select("id", { count: "exact", head: true }),
      supabase
        .from("transactions")
        .select("id, transaction_date, transaction_type, quantity, price, net_amount, total_fees, brokerage_fee, sec_fee, cscs_fee, stamp_duty, stocks(ticker, company_name), mutual_funds(fund_name), broker_accounts(broker_name)")
        .order("transaction_date", { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1),
    ]);
    totalCount = countRes.count ?? 0;
    txns = (dataRes.data ?? []) as typeof txns;
  }

  // ── Fee/dividend totals for the banner (all transactions) ─────────
  const allTxnsRes = await supabase
    .from("transactions")
    .select("transaction_type, net_amount, total_fees");
  const allTxns = allTxnsRes.data ?? [];
  const dividendTxns = allTxns.filter(t => t.transaction_type === "dividend");
  const buyTxns      = allTxns.filter(t => t.transaction_type === "buy");
  const sellTxns     = allTxns.filter(t => t.transaction_type === "sell");
  const totalDividends    = dividendTxns.reduce((s, t) => s + (t.net_amount ?? 0), 0);
  const totalBought       = buyTxns.reduce((s, t) => s + (t.net_amount ?? 0), 0);
  const totalSold         = sellTxns.reduce((s, t) => s + (t.net_amount ?? 0), 0);
  const totalInvFees      = allTxns.reduce((s, t) => s + (t.total_fees ?? 0), 0);

  const totalNow   = portfolioValue + totalBrokerCash + totalDividends;
  const netPL      = totalNow - totalRaised;
  const netPLPct   = totalRaised > 0 ? (netPL / totalRaised) * 100 : 0;
  const plPositive = isPositive(netPL);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div>
      <Header title="Transactions" subtitle="Full ledger, manual entry, and data import" />
      <div className="p-4 sm:p-6 space-y-6">

        <TabBar tabs={TABS} activeTab={tab} />

        {/* ── P&L banner (always shown) ─────────────────────────── */}
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
              <p className="hidden sm:block text-xs text-muted-foreground mt-1">
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
                <p className="font-semibold text-foreground">{formatCurrency(totalInvFees)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Cash flow summary (always shown) ────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1"><Wallet className="w-3.5 h-3.5 text-muted-foreground" /><p className="text-xs text-muted-foreground">Total Raised</p></div>
            <p className="text-xl font-bold text-foreground">{formatCurrency(totalRaised)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{contribs.length} contributions</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1"><BarChart3 className="w-3.5 h-3.5 text-muted-foreground" /><p className="text-xs text-muted-foreground">Invested (cost)</p></div>
            <p className="text-xl font-bold text-foreground">{formatCurrency(totalCost)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{buyTxns.length} buy orders</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1"><DollarSign className="w-3.5 h-3.5 text-muted-foreground" /><p className="text-xs text-muted-foreground">Cash at Broker</p></div>
            <p className="text-xl font-bold text-foreground">{formatCurrency(totalBrokerCash)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{brokers.length} broker{brokers.length !== 1 ? "s" : ""}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1"><TrendingUp className="w-3.5 h-3.5 text-muted-foreground" /><p className="text-xs text-muted-foreground">Dividends</p></div>
            <p className="text-xl font-bold text-gain">{formatCurrency(totalDividends)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{dividendTxns.length} payment{dividendTxns.length !== 1 ? "s" : ""}</p>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════
            TAB: LEDGER
        ════════════════════════════════════════════════════════ */}
        {tab === "ledger" && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-wrap gap-3">
              <div>
                <h3 className="font-semibold text-foreground">Transaction History</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {totalCount} records · page {currentPage} of {Math.max(1, totalPages)}
                </p>
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
                <p className="text-sm text-muted-foreground mt-1">Switch to &quot;Manual Entry&quot; to add your first transaction</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/30">
                      <tr>
                        <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Date</th>
                        <th className="text-center px-3 py-3 text-xs font-medium text-muted-foreground">Type</th>
                        <th className="text-left px-3 py-3 text-xs font-medium text-muted-foreground">Asset</th>
                        <th className="hidden lg:table-cell text-left px-3 py-3 text-xs font-medium text-muted-foreground">Broker</th>
                        <th className="hidden sm:table-cell text-right px-3 py-3 text-xs font-medium text-muted-foreground">Qty</th>
                        <th className="hidden md:table-cell text-right px-3 py-3 text-xs font-medium text-muted-foreground">Price</th>
                        <th className="hidden md:table-cell text-right px-3 py-3 text-xs font-medium text-muted-foreground">Fees</th>
                        <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {txns.map(txn => {
                        const colorClass = TXN_COLORS[txn.transaction_type] ?? "bg-muted text-muted-foreground";
                        const asset = (txn.stocks as { ticker?: string } | null)?.ticker
                          ?? (txn.mutual_funds as { fund_name?: string } | null)?.fund_name
                          ?? "—";
                        const assetSub = (txn.stocks as { company_name?: string } | null)?.company_name ?? "";
                        return (
                          <tr key={txn.id} className="hover:bg-muted/20 transition-colors">
                            <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-xs">
                              {new Date(txn.transaction_date).toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "numeric" })}
                            </td>
                            <td className="px-3 py-3 text-center">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
                                {txn.transaction_type.replace(/_/g, " ")}
                              </span>
                            </td>
                            <td className="px-3 py-3">
                              <p className="font-medium text-foreground">{asset}</p>
                              {assetSub && <p className="text-xs text-muted-foreground truncate max-w-[120px]">{assetSub}</p>}
                            </td>
                            <td className="hidden lg:table-cell px-3 py-3 text-muted-foreground text-xs">
                              {(txn.broker_accounts as { broker_name?: string } | null)?.broker_name ?? "—"}
                            </td>
                            <td className="hidden sm:table-cell px-3 py-3 text-right text-foreground text-xs">
                              {txn.quantity?.toLocaleString("en-NG") ?? "—"}
                            </td>
                            <td className="hidden md:table-cell px-3 py-3 text-right text-foreground text-xs">
                              {txn.price ? formatCurrency(txn.price) : "—"}
                            </td>
                            <td className="hidden md:table-cell px-3 py-3 text-right text-muted-foreground text-xs">
                              {txn.total_fees ? formatCurrency(txn.total_fees) : "—"}
                            </td>
                            <td className="px-4 py-3 text-right font-medium text-foreground text-sm">
                              {formatCurrency(txn.net_amount)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="px-5 py-3 border-t border-border flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    Showing {offset + 1}–{Math.min(offset + PAGE_SIZE, totalCount)} of {totalCount}
                  </p>
                  <div className="flex items-center gap-2">
                    {currentPage > 1 ? (
                      <Link
                        href={`/transactions?tab=ledger&page=${currentPage - 1}`}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-muted/50 hover:bg-muted text-foreground transition-colors"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" /> Prev
                      </Link>
                    ) : (
                      <span className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground opacity-50 cursor-not-allowed">
                        <ChevronLeft className="w-3.5 h-3.5" /> Prev
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground px-2">{currentPage} / {Math.max(1, totalPages)}</span>
                    {currentPage < totalPages ? (
                      <Link
                        href={`/transactions?tab=ledger&page=${currentPage + 1}`}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-muted/50 hover:bg-muted text-foreground transition-colors"
                      >
                        Next <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    ) : (
                      <span className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground opacity-50 cursor-not-allowed">
                        Next <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════
            TAB: MANUAL ENTRY
        ════════════════════════════════════════════════════════ */}
        {tab === "manual" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-card border border-border rounded-xl p-6">
              <div className="flex items-center gap-2 mb-3">
                <ArrowLeftRight className="w-4 h-4 text-primary" />
                <h3 className="font-semibold text-foreground">Record Transaction</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-5">
                Record a buy, sell, dividend, bonus, rights issue, or transfer manually.
                Each entry updates holdings, broker cash, and portfolio metrics immediately.
              </p>
              <AddTransactionButton />
            </div>
            <div className="bg-card border border-border rounded-xl p-6">
              <div className="flex items-center gap-2 mb-3">
                <Receipt className="w-4 h-4 text-muted-foreground" />
                <h3 className="font-semibold text-foreground">Transaction Types</h3>
              </div>
              <div className="space-y-2">
                {[
                  { type: "buy", desc: "Purchase of NGX stock or mutual fund units" },
                  { type: "sell", desc: "Disposal of holdings at market or negotiated price" },
                  { type: "dividend", desc: "Cash dividend received from a holding" },
                  { type: "bonus", desc: "Bonus shares issued to existing shareholders" },
                  { type: "rights_issue", desc: "New shares purchased via rights offering" },
                  { type: "transfer_in", desc: "Assets transferred in from another account" },
                  { type: "transfer_out", desc: "Assets transferred out to another account" },
                ].map(({ type, desc }) => (
                  <div key={type} className="flex items-start gap-3">
                    <span className={`shrink-0 mt-0.5 inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${TXN_COLORS[type] ?? "bg-muted text-muted-foreground"}`}>
                      {type.replace(/_/g, " ")}
                    </span>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════
            TAB: IMPORT
        ════════════════════════════════════════════════════════ */}
        {tab === "import" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-card border border-border rounded-xl p-6">
              <div className="flex items-center gap-2 mb-3">
                <Upload className="w-4 h-4 text-primary" />
                <h3 className="font-semibold text-foreground">Upload Document</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-5">
                Contract notes, bank statements, or valuation reports. Holdings are extracted automatically from supported CHD contract note formats.
              </p>
              <FileUpload />
            </div>
            <div className="bg-card border border-border rounded-xl p-6">
              <div className="flex items-center gap-2 mb-3">
                <Receipt className="w-4 h-4 text-muted-foreground" />
                <h3 className="font-semibold text-foreground">Supported Formats</h3>
              </div>
              <div className="space-y-3">
                <div className="p-3 bg-muted/30 rounded-lg">
                  <p className="text-sm font-medium text-foreground">CHD Contract Notes (.pdf)</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    CHD Securities contract notes are parsed automatically. Buy and sell transactions are extracted with ticker, quantity, price, and all fee components.
                  </p>
                </div>
                <div className="p-3 bg-muted/30 rounded-lg">
                  <p className="text-sm font-medium text-foreground">Bank Statements (.pdf, .xlsx)</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Upload Zenith Bank statements. Contribution credits and bank charges are identified and attributed automatically.
                  </p>
                </div>
                <div className="p-3 bg-muted/30 rounded-lg">
                  <p className="text-sm font-medium text-foreground">Valuation Reports (.pdf)</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    CHD fund valuation reports are parsed to update MMF and Paramount Fund balances.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
