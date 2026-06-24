import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/** PATCH /api/bank/balance — admin: update a bank account's cash balance. */
export async function PATCH(request: Request) {
  const supabase = await createServiceClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const body = await request.json() as { bank_account_id: string; cash_balance: number };

  if (!body.bank_account_id || body.cash_balance == null) {
    return NextResponse.json(
      { error: "bank_account_id and cash_balance are required" },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("bank_accounts")
    .update({ cash_balance: body.cash_balance })
    .eq("id", body.bank_account_id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
