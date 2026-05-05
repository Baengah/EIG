"use client";

import { useState } from "react";
import { Plus, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function AddCategoryButton() {
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [code, setCode]             = useState("");
  const [type, setType]             = useState<"income" | "cost" | "transfer">("income");
  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const router = useRouter();

  function handleClose() {
    setOpen(false);
    setCode("");
    setType("income");
    setDisplayName("");
    setDescription("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim() || !displayName.trim()) {
      toast.error("Code and display name are required");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/bank/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code:         code.trim(),
          type,
          display_name: displayName.trim(),
          description:  description.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create category");
      toast.success("Category created");
      handleClose();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create category");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-input bg-background text-foreground rounded-lg hover:bg-muted transition-colors"
      >
        <Plus className="w-3.5 h-3.5" />
        New Category
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={handleClose}>
          <div className="bg-card border border-border rounded-xl w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <h2 className="font-semibold text-foreground">New Line Item Category</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Add an income, cost, or transfer category</p>
              </div>
              <button onClick={handleClose} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Type</label>
                  <select value={type} onChange={e => setType(e.target.value as "income" | "cost" | "transfer")}
                    className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                    <option value="income">Income</option>
                    <option value="cost">Cost / Expense</option>
                    <option value="transfer">Transfer</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Code</label>
                  <input
                    type="text"
                    value={code}
                    onChange={e => setCode(e.target.value)}
                    required
                    placeholder="e.g. rental_income"
                    className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Display Name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  required
                  placeholder="e.g. Rental Income"
                  className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Description <span className="text-xs text-muted-foreground">(optional)</span>
                </label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={2}
                  placeholder="Brief description shown during attribution"
                  className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                />
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={handleClose}
                  className="flex-1 py-2.5 border border-input rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={loading}
                  className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {loading ? "Creating…" : "Create Category"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
