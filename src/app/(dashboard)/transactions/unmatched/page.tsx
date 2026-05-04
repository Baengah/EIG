import { createClient, createServiceClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/Header";
import { formatCurrency } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, MinusCircle } from "lucide-react";
import { AttributeEntryButton } from "@/components/bank/AttributeEntryButton";

export const revalidate = 0;

const RESOLVED_LABEL: Record<string, string> = {
  contribution:    "Member Contribution",
  interest_income: "Interest Income",
  other_income:    "Other Income",
  bank_charge:     "Bank Charge",
  tax:             "Tax",
  broker_transfer: "Broker Transfer",
  ignored:         "Ignored",
};

export default async function UnmatchedPage() {
  const [supabase, svc] = await Promise.all([createClient(), createServiceClient()]);
  const { data: { user } } = await supabase.auth.getUser();

  const [entriesRes, membersRes, profileRes] = await Promise.all([
    svc.from("unmatched_bank_entries").select("*").order("entry_date", { ascending: false }),
    svc.from("members").select("id, full_name, member_number").order("full_name"),
    user ? supabase.from("profiles").select("role").eq("id", user.id).single() : null,
  ]);

  const entries = entriesRes.data ?? [];
  const members = membersRes.data ?? [];
  const isAdmin = profileRes?.data?.role === "admin";

  const pending  = entries.filter(e => e.status === "pending");
  const resolved = entries.filter(e => e.status === "resolved");
  const ignored  = entries.filter(e => e.status === "ignored");

  const pendingCredits = pending.filter(e => e.amount > 0).reduce((s, e) => s + Number(e.amount), 0);
  const pendingDebits  = pending.filter(e => e.amount < 0).reduce((s, e) => s + Math.abs(Number(e.amount)), 0);

  return (
    <div>
      <Header
        title="Unmatched Bank Entries"
        subtitle="Credits and debits from the Zenith statement not yet attributed to a category"
      />
      <div className="p-6 space-y-6">

        {/* ── Summary banner ──────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className={`rounded-xl border p-5 ${pending.length > 0 ? "bg-amber-50 border-amber-200 dark:bg-amber-900/10 dark:border-amber-700/30" : "bg-card border-border"}`}>
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <p className="text-xs font-medium text-muted-foreground">Pending Attribution</p>
            </div>
            <p className="text-2xl font-bold text-foreground">{pending.length}</p>
            {pendingCredits > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                {formatCurrency(pendingCredits)} credits · {formatCurrency(pendingDebits)} debits
              </p>
            )}
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="w-4 h-4 text-gain" />
              <p className="text-xs font-medium text-muted-foreground">Resolved</p>
            </div>
            <p className="text-2xl font-bold text-foreground">{resolved.length}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-1">
              <MinusCircle className="w-4 h-4 text-muted-foreground" />
              <p className="text-xs font-medium text-muted-foreground">Ignored</p>
            </div>
            <p className="text-2xl font-bold text-foreground">{ignored.length}</p>
          </div>
        </div>

        {/* ── Pending entries ──────────────────────────────────── */}
        {pending.length > 0 && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <h3 className="font-semibold text-foreground">Needs Attribution ({pending.length})</h3>
            </div>
            <div className="divide-y divide-border">
              {pending.map(entry => (
                <div key={entry.id} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-muted/20 transition-colors">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(entry.entry_date).toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "numeric" })}
                      </span>
                      <p className="font-medium text-foreground truncate">{entry.description}</p>
                    </div>
                    {(entry.bank_reference || entry.notes) && (
                      <p className="text-xs text-muted-foreground mt-0.5 ml-0">
                        {[entry.bank_reference, entry.notes].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <p className={`font-bold text-sm ${Number(entry.amount) >= 0 ? "text-gain" : "text-loss"}`}>
                      {Number(entry.amount) >= 0 ? "+" : ""}₦{Math.abs(Number(entry.amount)).toLocaleString("en-NG")}
                    </p>
                    {isAdmin && (
                      <AttributeEntryButton
                        entry={{ ...entry, amount: Number(entry.amount) }}
                        members={members}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {pending.length === 0 && (
          <div className="bg-card border border-border rounded-xl p-12 text-center">
            <CheckCircle2 className="w-10 h-10 text-gain mx-auto mb-3" />
            <p className="font-medium text-foreground">All entries attributed</p>
            <p className="text-sm text-muted-foreground mt-1">No unmatched bank statement entries remain.</p>
          </div>
        )}

        {/* ── Resolved / ignored ───────────────────────────────── */}
        {(resolved.length > 0 || ignored.length > 0) && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="font-semibold text-foreground">Resolved Entries ({resolved.length + ignored.length})</h3>
            </div>
            <div className="divide-y divide-border">
              {[...resolved, ...ignored].sort((a, b) => b.entry_date.localeCompare(a.entry_date)).map(entry => (
                <div key={entry.id} className="flex items-center justify-between gap-4 px-5 py-3 opacity-70 hover:opacity-100 transition-opacity">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(entry.entry_date).toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "numeric" })}
                      </span>
                      <p className="text-sm text-foreground truncate">{entry.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <p className={`text-sm font-medium ${Number(entry.amount) >= 0 ? "text-gain" : "text-loss"}`}>
                      {Number(entry.amount) >= 0 ? "+" : ""}₦{Math.abs(Number(entry.amount)).toLocaleString("en-NG")}
                    </p>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                      {RESOLVED_LABEL[entry.resolved_as ?? ""] ?? entry.resolved_as}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
