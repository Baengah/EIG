"use client";

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { formatCurrency } from "@/lib/utils";

interface Snapshot {
  snapshot_date: string;
  total_value: number;
  gain_loss_percent: number | null;
}

interface PortfolioChartProps {
  snapshots: Snapshot[];
}

export function PortfolioChart({ snapshots }: PortfolioChartProps) {
  if (snapshots.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
        No historical data available yet
      </div>
    );
  }

  const data = [...snapshots]
    .reverse()
    .map((s) => ({
      date: new Date(s.snapshot_date).toLocaleDateString("en-NG", { day: "2-digit", month: "short" }),
      value: s.total_value,
      pct: s.gain_loss_percent ?? 0,
    }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="portfolioGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(224,71%,28%)" stopOpacity={0.15} />
            <stop offset="95%" stopColor="hsl(224,71%,28%)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          className="text-muted-foreground"
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `₦${(v / 1_000_000).toFixed(1)}M`}
          className="text-muted-foreground"
          width={60}
        />
        <Tooltip
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload;
            return (
              <div className="bg-card border border-border rounded-lg p-3 shadow-lg text-sm">
                <p className="font-medium text-foreground mb-1">{label}</p>
                <p className="text-muted-foreground">
                  Value: <span className="text-foreground font-medium">{formatCurrency(d.value)}</span>
                </p>
                <p className="text-muted-foreground">
                  Return: <span className={`font-medium ${d.pct >= 0 ? "text-gain" : "text-loss"}`}>
                    {d.pct >= 0 ? "+" : ""}{d.pct.toFixed(2)}%
                  </span>
                </p>
              </div>
            );
          }}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke="hsl(224,71%,28%)"
          strokeWidth={2}
          fill="url(#portfolioGradient)"
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
