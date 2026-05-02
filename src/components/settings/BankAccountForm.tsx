"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";

export function BankAccountForm() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ bank_name: "", account_name: "", account_number: "", sort_code: "" });
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.from("bank_accounts").insert({ ...form, is_active: true, currency: "NGN" });
      if (error) throw error;
      toast.success("Bank account added");
      setOpen(false);
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 border border-input rounded-lg text-sm text-foreground hover:bg-muted transition-colors"
      >
        <Plus className="w-3.5 h-3.5" /> Add Bank Account
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card border border-border rounded-xl w-full max-w-sm shadow-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-foreground">Add Bank Account</h2>
              <button onClick={() => setOpen(false)}><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              {[
                { name: "bank_name", label: "Bank Name", placeholder: "e.g. Zenith Bank" },
                { name: "account_name", label: "Account Name", placeholder: "EIG Investment Group" },
                { name: "account_number", label: "Account Number", placeholder: "10-digit NUBAN" },
                { name: "sort_code", label: "Sort Code (optional)", placeholder: "Bank sort code" },
              ].map((f) => (
                <div key={f.name}>
                  <label className="block text-sm font-medium text-foreground mb-1">{f.label}</label>
                  <input
                    type="text"
                    required={f.name !== "sort_code"}
                    placeholder={f.placeholder}
                    value={(form as Record<string, string>)[f.name]}
                    onChange={(e) => setForm((p) => ({ ...p, [f.name]: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              ))}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setOpen(false)} className="flex-1 py-2 border border-input rounded-lg text-sm text-foreground hover:bg-muted">Cancel</button>
                <button type="submit" disabled={loading} className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
                  {loading ? "Adding..." : "Add"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
