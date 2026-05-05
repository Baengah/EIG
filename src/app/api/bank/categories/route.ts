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
