"use client";

import { useState } from "react";
import { Pencil, X, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface Category {
  id: string;
  code: string;
  type: string;
  display_name: string;
  description: string | null;
  is_active: boolean;
}

export function EditCategoryButton({ category }: { category: Category }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [displayName, setDisplayName] = useState(category.display_name);
  const [description, setDescription] = useState(category.description ?? "");
  const router = useRouter();
  const supabase = createClient();

  function handleClose() {
    setOpen(false);
    setDisplayName(category.display_name);
    setDescription(category.description ?? "");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!displayName.trim()) { toast.error("Display name is required"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/bank/categories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: category.id,
          display_name: displayName.trim(),
          description: description.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Update failed");
      toast.success("Category updated");
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
        title="Edit category"
      >
        <Pencil className="w-3.5 h-3.5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={handleClose}>
          <div className="bg-card border border-border rounded-xl w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <h2 className="font-semibold text-foreground">Edit Category</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Code: <span className="font-mono">{category.code}</span></p>
              </div>
              <button onClick={handleClose} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Display Name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  required
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
                  {loading ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
