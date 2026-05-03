import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/Header";
import { Users, UserCheck, Mail, Phone, Info, ShieldCheck } from "lucide-react";

export const revalidate = 60;

export default async function MembersPage() {
  const supabase = await createClient();

  const [profilesRes, membersRes] = await Promise.all([
    supabase.from("profiles").select("*").order("full_name"),
    supabase.from("members").select("*"),
  ]);

  const profiles = profilesRes.data ?? [];
  const members = membersRes.data ?? [];

  // Index members by profile_id for quick lookup
  const memberByProfileId = new Map(
    members.filter((m) => m.profile_id).map((m) => [m.profile_id!, m])
  );

  const adminCount = profiles.filter((p) => p.role === "admin").length;

  return (
    <div>
      <Header title="Members" subtitle="EIG group member directory" />
      <div className="p-6 space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">Total Users</p>
            <p className="text-2xl font-bold text-foreground">{profiles.length}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">Members</p>
            <p className="text-2xl font-bold text-gain">{profiles.length - adminCount}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">Admins</p>
            <p className="text-2xl font-bold text-primary">{adminCount}</p>
          </div>
        </div>

        {/* Info banner */}
        <div className="flex items-start gap-3 bg-muted/40 border border-border rounded-xl px-4 py-3 text-sm text-muted-foreground">
          <Info className="w-4 h-4 mt-0.5 shrink-0" />
          <span>This list mirrors Supabase auth users. New members appear here automatically once they accept their invite.</span>
        </div>

        {/* Member grid */}
        {profiles.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-12 text-center">
            <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium text-foreground">No users yet</p>
            <p className="text-sm text-muted-foreground mt-1">Members added in Supabase will appear here automatically</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {profiles.map((profile) => {
              const member = memberByProfileId.get(profile.id);
              return (
                <div key={profile.id} className="bg-card border border-border rounded-xl p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                        <span className="text-primary font-semibold text-sm">
                          {profile.full_name.split(" ").map((n: string) => n[0]).slice(0, 2).join("")}
                        </span>
                      </div>
                      <div>
                        <p className="font-semibold text-foreground leading-tight">{profile.full_name}</p>
                        {member?.member_number && (
                          <p className="text-xs text-muted-foreground">{member.member_number}</p>
                        )}
                      </div>
                    </div>
                    <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                      profile.role === "admin"
                        ? "text-primary bg-primary/10"
                        : "text-emerald-700 bg-emerald-50"
                    }`}>
                      {profile.role === "admin"
                        ? <><ShieldCheck className="w-3 h-3" /> Admin</>
                        : <><UserCheck className="w-3 h-3" /> Member</>
                      }
                    </span>
                  </div>

                  <div className="space-y-1.5 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{profile.email}</span>
                    </div>
                    {profile.phone && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="w-3.5 h-3.5 shrink-0" />
                        <span>{profile.phone}</span>
                      </div>
                    )}
                  </div>

                  {member && (
                    <div className="mt-3 pt-3 border-t border-border space-y-1.5">
                      {member.join_date && (
                        <p className="text-xs text-muted-foreground">
                          Member since {new Date(member.join_date).toLocaleDateString("en-NG", { month: "long", year: "numeric" })}
                        </p>
                      )}
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
                  )}

                  {!member && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <p className="text-xs text-muted-foreground">
                        Joined {new Date(profile.created_at).toLocaleDateString("en-NG", { month: "long", year: "numeric" })}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
