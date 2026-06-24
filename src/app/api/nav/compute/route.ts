import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/** POST /api/nav/compute — compute and persist today's NAV, then price any unpriced contributions. */
export async function POST(request: Request) {
  const supabase = await createServiceClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({})) as { date?: string };
    const date = body.date ?? new Date().toISOString().split("T")[0];

    // Step 1: Compute and persist the fund NAV for this date
    const { data: nav, error: navErr } = await supabase
      .rpc("compute_and_save_fund_nav", { p_date: date });
    if (navErr) throw navErr;

    // Step 2: Price any contributions that don't yet have unit_transactions
    const { data: priced, error: priceErr } = await supabase
      .rpc("price_unpriced_contributions");
    if (priceErr) throw priceErr;

    return NextResponse.json({
      nav,
      priced_contributions: priced ?? [],
      priced_count: (priced ?? []).length,
    });
  } catch (err: unknown) {
    console.error("nav/compute error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
