"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Zap, Loader2 } from "lucide-react";

export function PriceContributionsButton() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handlePrice() {
    setLoading(true);
    try {
      const res = await fetch("/api/units/price-contributions", { method: "POST" });
      const data = await res.json() as { count?: number; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Pricing failed");

      const n = data.count ?? 0;
      if (n === 0) {
        toast.info("No unpriced contributions found");
      } else {
        toast.success(`${n} contribution${n !== 1 ? "s" : ""} priced and units issued`);
      }
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to price contributions");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handlePrice}
      disabled={loading}
      className="flex items-center gap-2 px-4 py-2 border border-input rounded-lg text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50 transition-colors"
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Zap className="w-4 h-4" />
      )}
      {loading ? "Pricing…" : "Price Contributions"}
    </button>
  );
}
