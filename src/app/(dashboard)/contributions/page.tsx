import { createClient, createServiceClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/Header";
import { formatCurrency, isPositive } from "@/lib/utils";
import {
  TrendingUp, TrendingDown, Wallet, ArrowDownRight, ArrowUpRight,
  Building2,
} from "lucide-react";
import { RecordContributionButton } from "@/components/contributions/RecordContributionButton";
import { AddBankEntryButton } from "@/components/contributions/AddBankEntryButton";
import { MemberCard } from "@/components/contributions/MemberCard";
import {
  computeNavAtDate, computeMonthlyReturns, monthEnd,
  BASELINE_NAV, type NavRawData,
} from "@/lib/navEngine";

export const revalidate = 60;

export default async function ContributionsPage() {
  const [supabase, svc] = await Promise.all([createClient(), createServiceClient()]);
  const { data: { user } } = await supabase.auth.getUser();

  // ── Round 1: parallel data fetch ──────────────────────────────────
  const [
    membersRes, contribsRes, summaryRes, brokersRes,
    ledgerRes, dividendsRes, profileRes,
    unitBalancesRes, fundValsRes, unitTxnsRes, allTxnsRes,
  ] = await Promise.all([
    svc.from("members")
      .select("id, full_name, member_number, email, phone, bank_name, bank_account_number, is_active, join_date")
      .order("full_name"),
    svc.from("member_contributions")
      .select("id, member_id, amount, contribution_date, payment_method, bank_reference, notes")
      .order("contribution_date", { ascending: true }),
    svc.from("v_portfolio_summary").select("*").single(),
    svc.from("broker_accounts").select("cash_balance").eq("is_active", true),
    svc.from("bank_ledger").select("amount, category, entry_date").order("entry_date", { ascending: true }),
    svc.from("transactions")
      .select("net_amount")
      .eq("transaction_type", "dividend"),
    user ? supabase.from("profiles").select("role, id").eq("id", user.id).single() : null,
    svc.from("v_member_unit_balances").select("*"),
    svc.from("mutual_fund_valuations").select("fund_name, valuation_date, value"),
    svc.from("unit_transactions").select("txn_date, units"),
    svc.from("transactions")
      .select("transaction_date, transaction_type, stock_id, quantity, net_amount")
      .order("transaction_date", { ascending: false }),
  ]);

  const members     = membersRes.data ?? [];
  const contribs    = contribsRes.data ?? [];
  const summary     = summaryRes.data;
  const brokers     = brokersRes.data ?? [];
  const ledger      = ledgerRes.data ?? [];
  const dividends   = dividendsRes.data ?? [];
  const isAdmin     = profileRes?.data?.role === "admin";
  const unitBalances = unitBalancesRes.data ?? [];
  const allTxns     = allTxnsRes.data ?? [];

  // ── Round 2: stock prices (needs stock_ids from transactions) ──────
  const stockIds = Array.from(new Set(allTxns.filter(t => t.stock_id).map(t => t.stock_id!)));
  const stockPricesRes = stockIds.length > 0
    ? await svc.from("stock_prices")
        .select("stock_id, price_date, closing_price")
        .in("stock_id", stockIds)
        .gte("price_date", "2026-05-01")
    : { data: [] as { stock_id: string; price_date: string; closing_price: number }[] };

  // ── Build NavRawData ───────────────────────────────────────────────
  const navData: NavRawData = {
    stockPrices: (stockPricesRes.data ?? []).map(p => ({
      stock_id: p.stock_id,
      price_date: p.price_date,
      closing_price: Number(p.closing_price),
    })),
    fundVals: (fundValsRes.data ?? []).map(v => ({
      fund_name: v.fund_name,
      valuation_date: v.valuation_date,
      value: Number(v.value),
    })),
    unitTxns: (unitTxnsRes.data ?? []).map(t => ({
      txn_date: t.txn_date,
      units: Number(t.units),
    })),
    portfolioTxns: allTxns.map(t => ({
      transaction_date: t.transaction_date,
      transaction_type: t.transaction_type,
      stock_id: t.stock_id ?? null,
      quantity: t.quantity ?? null,
      net_amount: t.net_amount ?? null,
    })),
    contributions: contribs.map(c => ({
      contribution_date: c.contribution_date,
      amount: Number(c.amount),
    })),
    bankLedger: ledger.map(e => ({
      entry_date: e.entry_date,
      amount: Number(e.amount),
      category: e.category,
    })),
  };

  // ── Derived NAV + returns ──────────────────────────────────────────
  const today     = new Date();
  const todayStr  = today.toISOString().split("T")[0];
  const mtdRefStr = monthEnd(today.getFullYear(), today.getMonth()); // end of prev month

  const navToday  = computeNavAtDate(todayStr, navData);
  const navMtdRef = computeNavAtDate(mtdRefStr, navData);
  const monthlyReturns = computeMonthlyReturns(today, navData);

  const fundMtdPct = navToday !== null && navMtdRef !== null && navMtdRef > 0
    ? ((navToday - navMtdRef) / navMtdRef) * 100 : null;
  const fundInceptionPct = navToday !== null
    ? ((navToday - BASELINE_NAV) / BASELINE_NAV) * 100 : null;

  // ── Aggregate metrics ──────────────────────────────────────────────
  const memberMap    = new Map(members.map(m => [m.id, m]));
  const memberTotals = new Map<string, number>();
  for (const c of contribs) {
    memberTotals.set(c.member_id, (memberTotals.get(c.member_id) ?? 0) + Number(c.amount));
  }
  const totalContributions = Array.from(memberTotals.values()).reduce((a, b) => a + b, 0);

  const portfolioValue     = summary?.total_value ?? 0;
  const totalBrokerCash    = brokers.reduce((s, b) => s + (b.cash_balance ?? 0), 0);
  const totalDividendsPaid = dividends.reduce((s, d) => s + Number(d.net_amount ?? 0), 0);

  const bankIncome     = ledger.filter(e => e.amount > 0 && e.category !== "broker_transfer")
    .reduce((s, e) => s + e.amount, 0);
  const bankCharges    = ledger.filter(e => e.amount < 0 && e.category === "bank_charge")
    .reduce((s, e) => s + Math.abs(e.amount), 0);
  const bankTaxes      = ledger.filter(e => e.amount < 0 && e.category === "tax")
    .reduce((s, e) => s + Math.abs(e.amount), 0);
  const brokerOutflows = ledger.filter(e => e.category === "broker_transfer" && e.amount < 0)
    .reduce((s, e) => s + Math.abs(e.amount), 0);
  const brokerInflows  = ledger.filter(e => e.category === "broker_transfer" && e.amount > 0)
    .reduce((s, e) => s + e.amount, 0);
  const brokerTransfers = brokerOutflows - brokerInflows;
  const totalBankCosts  = bankCharges + bankTaxes;

  const currentValue = portfolioValue + totalBrokerCash + totalDividendsPaid;
  const totalCapital  = totalContributions + bankIncome;
  const netPLBase     = totalCapital - totalBankCosts;
  const netPL         = currentValue - netPLBase;
  const netPLPct      = netPLBase > 0 ? (netPL / netPLBase) * 100 : 0;
  const plPositive    = isPositive(netPL);

  // ── Per-member card data ───────────────────────────────────────────
  const unitBalanceMap = new Map(unitBalances.map(b => [b.member_id, b]));

  const contributingMemberIds = Array.from(memberTotals.keys());
  const memberCardData = contributingMemberIds
    .map(memberId => {
      const member          = memberMap.get(memberId);
      const totalContributed = memberTotals.get(memberId) ?? 0;
      const unitBalance     = unitBalanceMap.get(memberId);
      const unitsHeld       = Number(unitBalance?.units_held ?? 0);
      const ownershipPct    = Number(unitBalance?.ownership_pct ?? 0);
      const currentMemberValue = Number(unitBalance?.current_value ?? 0);

      const inceptionNaira = navToday !== null
        ? unitsHeld * (navToday - BASELINE_NAV) : null;
      const mtdNaira = navToday !== null && navMtdRef !== null
        ? unitsHeld * (navToday - navMtdRef) : null;

      const memberContribs = contribs
        .filter(c => c.member_id === memberId)
        .map(c => ({
          id:    c.id,
          date:  c.contribution_date,
          amount: Number(c.amount),
          via:   c.bank_reference ?? c.payment_method ?? null,
          notes: c.notes ?? null,
        }));

      const memberMonthlyReturns = monthlyReturns.map(r => ({
        ym:          r.ym,
        label:       r.label,
        returnPct:   r.returnPct,
        nairaReturn: unitsHeld * r.nairaReturnPerUnit,
        isPartial:   r.isPartial,
      }));

      return {
        memberId,
        member,
        totalContributed,
        unitsHeld,
        ownershipPct,
        currentMemberValue,
        inceptionReturnPct: fundInceptionPct,
        inceptionNaira,
        mtdNaira,
        mtdPct: fundMtdPct,
        monthlyReturns: memberMonthlyReturns,
        memberContribs,
      };
    })
    .sort((a, b) => b.totalContributed - a.totalContributed);

  return (
    <div>
      <Header title="Contributions" subtitle="Capital raised and returns per member" />
      <div className="p-4 sm:p-6 space-y-6">

        {/* ── P&L Banner ─────────────────────────────────────────── */}
        <div className={`rounded-xl border p-5 ${plPositive ? "bg-gain/5 border-gain/20" : "bg-loss/5 border-loss/20"}`}>
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Net Return on Capital (after all costs)</p>
              <div className="flex items-center gap-2">
                {plPositive
                  ? <TrendingUp className="w-5 h-5 text-gain" />
                  : <TrendingDown className="w-5 h-5 text-loss" />}
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

        {/* ── Fund-level performance ──────────────────────────────── */}
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="font-semibold text-foreground mb-1">Fund Performance</h3>
          <p className="text-xs text-muted-foreground mb-4">
            NAV per unit — computed from portfolio positions and cash flows · same % applies to all members
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            {[
              { label: "Month to Date",  sub: "vs end of last month",        value: fundMtdPct       },
              { label: "Since Inception", sub: "from ₦100 baseline, May 2026", value: fundInceptionPct },
              { label: "NAV per Unit",   sub: navToday !== null ? `₦${navToday.toFixed(4)}` : "—",       value: null, highlight: true },
              { label: "NAV Baseline",   sub: "par value at inception",       value: null, nav: BASELINE_NAV },
            ].map(({ label, sub, value, highlight, nav }) => {
              const pos = value !== null && value >= 0;
              return (
                <div key={label} className="bg-muted/30 rounded-xl p-4">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <div className="mt-2">
                    {nav !== undefined ? (
                      <span className="text-sm font-bold text-foreground">₦{nav.toFixed(2)}</span>
                    ) : highlight ? (
                      <span className="text-sm font-bold text-primary">{sub}</span>
                    ) : value === null ? (
                      <span className="text-muted-foreground text-xs">—</span>
                    ) : (
                      <span className={`text-sm font-bold ${pos ? "text-gain" : "text-loss"}`}>
                        {pos ? "+" : ""}{value.toFixed(2)}%
                      </span>
                    )}
                  </div>
                  {!highlight && nav === undefined && (
                    <p className="text-xs text-muted-foreground mt-1">{sub}</p>
                  )}
                  {highlight && (
                    <p className="text-xs text-muted-foreground mt-1">derived from portfolio data</p>
                  )}
                  {nav !== undefined && (
                    <p className="text-xs text-muted-foreground mt-1">{sub}</p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Monthly returns strip */}
          {monthlyReturns.length > 0 && (
            <div className="border-t border-border pt-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Monthly Returns</p>
              <div className="flex flex-wrap gap-2">
                {[...monthlyReturns].reverse().map(r => {
                  const pos = r.returnPct >= 0;
                  return (
                    <div key={r.ym} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs ${pos ? "bg-gain/10 text-gain" : "bg-loss/10 text-loss"}`}>
                      <span className="font-medium">{r.label}{r.isPartial ? "*" : ""}</span>
                      <span className="font-bold">{pos ? "+" : ""}{r.returnPct.toFixed(2)}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Summary cards ───────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-card border border-border rounded-xl p-4 lg:col-span-2">
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="w-3.5 h-3.5 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Member Contributions</p>
            </div>
            <p className="text-xl font-bold text-foreground">{formatCurrency(totalContributions)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {contribs.length} payments · {memberTotals.size} contributors
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
              {formatCurrency(brokerOutflows)} out · {formatCurrency(brokerInflows)} back
            </p>
          </div>
        </div>

        {/* ── Per-member cards (expandable) ───────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-foreground">Member Breakdown</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Click a card to expand contribution history
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isAdmin && <AddBankEntryButton />}
              <RecordContributionButton members={members} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {memberCardData.map(card => (
              <MemberCard
                key={card.memberId}
                member={{
                  full_name:            card.member?.full_name ?? "Unknown",
                  member_number:        card.member?.member_number ?? null,
                  email:                card.member?.email ?? null,
                  phone:                card.member?.phone ?? null,
                  bank_name:            card.member?.bank_name ?? null,
                  bank_account_number:  card.member?.bank_account_number ?? null,
                  join_date:            card.member?.join_date ?? null,
                }}
                totalContributed={card.totalContributed}
                unitsHeld={card.unitsHeld}
                ownershipPct={card.ownershipPct}
                currentMemberValue={card.currentMemberValue}
                inceptionReturnPct={card.inceptionReturnPct}
                inceptionNaira={card.inceptionNaira}
                mtdNaira={card.mtdNaira}
                mtdPct={card.mtdPct}
                monthlyReturns={card.monthlyReturns}
                memberContribs={card.memberContribs}
              />
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
