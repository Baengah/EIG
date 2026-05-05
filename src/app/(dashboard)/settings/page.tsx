import { createClient, createServiceClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/Header";
import { BrokerAccountForm } from "@/components/settings/BrokerAccountForm";
import { BrokerCashButton } from "@/components/settings/BrokerCashButton";
import { BankAccountForm } from "@/components/settings/BankAccountForm";
import { TriggerScrapeButton } from "@/components/settings/TriggerScrapeButton";
import { InviteUserButton } from "@/components/settings/InviteUserButton";
import { EditCategoryButton } from "@/components/settings/EditCategoryButton";
import { AddCategoryButton } from "@/components/settings/AddCategoryButton";
import { Building2, Landmark, RefreshCw, Users, TrendingUp, TrendingDown, ArrowLeftRight } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export const revalidate = 60;

export default async function SettingsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  const svc = await createServiceClient();

  const [brokersRes, banksRes, profileRes, categoriesRes] = await Promise.all([
    supabase.from("broker_accounts").select("*").order("broker_name"),
    supabase.from("bank_accounts").select("*").order("bank_name"),
    user ? supabase.from("profiles").select("role").eq("id", user.id).single() : Promise.resolve({ data: null }),
    svc.from("ledger_categories").select("*").order("type").order("sort_order"),
  ]);

  const brokers    = brokersRes.data ?? [];
  const banks      = banksRes.data ?? [];
  const isAdmin    = profileRes.data?.role === "admin";
  const categories = categoriesRes.data ?? [];

  const incomeCategories = categories.filter(c => c.type === "income");
  const costCategories   = categories.filter(c => c.type === "cost");
  const xferCategories   = categories.filter(c => c.type === "transfer");

  return (
    <div>
      <Header title="Settings" subtitle="Group accounts, brokers, and system settings" />
      <div className="p-4 sm:p-6 space-y-6">

        {/* Broker accounts */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-foreground">Broker Accounts</h3>
          </div>
          {brokers.map((b) => (
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
                <BrokerCashButton
                  brokerId={b.id}
                  brokerName={b.broker_name}
                  currentBalance={b.cash_balance ?? 0}
                />
                <span className={`text-xs px-2 py-0.5 rounded-full ${b.is_active ? "bg-emerald-50 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
                  {b.is_active ? "Active" : "Inactive"}
                </span>
              </div>
            </div>
          ))}
          <div className="mt-3">
            <BrokerAccountForm />
          </div>
        </div>

        {/* Bank accounts */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Landmark className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-foreground">Group Bank Accounts</h3>
          </div>
          {banks.map((b) => (
            <div key={b.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg mb-2 text-sm">
              <div>
                <p className="font-medium text-foreground">{b.bank_name}</p>
                <p className="text-xs text-muted-foreground">{b.account_name} · {b.account_number}</p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full ${b.is_primary ? "bg-gold-50 text-gold-600" : "bg-muted text-muted-foreground"}`}>
                {b.is_primary ? "Primary" : "Secondary"}
              </span>
            </div>
          ))}
          <div className="mt-3">
            <BankAccountForm />
          </div>
        </div>

        {/* Access & Invites — admin only */}
        {isAdmin && (
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                <h3 className="font-semibold text-foreground">Access &amp; Invites</h3>
              </div>
              <InviteUserButton />
            </div>
            <p className="text-sm text-muted-foreground">
              Invite new members to the platform. They will receive an email with a link to set their name, phone, and password.
            </p>
          </div>
        )}

        {/* Line item categories */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-foreground">Income &amp; Cost Line Items</h3>
            </div>
            {isAdmin && <AddCategoryButton />}
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Categories used when attributing unmatched bank entries. Edit display names and descriptions here.
          </p>

          {/* Income */}
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

          {/* Cost */}
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

          {/* Transfer */}
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

        {/* Manual scrape trigger */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <RefreshCw className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-foreground">NGX Price Scraper</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Prices are automatically scraped from NGX Exchange daily at 6:00 PM WAT.
            Use the button below to trigger a manual update.
          </p>
          <TriggerScrapeButton />
        </div>
      </div>
    </div>
  );
}
