import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import type { ContractNoteData } from "@/lib/document-parsers/contract-note";
import type { BankStatementData } from "@/lib/document-parsers/bank-statement";
import type { FundStatementData, FundTransaction } from "@/lib/document-parsers/fund-statement";

export const runtime = "nodejs";

type TxnInsert = Database["public"]["Tables"]["transactions"]["Insert"];

interface ImportBody {
  // For contract notes — single trade
  contract_note?: ContractNoteData & { stock_id?: string };
  // For bank statements / fund statements — array of selected trade indices
  selected_indices?: number[];
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body: ImportBody = await request.json();
    const supabase = await createServiceClient();

    // Fetch document
    const { data: doc, error: docError } = await supabase
      .from("documents")
      .select("*")
      .eq("id", id)
      .single();

    if (docError || !doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    if (!doc.extracted_data) {
      return NextResponse.json({ error: "No extracted data" }, { status: 400 });
    }

    const extracted = doc.extracted_data as Record<string, unknown>;
    const inserted: string[] = [];

    if (doc.document_type === "contract_note") {
      const data = extracted as unknown as ContractNoteData;
      const stockId = body.contract_note?.stock_id ?? await findStockId(supabase, data.ticker_hint, data.security_name);

      if (!stockId) {
        return NextResponse.json({ error: "Could not match stock. Please enter manually." }, { status: 422 });
      }

      const gross = (data.quantity ?? 0) * (data.price ?? 0);
      const txn: TxnInsert = {
        transaction_date: data.trade_date ?? new Date().toISOString().split("T")[0],
        transaction_type: data.trade_type,
        asset_type: "stock",
        stock_id: stockId,
        quantity: data.quantity ?? 0,
        price: data.price ?? 0,
        gross_amount: data.consideration ?? gross,
        brokerage_fee: data.broker_commission,
        sec_fee: data.sec_fees,
        cscs_fee: data.cscs_fees,
        stamp_duty: data.stamp_duty,
        total_fees: data.total_fees,
        net_amount: data.total_contract_amount ?? (data.consideration ?? gross) + data.total_fees,
        contract_note_number: data.contract_note_number ?? null,
        settlement_date: data.settlement_date ?? null,
        document_id: doc.id,
      };

      const { data: newTxn, error } = await supabase.from("transactions").insert(txn).select("id").single();
      if (error) throw error;
      inserted.push(newTxn.id);

    } else if (doc.document_type === "bank_statement") {
      const data = extracted as unknown as BankStatementData;
      const trades = data.trades ?? [];
      const indices = body.selected_indices ?? trades.map((_, i) => i);

      for (const idx of indices) {
        const trade = trades[idx];
        if (!trade?.is_trade || !trade.ticker) continue;

        const stockId = await findStockId(supabase, trade.ticker, null);
        if (!stockId) continue;

        const gross = (trade.quantity ?? 0) * (trade.price ?? 0);
        const txn: TxnInsert = {
          transaction_date: trade.date,
          transaction_type: trade.trade_type ?? "buy",
          asset_type: "stock",
          stock_id: stockId,
          quantity: trade.quantity ?? 0,
          price: trade.price ?? 0,
          gross_amount: gross,
          net_amount: trade.trade_type === "buy" ? trade.debit || gross : trade.credit || gross,
          document_id: doc.id,
        };

        const { data: newTxn, error } = await supabase.from("transactions").insert(txn).select("id").single();
        if (error) throw error;
        inserted.push(newTxn.id);
      }

    } else if (doc.document_type === "fund_statement") {
      const data = extracted as unknown as FundStatementData;
      const txns = data.transactions ?? [];
      const indices = body.selected_indices ?? txns.map((_, i) => i);

      const fundId = await findFundId(supabase, data.fund_name);
      if (!fundId) {
        return NextResponse.json({ error: "Could not match fund. Please create the fund first." }, { status: 422 });
      }

      for (const idx of indices) {
        const ft: FundTransaction = txns[idx];
        if (!ft) continue;
        if (ft.type === "other") continue;

        const txn: TxnInsert = {
          transaction_date: ft.date ?? new Date().toISOString().split("T")[0],
          transaction_type: ft.type === "buy" ? "buy" : ft.type === "sell" ? "sell" : "dividend",
          asset_type: "mutual_fund",
          mutual_fund_id: fundId,
          quantity: Math.abs(ft.units),
          price: ft.offer_price,
          gross_amount: Math.abs(ft.amount),
          net_amount: Math.abs(ft.amount),
          document_id: doc.id,
        };

        const { data: newTxn, error } = await supabase.from("transactions").insert(txn).select("id").single();
        if (error) throw error;
        inserted.push(newTxn.id);
      }
    }

    return NextResponse.json({ inserted: inserted.length, transaction_ids: inserted });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

async function findStockId(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  ticker: string | null,
  companyName: string | null
): Promise<string | null> {
  if (ticker) {
    const { data } = await supabase.from("stocks").select("id").eq("ticker", ticker).single();
    if (data) return data.id;
  }
  if (companyName) {
    const simplified = companyName.replace(/\bPLC\b|\bLTD\b|\bLIMITED\b/gi, "").trim().split(" ").slice(0, 2).join(" ");
    const { data } = await supabase.from("stocks").select("id").ilike("company_name", `%${simplified}%`).limit(1).single();
    if (data) return data.id;
  }
  return null;
}

async function findFundId(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  fundName: string | null
): Promise<string | null> {
  if (!fundName) return null;
  const simplified = fundName.split(" ").slice(0, 4).join(" ");
  const { data } = await supabase.from("mutual_funds").select("id").ilike("fund_name", `%${simplified}%`).limit(1).single();
  return data?.id ?? null;
}
