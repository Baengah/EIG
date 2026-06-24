import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** GET /api/units/register — per-member unit balances and ownership. */
export async function GET() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const [balancesRes, txnsRes] = await Promise.all([
    supabase
      .from("v_member_unit_balances")
      .select("*"),
    supabase
      .from("unit_transactions")
      .select(
        "id, txn_date, member_id, txn_type, cash_amount, nav_per_unit, units, running_balance, notes"
      )
      .order("txn_date", { ascending: false })
      .limit(100),
  ]);

  if (balancesRes.error) {
    return NextResponse.json({ error: balancesRes.error.message }, { status: 500 });
  }

  return NextResponse.json({
    balances: balancesRes.data ?? [],
    recent_transactions: txnsRes.data ?? [],
  });
}
