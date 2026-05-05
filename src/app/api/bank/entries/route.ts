import { NextRequest } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body: {
    txn_date: string;
    description: string;
    credit?: number | null;
    debit?: number | null;
    bank_reference?: string | null;
    notes?: string | null;
  } = await req.json();

  if (!body.txn_date || !body.description?.trim()) {
    return Response.json({ error: "Date and description are required" }, { status: 400 });
  }
  if (!body.credit && !body.debit) {
    return Response.json({ error: "Either a credit or debit amount is required" }, { status: 400 });
  }

  const svc = await createServiceClient();
  const { data, error } = await svc.from("bank_statement_txns").insert({
    txn_date:      body.txn_date,
    description:   body.description.trim(),
    credit:        body.credit  ? Math.abs(body.credit)  : null,
    debit:         body.debit   ? Math.abs(body.debit)   : null,
    bank_reference: body.bank_reference ?? null,
    notes:         body.notes ?? null,
    status:        "unmatched",
  }).select("id").single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true, id: data.id });
}
