import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/Header";
import { formatCurrency } from "@/lib/utils";
import { PriceContributionsButton } from "@/components/units/PriceContributionsButton";
import { Users, ArrowUpDown } from "lucide-react";

export const revalidate = 60;

export default async function UnitsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };
  const isAdmin = profile?.role === "admin";

  const [balancesRes, txnsRes, latestNavRes] = await Promise.all([
    supabase.from("v_member_unit_balances").select("*"),
    supabase
      .from("unit_transactions")
      .select(
        "id, txn_date, txn_type, cash_amount, nav_per_unit, units, running_balance, notes, member_id"
      )
      .order("txn_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("fund_nav")
      .select("nav_per_unit, nav_date, units_in_issue")
      .order("nav_date", { ascending: false })
      .limit(1)
      .single(),
  ]);

  const balances = balancesRes.data ?? [];
  const txns = txnsRes.data ?? [];
  const latestNav = latestNavRes.data;

  const totalUnits = balances.reduce((s, b) => s + Number(b.units_held), 0);
  const totalValue = balances.reduce((s, b) => s + Number(b.current_value), 0);
  const totalInvested = balances.reduce((s, b) => s + Number(b.total_invested), 0);

  // Join member names onto transactions
  const memberNames = Object.fromEntries(
    balances.map((b) => [b.member_id, b.full_name]),
  );

  const typeLabel: Record<string, string> = {
    baseline: "Opening",
    issue: "Issue",
    redeem: "Redeem",
  };
  const typeBadge: Record<string, string> = {
    baseline: "bg-blue-100 text-blue-700",
    issue: "bg-emerald-100 text-emerald-700",
    redeem: "bg-rose-100 text-rose-700",
  };

  return (
    <div>
      <Header
        title="Unit Register"
        subtitle="Per-member unit balances, ownership, and transaction history"
      />

      <div className="p-4 sm:p-6 space-y-6">

        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">Total Units in Issue</p>
            <p className="text-2xl font-bold text-foreground">
              {totalUnits.toLocaleString("en-NG", { maximumFractionDigits: 4 })}
            </p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">NAV per Unit</p>
            <p className="text-2xl font-bold text-foreground">
              {latestNav ? `₦${Number(latestNav.nav_per_unit).toFixed(4)}` : "—"}
            </p>
            {latestNav && (
              <p className="text-xs text-muted-foreground mt-1">
                {new Date(latestNav.nav_date).toLocaleDateString("en-NG", {
                  day: "2-digit", month: "short", year: "numeric",
                })}
              </p>
            )}
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">Total Fund Value</p>
            <p className="text-2xl font-bold text-foreground">{formatCurrency(totalValue)}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">Total Invested</p>
            <p className="text-2xl font-bold text-foreground">{formatCurrency(totalInvested)}</p>
          </div>
        </div>

        {/* Admin actions */}
        {isAdmin && (
          <div className="flex items-center gap-3 flex-wrap">
            <p className="text-sm text-muted-foreground flex-1">
              Run &quot;Price Contributions&quot; after computing the NAV to issue units for any contributions not yet priced.
            </p>
            <PriceContributionsButton />
          </div>
        )}

        {/* Per-member unit register */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-foreground">Member Unit Register</h3>
            <span className="text-xs text-muted-foreground ml-auto">{balances.length} members</span>
          </div>
          {balances.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              No unit balances found. Seed the baseline first.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Member</th>
                    <th className="text-right px-3 py-3 text-xs font-medium text-muted-foreground">Units Held</th>
                    <th className="text-right px-3 py-3 text-xs font-medium text-muted-foreground">Ownership %</th>
                    <th className="hidden sm:table-cell text-right px-3 py-3 text-xs font-medium text-muted-foreground">Total Invested</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Current Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {balances.map((b) => (
                    <tr key={b.member_id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">{b.full_name}</p>
                        <p className="text-xs text-muted-foreground">{b.member_number}</p>
                      </td>
                      <td className="px-3 py-3 text-right font-medium text-foreground">
                        {Number(b.units_held).toLocaleString("en-NG", { maximumFractionDigits: 4 })}
                      </td>
                      <td className="px-3 py-3 text-right text-foreground">
                        {Number(b.ownership_pct).toFixed(2)}%
                      </td>
                      <td className="hidden sm:table-cell px-3 py-3 text-right text-foreground">
                        {formatCurrency(b.total_invested)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-foreground">
                        {formatCurrency(b.current_value)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-muted/20 border-t border-border">
                  <tr>
                    <td className="px-4 py-3 font-semibold text-foreground text-xs">Total</td>
                    <td className="px-3 py-3 text-right font-bold text-foreground">
                      {totalUnits.toLocaleString("en-NG", { maximumFractionDigits: 4 })}
                    </td>
                    <td className="px-3 py-3 text-right font-bold text-foreground">100.00%</td>
                    <td className="hidden sm:table-cell px-3 py-3 text-right font-bold text-foreground">
                      {formatCurrency(totalInvested)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-foreground">
                      {formatCurrency(totalValue)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* Unit transaction history */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-foreground">Unit Transaction Ledger</h3>
            <span className="text-xs text-muted-foreground ml-auto">Most recent 50</span>
          </div>
          {txns.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">No transactions yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Date</th>
                    <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground">Member</th>
                    <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground">Type</th>
                    <th className="text-right px-3 py-2.5 text-xs font-medium text-muted-foreground">Cash (₦)</th>
                    <th className="hidden sm:table-cell text-right px-3 py-2.5 text-xs font-medium text-muted-foreground">NAV/unit</th>
                    <th className="text-right px-3 py-2.5 text-xs font-medium text-muted-foreground">Units</th>
                    <th className="hidden md:table-cell text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {txns.map((t) => (
                    <tr key={t.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(t.txn_date).toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "2-digit" })}
                      </td>
                      <td className="px-3 py-3 text-foreground">{memberNames[t.member_id] ?? "—"}</td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${typeBadge[t.txn_type] ?? "bg-muted text-muted-foreground"}`}>
                          {typeLabel[t.txn_type] ?? t.txn_type}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right text-foreground">
                        {formatCurrency(Math.abs(Number(t.cash_amount)))}
                      </td>
                      <td className="hidden sm:table-cell px-3 py-3 text-right text-muted-foreground">
                        ₦{Number(t.nav_per_unit).toFixed(4)}
                      </td>
                      <td className={`px-3 py-3 text-right font-medium ${Number(t.units) >= 0 ? "text-gain" : "text-loss"}`}>
                        {Number(t.units) >= 0 ? "+" : ""}
                        {Number(t.units).toLocaleString("en-NG", { maximumFractionDigits: 4 })}
                      </td>
                      <td className="hidden md:table-cell px-4 py-3 text-right text-foreground">
                        {Number(t.running_balance).toLocaleString("en-NG", { maximumFractionDigits: 4 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
