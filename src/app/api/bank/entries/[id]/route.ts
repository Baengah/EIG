import { NextRequest } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const profileRes = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profileRes.data?.role !== "admin") {
    return Response.json({ error: "Admin access required" }, { status: 403 });
  }

  const { id } = await params;
  const body: {
    txn_date?: string;
    description?: string;
    credit?: number | null;
    debit?: number | null;
    bank_reference?: string | null;
    notes?: string | null;
    status?: "matched" | "unmatched" | "ignored";
  } = await req.json();

  if (!id) return Response.json({ error: "Entry ID required" }, { status: 400 });

  const updates: {
    txn_date?: string;
    description?: string;
    credit?: number | null;
    debit?: number | null;
    bank_reference?: string | null;
    notes?: string | null;
    status?: "matched" | "unmatched" | "ignored";
  } = {};
  if (body.txn_date !== undefined)       updates.txn_date       = body.txn_date;
  if (body.description !== undefined)    updates.description    = body.description?.trim();
  if (body.credit !== undefined)         updates.credit         = body.credit ?? null;
  if (body.debit !== undefined)          updates.debit          = body.debit ?? null;
  if (body.bank_reference !== undefined) updates.bank_reference = body.bank_reference ?? null;
  if (body.notes !== undefined)          updates.notes          = body.notes ?? null;
  if (body.status !== undefined)         updates.status         = body.status;

  const svc = await createServiceClient();
  const { error } = await svc.from("bank_statement_txns").update(updates).eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
