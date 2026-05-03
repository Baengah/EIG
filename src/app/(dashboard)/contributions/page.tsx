import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/Header";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { TrendingUp, TrendingDown, Wallet, Users } from "lucide-react";
import { RecordContributionButton } from "@/components/contributions/RecordContributionButton";

export const revalidate = 60;

export default async function ContributionsPage() {
  const supabase = await createClient();

  const [membersRes, contribsRes, summaryRes] = await Promise.all([
    supabase.from("members").select("id, full_name, member_number").eq("is_active", true).order("full_name"),
    supabase
      .from("member_contributions")
      .select("id, member_id, amount, contribution_date, payment_method, bank_reference, notes")
      .order("contribution_date", { ascending: false }),
    supabase.from("v_portfolio_summary").select("*").single(),
  ]);

  const members = membersRes.data ?? [];
  const contribs = contribsRes.data ?? [];
  const summary = summaryRes.data;

  // Build member name lookup
  const memberMap = new Map(members.map(m => [m.id, m]));

  // Per-member totals
  const memberTotals = new Map<string, number>();
  for (const c of contribs) {
    memberTotals.set(c.member_id, (memberTotals.get(c.member_id) ?? 0) + Number(c.amount));
  }

  const totalContributed = Array.from(memberTotals.values()).reduce((a, b) => a + b, 0);
  const totalPortfolioValue = summary?.total_value ?? 0;
  const totalUnrealizedGain = summary?.total_unrealized_gain_loss ?? 0;

  // Contributor P&L rows — sorted by contribution descending
  const plRows = Array.from(memberTotals.entries())
    .map(([memberId, contributed]) => {
      const sharePct = totalContributed > 0 ? contributed / totalContributed : 0;
      const portfolioValue = sharePct * totalPortfolioValue;
      const gain = sharePct * totalUnrealizedGain;
      const gainPct = contributed > 0 ? (gain / contributed) * 100 : 0;
      const member = memberMap.get(memberId);
      return { memberId, member, contributed, sharePct, portfolioValue, gain, gainPct };
    })
    .sort((a, b) => b.contributed - a.contributed);

  const METHOD_LABELS: Record<string, string> = {
    bank_transfer: "Bank Transfer",
    online: "Online",
    cash: "Cash",
    other: "Other",
  };

  return (
    <div>
      <Header title="Contributions" subtitle="Member contributions and portfolio ownership" />
      <div className="p-6 space-y-6">

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="w-3.5 h-3.5 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Total Raised</p>
            </div>
            <p className="text-xl font-bold text-foreground">{formatCurrency(totalContributed)}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Portfolio Value</p>
            </div>
            <p className="text-xl font-bold text-foreground">{formatCurrency(totalPortfolioValue)}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              {totalUnrealizedGain >= 0
                ? <TrendingUp className="w-3.5 h-3.5 text-gain" />
                : <TrendingDown className="w-3.5 h-3.5 text-loss" />}
              <p className="text-xs text-muted-foreground">Unrealized Gain</p>
            </div>
            <p className={`text-xl font-bold ${totalUnrealizedGain >= 0 ? "text-gain" : "text-loss"}`}>
              {totalUnrealizedGain >= 0 ? "+" : ""}{formatCurrency(totalUnrealizedGain)}
            </p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-3.5 h-3.5 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Contributors</p>
            </div>
            <p className="text-xl font-bold text-foreground">{memberTotals.size}</p>
          </div>
        </div>

        {/* Action */}
        <div className="flex justify-end">
          <RecordContributionButton members={members} />
        </div>

        {/* Contributor P&L table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="font-semibold text-foreground">Contributor P&L</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Each member&apos;s share is proportional to their total contribution
            </p>
          </div>

          {plRows.length === 0 ? (
            <div className="p-12 text-center">
              <Wallet className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="font-medium text-foreground">No contributions recorded yet</p>
              <p className="text-sm text-muted-foreground mt-1">Record the first contribution to see P&L</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30">
                  <tr>
                    <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Member</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Total Contributed</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Share %</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Portfolio Value</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Gain / Loss</th>
                    <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground">Return %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {plRows.map(({ memberId, member, contributed, sharePct, portfolioValue, gain, gainPct }) => (
                    <tr key={memberId} className="hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-3">
                        <p className="font-medium text-foreground">{member?.full_name ?? "Unknown"}</p>
                        <p className="text-xs text-muted-foreground">{member?.member_number ?? ""}</p>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-foreground">
                        {formatCurrency(contributed)}
                      </td>
                      <td className="px-4 py-3 text-right text-foreground">
                        {(sharePct * 100).toFixed(2)}%
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-foreground">
                        {formatCurrency(portfolioValue)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-medium ${gain >= 0 ? "text-gain" : "text-loss"}`}>
                          {gain >= 0 ? "+" : ""}{formatCurrency(gain)}
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
                      <td className="px-4 py-3 text-right font-bold text-foreground">{formatCurrency(totalContributed)}</td>
                      <td className="px-4 py-3 text-right font-bold text-foreground">100%</td>
                      <td className="px-4 py-3 text-right font-bold text-foreground">{formatCurrency(totalPortfolioValue)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-bold ${totalUnrealizedGain >= 0 ? "text-gain" : "text-loss"}`}>
                          {totalUnrealizedGain >= 0 ? "+" : ""}{formatCurrency(totalUnrealizedGain)}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span className={`font-bold ${totalUnrealizedGain >= 0 ? "text-gain" : "text-loss"}`}>
                          {totalContributed > 0 ? formatPercent((totalUnrealizedGain / totalContributed) * 100) : "—"}
                        </span>
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </div>

        {/* Contribution log */}
        {contribs.length > 0 && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="font-semibold text-foreground">Contribution Log</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{contribs.length} record{contribs.length !== 1 ? "s" : ""}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30">
                  <tr>
                    <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Date</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Member</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Amount</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Method</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Reference / Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {contribs.map(c => {
                    const member = memberMap.get(c.member_id);
                    return (
                      <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-5 py-3 text-foreground whitespace-nowrap">
                          {new Date(c.contribution_date).toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "numeric" })}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-foreground">{member?.full_name ?? "—"}</p>
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-foreground">
                          {formatCurrency(Number(c.amount))}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {METHOD_LABELS[c.payment_method] ?? c.payment_method}
                        </td>
                        <td className="px-5 py-3 text-muted-foreground text-xs">
                          {c.bank_reference || c.notes || "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
