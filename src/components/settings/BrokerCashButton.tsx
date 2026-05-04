"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Pencil, X, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

interface Props {
  brokerId: string;
  brokerName: string;
  currentBalance: number;
}

export function BrokerCashButton({ brokerId, brokerName, currentBalance }: Props) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(String(currentBalance));
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseFloat(value);
    if (isNaN(parsed) || parsed < 0) { toast.error("Enter a valid amount"); return; }
    setLoading(true);
    try {
      const { error } = await supabase
        .from("broker_accounts")
        .update({ cash_balance: parsed })
        .eq("id", brokerId);
      if (error) throw error;
      toast.success(`Cash balance updated for ${brokerName}`);
      setOpen(false);
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => { setValue(String(currentBalance)); setOpen(true); }}
        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        title="Update cash balance"
      >
        <Pencil className="w-3.5 h-3.5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setOpen(false)}>
          <div className="bg-card border border-border rounded-xl w-full max-w-sm shadow-xl p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-semibold text-foreground">Update Cash Balance</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{brokerName}</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Cash at Broker (₦)</label>
                <input
                  type="number"
                  value={value}
                  onChange={e => setValue(e.target.value)}
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  autoFocus
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Uninvested cash currently held at this broker
                </p>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setOpen(false)}
                  className="flex-1 py-2.5 border border-input rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={loading}
                  className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
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
