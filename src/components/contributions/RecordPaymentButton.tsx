"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { CheckCircle, X } from "lucide-react";
import { useRouter } from "next/navigation";

interface Props {
  contributionId: string | null;
  memberId: string;
  periodId: string;
  memberName: string;
  amountDue: number;
}

export function RecordPaymentButton({ contributionId, memberId, periodId, memberName, amountDue }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState(amountDue.toString());
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [method, setMethod] = useState<"bank_transfer" | "cash" | "online" | "other">("bank_transfer");
  const [reference, setReference] = useState("");
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const paid = parseFloat(amount);
      const status = paid >= amountDue ? "paid" : "partial";

      if (contributionId) {
        const { error } = await supabase
          .from("contributions")
          .update({ amount_paid: paid, payment_date: paymentDate, payment_method: method, bank_reference: reference || null, status })
          .eq("id", contributionId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("contributions").insert({
          member_id: memberId,
          period_id: periodId,
          amount_paid: paid,
          payment_date: paymentDate,
          payment_method: method,
          bank_reference: reference || null,
          status,
        });
        if (error) throw error;
      }

      toast.success(`Payment recorded for ${memberName}`);
      setOpen(false);
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to record payment");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 transition-colors"
      >
        <CheckCircle className="w-3 h-3" />
        Record
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card border border-border rounded-xl w-full max-w-sm mx-4 p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-foreground">Record Payment</h2>
              <button onClick={() => setOpen(false)}>
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">Recording payment for <strong>{memberName}</strong></p>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Amount Paid (₦)</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Payment Date</label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Method</label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value as typeof method)}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="online">Online</option>
                  <option value="cash">Cash</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Bank Reference (optional)</label>
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="Transaction reference"
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 py-2 border border-input rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                >
                  {loading ? "Saving..." : "Save Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
