"use client";

import { useState } from "react";
import { Plus, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function AddBankStatementEntry() {
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [date, setDate]             = useState(new Date().toISOString().split("T")[0]);
  const [description, setDescription] = useState("");
  const [type, setType]             = useState<"credit" | "debit">("credit");
  const [amount, setAmount]         = useState("");
  const [reference, setReference]   = useState("");
  const [notes, setNotes]           = useState("");
  const router = useRouter();

  function handleClose() {
    setOpen(false);
    setDate(new Date().toISOString().split("T")[0]);
    setDescription("");
    setType("credit");
    setAmount("");
    setReference("");
    setNotes("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0) { toast.error("Enter a valid amount"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/bank/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          txn_date:      date,
          description:   description.trim(),
          credit:        type === "credit" ? parsed : null,
          debit:         type === "debit"  ? parsed : null,
          bank_reference: reference.trim() || null,
          notes:         notes.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to add entry");
      toast.success("Entry added — ready for attribution");
      handleClose();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add entry");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 border border-input bg-background text-foreground rounded-lg text-sm font-medium hover:bg-muted transition-colors"
      >
        <Plus className="w-4 h-4" />
        Add Bank Entry
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={handleClose}>
          <div className="bg-card border border-border rounded-xl w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <h2 className="font-semibold text-foreground">Add Bank Statement Entry</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Entry will be added to the unmatched schedule for attribution</p>
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
                  placeholder="e.g. Transfer from Olujimi"
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

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={handleClose}
                  className="flex-1 py-2.5 border border-input rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={loading}
                  className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {loading ? "Adding…" : "Add Entry"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
