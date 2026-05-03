import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/Header";
import { BrokerAccountForm } from "@/components/settings/BrokerAccountForm";
import { BankAccountForm } from "@/components/settings/BankAccountForm";
import { TriggerScrapeButton } from "@/components/settings/TriggerScrapeButton";
import { InviteUserButton } from "@/components/settings/InviteUserButton";
import { Building2, Landmark, RefreshCw, Users } from "lucide-react";

export const revalidate = 60;

export default async function SettingsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  const [brokersRes, banksRes, profileRes] = await Promise.all([
    supabase.from("broker_accounts").select("*").order("broker_name"),
    supabase.from("bank_accounts").select("*").order("bank_name"),
    user ? supabase.from("profiles").select("role").eq("id", user.id).single() : Promise.resolve({ data: null }),
  ]);

  const brokers = brokersRes.data ?? [];
  const banks = banksRes.data ?? [];
  const isAdmin = profileRes.data?.role === "admin";

  return (
    <div>
      <Header title="Settings" subtitle="Group accounts, brokers, and system settings" />
      <div className="p-6 space-y-6">

        {/* Broker accounts */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-foreground">Broker Accounts</h3>
          </div>
          {brokers.map((b) => (
            <div key={b.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg mb-2 text-sm">
              <div>
                <p className="font-medium text-foreground">{b.broker_name}</p>
                <p className="text-xs text-muted-foreground">{b.account_name} · {b.account_number}</p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full ${b.is_active ? "bg-emerald-50 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
                {b.is_active ? "Active" : "Inactive"}
              </span>
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
