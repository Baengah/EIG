"use client";

import { useState } from "react";
import { X, Loader2, Tag } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface Member {
  id: string;
  full_name: string;
  member_number: string;
}

interface Entry {
  id: string;
  entry_date: string;
  description: string;
  amount: number;
  bank_reference: string | null;
  notes: string | null;
}

type ResolvedAs =
  | "contribution"
  | "interest_income"
  | "other_income"
  | "bank_charge"
  | "tax"
  | "broker_transfer"
  | "ignored";

const RESOLUTION_OPTIONS: { value: ResolvedAs; label: string; isLedger?: boolean; ledgerCategory?: string }[] = [
  { value: "contribution",     label: "Member Contribution" },
  { value: "interest_income",  label: "Interest Income",     isLedger: true, ledgerCategory: "interest_income" },
  { value: "other_income",     label: "Other Income",        isLedger: true, ledgerCategory: "other_income" },
  { value: "bank_charge",      label: "Bank Charge",         isLedger: true, ledgerCategory: "bank_charge" },
  { value: "tax",              label: "Tax (WHT / Stamp Duty)", isLedger: true, ledgerCategory: "tax" },
  { value: "broker_transfer",  label: "Broker Transfer",     isLedger: true, ledgerCategory: "broker_transfer" },
  { value: "ignored",          label: "Ignore (duplicate / error)" },
];

export function AttributeEntryButton({ entry, members }: { entry: Entry; members: Member[] }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resolvedAs, setResolvedAs] = useState<ResolvedAs>("contribution");
  const [memberId, setMemberId] = useState("");
  const [description, setDescription] = useState(entry.description);
  const router = useRouter();
  const supabase = createClient();

  function handleClose() {
    setOpen(false);
    setResolvedAs("contribution");
    setMemberId("");
    setDescription(entry.description);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const option = RESOLUTION_OPTIONS.find(o => o.value === resolvedAs)!;

      if (resolvedAs === "contribution") {
        if (!memberId) { toast.error("Select a member"); setLoading(false); return; }
        const { error } = await supabase.from("member_contributions").insert({
          member_id: memberId,
          amount: Math.abs(entry.amount),
          contribution_date: entry.entry_date,
          payment_method: "bank_transfer",
          bank_reference: entry.bank_reference ?? undefined,
          notes: description.trim() || undefined,
        });
        if (error) throw error;

      } else if (resolvedAs !== "ignored" && option.isLedger) {
        const { error } = await supabase.from("bank_ledger").insert({
          entry_date: entry.entry_date,
          description: description.trim(),
          amount: entry.amount,
          category: option.ledgerCategory! as "interest_income" | "bank_charge" | "tax" | "broker_transfer" | "other_income" | "other_expense",
          bank_reference: entry.bank_reference ?? undefined,
        });
        if (error) throw error;
      }

      // Mark the unmatched entry as resolved
      const { error: updateErr } = await supabase
        .from("unmatched_bank_entries")
        .update({
          status: resolvedAs === "ignored" ? "ignored" : "resolved",
          resolved_as: resolvedAs,
          resolved_at: new Date().toISOString(),
        })
        .eq("id", entry.id);
      if (updateErr) throw updateErr;

      toast.success(resolvedAs === "ignored" ? "Entry ignored" : `Attributed as ${option.label}`);
      handleClose();
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Attribution failed");
    } finally {
      setLoading(false);
    }
  }

  const isCredit = entry.amount >= 0;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 rounded-lg transition-colors"
      >
        <Tag className="w-3 h-3" />
        Attribute
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={handleClose}>
          <div className="bg-card border border-border rounded-xl w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="font-semibold text-foreground">Attribute Bank Entry</h2>
              <button onClick={handleClose} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-3 bg-muted/30 border-b border-border text-sm">
              <div className="flex justify-between items-start gap-2">
                <div>
                  <p className="text-muted-foreground text-xs">{entry.entry_date}</p>
                  <p className="font-medium text-foreground">{entry.description}</p>
                  {entry.bank_reference && <p className="text-xs text-muted-foreground mt-0.5">{entry.bank_reference}</p>}
                </div>
                <p className={`text-lg font-bold shrink-0 ${isCredit ? "text-gain" : "text-loss"}`}>
                  {isCredit ? "+" : ""}₦{Math.abs(entry.amount).toLocaleString("en-NG")}
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Attribute as</label>
                <select
                  value={resolvedAs}
                  onChange={e => setResolvedAs(e.target.value as ResolvedAs)}
                  className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {RESOLUTION_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              {resolvedAs === "contribution" && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Member</label>
                  <select
                    value={memberId}
                    onChange={e => setMemberId(e.target.value)}
                    required
                    className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Select member…</option>
                    {members.map(m => (
                      <option key={m.id} value={m.id}>{m.full_name} ({m.member_number})</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Description <span className="text-muted-foreground text-xs">(edit if needed)</span>
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 py-2.5 border border-input rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {loading ? "Saving…" : "Confirm"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
