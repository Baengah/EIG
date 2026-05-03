import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export async function POST() {
  try {
    const supabase = await createServiceClient();

    // Fetch pending documents
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
        let extractedData: Record<string, unknown> = {};

        if (doc.document_type === "bank_statement") {
          extractedData = await processBankStatement(doc.file_path, supabase);
        } else if (doc.document_type === "contract_note") {
          extractedData = await processContractNote(doc.file_path, supabase);
        }

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
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

async function processBankStatement(filePath: string, supabase: SupabaseClient<Database, "public">): Promise<Record<string, unknown>> {
  // Download file from Supabase Storage
  const { data: fileData, error } = await supabase.storage
    .from("eig-documents")
    .download(filePath);

  if (error || !fileData) {
    throw new Error(`Failed to download: ${error?.message}`);
  }

  // For PDF parsing, we'd use a library like pdf-parse or send to an OCR service.
  // This is a placeholder that returns metadata about the file.
  // In production, integrate with OpenAI vision API or a dedicated document parser.
  return {
    file_size: fileData.size,
    processed_at: new Date().toISOString(),
    note: "Automated extraction requires PDF parsing integration. Please review manually.",
    status: "manual_review_required",
  };
}

async function processContractNote(filePath: string, supabase: SupabaseClient<Database, "public">): Promise<Record<string, unknown>> {
  const { data: fileData, error } = await supabase.storage
    .from("eig-documents")
    .download(filePath);

  if (error || !fileData) {
    throw new Error(`Failed to download: ${error?.message}`);
  }

  // Placeholder: contract note parsing would extract:
  // - Trade date, settlement date
  // - Stock ticker, quantity, price
  // - Broker fees, SEC levy, CSCS charges, stamp duty
  // In production, use pdf-parse + regex patterns for Nigerian broker formats
  return {
    file_size: fileData.size,
    processed_at: new Date().toISOString(),
    note: "Contract note extraction requires PDF parsing integration. Please add transaction manually.",
    status: "manual_review_required",
    suggested_fields: {
      transaction_date: null,
      stock_ticker: null,
      quantity: null,
      price: null,
      brokerage_fee: null,
      sec_fee: null,
      cscs_fee: null,
      stamp_duty: null,
    },
  };
}
