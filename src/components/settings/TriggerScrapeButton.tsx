"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

export function TriggerScrapeButton() {
  const [loading, setLoading] = useState(false);

  async function handleTrigger() {
    setLoading(true);
    try {
      const res = await fetch("/api/scrape/ngx", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Scrape failed");
      toast.success(`NGX prices updated: ${data.updated ?? 0} stocks`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to trigger scrape");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleTrigger}
      disabled={loading}
      className="flex items-center gap-2 px-4 py-2 border border-input rounded-lg text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50 transition-colors"
    >
      <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
      {loading ? "Updating prices..." : "Trigger Manual Scrape"}
    </button>
  );
}
