import { createClient, createServiceClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/Header";
import { formatCurrency } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, ArrowUpRight, ArrowDownRight, FileText, BarChart3 } from "lucide-react";
import { AttributeEntryButton } from "@/components/bank/AttributeEntryButton";
import { AddBankStatementEntry } from "@/components/bank/AddBankStatementEntry";
import { EditBankEntryButton } from "@/components/bank/EditBankEntryButton";

type BankTxnRow = {
  id: string;
  txn_date: string;
  description: string;
  debit: number | null;
  credit: number | null;
  bank_reference: string | null;
  notes: string | null;
  status: "matched" | "unmatched" | "ignored";
  matched_type: string | null;
  matched_id: string | null;
};

export const revalidate = 0;

export default async function UnmatchedPage() {
  const [supabase, svc] = await Promise.all([createClient(), createServiceClient()]);
  const { data: { user } } = await supabase.auth.getUser();

  const [txnsRes, membersRes, categoriesRes, profileRes] = await Promise.all([
    svc.from("bank_statement_txns").select("*").order("txn_date", { ascending: false }),
    svc.from("members").select("id, full_name, member_number").order("full_name"),
    svc.from("ledger_categories").select("code, type, display_name, description").eq("is_active", true).order("sort_order"),
    user ? supabase.from("profiles").select("role").eq("id", user.id).single() : null,
  ]);

  const allTxns    = (txnsRes.data ?? []) as BankTxnRow[];
  const members    = membersRes.data ?? [];
  const categories = (categoriesRes.data ?? []) as { code: string; type: "income" | "cost" | "transfer"; display_name: string; description: string | null }[];
  const isAdmin    = profileRes?.data?.role === "admin";

  // Fetch bank_ledger categories for matched bank_ledger entries
  const bankLedgerIds = allTxns
    .filter(t => t.matched_type === "bank_ledger" && t.matched_id)
    .map(t => t.matched_id as string);

  const ledgerEntriesRes = bankLedgerIds.length > 0
    ? await svc.from("bank_ledger").select("id, category").in("id", bankLedgerIds)
    : { data: [] as { id: string; category: string }[] };

  const bankLedgerCategoryMap = new Map<string, string>(
    (ledgerEntriesRes.data ?? []).map(bl => [bl.id, bl.category])
  );
  const categoryDisplayMap = new Map<string, string>(
    categories.map(c => [c.code, c.display_name])
  );

  function getStatusLabel(txn: BankTxnRow): string {
    if (txn.status === "unmatched") return "Unmatched";
    if (txn.status === "ignored")   return "Ignored";
    if (txn.matched_type === "contribution") return "Contribution";
    if (txn.matched_type === "transaction")  return "Dividend";
    if (txn.matched_type === "bank_ledger") {
      const cat = bankLedgerCategoryMap.get(txn.matched_id as string);
      if (cat) return categoryDisplayMap.get(cat) ?? cat;
    }
    return "Matched";
  }

  const unmatched = allTxns.filter(t => t.status === "unmatched");
  const matched   = allTxns.filter(t => t.status === "matched");
  const ignored   = allTxns.filter(t => t.status === "ignored");

  const totalCredits  = allTxns.reduce((s, t) => s + (t.credit  ?? 0), 0);
  const totalDebits   = allTxns.reduce((s, t) => s + (t.debit   ?? 0), 0);
  const unmatchedAmt  = unmatched.reduce((s, t) => s + (t.credit ?? 0) - (t.debit ?? 0), 0);

  // Build cash statement groups
  interface CashGroup { label: string; count: number; total: number; isUnmatched: boolean; }
  const creditGroups = new Map<string, CashGroup>();
  const debitGroups  = new Map<string, CashGroup>();

  for (const txn of allTxns) {
    if (txn.status === "ignored") continue;
    const label       = getStatusLabel(txn);
    const isUnmatched = txn.status === "unmatched";
    if ((txn.credit ?? 0) > 0) {
      const g = creditGroups.get(label) ?? { label, count: 0, total: 0, isUnmatched };
      g.count++;
      g.total += txn.credit ?? 0;
      creditGroups.set(label, g);
    }
    if ((txn.debit ?? 0) > 0) {
      const g = debitGroups.get(label) ?? { label, count: 0, total: 0, isUnmatched };
      g.count++;
      g.total += txn.debit ?? 0;
      debitGroups.set(label, g);
    }
  }

  const creditLines = Array.from(creditGroups.values()).sort((a, b) => b.total - a.total);
  const debitLines  = Array.from(debitGroups.values()).sort((a, b) => b.total - a.total);

  return (
    <div>
      <Header
        title="Bank Reconciliation"
        subtitle="All Zenith statement entries matched against contributions, income, and cost records"
      />
      <div className="p-6 space-y-6">

        {/* ── Summary cards ─────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <FileText className="w-3.5 h-3.5 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Total Entries</p>
            </div>
            <p className="text-2xl font-bold text-foreground">{allTxns.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{matched.length} matched · {ignored.length} ignored</p>
          </div>
          <div className={`rounded-xl border p-4 ${unmatched.length > 0 ? "bg-amber-50 border-amber-200 dark:bg-amber-900/10 dark:border-amber-700/30" : "bg-card border-border"}`}>
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className={`w-3.5 h-3.5 ${unmatched.length > 0 ? "text-amber-500" : "text-muted-foreground"}`} />
              <p className="text-xs text-muted-foreground">Unmatched</p>
            </div>
            <p className="text-2xl font-bold text-foreground">{unmatched.length}</p>
            {unmatchedAmt !== 0 && (
              <p className={`text-xs mt-0.5 font-medium ${unmatchedAmt > 0 ? "text-gain" : "text-loss"}`}>
                {unmatchedAmt > 0 ? "+" : ""}{formatCurrency(unmatchedAmt)}
              </p>
            )}
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <ArrowUpRight className="w-3.5 h-3.5 text-gain" />
              <p className="text-xs text-muted-foreground">Total Credits</p>
            </div>
            <p className="text-xl font-bold text-gain">{formatCurrency(totalCredits)}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <ArrowDownRight className="w-3.5 h-3.5 text-loss" />
              <p className="text-xs text-muted-foreground">Total Debits</p>
            </div>
            <p className="text-xl font-bold text-loss">{formatCurrency(totalDebits)}</p>
          </div>
        </div>

        {/* ── Action bar ────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {unmatched.length > 0
              ? `${unmatched.length} entr${unmatched.length === 1 ? "y" : "ies"} need attribution`
              : "All entries are matched"}
          </p>
          {isAdmin && <AddBankStatementEntry />}
        </div>

        {/* ── Unmatched entries ─────────────────────────────── */}
        {unmatched.length > 0 && (
          <div className="bg-card border border-amber-200 dark:border-amber-700/30 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-amber-200 dark:border-amber-700/30 flex items-center gap-2 bg-amber-50/50 dark:bg-amber-900/10">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <h3 className="font-semibold text-foreground">Unmatched — Needs Attribution ({unmatched.length})</h3>
            </div>
            {!isAdmin && (
              <div className="px-5 py-3 text-sm text-amber-700 bg-amber-50/50 border-b border-amber-100">
                Admin access required to attribute entries.
              </div>
            )}
            <div className="divide-y divide-border">
              {unmatched.map(txn => (
                <div key={txn.id} className="flex items-start justify-between gap-4 px-5 py-4 hover:bg-muted/20 transition-colors">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(txn.txn_date).toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "numeric" })}
                      </span>
                      <p className="text-sm font-medium text-foreground">{txn.description}</p>
                    </div>
                    {txn.notes && <p className="text-xs text-muted-foreground mt-0.5">{txn.notes}</p>}
                    {txn.bank_reference && <p className="text-xs text-muted-foreground mt-0.5">Ref: {txn.bank_reference}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {txn.credit != null && (
                      <p className="font-bold text-sm text-gain">+₦{txn.credit.toLocaleString("en-NG")}</p>
                    )}
                    {txn.debit != null && (
                      <p className="font-bold text-sm text-loss">−₦{txn.debit.toLocaleString("en-NG")}</p>
                    )}
                    {isAdmin && <EditBankEntryButton entry={txn} />}
                    {isAdmin && (
                      <AttributeEntryButton entry={txn} members={members} categories={categories} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {unmatched.length === 0 && (
          <div className="bg-card border border-border rounded-xl p-10 text-center">
            <CheckCircle2 className="w-10 h-10 text-gain mx-auto mb-3" />
            <p className="font-medium text-foreground">Fully reconciled</p>
            <p className="text-sm text-muted-foreground mt-1">Every bank statement entry has been matched.</p>
          </div>
        )}

        {/* ── Cash Statement ────────────────────────────────── */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-foreground">Cash Statement</h3>
            <span className="text-xs text-muted-foreground ml-1">— categorised breakdown of all bank movements</span>
          </div>
          <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">

            {/* Credits */}
            <div>
              <div className="px-4 py-3 bg-gain/5 border-b border-border flex items-center gap-2">
                <ArrowUpRight className="w-3.5 h-3.5 text-gain" />
                <p className="text-xs font-semibold text-gain uppercase tracking-wide">Inflows (Credits)</p>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-muted/20 border-b border-border">
                  <tr>
                    <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Category</th>
                    <th className="text-center px-3 py-2 text-xs font-medium text-muted-foreground">Entries</th>
                    <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Amount (₦)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {creditLines.length === 0 ? (
                    <tr><td colSpan={3} className="px-4 py-4 text-center text-xs text-muted-foreground">No credit entries</td></tr>
                  ) : creditLines.map(g => (
                    <tr key={g.label} className={g.isUnmatched ? "bg-amber-50/30 dark:bg-amber-900/5" : "hover:bg-muted/10"}>
                      <td className="px-4 py-2.5 text-sm text-foreground">
                        {g.label}
                        {g.isUnmatched && (
                          <AlertTriangle className="inline w-3 h-3 text-amber-500 ml-1.5 -mt-0.5" />
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center text-xs text-muted-foreground">{g.count}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs text-gain tabular-nums">
                        {g.total.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-border bg-muted/20">
                  <tr>
                    <td colSpan={2} className="px-4 py-3 text-xs font-semibold text-muted-foreground">
                      Total Credits ({creditLines.reduce((s, g) => s + g.count, 0)})
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-gain text-xs tabular-nums">
                      {totalCredits.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Debits */}
            <div>
              <div className="px-4 py-3 bg-loss/5 border-b border-border flex items-center gap-2">
                <ArrowDownRight className="w-3.5 h-3.5 text-loss" />
                <p className="text-xs font-semibold text-loss uppercase tracking-wide">Outflows (Debits)</p>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-muted/20 border-b border-border">
                  <tr>
                    <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Category</th>
                    <th className="text-center px-3 py-2 text-xs font-medium text-muted-foreground">Entries</th>
                    <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Amount (₦)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {debitLines.length === 0 ? (
                    <tr><td colSpan={3} className="px-4 py-4 text-center text-xs text-muted-foreground">No debit entries</td></tr>
                  ) : debitLines.map(g => (
                    <tr key={g.label} className={g.isUnmatched ? "bg-amber-50/30 dark:bg-amber-900/5" : "hover:bg-muted/10"}>
                      <td className="px-4 py-2.5 text-sm text-foreground">
                        {g.label}
                        {g.isUnmatched && (
                          <AlertTriangle className="inline w-3 h-3 text-amber-500 ml-1.5 -mt-0.5" />
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center text-xs text-muted-foreground">{g.count}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs text-loss tabular-nums">
                        {g.total.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-border bg-muted/20">
                  <tr>
                    <td colSpan={2} className="px-4 py-3 text-xs font-semibold text-muted-foreground">
                      Total Debits ({debitLines.reduce((s, g) => s + g.count, 0)})
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-loss text-xs tabular-nums">
                      {totalDebits.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Net position */}
          <div className="px-5 py-3 border-t border-border bg-muted/10 flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Net Cash Position</p>
            <p className={`font-bold tabular-nums ${totalCredits - totalDebits >= 0 ? "text-gain" : "text-loss"}`}>
              {formatCurrency(totalCredits - totalDebits)}
            </p>
          </div>
        </div>

        {/* ── Full Statement ────────────────────────────────── */}
        {allTxns.length > 0 && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="font-semibold text-foreground">Full Statement ({allTxns.length} entries)</h3>
              <p className="text-xs text-muted-foreground mt-0.5">All bank entries with their reconciliation status</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 border-b border-border">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">Date</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Description</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Debit (₦)</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Credit (₦)</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground">Attribution</th>
                    {isAdmin && <th className="px-3 py-3"></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {allTxns.map(txn => {
                    const label = getStatusLabel(txn);
                    return (
                      <tr
                        key={txn.id}
                        className={`hover:bg-muted/20 transition-colors ${txn.status === "unmatched" ? "bg-amber-50/30 dark:bg-amber-900/5" : ""}`}
                      >
                        <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(txn.txn_date).toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "numeric" })}
                        </td>
                        <td className="px-4 py-2.5 max-w-xs">
                          <p className="text-foreground truncate">{txn.description}</p>
                          {txn.bank_reference && (
                            <p className="text-xs text-muted-foreground">{txn.bank_reference}</p>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-xs text-loss tabular-nums">
                          {txn.debit != null ? txn.debit.toLocaleString("en-NG", { minimumFractionDigits: 2 }) : ""}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-xs text-gain tabular-nums">
                          {txn.credit != null ? txn.credit.toLocaleString("en-NG", { minimumFractionDigits: 2 }) : ""}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {txn.status === "matched" && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-gain/10 text-gain font-medium whitespace-nowrap">
                              {label}
                            </span>
                          )}
                          {txn.status === "unmatched" && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 font-medium">
                              Unmatched
                            </span>
                          )}
                          {txn.status === "ignored" && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                              Ignored
                            </span>
                          )}
                        </td>
                        {isAdmin && (
                          <td className="px-3 py-2.5">
                            <EditBankEntryButton entry={txn} />
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="border-t-2 border-border bg-muted/20">
                  <tr>
                    <td colSpan={2} className="px-4 py-3 text-xs font-semibold text-muted-foreground">
                      Totals ({allTxns.length} entries)
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-loss text-xs tabular-nums">
                      {totalDebits.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-gain text-xs tabular-nums">
                      {totalCredits.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-center text-xs font-semibold text-foreground">
                      Net: {formatCurrency(totalCredits - totalDebits)}
                    </td>
                    {isAdmin && <td />}
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
