import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** GET /api/nav/history?limit=90 — fund_nav history for charts and audit. */
export async function GET(request: Request) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "180", 10), 365);

  const { data, error } = await supabase
    .from("fund_nav")
    .select(
      "id, nav_date, nav_per_unit, total_fund_value, units_in_issue, " +
      "stock_equity_value, mmf_value, paramount_value, " +
      "cash_at_bank, cash_at_broker, liabilities, source"
    )
    .order("nav_date", { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
