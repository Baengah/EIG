import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

/** GET /api/dividends — all dividend yield data + portfolio yield. */
export async function GET() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const [holdingYields, portfolioYield, declared] = await Promise.all([
    supabase
      .from("v_dividend_yield")
      .select("*")
      .order("annual_income", { ascending: false }),
    supabase
      .from("v_portfolio_dividend_yield")
      .select("*")
      .single(),
    supabase
      .from("equity_dividends")
      .select("*, stocks(ticker, company_name)")
      .order("ex_date", { ascending: false }),
  ]);

  return NextResponse.json({
    holdings: holdingYields.data ?? [],
    portfolio: portfolioYield.data,
    declared: declared.data ?? [],
  });
}

/** POST /api/dividends — admin: declare a new dividend. */
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
    stock_id: string;
    ex_date: string;
    dividend_per_share: number;
    pay_date?: string;
    announcement_date?: string;
    notes?: string;
  };

  if (!body.stock_id || !body.ex_date || !body.dividend_per_share) {
    return NextResponse.json(
      { error: "stock_id, ex_date, and dividend_per_share are required" },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("equity_dividends")
    .upsert({
      stock_id: body.stock_id,
      ex_date: body.ex_date,
      dividend_per_share: body.dividend_per_share,
      pay_date: body.pay_date ?? null,
      announcement_date: body.announcement_date ?? null,
      notes: body.notes ?? null,
      source: "manual",
    }, { onConflict: "stock_id,ex_date" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
