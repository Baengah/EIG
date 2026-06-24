import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/** POST /api/units/price-contributions — batch-issue units for all unpriced contributions. */
export async function POST() {
  const supabase = await createServiceClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { data, error } = await supabase.rpc("price_unpriced_contributions");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    priced: data ?? [],
    count: (data ?? []).length,
  });
}
