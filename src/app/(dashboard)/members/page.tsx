import { createClient, createServiceClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/Header";
import { Users, UserCheck, UserX, Mail, Phone, ShieldCheck, Clock } from "lucide-react";
import type { User } from "@supabase/supabase-js";

export const revalidate = 60;

function normalizeName(s: string) {
  return s.toLowerCase().replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim();
}

// Match names where last name is identical and one first name is a suffix/prefix of the other.
// Handles "Tobi Amida" ↔ "Oluwatobi Paul Amida" (tobi ∈ oluwatobi).
function fuzzyNameMatch(
  authUsers: User[],
  memberName: string,
  excludeIds: Set<string>
): User | undefined {
  const mParts = normalizeName(memberName).split(" ").filter(Boolean);
  if (mParts.length < 2) return undefined;
  const mFirst = mParts[0];
  const mLast = mParts[mParts.length - 1];
  return authUsers.find(u => {
    if (excludeIds.has(u.id)) return false;
    const raw = u.user_metadata?.full_name as string | undefined;
    if (!raw) return false;
    const uParts = normalizeName(raw).split(" ").filter(Boolean);
    if (uParts.length < 2) return false;
    const uFirst = uParts[0];
    const uLast = uParts[uParts.length - 1];
    return uLast === mLast && (uFirst.includes(mFirst) || mFirst.includes(uFirst));
  });
}

export default async function MembersPage() {
  const [supabase, serviceClient] = await Promise.all([
    createClient(),
    createServiceClient(),
  ]);

  const [{ data: authData }, membersRes, profilesRes] = await Promise.all([
    serviceClient.auth.admin.listUsers({ perPage: 1000 }),
    supabase.from("members").select("*").order("full_name"),
    supabase.from("profiles").select("id, role"),
  ]);

  const authUsers = authData?.users ?? [];
  const members = membersRes.data ?? [];
  const profiles = profilesRes.data ?? [];

  const roleById = new Map(profiles.map((p) => [p.id, p.role]));

  // Auth user lookup maps: by id, by email, by normalised name
  const authById = new Map(authUsers.map((u) => [u.id, u]));
  const authByEmail = new Map(
    authUsers.filter((u) => u.email).map((u) => [u.email!.toLowerCase(), u])
  );
  const authByName = new Map(
    authUsers
      .filter((u) => u.user_metadata?.full_name)
      .map((u) => [normalizeName(u.user_metadata.full_name as string), u])
  );

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
    invitePending: boolean;
  };

  // Match each member to an auth user: profile_id → email → normalised name
  const matchedAuthIds = new Set<string>();

  const memberEntries: Entry[] = members.map((m) => {
    const authUser =
      (m.profile_id ? authById.get(m.profile_id) : undefined) ??
      authByEmail.get(m.email.toLowerCase()) ??
      authByName.get(normalizeName(m.full_name)) ??
      fuzzyNameMatch(authUsers, m.full_name, matchedAuthIds);

    if (authUser) matchedAuthIds.add(authUser.id);

    const invitePending = authUser
      ? !authUser.confirmed_at || !authUser.last_sign_in_at
      : false;

    return {
      key: m.id,
      // Prefer the real display name from auth if available
      full_name: (authUser?.user_metadata?.full_name as string | undefined)?.trim() || m.full_name,
      email: authUser?.email || m.email,
      phone: (authUser?.user_metadata?.phone as string | undefined) ?? m.phone,
      member_number: m.member_number,
      join_date: m.join_date,
      is_active: m.is_active,
      bank_name: m.bank_name,
      bank_account_number: m.bank_account_number,
      role: authUser ? (roleById.get(authUser.id) ?? "member") : "member",
      invitePending,
    };
  });

  // Auth users with no matching member row
  const unlinkedAuthEntries: Entry[] = authUsers
    .filter((u) => !matchedAuthIds.has(u.id))
    .map((u) => {
      const displayName =
        (u.user_metadata?.full_name as string | undefined)?.trim() ||
        u.email?.split("@")[0] ||
        "Unknown";
      const invitePending = !u.confirmed_at || !u.last_sign_in_at;
      return {
        key: u.id,
        full_name: displayName,
        email: u.email ?? "",
        phone: (u.user_metadata?.phone as string | undefined) ?? null,
        member_number: null,
        join_date: u.created_at,
        is_active: true,
        bank_name: null,
        bank_account_number: null,
        role: roleById.get(u.id) ?? "member",
        invitePending,
      };
    });

  const all: Entry[] = [...memberEntries, ...unlinkedAuthEntries].sort((a, b) =>
    a.full_name.localeCompare(b.full_name)
  );

  const activeCount = all.filter((e) => e.is_active && !e.invitePending).length;
  const pendingCount = all.filter((e) => e.invitePending).length;
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
            <p className="text-xs text-muted-foreground mb-1">Pending invite</p>
            <p className="text-2xl font-bold text-amber-500">{pendingCount + inactiveCount}</p>
          </div>
        </div>

        {/* Member grid */}
        {all.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-12 text-center">
            <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium text-foreground">No members yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {all.map((entry) => (
              <div key={entry.key} className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                      <span className="text-primary font-semibold text-sm">
                        {entry.full_name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground leading-tight truncate">{entry.full_name}</p>
                      {entry.member_number && (
                        <p className="text-xs text-muted-foreground">{entry.member_number}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1 shrink-0 ml-2">
                    {entry.invitePending ? (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-amber-700 bg-amber-50">
                        <Clock className="w-3 h-3" /> Pending
                      </span>
                    ) : (
                      <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        entry.is_active ? "text-emerald-700 bg-emerald-50" : "text-muted-foreground bg-muted"
                      }`}>
                        {entry.is_active ? <UserCheck className="w-3 h-3" /> : <UserX className="w-3 h-3" />}
                        {entry.is_active ? "Active" : "Inactive"}
                      </span>
                    )}
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
