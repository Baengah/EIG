"use client";

import { useState, useMemo } from "react";
import { formatCurrency } from "@/lib/utils";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";

export type ContributionRow = {
  id: string;
  date: string;
  memberName: string;
  memberNumber: string;
  amount: number;
  via: string | null;
  notes: string | null;
};

type SortKey = "date" | "memberName" | "amount";
type SortDir = "asc" | "desc";

function SortIcon({ col, active, dir }: { col: string; active: boolean; dir: SortDir }) {
  if (!active) return <ChevronsUpDown className="w-3 h-3 text-muted-foreground/50 inline-block ml-1" />;
  return dir === "asc"
    ? <ChevronUp className="w-3 h-3 inline-block ml-1" />
    : <ChevronDown className="w-3 h-3 inline-block ml-1" />;
}

export function ContributionsTable({ rows }: { rows: ContributionRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "date") cmp = a.date.localeCompare(b.date);
      else if (sortKey === "memberName") cmp = a.memberName.localeCompare(b.memberName);
      else if (sortKey === "amount") cmp = a.amount - b.amount;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [rows, sortKey, sortDir]);

  const total = rows.reduce((s, r) => s + r.amount, 0);

  function thClass(key: SortKey) {
    return `cursor-pointer select-none hover:text-foreground transition-colors ${sortKey === key ? "text-foreground" : "text-muted-foreground"}`;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/30">
          <tr>
            <th
              className={`text-left px-4 py-3 text-xs font-medium whitespace-nowrap ${thClass("date")}`}
              onClick={() => handleSort("date")}
            >
              Date <SortIcon col="date" active={sortKey === "date"} dir={sortDir} />
            </th>
            <th
              className={`text-left px-3 py-3 text-xs font-medium ${thClass("memberName")}`}
              onClick={() => handleSort("memberName")}
            >
              Contributor <SortIcon col="memberName" active={sortKey === "memberName"} dir={sortDir} />
            </th>
            <th
              className={`text-right px-3 py-3 text-xs font-medium ${thClass("amount")}`}
              onClick={() => handleSort("amount")}
            >
              Amount <SortIcon col="amount" active={sortKey === "amount"} dir={sortDir} />
            </th>
            <th className="hidden sm:table-cell text-left px-3 py-3 text-xs font-medium text-muted-foreground">Via</th>
            <th className="hidden md:table-cell text-left px-4 py-3 text-xs font-medium text-muted-foreground">Notes</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {sorted.map(r => (
            <tr key={r.id} className="hover:bg-muted/20 transition-colors">
              <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                {new Date(r.date).toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "numeric" })}
              </td>
              <td className="px-3 py-2.5">
                <p className="font-medium text-foreground text-sm">{r.memberName}</p>
                {r.memberNumber && <p className="text-xs text-muted-foreground">{r.memberNumber}</p>}
              </td>
              <td className="px-3 py-2.5 text-right font-mono text-sm font-medium text-foreground tabular-nums">
                {formatCurrency(r.amount)}
              </td>
              <td className="hidden sm:table-cell px-3 py-2.5 text-xs text-muted-foreground max-w-[180px] truncate">
                {r.via ?? "—"}
              </td>
              <td className="hidden md:table-cell px-4 py-2.5 text-xs text-muted-foreground max-w-[240px] truncate">
                {r.notes ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t-2 border-border bg-muted/30">
          <tr>
            <td colSpan={2} className="px-4 py-3 text-xs font-semibold text-muted-foreground">
              Total ({rows.length} payment{rows.length !== 1 ? "s" : ""})
            </td>
            <td className="px-3 py-3 text-right font-bold text-foreground text-sm tabular-nums font-mono">
              {formatCurrency(total)}
            </td>
            <td className="hidden sm:table-cell" />
            <td className="hidden md:table-cell" />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
