import { createClient, createServiceClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/Header";
import { formatCurrency, isPositive } from "@/lib/utils";
import {
  TrendingUp, TrendingDown, Wallet, ArrowDownRight, ArrowUpRight,
  Landmark, Receipt, Building2, Mail, Phone, ShieldCheck,
} from "lucide-react";
import { RecordContributionButton } from "@/components/contributions/RecordContributionButton";
import { AddBankEntryButton } from "@/components/contributions/AddBankEntryButton";
import { ContributionsTable } from "@/components/contributions/ContributionsTable";

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

interface NavRecord { nav_date: string; nav_per_unit: number }

function findNavOnOrBefore(navs: NavRecord[], targetDate: string): NavRecord | null {
  return navs.find(n => n.nav_date <= targetDate) ?? null;
}

export default async function ContributionsPage() {
  const [supabase, svc] = await Promise.all([createClient(), createServiceClient()]);
  const { data: { user } } = await supabase.auth.getUser();

  const today = new Date();
  const mtdRefStr = new Date(today.getFullYear(), today.getMonth(), 0).toISOString().split("T")[0];
  const momRefStr = new Date(today.getTime() - 30 * 86400000).toISOString().split("T")[0];
  const ytdRefStr = `${today.getFullYear() - 1}-12-31`;

  const [
    membersRes, contribsRes, summaryRes, brokersRes,
    ledgerRes, dividendsRes, profileRes,
    navRes, unitBalancesRes,
  ] = await Promise.all([
    svc.from("members").select("id, full_name, member_number, email, phone, bank_name, bank_account_number, is_active, join_date").order("full_name"),
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
    user ? supabase.from("profiles").select("role, id").eq("id", user.id).single() : null,
    svc.from("fund_nav").select("nav_date, nav_per_unit").order("nav_date", { ascending: false }).limit(400),
    svc.from("v_member_unit_balances").select("*"),
  ]);

  const members = membersRes.data ?? [];
  const contribs = contribsRes.data ?? [];
  const summary = summaryRes.data;
  const brokers = brokersRes.data ?? [];
  const ledger = ledgerRes.data ?? [];
  const dividends = dividendsRes.data ?? [];
  const isAdmin = profileRes?.data?.role === "admin";

  const navHistory: NavRecord[] = (navRes.data ?? []).map(n => ({
    nav_date: n.nav_date,
    nav_per_unit: Number(n.nav_per_unit),
  }));
  const unitBalances = unitBalancesRes.data ?? [];

  // ── Fund-level period returns (NAV-based) ──────────────────────────
  const currentNav = navHistory[0] ?? null;
  const mtdRefNav  = findNavOnOrBefore(navHistory, mtdRefStr);
  const momRefNav  = findNavOnOrBefore(navHistory, momRefStr);
  const ytdRefNav  = findNavOnOrBefore(navHistory, ytdRefStr);
  const cnv = currentNav?.nav_per_unit ?? null;
  const fundReturns = {
    mtd: cnv && mtdRefNav ? ((cnv - mtdRefNav.nav_per_unit) / mtdRefNav.nav_per_unit) * 100 : null,
    mom: cnv && momRefNav ? ((cnv - momRefNav.nav_per_unit) / momRefNav.nav_per_unit) * 100 : null,
    ytd: cnv && ytdRefNav ? ((cnv - ytdRefNav.nav_per_unit) / ytdRefNav.nav_per_unit) * 100 : null,
  };

  // ── Aggregate metrics ──────────────────────────────────────────────
  const memberMap = new Map(members.map(m => [m.id, m]));
  const memberTotals = new Map<string, number>();
  for (const c of contribs) {
    memberTotals.set(c.member_id, (memberTotals.get(c.member_id) ?? 0) + Number(c.amount));
  }
  const totalContributions = Array.from(memberTotals.values()).reduce((a, b) => a + b, 0);

  const portfolioValue    = summary?.total_value ?? 0;
  const totalBrokerCash   = brokers.reduce((s, b) => s + (b.cash_balance ?? 0), 0);
  const totalDividendsPaid = dividends.reduce((s, d) => s + (d.net_amount ?? 0), 0);

  const bankIncome     = ledger.filter(e => e.amount > 0 && e.category !== "broker_transfer").reduce((s, e) => s + e.amount, 0);
  const bankCharges    = ledger.filter(e => e.amount < 0 && e.category === "bank_charge").reduce((s, e) => s + Math.abs(e.amount), 0);
  const bankTaxes      = ledger.filter(e => e.amount < 0 && e.category === "tax").reduce((s, e) => s + Math.abs(e.amount), 0);
  const brokerOutflows = ledger.filter(e => e.category === "broker_transfer" && e.amount < 0).reduce((s, e) => s + Math.abs(e.amount), 0);
  const brokerInflows  = ledger.filter(e => e.category === "broker_transfer" && e.amount > 0).reduce((s, e) => s + e.amount, 0);
  const brokerTransfers = brokerOutflows - brokerInflows;
  const totalBankCosts  = bankCharges + bankTaxes;

  const currentValue = portfolioValue + totalBrokerCash + totalDividendsPaid;
  const totalCapital  = totalContributions + bankIncome;
  const netPLBase     = totalCapital - totalBankCosts;
  const netPL         = currentValue - netPLBase;
  const netPLPct      = netPLBase > 0 ? (netPL / netPLBase) * 100 : 0;
  const plPositive    = isPositive(netPL);

  // ── Per-member data ────────────────────────────────────────────────
  const unitBalanceMap = new Map(unitBalances.map(b => [b.member_id, b]));

  // Only show members who have contributions
  const contributingMemberIds = Array.from(memberTotals.keys());
  const memberCards = contributingMemberIds
    .map(memberId => {
      const member = memberMap.get(memberId);
      const totalContributed = memberTotals.get(memberId) ?? 0;
      const unitBalance = unitBalanceMap.get(memberId);
      const unitsHeld = Number(unitBalance?.units_held ?? 0);
      const ownershipPct = Number(unitBalance?.ownership_pct ?? 0);
      const currentMemberValue = Number(unitBalance?.current_value ?? 0);

      const inceptionReturn = totalContributed > 0
        ? ((currentMemberValue - totalContributed) / totalContributed) * 100
        : null;

      // ₦ return for each period = units * NAV change
      const mtdNairaReturn = cnv && mtdRefNav ? unitsHeld * (cnv - mtdRefNav.nav_per_unit) : null;
      const momNairaReturn = cnv && momRefNav ? unitsHeld * (cnv - momRefNav.nav_per_unit) : null;
      const ytdNairaReturn = cnv && ytdRefNav ? unitsHeld * (cnv - ytdRefNav.nav_per_unit) : null;

      return {
        memberId,
        member,
        totalContributed,
        unitsHeld,
        ownershipPct,
        currentMemberValue,
        inceptionReturn,
        mtdNairaReturn,
        momNairaReturn,
        ytdNairaReturn,
      };
    })
    .sort((a, b) => b.totalContributed - a.totalContributed);

  // ── Contribution schedule rows ─────────────────────────────────────
  const contributionRows = contribs.map(c => {
    const m = memberMap.get(c.member_id);
    return {
      id: c.id,
      date: c.contribution_date,
      memberName: m?.full_name ?? "Unknown",
      memberNumber: m?.member_number ?? "",
      amount: Number(c.amount),
      via: c.bank_reference ?? c.payment_method ?? null,
      notes: c.notes ?? null,
    };
  });

  // ── Unified account statement ──────────────────────────────────────
  type StatementEntry = {
    id: string; date: string; description: string; category: string;
    debit: number; credit: number; reference: string | null; balance: number;
  };
  const rawEntries: Omit<StatementEntry, "balance">[] = [];

  for (const c of contribs) {
    const member = memberMap.get(c.member_id);
    rawEntries.push({
      id: `c_${c.id}`, date: c.contribution_date,
      description: member ? `Contribution — ${member.full_name}` : "Member contribution",
      category: "contribution", debit: 0, credit: Number(c.amount),
      reference: c.bank_reference || c.notes || null,
    });
  }
  for (const d of dividends) {
    const ticker = (d.stocks as { ticker?: string } | null)?.ticker;
    const company = (d.stocks as { company_name?: string } | null)?.company_name;
    rawEntries.push({
      id: `d_${d.id}`, date: d.transaction_date,
      description: ticker ? `Dividend — ${ticker}${company ? ` (${company})` : ""}` : "Dividend payment",
      category: "dividend", debit: 0, credit: d.net_amount ?? 0,
      reference: d.contract_note_number || d.notes || null,
    });
  }
  for (const e of ledger) {
    rawEntries.push({
      id: `b_${e.id}`, date: e.entry_date, description: e.description,
      category: e.category, debit: e.amount < 0 ? Math.abs(e.amount) : 0,
      credit: e.amount > 0 ? e.amount : 0, reference: e.bank_reference || null,
    });
  }

  rawEntries.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  let running = 0;
  const statementAsc: StatementEntry[] = rawEntries.map(e => {
    running += e.credit - e.debit;
    return { ...e, balance: running };
  });
  const cashAtBank  = running;
  const statement   = [...statementAsc].reverse();
  const totalDebits  = rawEntries.reduce((s, e) => s + e.debit, 0);
  const totalCredits = rawEntries.reduce((s, e) => s + e.credit, 0);

  function ReturnBadge({ pct }: { pct: number | null }) {
    if (pct === null) return <span className="text-muted-foreground text-xs">—</span>;
    const pos = pct >= 0;
    return (
      <span className={`text-xs font-bold ${pos ? "text-gain" : "text-loss"}`}>
        {pos ? "+" : ""}{pct.toFixed(2)}%
      </span>
    );
  }

  return (
    <div>
      <Header title="Contributions" subtitle="Capital raised, returns per member, and account statement" />
      <div className="p-4 sm:p-6 space-y-6">

        {/* ── P&L Banner ─────────────────────────────────────────── */}
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
              <p className="hidden sm:block text-xs text-muted-foreground mt-1.5 leading-relaxed">
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

        {/* ── Fund-level period returns ───────────────────────────── */}
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="font-semibold text-foreground mb-1">Fund Performance</h3>
          <p className="text-xs text-muted-foreground mb-4">NAV-per-unit returns — same % applies proportionally to all members</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Month to Date", sub: "vs end of last month", value: fundReturns.mtd },
              { label: "Month on Month", sub: "vs 30 days ago", value: fundReturns.mom },
              { label: "Year to Date", sub: "vs 31 Dec last year", value: fundReturns.ytd },
              { label: "Since Inception", sub: "vs total capital raised", value: netPLPct },
            ].map(({ label, sub, value }) => {
              const pos = value !== null && value >= 0;
              return (
                <div key={label} className="bg-muted/30 rounded-xl p-4">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <div className="mt-2">
                    {value === null ? (
                      <span className="text-muted-foreground text-xs">—</span>
                    ) : (
                      <span className={`text-sm font-bold ${pos ? "text-gain" : "text-loss"}`}>
                        {pos ? "+" : ""}{value.toFixed(2)}%
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{sub}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Summary cards ───────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-card border border-border rounded-xl p-4 lg:col-span-2">
            <div className="flex items-center gap-2 mb-1"><Wallet className="w-3.5 h-3.5 text-muted-foreground" /><p className="text-xs text-muted-foreground">Member Contributions</p></div>
            <p className="text-xl font-bold text-foreground">{formatCurrency(totalContributions)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{contribs.length} payments · {memberTotals.size} contributors</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1"><ArrowUpRight className="w-3.5 h-3.5 text-gain" /><p className="text-xs text-muted-foreground">Bank Income</p></div>
            <p className="text-xl font-bold text-gain">{formatCurrency(bankIncome)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Interest &amp; credits</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1"><ArrowDownRight className="w-3.5 h-3.5 text-amber-500" /><p className="text-xs text-muted-foreground">Bank Charges</p></div>
            <p className="text-xl font-bold text-amber-600">{formatCurrency(bankCharges)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">COT, fees</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1"><ArrowDownRight className="w-3.5 h-3.5 text-rose-500" /><p className="text-xs text-muted-foreground">Taxes</p></div>
            <p className="text-xl font-bold text-rose-600">{formatCurrency(bankTaxes)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">VAT, stamp duty</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1"><Building2 className="w-3.5 h-3.5 text-muted-foreground" /><p className="text-xs text-muted-foreground">Net to Broker</p></div>
            <p className="text-xl font-bold text-foreground">{formatCurrency(brokerTransfers)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{formatCurrency(brokerOutflows)} out · {formatCurrency(brokerInflows)} back</p>
          </div>
        </div>

        {/* ── Per-member cards ─────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-foreground">Member Breakdown</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Individual contribution, units, and returns</p>
            </div>
            <div className="flex items-center gap-2">
              {isAdmin && <AddBankEntryButton />}
              <RecordContributionButton members={members} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {memberCards.map(({ memberId, member, totalContributed, unitsHeld, ownershipPct, currentMemberValue, inceptionReturn, mtdNairaReturn, momNairaReturn, ytdNairaReturn }) => {
              const gain = inceptionReturn !== null && inceptionReturn >= 0;
              const initials = (member?.full_name ?? "?").split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();
              return (
                <div key={memberId} className="bg-card border border-border rounded-xl p-5">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                        <span className="text-primary font-semibold text-sm">{initials}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground leading-tight truncate">{member?.full_name ?? "Unknown"}</p>
                        {member?.member_number && <p className="text-xs text-muted-foreground">{member.member_number}</p>}
                      </div>
                    </div>
                    {ownershipPct > 0 && (
                      <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full shrink-0 ml-2">
                        {ownershipPct.toFixed(1)}% owner
                      </span>
                    )}
                  </div>

                  {/* Contact info */}
                  <div className="space-y-1 mb-4">
                    {member?.email && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Mail className="w-3 h-3 shrink-0" />
                        <span className="truncate">{member.email}</span>
                      </div>
                    )}
                    {member?.phone && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Phone className="w-3 h-3 shrink-0" />
                        <span>{member.phone}</span>
                      </div>
                    )}
                    {member?.bank_name && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Landmark className="w-3 h-3 shrink-0" />
                        <span>{member.bank_name} · ****{member.bank_account_number?.slice(-4)}</span>
                      </div>
                    )}
                  </div>

                  {/* Contribution & value */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-muted/30 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground mb-0.5">Contributed</p>
                      <p className="text-sm font-bold text-foreground">{formatCurrency(totalContributed)}</p>
                    </div>
                    <div className="bg-muted/30 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground mb-0.5">Current Value</p>
                      <p className="text-sm font-bold text-foreground">{currentMemberValue > 0 ? formatCurrency(currentMemberValue) : "—"}</p>
                    </div>
                    <div className="bg-muted/30 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground mb-0.5">Units Held</p>
                      <p className="text-sm font-bold text-foreground">
                        {unitsHeld > 0 ? unitsHeld.toLocaleString("en-NG", { maximumFractionDigits: 2 }) : "—"}
                      </p>
                    </div>
                    <div className={`rounded-lg p-3 ${gain ? "bg-gain/5" : "bg-loss/5"}`}>
                      <p className="text-xs text-muted-foreground mb-0.5">Inception Return</p>
                      {inceptionReturn !== null ? (
                        <p className={`text-sm font-bold ${gain ? "text-gain" : "text-loss"}`}>
                          {gain ? "+" : ""}{inceptionReturn.toFixed(2)}%
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground">—</p>
                      )}
                    </div>
                  </div>

                  {/* Period returns */}
                  <div className="border-t border-border pt-3">
                    <p className="text-xs text-muted-foreground mb-2">Period Returns (₦)</p>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      {[
                        { label: "MTD", value: mtdNairaReturn, pct: fundReturns.mtd },
                        { label: "MoM", value: momNairaReturn, pct: fundReturns.mom },
                        { label: "YTD", value: ytdNairaReturn, pct: fundReturns.ytd },
                      ].map(({ label, value, pct }) => {
                        const pos = value !== null && value >= 0;
                        return (
                          <div key={label} className="bg-muted/20 rounded-lg p-2">
                            <p className="text-xs text-muted-foreground">{label}</p>
                            {value !== null ? (
                              <>
                                <p className={`text-xs font-bold ${pos ? "text-gain" : "text-loss"}`}>
                                  {pos ? "+" : ""}{formatCurrency(value)}
                                </p>
                                {pct !== null && (
                                  <p className={`text-xs ${pos ? "text-gain" : "text-loss"}`}>
                                    ({pos ? "+" : ""}{pct.toFixed(1)}%)
                                  </p>
                                )}
                              </>
                            ) : (
                              <p className="text-xs text-muted-foreground">—</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Join date */}
                  {member?.join_date && (
                    <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border">
                      Member since {new Date(member.join_date).toLocaleDateString("en-NG", { month: "long", year: "numeric" })}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Contribution Schedule ──────────────────────────────── */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 sm:px-5 py-4 border-b border-border">
            <h3 className="font-semibold text-foreground">Contribution Schedule</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {contributionRows.length} payment{contributionRows.length !== 1 ? "s" : ""} · click column headers to sort
            </p>
          </div>
          {contributionRows.length === 0 ? (
            <div className="p-12 text-center">
              <Wallet className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="font-medium text-foreground">No contributions recorded yet</p>
            </div>
          ) : (
            <ContributionsTable rows={contributionRows} />
          )}
        </div>

        {/* ── Account Statement ──────────────────────────────────── */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 sm:px-5 py-4 border-b border-border">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div className="flex items-center gap-2">
                  <Landmark className="w-4 h-4 text-primary" />
                  <h3 className="font-semibold text-foreground">Account Statement</h3>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{statement.length} entries</p>
              </div>
              <div className="flex items-center gap-3 sm:gap-6 text-right text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Credits</p>
                  <p className="font-semibold text-gain text-sm">{formatCurrency(totalCredits)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Debits</p>
                  <p className="font-semibold text-loss text-sm">{formatCurrency(totalDebits)}</p>
                </div>
                <div className="pl-3 sm:pl-4 border-l border-border">
                  <p className="text-xs text-muted-foreground">Balance</p>
                  <p className={`font-bold ${cashAtBank >= 0 ? "text-foreground" : "text-loss"}`}>{formatCurrency(cashAtBank)}</p>
                </div>
              </div>
            </div>
          </div>

          {statement.length === 0 ? (
            <div className="p-10 text-center">
              <Receipt className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <p className="font-medium text-foreground">No entries yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">Date</th>
                    <th className="text-left px-3 py-3 text-xs font-medium text-muted-foreground">Description</th>
                    <th className="hidden sm:table-cell text-left px-3 py-3 text-xs font-medium text-muted-foreground">Type</th>
                    <th className="hidden sm:table-cell text-right px-3 py-3 text-xs font-medium text-muted-foreground">Debit</th>
                    <th className="hidden sm:table-cell text-right px-3 py-3 text-xs font-medium text-muted-foreground">Credit</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {statement.map((entry, i) => {
                    const meta = CATEGORY_META[entry.category] ?? { label: entry.category, color: "text-muted-foreground" };
                    return (
                      <tr key={entry.id} className={`hover:bg-muted/20 transition-colors ${i === 0 ? "bg-muted/10" : ""}`}>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-xs">
                          {new Date(entry.date).toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "2-digit" })}
                        </td>
                        <td className="px-3 py-3 max-w-0">
                          <p className="text-foreground leading-tight text-xs truncate">{entry.description}</p>
                          {entry.reference && <p className="text-xs text-muted-foreground mt-0.5 truncate">{entry.reference}</p>}
                          <p className={`text-xs font-medium mt-0.5 sm:hidden ${entry.credit > 0 ? "text-gain" : "text-loss"}`}>
                            {entry.credit > 0 ? `+${formatCurrency(entry.credit)}` : entry.debit > 0 ? `−${formatCurrency(entry.debit)}` : ""}
                          </p>
                        </td>
                        <td className="hidden sm:table-cell px-3 py-3">
                          <span className={`text-xs font-medium ${meta.color}`}>{meta.label}</span>
                        </td>
                        <td className="hidden sm:table-cell px-3 py-3 text-right font-mono text-xs text-loss">
                          {entry.debit > 0 ? formatCurrency(entry.debit) : ""}
                        </td>
                        <td className="hidden sm:table-cell px-3 py-3 text-right font-mono text-xs text-gain">
                          {entry.credit > 0 ? formatCurrency(entry.credit) : ""}
                        </td>
                        <td className={`px-4 py-3 text-right font-mono text-xs tabular-nums font-medium ${entry.balance >= 0 ? "text-foreground" : "text-loss"} ${i === 0 ? "font-bold" : ""}`}>
                          {formatCurrency(entry.balance)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="border-t-2 border-border bg-muted/30">
                  <tr>
                    <td colSpan={2} className="px-4 py-3 text-xs font-semibold text-muted-foreground">Totals ({rawEntries.length})</td>
                    <td className="hidden sm:table-cell px-3 py-3" />
                    <td className="hidden sm:table-cell px-3 py-3 text-right font-bold text-loss text-xs">{formatCurrency(totalDebits)}</td>
                    <td className="hidden sm:table-cell px-3 py-3 text-right font-bold text-gain text-xs">{formatCurrency(totalCredits)}</td>
                    <td className="px-4 py-3 text-right font-bold text-foreground text-xs">{formatCurrency(cashAtBank)}</td>
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
