"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { formatCurrency } from "@/lib/utils";

const COLORS = [
  "#1e3a8a", "#1d4ed8", "#3b82f6", "#60a5fa", "#93c5fd",
  "#7c3aed", "#a855f7", "#c084fc", "#f59e0b", "#fbbf24",
];

interface AllocationChartProps {
  data: { name: string; value: number; type: string }[];
}

export function AllocationChart({ data }: AllocationChartProps) {
  const filtered = data.filter((d) => d.value > 0);

  if (filtered.length === 0) {
    return (
      <div className="h-36 flex items-center justify-center text-sm text-muted-foreground">
        No holdings data
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={150}>
      <PieChart>
        <Pie
          data={filtered}
          cx="50%"
          cy="50%"
          innerRadius={40}
          outerRadius={65}
          paddingAngle={2}
          dataKey="value"
        >
          {filtered.map((_, index) => (
            <Cell key={index} fill={COLORS[index % COLORS.length]} strokeWidth={0} />
          ))}
        </Pie>
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload;
            return (
              <div className="bg-card border border-border rounded-lg p-2.5 shadow text-xs">
                <p className="font-medium text-foreground">{d.name}</p>
                <p className="text-muted-foreground">{formatCurrency(d.value)}</p>
              </div>
            );
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
