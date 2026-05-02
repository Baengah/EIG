import { createClient } from "@/lib/supabase/server";
import { Bell, User } from "lucide-react";

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export async function Header({ title, subtitle }: HeaderProps) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let profile = null;
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("full_name, role")
      .eq("id", user.id)
      .single();
    profile = data;
  }

  return (
    <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6 shrink-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">{title}</h1>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3">
        <button className="relative p-2 rounded-lg hover:bg-muted transition-colors">
          <Bell className="w-4 h-4 text-muted-foreground" />
        </button>
        <div className="flex items-center gap-2 pl-3 border-l border-border">
          <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
            <User className="w-4 h-4 text-primary-foreground" />
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-foreground leading-tight">
              {profile?.full_name ?? user?.email?.split("@")[0]}
            </p>
            <p className="text-xs text-muted-foreground capitalize leading-tight">
              {profile?.role ?? "member"}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
