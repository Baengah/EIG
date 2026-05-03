import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/Header";
import { Users, UserCheck, UserX, Mail, Phone, Info, ShieldCheck } from "lucide-react";

export const revalidate = 60;

export default async function MembersPage() {
  const supabase = await createClient();

  const [membersRes, profilesRes] = await Promise.all([
    supabase.from("members").select("*").order("full_name"),
    supabase.from("profiles").select("*").order("full_name"),
  ]);

  const members = membersRes.data ?? [];
  const profiles = profilesRes.data ?? [];

  // Build a profile lookup by id
  const profileById = new Map(profiles.map((p) => [p.id, p]));

  // Track which profiles are already linked to a member row
  const linkedProfileIds = new Set(
    members.filter((m) => m.profile_id).map((m) => m.profile_id!)
  );

  // Unified entries: all members + any profile not yet linked to a member
  type Entry = {
    key: string;
    full_name: string;
    email: string;
    phone: string | null;
    member_number: string | null;
    join_date: string | null;
    is_active: boolean;
    bank_name: string | null;
    bank_account_number: string | null;
    role: string;
    hasAccount: boolean;
  };

  const memberEntries: Entry[] = members.map((m) => {
    const profile = m.profile_id ? profileById.get(m.profile_id) : undefined;
    return {
      key: m.id,
      full_name: m.full_name,
      email: m.email,
      phone: m.phone,
      member_number: m.member_number,
      join_date: m.join_date,
      is_active: m.is_active,
      bank_name: m.bank_name,
      bank_account_number: m.bank_account_number,
      role: profile?.role ?? "member",
      hasAccount: !!(m.profile_id && profileById.has(m.profile_id)),
    };
  });

  const unlinkedProfileEntries: Entry[] = profiles
    .filter((p) => !linkedProfileIds.has(p.id))
    .map((p) => ({
      key: p.id,
      full_name: p.full_name,
      email: p.email,
      phone: p.phone,
      member_number: null,
      join_date: p.created_at,
      is_active: true,
      bank_name: null,
      bank_account_number: null,
      role: p.role,
      hasAccount: true,
    }));

  const all: Entry[] = [...memberEntries, ...unlinkedProfileEntries].sort((a, b) =>
    a.full_name.localeCompare(b.full_name)
  );

  const activeCount = all.filter((e) => e.is_active).length;
  const inactiveCount = all.filter((e) => !e.is_active).length;

  return (
    <div>
      <Header title="Members" subtitle="EIG group member directory" />
      <div className="p-6 space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">Total Members</p>
            <p className="text-2xl font-bold text-foreground">{all.length}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">Active</p>
            <p className="text-2xl font-bold text-gain">{activeCount}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">Inactive</p>
            <p className="text-2xl font-bold text-muted-foreground">{inactiveCount}</p>
          </div>
        </div>

        {/* Info banner */}
        <div className="flex items-start gap-3 bg-muted/40 border border-border rounded-xl px-4 py-3 text-sm text-muted-foreground">
          <Info className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            This list combines the <strong className="text-foreground">members</strong> table and all
            <strong className="text-foreground"> auth users</strong> in Supabase. It updates automatically — no manual entry needed here.
          </span>
        </div>

        {/* Member grid */}
        {all.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-12 text-center">
            <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium text-foreground">No members yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Add members in Supabase or invite users — they will appear here automatically
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {all.map((entry) => (
              <div key={entry.key} className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                      <span className="text-primary font-semibold text-sm">
                        {entry.full_name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                      </span>
                    </div>
                    <div>
                      <p className="font-semibold text-foreground leading-tight">{entry.full_name}</p>
                      {entry.member_number && (
                        <p className="text-xs text-muted-foreground">{entry.member_number}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                      entry.is_active
                        ? "text-emerald-700 bg-emerald-50"
                        : "text-muted-foreground bg-muted"
                    }`}>
                      {entry.is_active
                        ? <UserCheck className="w-3 h-3" />
                        : <UserX className="w-3 h-3" />}
                      {entry.is_active ? "Active" : "Inactive"}
                    </span>
                    {entry.role === "admin" && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-primary bg-primary/10">
                        <ShieldCheck className="w-3 h-3" /> Admin
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5 text-sm">
                  {entry.email && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{entry.email}</span>
                    </div>
                  )}
                  {entry.phone && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="w-3.5 h-3.5 shrink-0" />
                      <span>{entry.phone}</span>
                    </div>
                  )}
                </div>

                <div className="mt-3 pt-3 border-t border-border space-y-1.5">
                  {entry.join_date && (
                    <p className="text-xs text-muted-foreground">
                      Member since {new Date(entry.join_date).toLocaleDateString("en-NG", {
                        month: "long", year: "numeric",
                      })}
                    </p>
                  )}
                  {entry.bank_name && (
                    <div className="p-2 bg-muted/40 rounded-lg text-xs">
                      <span className="text-muted-foreground">{entry.bank_name}</span>
                      <span className="mx-1 text-muted-foreground">·</span>
                      <span className="font-mono text-foreground">
                        ****{entry.bank_account_number?.slice(-4)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
