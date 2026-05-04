import { createClient, createServiceClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/Header";
import { formatCurrency, formatPercent, isPositive } from "@/lib/utils";
import {
  TrendingUp, TrendingDown, Wallet, ArrowDownRight, ArrowUpRight,
  Landmark, Receipt, Building2,
} from "lucide-react";
import { RecordContributionButton } from "@/components/contributions/RecordContributionButton";
import { AddBankEntryButton } from "@/components/contributions/AddBankEntryButton";

export const revalidate = 60;

const CATEGORY_META: Record<string, { label: string; color: string }> = {
  contribution:    { label: "Contribution",   color: "text-primary"           },
  dividend:        { label: "Dividend",        color: "text-gain"              },
  interest_income: { label: "Interest",        color: "text-gain"              },
  other_income:    { label: "Other Income",    color: "text-gain"              },
  bank_charge:     { label: "Bank Charges",    color: "text-amber-600"         },
  tax:             { label: "Tax",             color: "text-rose-600"          },
  broker_transfer: { label: "Broker Transfer", color: "text-muted-foreground"  },
  other_expense:   { label: "Other Expense",   color: "text-rose-600"          },
};

export default async function ContributionsPage() {
  // Use service client for all data queries to bypass per-user RLS
  const [supabase, svc] = await Promise.all([createClient(), createServiceClient()]);
  const { data: { user } } = await supabase.auth.getUser();

  const [membersRes, contribsRes, summaryRes, brokersRes, ledgerRes, dividendsRes, profileRes] = await Promise.all([
    svc.from("members").select("id, full_name, member_number").order("full_name"),
    svc.from("member_contributions")
      .select("id, member_id, amount, contribution_date, payment_method, bank_reference, notes")
      .order("contribution_date", { ascending: true }),
    svc.from("v_portfolio_summary").select("*").single(),
    svc.from("broker_accounts").select("cash_balance").eq("is_active", true),
    svc.from("bank_ledger").select("*").order("entry_date", { ascending: true }),
    svc.from("transactions")
      .select("id, transaction_date, net_amount, notes, contract_note_number, stocks(ticker, company_name)")
      .eq("transaction_type", "dividend")
      .order("transaction_date", { ascending: true }),
    user ? supabase.from("profiles").select("role").eq("id", user.id).single() : null,
  ]);

  const members = membersRes.data ?? [];
  const contribs = contribsRes.data ?? [];
  const summary = summaryRes.data;
  const brokers = brokersRes.data ?? [];
  const ledger = ledgerRes.data ?? [];
  const dividends = dividendsRes.data ?? [];
  const isAdmin = profileRes?.data?.role === "admin";

  // ── Member lookup ──────────────────────────────────────────────
  const memberMap = new Map(members.map(m => [m.id, m]));
  const memberTotals = new Map<string, number>();
  for (const c of contribs) {
    memberTotals.set(c.member_id, (memberTotals.get(c.member_id) ?? 0) + Number(c.amount));
  }
  const totalContributions = Array.from(memberTotals.values()).reduce((a, b) => a + b, 0);

  // ── Portfolio metrics ──────────────────────────────────────────
  const portfolioValue    = summary?.total_value ?? 0;
  const totalBrokerCash   = brokers.reduce((s, b) => s + (b.cash_balance ?? 0), 0);
  const totalDividendsPaid = dividends.reduce((s, d) => s + (d.net_amount ?? 0), 0);

  // ── Bank ledger metrics ────────────────────────────────────────
  // Exclude broker_transfer from income — those are internal Zenith↔CHD movements, not P&L events
  const bankIncome      = ledger.filter(e => e.amount > 0 && e.category !== "broker_transfer").reduce((s, e) => s + e.amount, 0);
  const bankCharges     = ledger.filter(e => e.amount < 0 && e.category === "bank_charge").reduce((s, e) => s + Math.abs(e.amount), 0);
  const bankTaxes       = ledger.filter(e => e.amount < 0 && e.category === "tax").reduce((s, e) => s + Math.abs(e.amount), 0);
  const brokerOutflows  = ledger.filter(e => e.category === "broker_transfer" && e.amount < 0).reduce((s, e) => s + Math.abs(e.amount), 0);
  const brokerInflows   = ledger.filter(e => e.category === "broker_transfer" && e.amount > 0).reduce((s, e) => s + e.amount, 0);
  const brokerTransfers = brokerOutflows - brokerInflows; // net sent to broker
  const totalBankCosts  = bankCharges + bankTaxes;

  // ── True P&L ───────────────────────────────────────────────────
  const currentValue = portfolioValue + totalBrokerCash + totalDividendsPaid;
  const totalCapital  = totalContributions + bankIncome;
  const netPLBase     = totalCapital - totalBankCosts;
  const netPL         = currentValue - netPLBase;
  const netPLPct      = netPLBase > 0 ? (netPL / netPLBase) * 100 : 0;
  const plPositive    = isPositive(netPL);

  // ── Contributor P&L rows ───────────────────────────────────────
  const plRows = Array.from(memberTotals.entries())
    .map(([memberId, contributed]) => {
      const sharePct    = totalContributions > 0 ? contributed / totalContributions : 0;
      const attrPortfolio = sharePct * portfolioValue;
      const attrGain    = sharePct * (summary?.total_unrealized_gain_loss ?? 0);
      const gainPct     = contributed > 0 ? (attrGain / contributed) * 100 : 0;
      return { memberId, member: memberMap.get(memberId), contributed, sharePct, attrPortfolio, attrGain, gainPct };
    })
    .sort((a, b) => b.contributed - a.contributed);

  // ── Unified account statement (oldest-first for balance, display newest-first) ──
  type StatementEntry = {
    id: string; date: string; description: string; category: string;
    debit: number; credit: number; reference: string | null; balance: number;
  };

  const rawEntries: Omit<StatementEntry, "balance">[] = [];

  // 1. Member contributions → credits
  for (const c of contribs) {
    const member = memberMap.get(c.member_id);
    rawEntries.push({
      id: `c_${c.id}`,
      date: c.contribution_date,
      description: member ? `Contribution — ${member.full_name}` : "Member contribution",
      category: "contribution",
      debit: 0,
      credit: Number(c.amount),
      reference: c.bank_reference || c.notes || null,
    });
  }

  // 2. Dividend payments → credits
  for (const d of dividends) {
    const ticker = (d.stocks as { ticker?: string; company_name?: string } | null)?.ticker;
    const company = (d.stocks as { ticker?: string; company_name?: string } | null)?.company_name;
    rawEntries.push({
      id: `d_${d.id}`,
      date: d.transaction_date,
      description: ticker ? `Dividend — ${ticker}${company ? ` (${company})` : ""}` : "Dividend payment",
      category: "dividend",
      debit: 0,
      credit: d.net_amount ?? 0,
      reference: d.contract_note_number || d.notes || null,
    });
  }

  // 3. Bank ledger entries (charges, interest, taxes, broker transfers)
  for (const e of ledger) {
    rawEntries.push({
      id: `b_${e.id}`,
      date: e.entry_date,
      description: e.description,
      category: e.category,
      debit: e.amount < 0 ? Math.abs(e.amount) : 0,
      credit: e.amount > 0 ? e.amount : 0,
      reference: e.bank_reference || null,
    });
  }

  // Sort oldest-first, compute running balance, then reverse for display
  rawEntries.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  let running = 0;
  const statementAsc: StatementEntry[] = rawEntries.map(e => {
    running += e.credit - e.debit;
    return { ...e, balance: running };
  });

  const cashAtBank  = running;
  const statement   = [...statementAsc].reverse();
  const totalDebits  = rawEntries.reduce((s, e) => s + e.debit,  0);
  const totalCredits = rawEntries.reduce((s, e) => s + e.credit, 0);

  return (
    <div>
      <Header title="Contributions & P&L" subtitle="Capital raised, bank costs, dividends, and collective returns" />
      <div className="p-6 space-y-6">

        {/* ── True P&L Banner ─────────────────────────────────── */}
        <div className={`rounded-xl border p-5 ${plPositive ? "bg-gain/5 border-gain/20" : "bg-loss/5 border-loss/20"}`}>
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Net Return on Capital (after all costs)</p>
              <div className="flex items-center gap-2">
                {plPositive ? <TrendingUp className="w-5 h-5 text-gain" /> : <TrendingDown className="w-5 h-5 text-loss" />}
                <p className={`text-3xl font-bold ${plPositive ? "text-gain" : "text-loss"}`}>
                  {plPositive ? "+" : ""}{formatCurrency(netPL)}
                </p>
                <span className={`text-sm font-medium px-2 py-0.5 rounded-full ${plPositive ? "bg-gain/10 text-gain" : "bg-loss/10 text-loss"}`}>
                  {plPositive ? "+" : ""}{netPLPct.toFixed(2)}%
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                Current value (Portfolio {formatCurrency(portfolioValue)} + Broker cash {formatCurrency(totalBrokerCash)} + Dividends {formatCurrency(totalDividendsPaid)})
                {bankIncome > 0 && ` + Bank interest ${formatCurrency(bankIncome)}`}
                {` − Capital ${formatCurrency(totalContributions)}`}
                {totalBankCosts > 0 && ` − Bank costs ${formatCurrency(totalBankCosts)}`}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-right text-sm shrink-0">
              <div>
                <p className="text-xs text-muted-foreground">Unrealized Gain</p>
                <p className={`font-semibold ${(summary?.total_unrealized_gain_loss ?? 0) >= 0 ? "text-gain" : "text-loss"}`}>
                  {(summary?.total_unrealized_gain_loss ?? 0) >= 0 ? "+" : ""}{formatCurrency(summary?.total_unrealized_gain_loss ?? 0)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Dividends Received</p>
                <p className="font-semibold text-gain">{formatCurrency(totalDividendsPaid)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Summary cards ───────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-card border border-border rounded-xl p-4 lg:col-span-2">
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="w-3.5 h-3.5 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Member Contributions</p>
            </div>
            <p className="text-xl font-bold text-foreground">{formatCurrency(totalContributions)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {contribs.length} payment{contribs.length !== 1 ? "s" : ""} · {memberTotals.size} contributor{memberTotals.size !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <ArrowUpRight className="w-3.5 h-3.5 text-gain" />
              <p className="text-xs text-muted-foreground">Bank Income</p>
            </div>
            <p className="text-xl font-bold text-gain">{formatCurrency(bankIncome)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Interest &amp; credits</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <ArrowDownRight className="w-3.5 h-3.5 text-amber-500" />
              <p className="text-xs text-muted-foreground">Bank Charges</p>
            </div>
            <p className="text-xl font-bold text-amber-600">{formatCurrency(bankCharges)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">COT, fees</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <ArrowDownRight className="w-3.5 h-3.5 text-rose-500" />
              <p className="text-xs text-muted-foreground">Taxes</p>
            </div>
            <p className="text-xl font-bold text-rose-600">{formatCurrency(bankTaxes)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">VAT, stamp duty</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Net to Broker</p>
            </div>
            <p className="text-xl font-bold text-foreground">{formatCurrency(brokerTransfers)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {formatCurrency(brokerOutflows)} out · {formatCurrency(brokerInflows)} returned
            </p>
          </div>
        </div>

        {/* ── Record buttons ───────────────────────────────────── */}
        <div className="flex items-center justify-end gap-2">
          {isAdmin && <AddBankEntryButton />}
          <RecordContributionButton members={members} />
        </div>

        {/* ── Contributor P&L table ───────────────────────────── */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="font-semibold text-foreground">Contributor P&L</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Ownership share proportional to contributions · Unrealized portfolio gains attributed pro-rata
            </p>
          </div>
          {plRows.length === 0 ? (
            <div className="p-12 text-center">
              <Wallet className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="font-medium text-foreground">No contributions recorded yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30">
                  <tr>
                    <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Member</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Contributed</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Share %</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Portfolio Value</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Unrealized Gain</th>
                    <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground">Return %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {plRows.map(({ memberId, member, contributed, sharePct, attrPortfolio, attrGain, gainPct }) => (
                    <tr key={memberId} className="hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-3">
                        <p className="font-medium text-foreground">{member?.full_name ?? "Unknown"}</p>
                        <p className="text-xs text-muted-foreground">{member?.member_number ?? ""}</p>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-foreground">{formatCurrency(contributed)}</td>
                      <td className="px-4 py-3 text-right text-foreground">{(sharePct * 100).toFixed(2)}%</td>
                      <td className="px-4 py-3 text-right font-medium text-foreground">{formatCurrency(attrPortfolio)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-medium ${attrGain >= 0 ? "text-gain" : "text-loss"}`}>
                          {attrGain >= 0 ? "+" : ""}{formatCurrency(attrGain)}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span className={`font-medium ${gainPct >= 0 ? "text-gain" : "text-loss"}`}>
                          {formatPercent(gainPct)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {plRows.length > 1 && (
                  <tfoot className="bg-muted/20 border-t border-border">
                    <tr>
                      <td className="px-5 py-3 text-xs font-semibold text-muted-foreground">Total</td>
                      <td className="px-4 py-3 text-right font-bold text-foreground">{formatCurrency(totalContributions)}</td>
                      <td className="px-4 py-3 text-right font-bold text-foreground">100%</td>
                      <td className="px-4 py-3 text-right font-bold text-foreground">{formatCurrency(portfolioValue)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-bold ${(summary?.total_unrealized_gain_loss ?? 0) >= 0 ? "text-gain" : "text-loss"}`}>
                          {(summary?.total_unrealized_gain_loss ?? 0) >= 0 ? "+" : ""}{formatCurrency(summary?.total_unrealized_gain_loss ?? 0)}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span className={`font-bold ${(summary?.overall_gain_loss_percent ?? 0) >= 0 ? "text-gain" : "text-loss"}`}>
                          {formatPercent(summary?.overall_gain_loss_percent ?? 0)}
                        </span>
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </div>

        {/* ── Account Statement ────────────────────────────────── */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2">
                <Landmark className="w-4 h-4 text-primary" />
                <h3 className="font-semibold text-foreground">Account Statement</h3>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {statement.length} entries — contributions, dividends, interest, charges, taxes, transfers
              </p>
            </div>
            <div className="flex items-center gap-6 text-right text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Total Credits</p>
                <p className="font-semibold text-gain">{formatCurrency(totalCredits)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Debits</p>
                <p className="font-semibold text-loss">{formatCurrency(totalDebits)}</p>
              </div>
              <div className="pl-4 border-l border-border">
                <p className="text-xs text-muted-foreground">Cash at Bank</p>
                <p className={`text-lg font-bold ${cashAtBank >= 0 ? "text-foreground" : "text-loss"}`}>
                  {formatCurrency(cashAtBank)}
                </p>
              </div>
            </div>
          </div>

          {statement.length === 0 ? (
            <div className="p-10 text-center">
              <Receipt className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <p className="font-medium text-foreground">No entries yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Record contributions or add bank entries (interest, charges, taxes) to build the statement
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30">
                  <tr>
                    <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">Date</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Description</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Type</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Debit (₦)</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Credit (₦)</th>
                    <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground">Balance (₦)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {statement.map((entry, i) => {
                    const meta = CATEGORY_META[entry.category] ?? { label: entry.category, color: "text-muted-foreground" };
                    return (
                      <tr key={entry.id} className={`hover:bg-muted/20 transition-colors ${i === 0 ? "bg-muted/10" : ""}`}>
                        <td className="px-5 py-3 text-muted-foreground whitespace-nowrap text-xs">
                          {new Date(entry.date).toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "numeric" })}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-foreground leading-tight">{entry.description}</p>
                          {entry.reference && (
                            <p className="text-xs text-muted-foreground mt-0.5">{entry.reference}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-medium ${meta.color}`}>{meta.label}</span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs text-loss">
                          {entry.debit > 0 ? formatCurrency(entry.debit) : ""}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs text-gain">
                          {entry.credit > 0 ? formatCurrency(entry.credit) : ""}
                        </td>
                        <td className={`px-5 py-3 text-right font-mono text-xs tabular-nums font-medium ${
                          entry.balance >= 0 ? "text-foreground" : "text-loss"
                        } ${i === 0 ? "font-bold" : ""}`}>
                          {formatCurrency(entry.balance)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="border-t-2 border-border bg-muted/30">
                  <tr>
                    <td colSpan={3} className="px-5 py-3 text-xs font-semibold text-muted-foreground">
                      Totals ({rawEntries.length} entries)
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-loss text-xs">{formatCurrency(totalDebits)}</td>
                    <td className="px-4 py-3 text-right font-bold text-gain text-xs">{formatCurrency(totalCredits)}</td>
                    <td className="px-5 py-3 text-right font-bold text-foreground text-xs">{formatCurrency(cashAtBank)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
