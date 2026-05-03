"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { TrendingUp, User, Phone, Lock, CheckCircle2 } from "lucide-react";

export default function AcceptInvitePage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  // Confirm the user arrived here via a valid invite session
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace("/login?error=invalid_link");
      } else {
        setEmail(user.email ?? "");
        // Pre-fill name if Supabase metadata already has it
        setFullName((user.user_metadata?.full_name as string) ?? "");
        setChecking(false);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    setLoading(true);
    try {
      // 1. Set the password and update user metadata
      const { data: { user }, error: updateErr } = await supabase.auth.updateUser({
        password,
        data: { full_name: fullName },
      });
      if (updateErr) throw updateErr;
      if (!user) throw new Error("Session lost — please request a new invite.");

      // 2. Create the profile record
      const { error: profileErr } = await supabase.from("profiles").upsert({
        id: user.id,
        full_name: fullName.trim(),
        email: user.email!,
        phone: phone.trim() || null,
        role: "member",
      });
      if (profileErr) throw profileErr;

      toast.success("Account set up — welcome to EIG!");
      router.replace("/");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Setup failed");
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-brand-900 via-brand-800 to-brand-700 flex-col justify-between p-12">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gold-500 rounded-lg flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-white" />
          </div>
          <span className="text-white text-xl font-bold tracking-tight">EIG Platform</span>
        </div>
        <div>
          <h1 className="text-4xl font-bold text-white leading-tight mb-4">
            You&apos;ve been invited
          </h1>
          <p className="text-blue-200 text-lg leading-relaxed">
            Set up your account to access the Equity Investment Group portfolio platform.
          </p>
        </div>
        <p className="text-blue-300 text-sm">equityinvestmentgroup.club</p>
      </div>

      {/* Right panel */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <span className="text-foreground text-xl font-bold">EIG Platform</span>
          </div>

          <div className="mb-8">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              <span className="text-sm text-emerald-600 font-medium">Invite accepted</span>
            </div>
            <h2 className="text-2xl font-bold text-foreground">Set up your account</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Signing in as <span className="font-medium text-foreground">{email}</span>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full name */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Full name <span className="text-loss">*</span>
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  required
                  placeholder="First name Surname"
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                />
              </div>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Phone <span className="text-muted-foreground text-xs">(optional)</span>
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+234 800 000 0000"
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Password <span className="text-loss">*</span>
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={8}
                  placeholder="Minimum 8 characters"
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                />
              </div>
            </div>

            {/* Confirm password */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Confirm password <span className="text-loss">*</span>
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                  placeholder="Re-enter password"
                  className={`w-full pl-10 pr-4 py-2.5 rounded-lg border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm ${
                    confirm && confirm !== password ? "border-loss focus:ring-loss" : "border-input"
                  }`}
                />
              </div>
              {confirm && confirm !== password && (
                <p className="text-xs text-loss mt-1">Passwords do not match</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || (!!confirm && confirm !== password)}
              className="w-full py-2.5 px-4 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-2"
            >
              {loading ? "Setting up account..." : "Complete setup"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
