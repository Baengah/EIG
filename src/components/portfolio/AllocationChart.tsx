"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { formatCurrency } from "@/lib/utils";

const COLORS = [
  "#1d4ed8", // blue
  "#d97706", // amber
  "#059669", // emerald
  "#7c3aed", // violet
  "#dc2626", // red
  "#0891b2", // cyan
  "#be185d", // pink
  "#65a30d", // lime
  "#ea580c", // orange
  "#6366f1", // indigo
  "#0f766e", // teal
  "#9333ea", // purple
];

interface AllocationChartProps {
  data: { name: string; value: number; type: string }[];
}

export function AllocationChart({ data }: AllocationChartProps) {
  const filtered = data.filter((d) => d.value > 0).sort((a, b) => b.value - a.value);
  const total = filtered.reduce((sum, d) => sum + d.value, 0);

  if (filtered.length === 0) {
    return (
      <div className="h-36 flex items-center justify-center text-sm text-muted-foreground">
        No holdings data
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Donut with center label */}
      <div className="relative h-[200px]">
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={filtered}
              cx="50%"
              cy="50%"
              innerRadius={68}
              outerRadius={92}
              paddingAngle={2}
              dataKey="value"
              startAngle={90}
              endAngle={-270}
            >
              {filtered.map((_, index) => (
                <Cell key={index} fill={COLORS[index % COLORS.length]} strokeWidth={0} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload;
                const pct = total > 0 ? ((d.value / total) * 100).toFixed(1) : "0";
                return (
                  <div className="bg-card border border-border rounded-lg p-2.5 shadow-lg text-xs">
                    <p className="font-semibold text-foreground mb-1">{d.name}</p>
                    <p className="text-foreground">{formatCurrency(d.value)}</p>
                    <p className="text-muted-foreground">{pct}% of portfolio</p>
                  </div>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Total</p>
          <p className="text-sm font-bold text-foreground leading-tight">{formatCurrency(total)}</p>
        </div>
      </div>

      {/* Legend */}
      <div className="space-y-1.5">
        {filtered.map((d, index) => {
          const pct = total > 0 ? ((d.value / total) * 100).toFixed(1) : "0";
          return (
            <div key={d.name} className="flex items-center gap-2 text-xs">
              <div
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: COLORS[index % COLORS.length] }}
              />
              <span className="text-foreground flex-1 truncate">{d.name}</span>
              <span className="text-muted-foreground tabular-nums">{pct}%</span>
              <span className="text-foreground font-medium tabular-nums w-24 text-right">
                {formatCurrency(d.value)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
