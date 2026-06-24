"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { FundNav } from "@/types/database";

interface Props {
  data: Pick<FundNav, "nav_date" | "nav_per_unit" | "total_fund_value">[];
}

export function NavHistoryChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
        No NAV history yet — compute the first NAV above.
      </div>
    );
  }

  // Recharts wants ascending order
  const sorted = [...data].sort(
    (a, b) => new Date(a.nav_date).getTime() - new Date(b.nav_date).getTime(),
  );

  const chartData = sorted.map((r) => ({
    date: new Date(r.nav_date).toLocaleDateString("en-NG", {
      day: "2-digit",
      month: "short",
    }),
    nav: Number(r.nav_per_unit),
    fundValue: Number(r.total_fund_value),
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => `₦${v.toFixed(0)}`}
          domain={["auto", "auto"]}
          width={60}
        />
        <Tooltip
          formatter={(value: number) => [`₦${value.toFixed(4)}`, "NAV/unit"]}
          labelStyle={{ color: "var(--foreground)", fontSize: 12 }}
          contentStyle={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 12,
          }}
        />
        <Line
          type="monotone"
          dataKey="nav"
          stroke="var(--primary)"
          strokeWidth={2}
          dot={data.length <= 30}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
