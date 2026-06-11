"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { TrendingUp, Lock, RefreshCw, Eye, EyeOff } from "lucide-react";

function generatePassword(): string {
  const upper   = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower   = "abcdefghjkmnpqrstuvwxyz";
  const digits  = "23456789";
  const special = "!@#$%^&*";
  const all     = upper + lower + digits + special;
  const pick    = (s: string) => s[Math.floor(Math.random() * s.length)];
  const chars   = [pick(upper), pick(lower), pick(digits), pick(special),
                   ...Array.from({ length: 8 }, () => pick(all))];
  return chars.sort(() => Math.random() - 0.5).join("");
}

export default function SetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();

  const [password, setPassword]   = useState("");
  const [confirm, setConfirm]     = useState("");
  const [showPw, setShowPw]       = useState(false);
  const [loading, setLoading]     = useState(false);
  const [checking, setChecking]   = useState(true);

  // Verify the user has a valid recovery session
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.replace("/login?error=invalid_link");
      else setChecking(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleGenerate() {
    const pw = generatePassword();
    setPassword(pw);
    setConfirm(pw);
    setShowPw(true);
    navigator.clipboard.writeText(pw).then(
      () => toast.success("Password generated and copied to clipboard"),
      () => toast.info("Password generated — copy it before continuing"),
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { toast.error("Passwords do not match"); return; }
    if (password.length < 8)  { toast.error("Password must be at least 8 characters"); return; }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated — you are now signed in");
      router.replace("/");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Password update failed");
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
          <h1 className="text-4xl font-bold text-white leading-tight mb-4">Set a new password</h1>
          <p className="text-blue-200 text-lg leading-relaxed">
            Choose a strong password or let us generate one for you.
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
            <h2 className="text-2xl font-bold text-foreground">Set new password</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Choose a strong password or use the generator below.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Auto-generate */}
            <button
              type="button"
              onClick={handleGenerate}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border border-dashed border-input text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Generate a strong password automatically
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">or enter manually</span>
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                New password <span className="text-loss">*</span>
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={8}
                  placeholder="Minimum 8 characters"
                  className="w-full pl-10 pr-10 py-2.5 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Confirm password <span className="text-loss">*</span>
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type={showPw ? "text" : "password"}
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
              {loading ? "Updating password..." : "Set new password"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
