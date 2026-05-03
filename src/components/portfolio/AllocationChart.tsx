"use client";

import { useState } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { formatCurrency } from "@/lib/utils";
import { X, Maximize2 } from "lucide-react";

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

export interface AllocationSegment {
  name: string;
  value: number;
  type: string;
  holdings?: { name: string; subName?: string; value: number }[];
}

interface AllocationChartProps {
  data: AllocationSegment[];
}

export function AllocationChart({ data }: AllocationChartProps) {
  const [showModal, setShowModal] = useState(false);
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
    <>
      {/* Chart — click to open modal */}
      <div
        className="space-y-4 cursor-pointer group"
        onClick={() => setShowModal(true)}
        title="Click to see full breakdown"
      >
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
                  const d = payload[0].payload as AllocationSegment;
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
          {/* Center label */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Total</p>
            <p className="text-sm font-bold text-foreground leading-tight">{formatCurrency(total)}</p>
          </div>
          {/* Expand hint */}
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <Maximize2 className="w-3.5 h-3.5 text-muted-foreground" />
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

      {/* Breakdown modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-card border border-border rounded-xl w-full max-w-lg shadow-xl max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <h2 className="font-semibold text-foreground">Allocation Breakdown</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Portfolio value: {formatCurrency(total)}</p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto p-6 space-y-5">
              {filtered.map((d, index) => {
                const pct = total > 0 ? ((d.value / total) * 100).toFixed(1) : "0";
                return (
                  <div key={d.name}>
                    {/* Segment header */}
                    <div className="flex items-center gap-2.5 mb-2">
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="font-semibold text-foreground flex-1">{d.name}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">{pct}%</span>
                      <span className="text-sm font-bold text-foreground tabular-nums">
                        {formatCurrency(d.value)}
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div className="h-1.5 bg-muted rounded-full mb-3 ml-5">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: COLORS[index % COLORS.length],
                        }}
                      />
                    </div>

                    {/* Constituent holdings */}
                    {d.holdings && d.holdings.length > 0 && (
                      <div className="ml-5 space-y-1.5">
                        {d.holdings.map((h) => {
                          const hPct = d.value > 0 ? ((h.value / d.value) * 100).toFixed(1) : "0";
                          return (
                            <div key={h.name} className="flex items-center gap-2 text-xs">
                              <span className="font-medium text-foreground w-16 shrink-0">{h.name}</span>
                              {h.subName && (
                                <span className="text-muted-foreground flex-1 truncate">{h.subName}</span>
                              )}
                              <span className="text-muted-foreground tabular-nums ml-auto">{hPct}%</span>
                              <span className="text-foreground tabular-nums w-24 text-right">
                                {formatCurrency(h.value)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
