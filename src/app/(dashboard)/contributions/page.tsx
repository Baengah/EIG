import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/Header";
import { formatCurrency, getMonthName } from "@/lib/utils";
import { CheckCircle2, Clock, AlertCircle, MinusCircle, ArrowUpRight } from "lucide-react";
import { AddPeriodButton } from "@/components/contributions/AddPeriodButton";
import { RecordPaymentButton } from "@/components/contributions/RecordPaymentButton";

const STATUS_CONFIG = {
  paid: { label: "Paid", icon: CheckCircle2, color: "text-emerald-600 bg-emerald-50" },
  pending: { label: "Pending", icon: Clock, color: "text-amber-600 bg-amber-50" },
  overdue: { label: "Overdue", icon: AlertCircle, color: "text-rose-600 bg-rose-50" },
  partial: { label: "Partial", icon: ArrowUpRight, color: "text-blue-600 bg-blue-50" },
  waived: { label: "Waived", icon: MinusCircle, color: "text-muted-foreground bg-muted" },
};

export const revalidate = 60;

export default async function ContributionsPage() {
  const supabase = await createClient();

  const [periodsRes, statusRes] = await Promise.all([
    supabase
      .from("contribution_periods")
      .select("*")
      .order("year", { ascending: false })
      .order("month", { ascending: false }),
    supabase
      .from("v_contribution_status")
      .select("*")
      .order("year", { ascending: false })
      .order("month", { ascending: false })
      .order("full_name"),
  ]);

  const periods = periodsRes.data ?? [];
  const statusRows = statusRes.data ?? [];

  // Group by period
  const periodMap = new Map<string, typeof statusRows>();
  for (const row of statusRows) {
    const key = `${row.year}-${row.month}`;
    if (!periodMap.has(key)) periodMap.set(key, []);
    periodMap.get(key)!.push(row);
  }

  // Summary stats
  const totalExpected = statusRows
    .filter((r) => r.status !== "waived")
    .reduce((acc, r) => acc + (r.amount_per_member ?? 0), 0);
  const totalCollected = statusRows.reduce((acc, r) => acc + (r.paid_amount ?? 0), 0);

  return (
    <div>
      <Header
        title="Contributions"
        subtitle="Monthly member contribution tracking"
      />
      <div className="p-6 space-y-6">

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Expected", value: formatCurrency(totalExpected), color: "text-foreground" },
            { label: "Total Collected", value: formatCurrency(totalCollected), color: "text-gain" },
            { label: "Outstanding", value: formatCurrency(totalExpected - totalCollected), color: "text-loss" },
            {
              label: "Collection Rate",
              value: totalExpected > 0 ? `${((totalCollected / totalExpected) * 100).toFixed(1)}%` : "0%",
              color: totalCollected >= totalExpected ? "text-gain" : "text-amber-600",
            },
          ].map((s) => (
            <div key={s.label} className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex justify-end">
          <AddPeriodButton />
        </div>

        {/* Periods with members */}
        {periods.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-12 text-center">
            <Clock className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-foreground font-medium">No contribution periods yet</p>
            <p className="text-sm text-muted-foreground mt-1">Create a new period to start tracking contributions</p>
          </div>
        ) : (
          periods.map((period) => {
            const key = `${period.year}-${period.month}`;
            const rows = periodMap.get(key) ?? [];
            const paid = rows.filter((r) => r.status === "paid").length;
            const total = rows.length;

            return (
              <div key={period.id} className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-foreground">
                      {getMonthName(period.month)} {period.year}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {formatCurrency(period.amount_per_member)} per member · Due{" "}
                      {new Date(period.due_date).toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "numeric" })}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-foreground">{paid}/{total} paid</div>
                    <div className="text-xs text-muted-foreground">
                      {formatCurrency(rows.reduce((a, r) => a + (r.paid_amount ?? 0), 0))} collected
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40">
                      <tr>
                        <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Member</th>
                        <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Due</th>
                        <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Paid</th>
                        <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Outstanding</th>
                        <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
                        <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground">Date</th>
                        <th className="px-5 py-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {rows.map((row) => {
                        const cfg = STATUS_CONFIG[row.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pending;
                        const StatusIcon = cfg.icon;
                        return (
                          <tr key={`${row.member_id}-${period.id}`} className="hover:bg-muted/30 transition-colors">
                            <td className="px-5 py-3">
                              <p className="font-medium text-foreground">{row.full_name}</p>
                              <p className="text-xs text-muted-foreground">{row.member_number}</p>
                            </td>
                            <td className="px-4 py-3 text-right text-foreground">
                              {formatCurrency(row.amount_per_member)}
                            </td>
                            <td className="px-4 py-3 text-right text-gain font-medium">
                              {row.paid_amount > 0 ? formatCurrency(row.paid_amount) : "—"}
                            </td>
                            <td className="px-4 py-3 text-right text-loss font-medium">
                              {row.outstanding_amount > 0 ? formatCurrency(row.outstanding_amount) : "—"}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
                                <StatusIcon className="w-3 h-3" />
                                {cfg.label}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center text-xs text-muted-foreground">
                              {row.payment_date
                                ? new Date(row.payment_date).toLocaleDateString("en-NG", { day: "2-digit", month: "short" })
                                : "—"}
                            </td>
                            <td className="px-5 py-3 text-center">
                              {row.status !== "paid" && row.status !== "waived" && (
                                <RecordPaymentButton
                                  contributionId={row.contribution_id}
                                  memberId={row.member_id}
                                  periodId={period.id}
                                  memberName={row.full_name}
                                  amountDue={row.amount_per_member}
                                />
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
