import { createServiceClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/Header";
import { formatCurrency } from "@/lib/utils";
import { BookOpen, ArrowUpRight, ArrowDownRight, Wallet, TrendingUp } from "lucide-react";

export const revalidate = 0;

type LedgerEntry = {
  id: string;
  date: string;
  description: string;
  type_label: string;
  type_key: string;
  asset: string | null;
  member: string | null;
  units: number | null;
  price: number | null;
  fees: number | null;
  fee_brokerage: number | null;
  fee_sec: number | null;
  fee_cscs: number | null;
  fee_stamp: number | null;
  debit: number | null;
  credit: number | null;
  notes: string | null;
  reference: string | null;
  balance: number;
};

const BANK_CATEGORY_LABELS: Record<string, string> = {
  interest_income: "Interest Income",
  bank_charge:     "Bank Charge",
  tax:             "Tax / WHT",
  other_income:    "Other Income",
  other_expense:   "Other Expense",
};

const TYPE_BADGE: Record<string, string> = {
  contribution:    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  buy:             "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
  ipo:             "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  sell:            "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  dividend:        "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
  interest_income: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  bank_charge:     "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
  tax:             "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-NG", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function fmtNum(n: number | null | undefined, dp = 2) {
  if (n == null) return "—";
  return n.toLocaleString("en-NG", { minimumFractionDigits: dp });
}

export default async function LedgerPage() {
  const svc = await createServiceClient();

  const [contribsRes, txnsRes, bankLedgerRes] = await Promise.all([
    svc
      .from("member_contributions")
      .select("id, contribution_date, amount, bank_reference, notes, members(full_name)")
      .order("contribution_date", { ascending: true }),
    svc
      .from("transactions")
      .select(`
        id, transaction_date, transaction_type, notes,
        quantity, price, gross_amount, net_amount,
        brokerage_fee, sec_fee, cscs_fee, stamp_duty, total_fees,
        contract_note_number,
        stocks(ticker, company_name),
        mutual_funds(fund_name)
      `)
      .order("transaction_date", { ascending: true }),
    svc
      .from("bank_ledger")
      .select("id, entry_date, description, amount, category, bank_reference")
      .neq("category", "broker_transfer")
      .order("entry_date", { ascending: true }),
  ]);

  const rawContribs    = contribsRes.data    ?? [];
  const rawTxns        = txnsRes.data        ?? [];
  // Double-filter broker_transfers in memory — Supabase .neq() can fail silently
  // when the column value is stored with different casing or when RLS transforms data.
  // Broker transfers are internal Zenith→CHD movements, not pool outflows.
  const rawBankEntries = (bankLedgerRes.data ?? []).filter(
    bl => (bl.category as string) !== "broker_transfer"
  );

  const unsorted: Omit<LedgerEntry, "balance">[] = [];

  // ── 1. Member contributions ──────────────────────────────────
  for (const c of rawContribs) {
    const memberName = (c.members as unknown as { full_name: string } | null)?.full_name ?? "Unknown";
    unsorted.push({
      id:           `c-${c.id}`,
      date:         c.contribution_date,
      description:  `Capital Contribution — ${memberName}`,
      type_label:   "Contribution",
      type_key:     "contribution",
      asset:        null,
      member:       memberName,
      units:        null,
      price:        null,
      fees:         null,
      fee_brokerage: null, fee_sec: null, fee_cscs: null, fee_stamp: null,
      debit:        null,
      credit:       Number(c.amount),
      notes:        c.notes,
      reference:    c.bank_reference,
    });
  }

  // ── 2. Investment transactions ───────────────────────────────
  for (const t of rawTxns) {
    const ticker  = (t.stocks as { ticker?: string } | null)?.ticker
                 ?? (t.mutual_funds as { fund_name?: string } | null)?.fund_name
                 ?? "—";
    const company = (t.stocks as { company_name?: string } | null)?.company_name ?? "";
    const qty   = t.quantity   as number | null;
    const price = t.price      as number | null;
    const type  = t.transaction_type as string;
    const net   = t.net_amount as number | null;

    let type_key: string;
    let type_label: string;
    let description: string;
    let debit: number | null   = null;
    let credit: number | null  = null;

    switch (type) {
      case "buy":
        if (qty == null) {
          type_key = "ipo";
          type_label = "IPO Subscription";
          description = `IPO Subscription — ${ticker}`;
        } else {
          type_key = "buy";
          type_label = "Equity Purchase";
          description = `Purchase — ${qty.toLocaleString("en-NG")} × ${ticker} @ ₦${fmtNum(price)}`;
        }
        debit = net != null ? Number(net) : null;
        break;

      case "sell":
        type_key = "sell";
        type_label = "Equity Sale";
        description = `Sale — ${qty != null ? qty.toLocaleString("en-NG") : "—"} × ${ticker} @ ₦${fmtNum(price)}`;
        credit = net != null ? Number(net) : null;
        break;

      case "dividend":
        type_key = "dividend";
        type_label = "Dividend";
        description = `Dividend — ${ticker}${company ? ` (${company})` : ""}`;
        credit = net != null ? Number(net) : null;
        break;

      case "rights_issue":
        type_key = "buy";
        type_label = "Rights Issue";
        description = `Rights Issue — ${ticker}`;
        debit = net != null ? Number(net) : null;
        break;

      case "transfer_in":
        type_key = "buy";
        type_label = "Transfer In";
        description = `Transfer In — ${ticker}`;
        credit = net != null ? Number(net) : null;
        break;

      case "transfer_out":
        type_key = "sell";
        type_label = "Transfer Out";
        description = `Transfer Out — ${ticker}`;
        debit = net != null ? Number(net) : null;
        break;

      default:
        type_key = "buy";
        type_label = type.replace(/_/g, " ");
        description = `${type_label} — ${ticker}`;
    }

    unsorted.push({
      id:           `t-${t.id}`,
      date:         t.transaction_date as string,
      description,
      type_label,
      type_key,
      asset:        ticker,
      member:       null,
      units:        qty,
      price,
      fees:         t.total_fees   != null ? Number(t.total_fees)   : null,
      fee_brokerage: t.brokerage_fee != null ? Number(t.brokerage_fee) : null,
      fee_sec:       t.sec_fee      != null ? Number(t.sec_fee)      : null,
      fee_cscs:      t.cscs_fee     != null ? Number(t.cscs_fee)     : null,
      fee_stamp:     t.stamp_duty   != null ? Number(t.stamp_duty)   : null,
      debit,
      credit,
      notes:        t.notes as string | null,
      reference:    t.contract_note_number as string | null,
    });
  }

  // ── 3. Bank ledger (interest, charges, taxes — no broker transfers) ──
  for (const bl of rawBankEntries) {
    const amt    = Number(bl.amount);
    const catKey = bl.category ?? "other";
    unsorted.push({
      id:           `bl-${bl.id}`,
      date:         bl.entry_date as string,
      description:  bl.description as string,
      type_label:   BANK_CATEGORY_LABELS[catKey] ?? catKey.replace(/_/g, " "),
      type_key:     catKey,
      asset:        null,
      member:       null,
      units:        null,
      price:        null,
      fees:         null,
      fee_brokerage: null, fee_sec: null, fee_cscs: null, fee_stamp: null,
      debit:        amt < 0 ? -amt : null,
      credit:       amt > 0 ?  amt : null,
      notes:        null,
      reference:    bl.bank_reference as string | null,
    });
  }

  // ── Sort: ascending date; contributions before trades on same date ──
  unsorted.sort((a, b) => {
    const d = a.date.localeCompare(b.date);
    if (d !== 0) return d;
    if (a.type_key === "contribution" && b.type_key !== "contribution") return -1;
    if (a.type_key !== "contribution" && b.type_key === "contribution") return  1;
    return 0;
  });

  // ── Running balance ──────────────────────────────────────────
  let runningBalance = 0;
  const entries: LedgerEntry[] = unsorted.map(e => {
    runningBalance += (e.credit ?? 0) - (e.debit ?? 0);
    return { ...e, balance: runningBalance };
  });

  // ── Summary metrics ──────────────────────────────────────────
  const totalCapital       = entries.filter(e => e.type_key === "contribution")
                                    .reduce((s, e) => s + (e.credit ?? 0), 0);
  const totalIncome        = entries.filter(e => ["dividend", "interest_income"].includes(e.type_key))
                                    .reduce((s, e) => s + (e.credit ?? 0), 0);
  const totalSaleProceeds  = entries.filter(e => e.type_key === "sell")
                                    .reduce((s, e) => s + (e.credit ?? 0), 0);
  // "Total Deployed" = all money that has entered the investment pool
  // (member capital + income reinvested + sale proceeds reinvested)
  const totalDeployed      = totalCapital + totalIncome + totalSaleProceeds;
  const totalFees          = entries.filter(e => e.fees != null)
                                    .reduce((s, e) => s + (e.fees ?? 0), 0);
  const finalBalance       = runningBalance;

  const totalDebit  = entries.reduce((s, e) => s + (e.debit  ?? 0), 0);
  const totalCredit = entries.reduce((s, e) => s + (e.credit ?? 0), 0);

  return (
    <div>
      <Header
        title="Investment Ledger"
        subtitle="Complete record of all contributions, trades, income, and costs from inception"
      />
      <div className="p-4 sm:p-6 space-y-6">

        {/* ── Summary cards ────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="w-3.5 h-3.5 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Capital Raised</p>
            </div>
            <p className="text-xl font-bold text-foreground">{formatCurrency(totalCapital)}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <ArrowDownRight className="w-3.5 h-3.5 text-loss" />
              <p className="text-xs text-muted-foreground">Total Deployed</p>
            </div>
            <p className="text-xl font-bold text-foreground">{formatCurrency(totalDeployed)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">capital + income + sale proceeds</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-3.5 h-3.5 text-gain" />
              <p className="text-xs text-muted-foreground">Income (Div + Int)</p>
            </div>
            <p className="text-xl font-bold text-gain">{formatCurrency(totalIncome)}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Cash Balance</p>
            </div>
            <p className={`text-xl font-bold ${finalBalance >= 0 ? "text-foreground" : "text-loss"}`}>
              {formatCurrency(finalBalance)}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">excl. equity portfolio</p>
          </div>
        </div>

        {/* ── Ledger table ─────────────────────────────────────── */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-foreground">Transaction Ledger</h3>
            <span className="text-xs text-muted-foreground ml-1">
              — {entries.length} entries · chronological order
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 border-b border-border">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Description</th>
                  <th className="text-center px-3 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">Type</th>
                  <th className="hidden lg:table-cell text-right px-3 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">Units</th>
                  <th className="hidden lg:table-cell text-right px-3 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">Price (₦)</th>
                  <th className="hidden md:table-cell text-right px-3 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">Fees (₦)</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">Debit (₦)</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">Credit (₦)</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">Balance (₦)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {entries.map(e => {
                  const badge = TYPE_BADGE[e.type_key] ?? "bg-muted text-muted-foreground";
                  const hasFeeDetail = e.fee_brokerage || e.fee_sec || e.fee_cscs || e.fee_stamp;
                  return (
                    <tr key={e.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap align-top">
                        {fmtDate(e.date)}
                      </td>
                      <td className="px-4 py-2.5 align-top max-w-[280px]">
                        <p className="text-xs font-medium text-foreground">{e.description}</p>
                        {e.notes && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate" title={e.notes}>
                            {e.notes}
                          </p>
                        )}
                        {e.reference && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Ref: {e.reference}
                          </p>
                        )}
                        {hasFeeDetail && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {[
                              e.fee_brokerage ? `Brok. ₦${e.fee_brokerage.toLocaleString("en-NG", { minimumFractionDigits: 2 })}` : null,
                              e.fee_sec       ? `SEC ₦${e.fee_sec.toLocaleString("en-NG", { minimumFractionDigits: 2 })}`           : null,
                              e.fee_cscs      ? `CSCS ₦${e.fee_cscs.toLocaleString("en-NG", { minimumFractionDigits: 2 })}`         : null,
                              e.fee_stamp     ? `Stamp ₦${e.fee_stamp.toLocaleString("en-NG", { minimumFractionDigits: 2 })}`       : null,
                            ].filter(Boolean).join(" · ")}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center align-top">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${badge}`}>
                          {e.type_label}
                        </span>
                      </td>
                      <td className="hidden lg:table-cell px-3 py-2.5 text-right text-xs font-mono text-foreground tabular-nums align-top">
                        {e.units != null ? e.units.toLocaleString("en-NG") : "—"}
                      </td>
                      <td className="hidden lg:table-cell px-3 py-2.5 text-right text-xs font-mono text-foreground tabular-nums align-top">
                        {e.price != null ? e.price.toLocaleString("en-NG", { minimumFractionDigits: 2 }) : "—"}
                      </td>
                      <td className="hidden md:table-cell px-3 py-2.5 text-right text-xs font-mono text-muted-foreground tabular-nums align-top">
                        {e.fees != null && e.fees > 0
                          ? e.fees.toLocaleString("en-NG", { minimumFractionDigits: 2 })
                          : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right text-xs font-mono text-loss tabular-nums align-top">
                        {e.debit != null
                          ? e.debit.toLocaleString("en-NG", { minimumFractionDigits: 2 })
                          : ""}
                      </td>
                      <td className="px-4 py-2.5 text-right text-xs font-mono text-gain tabular-nums align-top">
                        {e.credit != null
                          ? e.credit.toLocaleString("en-NG", { minimumFractionDigits: 2 })
                          : ""}
                      </td>
                      <td className={`px-4 py-2.5 text-right text-xs font-mono font-semibold tabular-nums whitespace-nowrap align-top ${e.balance >= 0 ? "text-foreground" : "text-loss"}`}>
                        {e.balance.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t-2 border-border bg-muted/20">
                <tr>
                  <td colSpan={6} className="px-4 py-3 text-xs font-semibold text-muted-foreground">
                    Totals ({entries.length} entries)
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-loss text-xs tabular-nums">
                    {totalDebit.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-gain text-xs tabular-nums">
                    {totalCredit.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                  </td>
                  <td className={`px-4 py-3 text-right font-bold text-xs tabular-nums ${finalBalance >= 0 ? "text-foreground" : "text-loss"}`}>
                    {finalBalance.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
