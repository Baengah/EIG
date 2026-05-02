"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";

type AssetType = "stock" | "mutual_fund";
type TxnType = "buy" | "sell" | "dividend" | "rights_issue" | "bonus" | "transfer_in" | "transfer_out";

export function AddTransactionButton() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [stocks, setStocks] = useState<{ id: string; ticker: string; company_name: string }[]>([]);
  const [funds, setFunds] = useState<{ id: string; fund_name: string; fund_manager: string | null }[]>([]);
  const [brokers, setBrokers] = useState<{ id: string; broker_name: string; account_number: string }[]>([]);

  const [assetType, setAssetType] = useState<AssetType>("stock");
  const [txnType, setTxnType] = useState<TxnType>("buy");
  const [stockId, setStockId] = useState("");
  const [fundId, setFundId] = useState("");
  const [brokerId, setBrokerId] = useState("");
  const [txnDate, setTxnDate] = useState(new Date().toISOString().split("T")[0]);
  const [qty, setQty] = useState("");
  const [price, setPrice] = useState("");
  const [brokFee, setBrokFee] = useState("0");
  const [secFee, setSecFee] = useState("0");
  const [cscsFee, setCscsFee] = useState("0");
  const [stampDuty, setStampDuty] = useState("0");
  const [contractNote, setContractNote] = useState("");
  const [notes, setNotes] = useState("");

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    if (!open) return;
    Promise.all([
      supabase.from("stocks").select("id, ticker, company_name").eq("is_active", true).order("ticker"),
      supabase.from("mutual_funds").select("id, fund_name, fund_manager").eq("is_active", true).order("fund_name"),
      supabase.from("broker_accounts").select("id, broker_name, account_number").eq("is_active", true),
    ]).then(([s, f, b]) => {
      setStocks(s.data ?? []);
      setFunds(f.data ?? []);
      setBrokers(b.data ?? []);
    });
  }, [open]);

  const gross = parseFloat(qty || "0") * parseFloat(price || "0");
  const totalFees = parseFloat(brokFee || "0") + parseFloat(secFee || "0") + parseFloat(cscsFee || "0") + parseFloat(stampDuty || "0");
  const net = txnType === "buy" ? gross + totalFees : gross - totalFees;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.from("transactions").insert({
        transaction_date: txnDate,
        transaction_type: txnType,
        asset_type: assetType,
        stock_id: assetType === "stock" ? stockId || null : null,
        mutual_fund_id: assetType === "mutual_fund" ? fundId || null : null,
        broker_account_id: brokerId || null,
        quantity: parseFloat(qty),
        price: parseFloat(price),
        gross_amount: gross,
        brokerage_fee: parseFloat(brokFee || "0"),
        sec_fee: parseFloat(secFee || "0"),
        cscs_fee: parseFloat(cscsFee || "0"),
        stamp_duty: parseFloat(stampDuty || "0"),
        total_fees: totalFees,
        net_amount: net,
        contract_note_number: contractNote || null,
        notes: notes || null,
      });
      if (error) throw error;
      toast.success("Transaction recorded successfully");
      setOpen(false);
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to record transaction");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
      >
        <Plus className="w-4 h-4" />
        Add Transaction
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card border border-border rounded-xl w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Record Transaction</h2>
              <button onClick={() => setOpen(false)}>
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Asset Type</label>
                  <select
                    value={assetType}
                    onChange={(e) => setAssetType(e.target.value as AssetType)}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="stock">NGX Stock</option>
                    <option value="mutual_fund">Mutual Fund</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Transaction Type</label>
                  <select
                    value={txnType}
                    onChange={(e) => setTxnType(e.target.value as TxnType)}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="buy">Buy</option>
                    <option value="sell">Sell</option>
                    <option value="dividend">Dividend</option>
                    <option value="rights_issue">Rights Issue</option>
                    <option value="bonus">Bonus</option>
                    <option value="transfer_in">Transfer In</option>
                    <option value="transfer_out">Transfer Out</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  {assetType === "stock" ? "Stock" : "Fund"}
                </label>
                {assetType === "stock" ? (
                  <select
                    value={stockId}
                    onChange={(e) => setStockId(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Select stock...</option>
                    {stocks.map((s) => (
                      <option key={s.id} value={s.id}>{s.ticker} — {s.company_name}</option>
                    ))}
                  </select>
                ) : (
                  <select
                    value={fundId}
                    onChange={(e) => setFundId(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Select fund...</option>
                    {funds.map((f) => (
                      <option key={f.id} value={f.id}>{f.fund_name}</option>
                    ))}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Transaction Date</label>
                  <input
                    type="date"
                    value={txnDate}
                    onChange={(e) => setTxnDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Broker</label>
                  <select
                    value={brokerId}
                    onChange={(e) => setBrokerId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">None</option>
                    {brokers.map((b) => (
                      <option key={b.id} value={b.id}>{b.broker_name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Quantity / Units</label>
                  <input
                    type="number"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    required
                    min="0"
                    step="any"
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Price per Unit (₦)</label>
                  <input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    required
                    min="0"
                    step="any"
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>

              <div className="bg-muted/40 rounded-lg p-3">
                <p className="text-xs font-medium text-muted-foreground mb-2">FEES (₦)</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Brokerage", value: brokFee, set: setBrokFee },
                    { label: "SEC Levy", value: secFee, set: setSecFee },
                    { label: "CSCS Fee", value: cscsFee, set: setCscsFee },
                    { label: "Stamp Duty", value: stampDuty, set: setStampDuty },
                  ].map(({ label, value, set }) => (
                    <div key={label}>
                      <label className="block text-xs text-muted-foreground mb-0.5">{label}</label>
                      <input
                        type="number"
                        value={value}
                        onChange={(e) => set(e.target.value)}
                        min="0"
                        step="0.01"
                        className="w-full px-2 py-1.5 rounded border border-input bg-background text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-2 pt-2 border-t border-border flex justify-between text-sm">
                  <span className="text-muted-foreground">Net Amount</span>
                  <span className="font-semibold text-foreground">
                    ₦{net.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Contract Note # (optional)</label>
                <input
                  type="text"
                  value={contractNote}
                  onChange={(e) => setContractNote(e.target.value)}
                  placeholder="e.g. CN-2024-001"
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 py-2.5 border border-input rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {loading ? "Saving..." : "Record Transaction"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
