"use client";
import { useRouter, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface Tab { id: string; label: string }

export function TabBar({ tabs, activeTab }: { tabs: Tab[]; activeTab: string }) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <div className="flex gap-1 bg-muted/40 rounded-xl p-1 w-fit border border-border">
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => router.push(`${pathname}?tab=${tab.id}`)}
          className={cn(
            "px-4 py-2 rounded-lg text-sm font-medium transition-all",
            tab.id === activeTab
              ? "bg-card text-foreground shadow-sm border border-border"
              : "text-muted-foreground hover:text-foreground hover:bg-card/50"
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
