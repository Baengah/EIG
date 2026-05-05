"use client";

import { useState } from "react";
import { X, Loader2, Tag } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface Member {
  id: string;
  full_name: string;
  member_number: string;
}

interface Category {
  code: string;
  type: "income" | "cost" | "transfer";
  display_name: string;
  description: string | null;
}

interface BankTxn {
  id: string;
  txn_date: string;
  description: string;
  debit: number | null;
  credit: number | null;
  bank_reference: string | null;
  notes: string | null;
}

export function AttributeEntryButton({
  entry,
  members,
  categories,
}: {
  entry: BankTxn;
  members: Member[];
  categories: Category[];
}) {
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [resolvedAs, setResolvedAs] = useState("contribution");
  const [memberId, setMemberId]     = useState("");
  const [description, setDescription] = useState(entry.description);
  const router = useRouter();

  // Signed amount: positive = credit, negative = debit
  const amount   = (entry.credit ?? 0) - (entry.debit ?? 0);
  const isCredit = amount >= 0;

  function handleClose() {
    setOpen(false);
    setResolvedAs("contribution");
    setMemberId("");
    setDescription(entry.description);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (resolvedAs === "contribution" && !memberId) {
      toast.error("Select a member");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/bank/attribute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          txnId:        entry.id,
          resolvedAs,
          memberId:     resolvedAs === "contribution" ? memberId : undefined,
          description:  description.trim(),
          amount,
          txnDate:      entry.txn_date,
          bankReference: entry.bank_reference,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Attribution failed");
      toast.success(resolvedAs === "ignored" ? "Entry ignored" : "Entry attributed");
      handleClose();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Attribution failed");
    } finally {
      setLoading(false);
    }
  }

  const incomeCategories = categories.filter(c => c.type === "income");
  const costCategories   = categories.filter(c => c.type === "cost");
  const xferCategories   = categories.filter(c => c.type === "transfer");
  const selectedCategory = categories.find(c => c.code === resolvedAs);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 rounded-lg transition-colors whitespace-nowrap"
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

            {/* Entry summary */}
            <div className="px-6 py-3 bg-muted/30 border-b border-border">
              <div className="flex justify-between items-start gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">{entry.txn_date}</p>
                  <p className="font-medium text-foreground">{entry.description}</p>
                  {entry.notes && <p className="text-xs text-muted-foreground mt-0.5">{entry.notes}</p>}
                  {entry.bank_reference && (
                    <p className="text-xs text-muted-foreground mt-0.5">Ref: {entry.bank_reference}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  {entry.credit != null && (
                    <p className="font-bold text-gain">+₦{entry.credit.toLocaleString("en-NG")}</p>
                  )}
                  {entry.debit != null && (
                    <p className="font-bold text-loss">−₦{entry.debit.toLocaleString("en-NG")}</p>
                  )}
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Attribute as</label>
                <select
                  value={resolvedAs}
                  onChange={e => setResolvedAs(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {isCredit && <option value="contribution">Member Contribution</option>}
                  {incomeCategories.length > 0 && (
                    <optgroup label="Income">
                      {incomeCategories.map(c => (
                        <option key={c.code} value={c.code}>{c.display_name}</option>
                      ))}
                    </optgroup>
                  )}
                  {costCategories.length > 0 && (
                    <optgroup label="Cost / Expense">
                      {costCategories.map(c => (
                        <option key={c.code} value={c.code}>{c.display_name}</option>
                      ))}
                    </optgroup>
                  )}
                  {xferCategories.length > 0 && (
                    <optgroup label="Transfer">
                      {xferCategories.map(c => (
                        <option key={c.code} value={c.code}>{c.display_name}</option>
                      ))}
                    </optgroup>
                  )}
                  <option value="ignored">Ignore (duplicate / error)</option>
                </select>
                {selectedCategory?.description && (
                  <p className="text-xs text-muted-foreground mt-1">{selectedCategory.description}</p>
                )}
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
                  Description <span className="text-xs text-muted-foreground">(edit if needed)</span>
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
                <button type="button" onClick={handleClose}
                  className="flex-1 py-2.5 border border-input rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={loading}
                  className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
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
