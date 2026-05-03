import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  // Use the configured public URL as origin — Cloud Run exposes an internal
  // address (0.0.0.0:3000) which would produce broken redirect URLs otherwise.
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "https://equityinvestmentgroup.club";
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  const cookieStore = await cookies();
  const supabase = createServerClient<Database, "public">(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        },
      },
    }
  );

  // token_hash path — used when email template sends user directly here
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as "invite" | "recovery" | "signup" | "email",
    });
    if (!error) {
      const dest = type === "invite" ? "/auth/accept-invite" : next;
      return NextResponse.redirect(new URL(dest, origin));
    }
  }

  // PKCE code path — Supabase default: verifies on their server then redirects here with ?code=
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      // New invitee has no profile row yet — send them to account setup
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", data.user.id)
        .single();
      const dest = profile ? next : "/auth/accept-invite";
      return NextResponse.redirect(new URL(dest, origin));
    }
  }

  return NextResponse.redirect(new URL("/login?error=invalid_link", origin));
}
