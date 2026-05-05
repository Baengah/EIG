import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { parseContractNote } from "@/lib/document-parsers/contract-note";
import { parseBankStatement } from "@/lib/document-parsers/bank-statement";
import { parseFundStatement } from "@/lib/document-parsers/fund-statement";

export const runtime = "nodejs";

type Row = Database["public"]["Tables"]["documents"]["Row"];

export async function POST() {
  try {
    const supabase = await createServiceClient();

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    }

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { data: pending } = await supabase
      .from("documents")
      .select("*")
      .eq("processing_status", "pending")
      .limit(10);

    if (!pending || pending.length === 0) {
      return NextResponse.json({ processed: 0, message: "No pending documents" });
    }

    let processed = 0;

    for (const doc of pending) {
      await supabase
        .from("documents")
        .update({ processing_status: "processing" })
        .eq("id", doc.id);

      try {
        const extractedData = await extractDocument(doc, supabase);

        await supabase
          .from("documents")
          .update({
            processing_status: "completed",
            extracted_data: extractedData as Json,
          })
          .eq("id", doc.id);

        processed++;
      } catch (err) {
        await supabase
          .from("documents")
          .update({
            processing_status: "failed",
            processing_error: String(err),
          })
          .eq("id", doc.id);
      }
    }

    return NextResponse.json({ processed, total: pending.length });
  } catch (err: unknown) {
    console.error("Document process error:", err);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}

async function extractDocument(
  doc: Row,
  supabase: SupabaseClient<Database, "public">
): Promise<Record<string, unknown>> {
  const { data: fileData, error } = await supabase.storage
    .from("eig-documents")
    .download(doc.file_path);

  if (error || !fileData) {
    throw new Error(`Failed to download: ${error?.message}`);
  }

  const isPdf = doc.mime_type === "application/pdf" || doc.file_name.toLowerCase().endsWith(".pdf");

  if (!isPdf) {
    return {
      file_size: fileData.size,
      processed_at: new Date().toISOString(),
      note: "Non-PDF documents require manual review.",
      status: "manual_review_required",
    };
  }

  const text = await extractPdfText(fileData);

  if (doc.document_type === "contract_note") {
    return parseContractNote(text, doc.file_name) as unknown as Record<string, unknown>;
  } else if (doc.document_type === "bank_statement") {
    return parseBankStatement(text) as unknown as Record<string, unknown>;
  } else if (doc.document_type === "fund_statement") {
    return parseFundStatement(text) as unknown as Record<string, unknown>;
  }

  return {
    file_size: fileData.size,
    processed_at: new Date().toISOString(),
    raw_text_sample: text.slice(0, 1000),
    note: "Unknown document type — manual review required.",
  };
}

async function extractPdfText(blob: Blob): Promise<string> {
  const buffer = Buffer.from(await blob.arrayBuffer());
  const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string }>; // CJS module
  const result = await pdfParse(buffer);
  return result.text;
}
