"use client";

import { useState } from "react";
import { Plus, X, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

type Category =
  | "interest_income"
  | "bank_charge"
  | "tax"
  | "broker_transfer"
  | "other_income"
  | "other_expense";

const CATEGORIES: { value: Category; label: string; sign: "+" | "-" }[] = [
  { value: "interest_income", label: "Interest Income (capitalised interest)", sign: "+" },
  { value: "other_income",    label: "Other Income",                           sign: "+" },
  { value: "bank_charge",     label: "Bank Charges (COT, transfer fees, SMS)", sign: "-" },
  { value: "tax",             label: "Taxes (VAT, stamp duty)",                sign: "-" },
  { value: "broker_transfer", label: "Transfer to Broker",                    sign: "-" },
  { value: "other_expense",   label: "Other Expense",                         sign: "-" },
];

export function AddBankEntryButton() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState<Category>("bank_charge");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [reference, setReference] = useState("");
  const router = useRouter();
  const supabase = createClient();

  const sign = CATEGORIES.find(c => c.value === category)?.sign ?? "-";

  function handleClose() {
    setOpen(false);
    setCategory("bank_charge");
    setDescription("");
    setAmount("");
    setDate(new Date().toISOString().split("T")[0]);
    setReference("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0) { toast.error("Enter a valid amount"); return; }
    if (!description.trim()) { toast.error("Enter a description"); return; }

    // Income categories are positive, expense categories are negative
    const signed = sign === "+" ? parsed : -parsed;

    setLoading(true);
    try {
      const { error } = await supabase.from("bank_ledger").insert({
        entry_date: date,
        description: description.trim(),
        amount: signed,
        category,
        bank_reference: reference.trim() || null,
      });
      if (error) throw error;
      toast.success("Bank entry recorded");
      handleClose();
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to record entry");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-2 border border-input rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors"
      >
        <Plus className="w-3.5 h-3.5" />
        Add Bank Entry
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={handleClose}>
          <div className="bg-card border border-border rounded-xl w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <h2 className="font-semibold text-foreground">Record Bank Entry</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Interest, charges, taxes, and transfers</p>
              </div>
              <button onClick={handleClose} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Category</label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value as Category)}
                  className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {CATEGORIES.map(c => (
                    <option key={c.value} value={c.value}>
                      {c.sign === "+" ? "↑" : "↓"} {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  required
                  placeholder="e.g. Monthly COT charge, Capitalised interest Aug 2025"
                  className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Amount (₦) — will be recorded as {sign === "+" ? "income (+)" : "expense (−)"}
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  required
                  min="0.01"
                  step="0.01"
                  placeholder="0.00"
                  className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Date</label>
                  <input
                    type="date"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    required
                    className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Reference <span className="text-muted-foreground text-xs">(opt.)</span>
                  </label>
                  <input
                    type="text"
                    value={reference}
                    onChange={e => setReference(e.target.value)}
                    placeholder="Bank ref"
                    className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={handleClose}
                  className="flex-1 py-2.5 border border-input rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={loading}
                  className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {loading ? "Saving…" : "Save Entry"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
