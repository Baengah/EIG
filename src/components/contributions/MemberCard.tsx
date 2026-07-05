"use client";

import { useState } from "react";
import { ChevronDown, Mail, Phone, Landmark } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface MemberContrib {
  id: string;
  date: string;
  amount: number;
  via: string | null;
  notes: string | null;
}

interface MonthlyReturnEntry {
  ym: string;
  label: string;
  returnPct: number;
  nairaReturn: number;
  isPartial: boolean;
}

export interface MemberCardProps {
  member: {
    full_name: string;
    member_number?: string | null;
    email?: string | null;
    phone?: string | null;
    bank_name?: string | null;
    bank_account_number?: string | null;
    join_date?: string | null;
  };
  totalContributed: number;
  unitsHeld: number;
  ownershipPct: number;
  currentMemberValue: number;
  inceptionReturnPct: number | null;
  inceptionNaira: number | null;
  mtdNaira: number | null;
  mtdPct: number | null;
  monthlyReturns: MonthlyReturnEntry[];
  memberContribs: MemberContrib[];
}

export function MemberCard({
  member, totalContributed, unitsHeld, ownershipPct, currentMemberValue,
  inceptionReturnPct, inceptionNaira, mtdNaira, mtdPct,
  monthlyReturns, memberContribs,
}: MemberCardProps) {
  const [expanded, setExpanded] = useState(false);

  const initials = (member.full_name ?? "?")
    .split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase();
  const inceptionPos = inceptionReturnPct !== null && inceptionReturnPct >= 0;
  const mtdPos       = mtdNaira !== null && mtdNaira >= 0;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* ── Main card body ───────────────────────────────────── */}
      <div className="p-5">

        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
              <span className="text-primary font-semibold text-sm">{initials}</span>
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-foreground leading-tight truncate">{member.full_name}</p>
              {member.member_number && (
                <p className="text-xs text-muted-foreground">{member.member_number}</p>
              )}
            </div>
          </div>
          {ownershipPct > 0 && (
            <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full shrink-0 ml-2">
              {ownershipPct.toFixed(1)}% owner
            </span>
          )}
        </div>

        {/* Contact */}
        <div className="space-y-1 mb-4">
          {member.email && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Mail className="w-3 h-3 shrink-0" />
              <span className="truncate">{member.email}</span>
            </div>
          )}
          {member.phone && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Phone className="w-3 h-3 shrink-0" />
              <span>{member.phone}</span>
            </div>
          )}
          {member.bank_name && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Landmark className="w-3 h-3 shrink-0" />
              <span>{member.bank_name} · ****{member.bank_account_number?.slice(-4)}</span>
            </div>
          )}
        </div>

        {/* Summary metrics 2×2 */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-muted/30 rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-0.5">Contributed</p>
            <p className="text-sm font-bold text-foreground">{formatCurrency(totalContributed)}</p>
          </div>
          <div className="bg-muted/30 rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-0.5">Current Value</p>
            <p className="text-sm font-bold text-foreground">
              {currentMemberValue > 0 ? formatCurrency(currentMemberValue) : "—"}
            </p>
          </div>
          <div className="bg-muted/30 rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-0.5">Units Held</p>
            <p className="text-sm font-bold text-foreground">
              {unitsHeld > 0
                ? unitsHeld.toLocaleString("en-NG", { maximumFractionDigits: 2 })
                : "—"}
            </p>
          </div>
          <div className={`rounded-lg p-3 ${inceptionPos ? "bg-gain/5" : "bg-loss/5"}`}>
            <p className="text-xs text-muted-foreground mb-0.5">Since Inception</p>
            {inceptionReturnPct !== null ? (
              <>
                <p className={`text-sm font-bold ${inceptionPos ? "text-gain" : "text-loss"}`}>
                  {inceptionPos ? "+" : ""}{inceptionReturnPct.toFixed(2)}%
                </p>
                {inceptionNaira !== null && (
                  <p className={`text-xs ${inceptionPos ? "text-gain" : "text-loss"}`}>
                    {inceptionPos ? "+" : ""}{formatCurrency(inceptionNaira)}
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">—</p>
            )}
          </div>
        </div>

        {/* Period returns */}
        {(monthlyReturns.length > 0 || mtdNaira !== null) && (
          <div className="border-t border-border pt-3">
            <p className="text-xs text-muted-foreground mb-2">Period Returns</p>

            {mtdNaira !== null && (
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-muted-foreground">Month to Date</span>
                <div className="flex items-center gap-2">
                  <span className={`font-medium ${mtdPos ? "text-gain" : "text-loss"}`}>
                    {mtdPos ? "+" : ""}{formatCurrency(mtdNaira)}
                  </span>
                  {mtdPct !== null && (
                    <span className={`font-bold ${mtdPos ? "text-gain" : "text-loss"}`}>
                      ({mtdPos ? "+" : ""}{mtdPct.toFixed(2)}%)
                    </span>
                  )}
                </div>
              </div>
            )}

            {[...monthlyReturns].reverse().map(r => {
              const pos = r.nairaReturn >= 0;
              return (
                <div key={r.ym} className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted-foreground">
                    {r.label}{r.isPartial ? " *" : ""}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className={`font-medium ${pos ? "text-gain" : "text-loss"}`}>
                      {pos ? "+" : ""}{formatCurrency(r.nairaReturn)}
                    </span>
                    <span className={`font-bold ${pos ? "text-gain" : "text-loss"}`}>
                      ({r.returnPct >= 0 ? "+" : ""}{r.returnPct.toFixed(2)}%)
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Join date */}
        {member.join_date && (
          <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border">
            Member since {new Date(member.join_date).toLocaleDateString("en-NG", {
              month: "long", year: "numeric",
            })}
          </p>
        )}

        {/* Expand toggle */}
        {memberContribs.length > 0 && (
          <button
            onClick={() => setExpanded(e => !e)}
            className="mt-3 w-full flex items-center justify-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors py-1.5 rounded-lg hover:bg-primary/5"
          >
            {expanded ? "Hide" : "Show"} contribution history ({memberContribs.length})
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
            />
          </button>
        )}
      </div>

      {/* ── Expanded: contribution history ───────────────────── */}
      {expanded && (
        <div className="border-t border-border bg-muted/5">
          <div className="px-5 py-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Contribution History
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left pb-2 text-muted-foreground font-medium">Date</th>
                    <th className="text-right pb-2 text-muted-foreground font-medium">Amount</th>
                    <th className="hidden sm:table-cell text-left pb-2 pl-3 text-muted-foreground font-medium">
                      Reference / Notes
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {memberContribs.map(c => (
                    <tr key={c.id}>
                      <td className="py-2 text-muted-foreground">
                        {new Date(c.date).toLocaleDateString("en-NG", {
                          day: "2-digit", month: "short", year: "2-digit",
                        })}
                      </td>
                      <td className="py-2 text-right font-medium text-foreground">
                        {formatCurrency(c.amount)}
                      </td>
                      <td className="hidden sm:table-cell py-2 pl-3 text-muted-foreground truncate max-w-[140px]">
                        {c.via ?? c.notes ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-border">
                  <tr>
                    <td className="pt-2 text-xs font-semibold text-muted-foreground">Total</td>
                    <td className="pt-2 text-right font-bold text-foreground">
                      {formatCurrency(memberContribs.reduce((s, c) => s + c.amount, 0))}
                    </td>
                    <td className="hidden sm:table-cell" />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
