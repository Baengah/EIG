"use client";

import { Menu } from "lucide-react";
import { useSidebar } from "./SidebarContext";

export function MobileMenuButton() {
  const { openMobile } = useSidebar();
  return (
    <button
      onClick={openMobile}
      className="md:hidden p-2 rounded-lg hover:bg-muted transition-colors"
      aria-label="Open navigation"
    >
      <Menu className="w-5 h-5 text-muted-foreground" />
    </button>
  );
}
