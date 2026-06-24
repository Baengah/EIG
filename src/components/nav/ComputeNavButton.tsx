"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw, Loader2 } from "lucide-react";

export function ComputeNavButton() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleCompute() {
    setLoading(true);
    try {
      const res = await fetch("/api/nav/compute", { method: "POST" });
      const data = await res.json() as {
        nav?: { nav_per_unit: number; nav_date: string };
        priced_count?: number;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "NAV compute failed");

      const nav = data.nav;
      const priced = data.priced_count ?? 0;
      toast.success(
        `NAV computed: ₦${Number(nav?.nav_per_unit ?? 0).toFixed(4)}/unit` +
          (priced > 0 ? ` · ${priced} contribution${priced !== 1 ? "s" : ""} priced` : ""),
      );
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to compute NAV");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleCompute}
      disabled={loading}
      className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <RefreshCw className="w-4 h-4" />
      )}
      {loading ? "Computing…" : "Compute NAV"}
    </button>
  );
}
