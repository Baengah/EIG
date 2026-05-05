import { NextRequest } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body: {
    entryId: string;
    resolvedAs: string;
    memberId?: string;
    description: string;
    amount: number;
    entryDate: string;
    bankReference: string | null;
  } = await req.json();

  const { entryId, resolvedAs, memberId, description, amount, entryDate, bankReference } = body;

  const svc = await createServiceClient();

  try {
    if (resolvedAs === "contribution") {
      if (!memberId) return Response.json({ error: "Member is required for contribution" }, { status: 400 });
      const { error } = await svc.from("member_contributions").insert({
        member_id: memberId,
        amount: Math.abs(amount),
        contribution_date: entryDate,
        payment_method: "bank_transfer",
        bank_reference: bankReference ?? null,
        notes: description,
      });
      if (error) throw error;

    } else if (resolvedAs !== "ignored") {
      const validCategories = [
        "interest_income", "other_income",
        "bank_charge", "tax", "other_expense", "broker_transfer",
      ] as const;
      if (!validCategories.includes(resolvedAs as typeof validCategories[number])) {
        return Response.json({ error: "Invalid category" }, { status: 400 });
      }
      const { error } = await svc.from("bank_ledger").insert({
        entry_date: entryDate,
        description,
        amount,
        category: resolvedAs as "interest_income" | "other_income" | "bank_charge" | "tax" | "other_expense" | "broker_transfer",
        bank_reference: bankReference ?? null,
      });
      if (error) throw error;
    }

    const { error: updateErr } = await svc.from("unmatched_bank_entries").update({
      status: resolvedAs === "ignored" ? "ignored" : "resolved",
      resolved_as: resolvedAs as "contribution" | "interest_income" | "other_income" | "bank_charge" | "tax" | "other_expense" | "broker_transfer" | "ignored",
      resolved_at: new Date().toISOString(),
    }).eq("id", entryId);
    if (updateErr) throw updateErr;

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Attribution failed" }, { status: 500 });
  }
}
