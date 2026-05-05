import { NextRequest } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body: {
    txnId: string;
    resolvedAs: string;
    memberId?: string;
    description: string;
    amount: number;   // positive credit amount (or negative for debit)
    txnDate: string;
    bankReference: string | null;
  } = await req.json();

  const { txnId, resolvedAs, memberId, description, amount, txnDate, bankReference } = body;

  const svc = await createServiceClient();

  try {
    let matchedType: "contribution" | "bank_ledger" | "transaction" | null = null;
    let matchedId: string | null = null;

    if (resolvedAs === "contribution") {
      if (!memberId) return Response.json({ error: "Member is required" }, { status: 400 });
      const { data, error } = await svc.from("member_contributions").insert({
        member_id: memberId,
        amount: Math.abs(amount),
        contribution_date: txnDate,
        payment_method: "bank_transfer",
        bank_reference: bankReference ?? null,
        notes: description,
      }).select("id").single();
      if (error) throw error;
      matchedType = "contribution";
      matchedId   = data.id;

    } else if (resolvedAs !== "ignored") {
      const validCategories = [
        "interest_income", "other_income",
        "bank_charge", "tax", "other_expense", "broker_transfer",
      ] as const;
      type ValidCat = typeof validCategories[number];
      if (!validCategories.includes(resolvedAs as ValidCat)) {
        return Response.json({ error: "Invalid category" }, { status: 400 });
      }
      const { data, error } = await svc.from("bank_ledger").insert({
        entry_date: txnDate,
        description,
        amount,
        category: resolvedAs as ValidCat,
        bank_reference: bankReference ?? null,
      }).select("id").single();
      if (error) throw error;
      matchedType = "bank_ledger";
      matchedId   = data.id;
    }

    // Update the bank statement entry
    const { error: updateErr } = await svc.from("bank_statement_txns").update({
      status:       resolvedAs === "ignored" ? "ignored" : "matched",
      matched_type: matchedType,
      matched_id:   matchedId,
    }).eq("id", txnId);
    if (updateErr) throw updateErr;

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Attribution failed" }, { status: 500 });
  }
}
