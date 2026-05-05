import { createClient, createServiceClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/Header";
import { formatCurrency } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, ArrowUpRight, ArrowDownRight, FileText } from "lucide-react";
import { AttributeEntryButton } from "@/components/bank/AttributeEntryButton";
import { AddBankStatementEntry } from "@/components/bank/AddBankStatementEntry";

export const revalidate = 0;

const MATCH_LABEL: Record<string, string> = {
  contribution: "Contribution",
  bank_ledger:  "Ledger",
  transaction:  "Dividend",
};

export default async function UnmatchedPage() {
  const [supabase, svc] = await Promise.all([createClient(), createServiceClient()]);
  const { data: { user } } = await supabase.auth.getUser();

  const [txnsRes, membersRes, categoriesRes, profileRes] = await Promise.all([
    svc.from("bank_statement_txns").select("*").order("txn_date", { ascending: false }),
    svc.from("members").select("id, full_name, member_number").order("full_name"),
    svc.from("ledger_categories").select("code, type, display_name, description").eq("is_active", true).order("sort_order"),
    user ? supabase.from("profiles").select("role").eq("id", user.id).single() : null,
  ]);

  const allTxns    = txnsRes.data ?? [];
  const members    = membersRes.data ?? [];
  const categories = (categoriesRes.data ?? []) as { code: string; type: "income" | "cost" | "transfer"; display_name: string; description: string | null }[];
  const isAdmin    = profileRes?.data?.role === "admin";

  const unmatched = allTxns.filter(t => t.status === "unmatched");
  const matched   = allTxns.filter(t => t.status === "matched");
  const ignored   = allTxns.filter(t => t.status === "ignored");

  const totalCredits  = allTxns.reduce((s, t) => s + (t.credit  ?? 0), 0);
  const totalDebits   = allTxns.reduce((s, t) => s + (t.debit   ?? 0), 0);
  const unmatchedAmt  = unmatched.reduce((s, t) => s + (t.credit ?? 0) - (t.debit ?? 0), 0);

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
                  <div className="flex items-center gap-3 shrink-0">
                    {txn.credit != null && (
                      <p className="font-bold text-sm text-gain">+₦{txn.credit.toLocaleString("en-NG")}</p>
                    )}
                    {txn.debit != null && (
                      <p className="font-bold text-sm text-loss">−₦{txn.debit.toLocaleString("en-NG")}</p>
                    )}
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

        {/* ── Full statement reconciliation ─────────────────── */}
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
                    <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {allTxns.map(txn => (
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
                        {txn.status === "matched" && txn.matched_type && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gain/10 text-gain font-medium">
                            {MATCH_LABEL[txn.matched_type] ?? txn.matched_type}
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
                    </tr>
                  ))}
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
