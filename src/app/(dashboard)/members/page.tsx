import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/Header";
import { Users, UserCheck, Mail, Phone, Info, ShieldCheck } from "lucide-react";

export const revalidate = 60;

export default async function MembersPage() {
  const supabase = await createClient();

  const [membersRes, profilesRes] = await Promise.all([
    supabase.from("members").select("*").order("full_name"),
    supabase.from("profiles").select("id, role"),
  ]);

  const members = membersRes.data ?? [];
  const profiles = profilesRes.data ?? [];

  // Index profiles by id for auth-status lookup
  const profileById = new Map(profiles.map((p) => [p.id, p]));

  const active = members.filter((m) => m.is_active);
  const inactive = members.filter((m) => !m.is_active);

  return (
    <div>
      <Header title="Members" subtitle="EIG group member directory" />
      <div className="p-6 space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">Total Members</p>
            <p className="text-2xl font-bold text-foreground">{members.length}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">Active</p>
            <p className="text-2xl font-bold text-gain">{active.length}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">Inactive</p>
            <p className="text-2xl font-bold text-muted-foreground">{inactive.length}</p>
          </div>
        </div>

        {/* Info banner */}
        <div className="flex items-start gap-3 bg-muted/40 border border-border rounded-xl px-4 py-3 text-sm text-muted-foreground">
          <Info className="w-4 h-4 mt-0.5 shrink-0" />
          <span>This list mirrors Supabase auth users. New members appear here automatically once they accept their invite.</span>
        </div>

        {/* Member grid */}
        {members.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-12 text-center">
            <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium text-foreground">No members yet</p>
            <p className="text-sm text-muted-foreground mt-1">Members added in Supabase will appear here automatically</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {members.map((member) => {
              const profile = member.profile_id ? profileById.get(member.profile_id) : undefined;
              const isAdmin = profile?.role === "admin";
              return (
                <div key={member.id} className="bg-card border border-border rounded-xl p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                        <span className="text-primary font-semibold text-sm">
                          {member.full_name.split(" ").map((n: string) => n[0]).slice(0, 2).join("")}
                        </span>
                      </div>
                      <div>
                        <p className="font-semibold text-foreground leading-tight">{member.full_name}</p>
                        <p className="text-xs text-muted-foreground">{member.member_number}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        member.is_active ? "text-emerald-700 bg-emerald-50" : "text-muted-foreground bg-muted"
                      }`}>
                        <UserCheck className="w-3 h-3" />
                        {member.is_active ? "Active" : "Inactive"}
                      </span>
                      {isAdmin && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-primary bg-primary/10">
                          <ShieldCheck className="w-3 h-3" /> Admin
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5 text-sm">
                    {member.email && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{member.email}</span>
                      </div>
                    )}
                    {member.phone && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="w-3.5 h-3.5 shrink-0" />
                        <span>{member.phone}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 pt-3 border-t border-border space-y-1.5">
                    <p className="text-xs text-muted-foreground">
                      Member since {new Date(member.join_date).toLocaleDateString("en-NG", { month: "long", year: "numeric" })}
                    </p>
                    {member.bank_name && (
                      <div className="p-2 bg-muted/40 rounded-lg text-xs">
                        <span className="text-muted-foreground">{member.bank_name}</span>
                        <span className="mx-1 text-muted-foreground">·</span>
                        <span className="font-mono text-foreground">
                          ****{member.bank_account_number?.slice(-4)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
