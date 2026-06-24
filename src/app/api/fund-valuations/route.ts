import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

/** GET /api/fund-valuations — recent CHD MMF / Paramount valuations. */
export async function GET() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { data, error } = await supabase
    .from("mutual_fund_valuations")
    .select("*")
    .order("valuation_date", { ascending: false })
    .limit(60);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

/** POST /api/fund-valuations — admin: add a new CHD fund valuation. */
export async function POST(request: Request) {
  const supabase = await createServiceClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const body = await request.json() as {
    fund_name: string;
    valuation_date: string;
    value: number;
    notes?: string;
  };

  const ALLOWED_FUNDS = ["CHD Money Market Fund", "CHD Paramount Fund"];
  if (!ALLOWED_FUNDS.includes(body.fund_name)) {
    return NextResponse.json(
      { error: `fund_name must be one of: ${ALLOWED_FUNDS.join(", ")}` },
      { status: 400 },
    );
  }
  if (!body.valuation_date || body.value == null) {
    return NextResponse.json(
      { error: "valuation_date and value are required" },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("mutual_fund_valuations")
    .upsert({
      fund_name: body.fund_name,
      valuation_date: body.valuation_date,
      value: body.value,
      notes: body.notes ?? null,
      source: "manual",
    }, { onConflict: "fund_name,valuation_date" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
