import { NextRequest } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id, display_name, description }: { id: string; display_name: string; description: string | null } = await req.json();
  if (!id || !display_name?.trim()) {
    return Response.json({ error: "id and display_name are required" }, { status: 400 });
  }

  const svc = await createServiceClient();
  const { error } = await svc
    .from("ledger_categories")
    .update({ display_name: display_name.trim(), description: description ?? null, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const profileRes = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profileRes.data?.role !== "admin") {
    return Response.json({ error: "Admin access required" }, { status: 403 });
  }

  const body: { code: string; type: string; display_name: string; description?: string | null } = await req.json();
  if (!body.code?.trim() || !body.type || !body.display_name?.trim()) {
    return Response.json({ error: "code, type, and display_name are required" }, { status: 400 });
  }
  if (!["income", "cost", "transfer"].includes(body.type)) {
    return Response.json({ error: "type must be income, cost, or transfer" }, { status: 400 });
  }

  const svc = await createServiceClient();
  const { error } = await svc.from("ledger_categories").insert({
    code:         body.code.trim().toLowerCase().replace(/\s+/g, "_"),
    type:         body.type as "income" | "cost" | "transfer",
    display_name: body.display_name.trim(),
    description:  body.description?.trim() || null,
  });

  if (error) {
    if (error.code === "23505") return Response.json({ error: "A category with that code already exists" }, { status: 409 });
    return Response.json({ error: error.message }, { status: 500 });
  }
  return Response.json({ ok: true }, { status: 201 });
}
