"use client";

import { useState } from "react";
import { Pencil, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface BankTxn {
  id: string;
  txn_date: string;
  description: string;
  debit: number | null;
  credit: number | null;
  bank_reference: string | null;
  notes: string | null;
  status: "matched" | "unmatched" | "ignored";
}

export function EditBankEntryButton({ entry }: { entry: BankTxn }) {
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [date, setDate]             = useState(entry.txn_date);
  const [description, setDescription] = useState(entry.description);
  const [type, setType]             = useState<"credit" | "debit">(entry.credit != null ? "credit" : "debit");
  const [amount, setAmount]         = useState(String(entry.credit ?? entry.debit ?? ""));
  const [reference, setReference]   = useState(entry.bank_reference ?? "");
  const [notes, setNotes]           = useState(entry.notes ?? "");
  const [status, setStatus]         = useState<"unmatched" | "ignored">(
    entry.status === "ignored" ? "ignored" : "unmatched"
  );
  const router = useRouter();

  function handleClose() {
    setOpen(false);
    setDate(entry.txn_date);
    setDescription(entry.description);
    setType(entry.credit != null ? "credit" : "debit");
    setAmount(String(entry.credit ?? entry.debit ?? ""));
    setReference(entry.bank_reference ?? "");
    setNotes(entry.notes ?? "");
    setStatus(entry.status === "ignored" ? "ignored" : "unmatched");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0) { toast.error("Enter a valid amount"); return; }
    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        txn_date:       date,
        description:    description.trim(),
        credit:         type === "credit" ? parsed : null,
        debit:          type === "debit"  ? parsed : null,
        bank_reference: reference.trim() || null,
        notes:          notes.trim() || null,
      };
      if (entry.status !== "matched") body.status = status;
      const res = await fetch(`/api/bank/entries/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Update failed");
      toast.success("Entry updated");
      handleClose();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
        title="Edit entry"
      >
        <Pencil className="w-3.5 h-3.5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={handleClose}>
          <div className="bg-card border border-border rounded-xl w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <h2 className="font-semibold text-foreground">Edit Bank Entry</h2>
                {entry.status === "matched" && (
                  <p className="text-xs text-muted-foreground mt-0.5">Status is locked — entry is already attributed</p>
                )}
              </div>
              <button onClick={handleClose} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Date</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} required
                  className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Description</label>
                <input type="text" value={description} onChange={e => setDescription(e.target.value)} required
                  className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Type</label>
                  <select value={type} onChange={e => setType(e.target.value as "credit" | "debit")}
                    className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                    <option value="credit">Credit (money in)</option>
                    <option value="debit">Debit (money out)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Amount (₦)</label>
                  <input type="number" value={amount} onChange={e => setAmount(e.target.value)} required
                    min="0.01" step="0.01" placeholder="0.00"
                    className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Bank Reference <span className="text-xs text-muted-foreground">(optional)</span>
                </label>
                <input type="text" value={reference} onChange={e => setReference(e.target.value)}
                  placeholder="ISW / CIP / NIP reference"
                  className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Notes <span className="text-xs text-muted-foreground">(optional)</span>
                </label>
                <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="Any additional context"
                  className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>

              {entry.status !== "matched" && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Status</label>
                  <select value={status} onChange={e => setStatus(e.target.value as "unmatched" | "ignored")}
                    className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                    <option value="unmatched">Unmatched — needs attribution</option>
                    <option value="ignored">Ignored — duplicate or error</option>
                  </select>
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={handleClose}
                  className="flex-1 py-2.5 border border-input rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={loading}
                  className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {loading ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
