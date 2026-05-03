"use client";

import { useState } from "react";
import { X, FileText, CheckCircle2, AlertCircle, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import type { ContractNoteData } from "@/lib/document-parsers/contract-note";
import type { BankStatementData } from "@/lib/document-parsers/bank-statement";
import type { FundStatementData } from "@/lib/document-parsers/fund-statement";

interface Doc {
  id: string;
  document_type: string;
  file_name: string;
  extracted_data: Record<string, unknown> | null;
}

interface Props {
  doc: Doc;
  onClose: () => void;
}

export function DocumentReviewModal({ doc, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const type = doc.extracted_data?.type as string | undefined;

  async function importAll(selectedIndices?: number[]) {
    setLoading(true);
    try {
      const res = await fetch(`/api/documents/${doc.id}/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selected_indices: selectedIndices }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Import failed");
      toast.success(`Imported ${json.inserted} transaction${json.inserted !== 1 ? "s" : ""}`);
      onClose();
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-foreground truncate max-w-xs">{doc.file_name}</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {!doc.extracted_data ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertCircle className="w-8 h-8 mx-auto mb-2" />
              <p>No extracted data available.</p>
            </div>
          ) : type === "contract_note" ? (
            <ContractNoteView
              data={doc.extracted_data as unknown as ContractNoteData}
              loading={loading}
              onImport={() => importAll()}
            />
          ) : type === "bank_statement" ? (
            <BankStatementView
              data={doc.extracted_data as unknown as BankStatementData}
              loading={loading}
              onImport={importAll}
            />
          ) : type === "fund_statement" ? (
            <FundStatementView
              data={doc.extracted_data as unknown as FundStatementData}
              loading={loading}
              onImport={importAll}
            />
          ) : (
            <pre className="text-xs text-muted-foreground bg-muted/40 rounded p-4 overflow-auto max-h-64">
              {JSON.stringify(doc.extracted_data, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string | number | null | undefined; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-border last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-sm font-medium ${highlight ? "text-foreground" : "text-foreground/80"}`}>
        {value ?? "—"}
      </span>
    </div>
  );
}

function ContractNoteView({ data, loading, onImport }: { data: ContractNoteData; loading: boolean; onImport: () => void }) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <span className={`px-2 py-0.5 rounded text-xs font-semibold uppercase ${data.trade_type === "buy" ? "bg-blue-100 text-blue-700" : "bg-rose-100 text-rose-700"}`}>
          {data.trade_type}
        </span>
        <span className="text-sm text-muted-foreground">Contract Note</span>
        {data.contract_note_number && <span className="text-xs text-muted-foreground">#{data.contract_note_number}</span>}
      </div>

      <div className="bg-muted/30 rounded-lg p-4 space-y-0.5">
        <Row label="Security" value={data.security_name} highlight />
        <Row label="Ticker (guessed)" value={data.ticker_hint} />
        <Row label="Trade Date" value={data.trade_date ?? undefined} />
        <Row label="Settlement Date" value={data.settlement_date ?? undefined} />
        <Row label="Quantity" value={data.quantity?.toLocaleString()} />
        <Row label="Price per unit" value={data.price != null ? formatCurrency(data.price) : undefined} />
        <Row label="Consideration" value={data.consideration != null ? formatCurrency(data.consideration) : undefined} />
      </div>

      <div className="bg-muted/30 rounded-lg p-4 space-y-0.5">
        <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Fees</p>
        <Row label="Broker Commission" value={formatCurrency(data.broker_commission)} />
        <Row label="NGX Fees" value={formatCurrency(data.ngx_fees)} />
        <Row label="CSCS Fees" value={formatCurrency(data.cscs_fees)} />
        <Row label="SEC Fees" value={formatCurrency(data.sec_fees)} />
        <Row label="Stamp Duty" value={formatCurrency(data.stamp_duty)} />
        <Row label="Total Fees" value={formatCurrency(data.total_fees)} highlight />
      </div>

      <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
        <div className="flex justify-between items-center">
          <span className="font-semibold text-foreground">Total Contract Amount</span>
          <span className="text-xl font-bold text-foreground">
            {data.total_contract_amount != null ? formatCurrency(data.total_contract_amount) : "—"}
          </span>
        </div>
      </div>

      {!data.ticker_hint && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg">
          <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Could not auto-match ticker for &ldquo;{data.security_name}&rdquo;.
            Ensure the stock exists in the Master Data, then import will match by company name.
          </p>
        </div>
      )}

      <button
        onClick={onImport}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
        Import as Transaction
      </button>
    </div>
  );
}

function BankStatementView({ data, loading, onImport }: { data: BankStatementData; loading: boolean; onImport: (indices: number[]) => void }) {
  const trades = data.trades ?? [];
  const [selected, setSelected] = useState<Set<number>>(() => new Set(trades.map((_, i) => i)));
  const [expanded, setExpanded] = useState(true);

  function toggle(i: number) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <div className="bg-muted/30 rounded-lg p-4 space-y-0.5">
        <Row label="Account" value={data.account_name ?? undefined} />
        <Row label="Account Number" value={data.account_number ?? undefined} />
        <Row label="Period" value={data.period_from && data.period_to ? `${data.period_from} → ${data.period_to}` : undefined} />
        <Row label="Opening Balance" value={formatCurrency(data.opening_balance)} />
        <Row label="Closing Balance" value={formatCurrency(data.closing_balance)} highlight />
      </div>

      <div className="border border-border rounded-lg overflow-hidden">
        <button
          onClick={() => setExpanded(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 bg-muted/20 hover:bg-muted/40 transition-colors"
        >
          <span className="text-sm font-medium text-foreground">
            {trades.length} trade{trades.length !== 1 ? "s" : ""} detected — {selected.size} selected
          </span>
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {expanded && (
          <div className="divide-y divide-border max-h-72 overflow-y-auto">
            {trades.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No trades detected automatically.</p>
            ) : (
              trades.map((t, i) => (
                <label key={i} className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/20 ${selected.has(i) ? "bg-primary/5" : ""}`}>
                  <input
                    type="checkbox"
                    checked={selected.has(i)}
                    onChange={() => toggle(i)}
                    className="w-3.5 h-3.5 accent-primary"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`px-1.5 py-0.5 rounded text-xs font-semibold uppercase ${t.trade_type === "buy" ? "bg-blue-100 text-blue-700" : "bg-rose-100 text-rose-700"}`}>
                        {t.trade_type}
                      </span>
                      <span className="text-sm font-medium text-foreground">{t.ticker}</span>
                      <span className="text-xs text-muted-foreground">{t.date}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t.quantity?.toLocaleString()} units @ ₦{t.price?.toLocaleString()} — {formatCurrency(t.debit || t.credit)}
                    </p>
                  </div>
                </label>
              ))
            )}
          </div>
        )}
      </div>

      <button
        onClick={() => onImport(Array.from(selected))}
        disabled={loading || selected.size === 0}
        className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
        Import {selected.size} Transaction{selected.size !== 1 ? "s" : ""}
      </button>

      <p className="text-xs text-muted-foreground text-center">
        Stocks must exist in Master Data for import to succeed.
      </p>
    </div>
  );
}

function FundStatementView({ data, loading, onImport }: { data: FundStatementData; loading: boolean; onImport: (indices: number[]) => void }) {
  const txns = data.transactions ?? [];
  const [selected, setSelected] = useState<Set<number>>(() => new Set(txns.map((_, i) => i).filter(i => txns[i].type !== "other")));

  function toggle(i: number) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  const typeColor: Record<string, string> = {
    buy: "bg-blue-100 text-blue-700",
    sell: "bg-rose-100 text-rose-700",
    dividend: "bg-emerald-100 text-emerald-700",
    other: "bg-muted text-muted-foreground",
  };

  return (
    <div className="space-y-4">
      <div className="bg-muted/30 rounded-lg p-4 space-y-0.5">
        <Row label="Fund" value={data.fund_name ?? undefined} highlight />
        <Row label="Period" value={data.period_from && data.period_to ? `${data.period_from} → ${data.period_to}` : undefined} />
        <Row label="Closing Units" value={data.closing_units?.toLocaleString()} />
        <Row label="Closing NAV" value={data.closing_nav != null ? formatCurrency(data.closing_nav) : undefined} />
        <Row label="Closing Balance" value={formatCurrency(data.closing_balance)} highlight />
      </div>

      <div className="border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 bg-muted/20">
          <span className="text-sm font-medium text-foreground">
            {txns.length} transaction{txns.length !== 1 ? "s" : ""} — {selected.size} selected
          </span>
        </div>
        <div className="divide-y divide-border max-h-72 overflow-y-auto">
          {txns.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No transactions detected.</p>
          ) : (
            txns.map((t, i) => (
              <label key={i} className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/20 ${selected.has(i) ? "bg-primary/5" : ""}`}>
                <input
                  type="checkbox"
                  checked={selected.has(i)}
                  onChange={() => toggle(i)}
                  className="w-3.5 h-3.5 accent-primary"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`px-1.5 py-0.5 rounded text-xs font-semibold uppercase ${typeColor[t.type]}`}>
                      {t.type}
                    </span>
                    <span className="text-sm font-medium text-foreground">{t.description}</span>
                    <span className="text-xs text-muted-foreground">{t.date}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {Math.abs(t.units).toLocaleString()} units @ ₦{t.offer_price.toLocaleString()} — {formatCurrency(Math.abs(t.amount))}
                  </p>
                </div>
              </label>
            ))
          )}
        </div>
      </div>

      <button
        onClick={() => onImport(Array.from(selected))}
        disabled={loading || selected.size === 0}
        className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
        Import {selected.size} Transaction{selected.size !== 1 ? "s" : ""}
      </button>

      <p className="text-xs text-muted-foreground text-center">
        The fund must exist in Master Data for import to succeed.
      </p>
    </div>
  );
}
