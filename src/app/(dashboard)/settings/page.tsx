import { createClient, createServiceClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/Header";
import { BrokerAccountForm } from "@/components/settings/BrokerAccountForm";
import { BrokerCashButton } from "@/components/settings/BrokerCashButton";
import { BankAccountForm } from "@/components/settings/BankAccountForm";
import { BankCashButton } from "@/components/settings/BankCashButton";
import { TriggerScrapeButton } from "@/components/settings/TriggerScrapeButton";
import { InviteUserButton } from "@/components/settings/InviteUserButton";
import { EditCategoryButton } from "@/components/settings/EditCategoryButton";
import { AddCategoryButton } from "@/components/settings/AddCategoryButton";
import {
  Building2, Landmark, RefreshCw, Users, TrendingUp, TrendingDown,
  ArrowLeftRight, ShieldCheck, Mail, Phone, UserCheck, UserX, Clock,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { User } from "@supabase/supabase-js";

export const revalidate = 60;

function normalizeName(s: string) {
  return s.toLowerCase().replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim();
}

function fuzzyNameMatch(authUsers: User[], memberName: string, excludeIds: Set<string>): User | undefined {
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

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const svc = await createServiceClient();

  const [brokersRes, banksRes, profileRes, categoriesRes, { data: authData }, membersRes, profilesRes] = await Promise.all([
    supabase.from("broker_accounts").select("*").order("broker_name"),
    supabase.from("bank_accounts").select("*").order("bank_name"),
    user ? supabase.from("profiles").select("role").eq("id", user.id).single() : Promise.resolve({ data: null }),
    svc.from("ledger_categories").select("*").order("type").order("sort_order"),
    svc.auth.admin.listUsers({ perPage: 1000 }),
    supabase.from("members").select("*").order("full_name"),
    supabase.from("profiles").select("id, role"),
  ]);

  const brokers    = brokersRes.data ?? [];
  const banks      = banksRes.data ?? [];
  const isAdmin    = profileRes.data?.role === "admin";
  const categories = categoriesRes.data ?? [];
  const authUsers  = authData?.users ?? [];
  const members    = membersRes.data ?? [];
  const profiles   = profilesRes.data ?? [];

  const incomeCategories = categories.filter(c => c.type === "income");
  const costCategories   = categories.filter(c => c.type === "cost");
  const xferCategories   = categories.filter(c => c.type === "transfer");

  const roleById = new Map(profiles.map(p => [p.id, p.role]));
  const authById = new Map(authUsers.map(u => [u.id, u]));
  const authByEmail = new Map(authUsers.filter(u => u.email).map(u => [u.email!.toLowerCase(), u]));
  const authByName = new Map(authUsers.filter(u => u.user_metadata?.full_name).map(u => [normalizeName(u.user_metadata.full_name as string), u]));

  const matchedAuthIds = new Set<string>();
  const memberEntries = members.map(m => {
    const authUser =
      (m.profile_id ? authById.get(m.profile_id) : undefined) ??
      authByEmail.get(m.email.toLowerCase()) ??
      authByName.get(normalizeName(m.full_name)) ??
      fuzzyNameMatch(authUsers, m.full_name, matchedAuthIds);
    if (authUser) matchedAuthIds.add(authUser.id);
    const invitePending = authUser ? !authUser.confirmed_at || !authUser.last_sign_in_at : false;
    return {
      key: m.id,
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

  const activeCount  = memberEntries.filter(e => e.is_active && !e.invitePending).length;
  const pendingCount = memberEntries.filter(e => e.invitePending).length;

  return (
    <div>
      <Header title="Settings" subtitle="Members, accounts, ledger categories, and system" />
      <div className="p-4 sm:p-6 space-y-6">

        {/* ── 1. Members & Access ──────────────────────────────── */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-foreground">Members &amp; Access</h3>
            </div>
            {isAdmin && <InviteUserButton />}
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-muted/30 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-foreground">{memberEntries.length}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-gain">{activeCount}</p>
              <p className="text-xs text-muted-foreground">Active</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-amber-500">{pendingCount}</p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </div>
          </div>

          {/* Member list */}
          {memberEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No members yet. Invite one using the button above.</p>
          ) : (
            <div className="space-y-2">
              {memberEntries.map(entry => (
                <div key={entry.key} className="flex items-start justify-between p-3 bg-muted/30 rounded-lg gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                      <span className="text-primary font-semibold text-xs">
                        {entry.full_name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-foreground">{entry.full_name}</p>
                        {entry.member_number && <span className="text-xs text-muted-foreground">{entry.member_number}</span>}
                        {entry.role === "admin" && (
                          <span className="flex items-center gap-0.5 text-xs text-primary">
                            <ShieldCheck className="w-3 h-3" /> Admin
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 flex-wrap mt-0.5">
                        {entry.email && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Mail className="w-3 h-3" /> {entry.email}
                          </span>
                        )}
                        {entry.phone && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Phone className="w-3 h-3" /> {entry.phone}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0">
                    {entry.invitePending ? (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-amber-700 bg-amber-50">
                        <Clock className="w-3 h-3" /> Pending
                      </span>
                    ) : (
                      <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${entry.is_active ? "text-emerald-700 bg-emerald-50" : "text-muted-foreground bg-muted"}`}>
                        {entry.is_active ? <UserCheck className="w-3 h-3" /> : <UserX className="w-3 h-3" />}
                        {entry.is_active ? "Active" : "Inactive"}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── 2. Broker Accounts ────────────────────────────────── */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-foreground">Broker Accounts</h3>
          </div>
          {brokers.map(b => (
            <div key={b.id} className="flex items-start justify-between p-3 bg-muted/30 rounded-lg mb-2 text-sm gap-3">
              <div className="min-w-0">
                <p className="font-medium text-foreground">{b.broker_name}</p>
                <p className="text-xs text-muted-foreground truncate">{b.account_name} · {b.account_number}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Cash at broker</p>
                  <p className="font-semibold text-foreground">{formatCurrency(b.cash_balance ?? 0)}</p>
                </div>
                <BrokerCashButton brokerId={b.id} brokerName={b.broker_name} currentBalance={b.cash_balance ?? 0} />
                <span className={`text-xs px-2 py-0.5 rounded-full ${b.is_active ? "bg-emerald-50 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
                  {b.is_active ? "Active" : "Inactive"}
                </span>
              </div>
            </div>
          ))}
          <div className="mt-3"><BrokerAccountForm /></div>
        </div>

        {/* ── 3. Bank Accounts ──────────────────────────────────── */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Landmark className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-foreground">Group Bank Accounts</h3>
          </div>
          {banks.map(b => (
            <div key={b.id} className="flex items-start justify-between p-3 bg-muted/30 rounded-lg mb-2 text-sm gap-3">
              <div className="min-w-0">
                <p className="font-medium text-foreground">{b.bank_name}</p>
                <p className="text-xs text-muted-foreground truncate">{b.account_name} · {b.account_number}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Cash at bank</p>
                  <p className="font-semibold text-foreground">{formatCurrency(b.cash_balance ?? 0)}</p>
                </div>
                <BankCashButton bankId={b.id} bankName={b.bank_name} currentBalance={b.cash_balance ?? 0} />
                <span className={`text-xs px-2 py-0.5 rounded-full ${b.is_primary ? "bg-gold-50 text-gold-600" : "bg-muted text-muted-foreground"}`}>
                  {b.is_primary ? "Primary" : "Secondary"}
                </span>
              </div>
            </div>
          ))}
          <div className="mt-3"><BankAccountForm /></div>
        </div>

        {/* ── 4. Ledger Categories ──────────────────────────────── */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-foreground">Income &amp; Cost Line Items</h3>
            </div>
            {isAdmin && <AddCategoryButton />}
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Categories used when attributing bank entries. Edit display names and descriptions here.
          </p>

          <div className="mb-4">
            <div className="flex items-center gap-1.5 mb-2">
              <TrendingUp className="w-3.5 h-3.5 text-gain" />
              <p className="text-xs font-semibold text-gain uppercase tracking-wide">Income</p>
            </div>
            <div className="space-y-1.5">
              {incomeCategories.map(c => (
                <div key={c.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground">{c.display_name}</p>
                      <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{c.code}</span>
                    </div>
                    {c.description && <p className="text-xs text-muted-foreground mt-0.5">{c.description}</p>}
                  </div>
                  {isAdmin && <EditCategoryButton category={c} />}
                </div>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <div className="flex items-center gap-1.5 mb-2">
              <TrendingDown className="w-3.5 h-3.5 text-loss" />
              <p className="text-xs font-semibold text-loss uppercase tracking-wide">Cost / Expense</p>
            </div>
            <div className="space-y-1.5">
              {costCategories.map(c => (
                <div key={c.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground">{c.display_name}</p>
                      <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{c.code}</span>
                    </div>
                    {c.description && <p className="text-xs text-muted-foreground mt-0.5">{c.description}</p>}
                  </div>
                  {isAdmin && <EditCategoryButton category={c} />}
                </div>
              ))}
            </div>
          </div>

          {xferCategories.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <ArrowLeftRight className="w-3.5 h-3.5 text-muted-foreground" />
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Transfer</p>
              </div>
              <div className="space-y-1.5">
                {xferCategories.map(c => (
                  <div key={c.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground">{c.display_name}</p>
                        <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{c.code}</span>
                      </div>
                      {c.description && <p className="text-xs text-muted-foreground mt-0.5">{c.description}</p>}
                    </div>
                    {isAdmin && <EditCategoryButton category={c} />}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── 5. System ──────────────────────────────────────────── */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <RefreshCw className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-foreground">NGX Price Scraper</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Prices are automatically scraped from NGX Exchange daily at 6:00 PM WAT.
            Covers Main Board (146 equities) and Growth Board (9 equities including The Initiates Plc / TIP).
            Use the button below to trigger a manual update outside the scheduled window.
          </p>
          <TriggerScrapeButton />
        </div>

      </div>
    </div>
  );
}
