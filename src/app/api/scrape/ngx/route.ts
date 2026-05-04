import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import * as XLSX from "xlsx";

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const apiKey = process.env.SCRAPER_API_KEY;

  if (apiKey && authHeader !== `Bearer ${apiKey}`) {
    const supabase = await createServiceClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "admin") return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    const gcpEndpoint = process.env.GCP_SCRAPER_ENDPOINT;
    if (gcpEndpoint) {
      const response = await fetch(gcpEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ trigger: "manual" }),
      });
      return NextResponse.json(await response.json(), { status: response.status });
    }

    const result = await scrapeNGX();
    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error("NGX scrape error:", err);
    return NextResponse.json({ error: "Scrape failed", detail: String(err) }, { status: 500 });
  }
}

async function scrapeNGX() {
  const supabase = await createServiceClient();

  const url = "https://ngxgroup.com/exchange/data/equities-price-list/";
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; EIG-Scraper/1.0)",
      "Accept": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel, text/html, */*",
    },
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) throw new Error(`NGX returned HTTP ${response.status}`);

  const contentType = response.headers.get("content-type") ?? "";
  const isExcel = contentType.includes("spreadsheet") || contentType.includes("excel") ||
    contentType.includes("octet-stream");

  let rows: PriceRow[];

  if (isExcel || !contentType.includes("html")) {
    // NGX serves an Excel (.xlsx) file — parse with xlsx library
    const buffer = await response.arrayBuffer();
    rows = parseExcelPriceList(buffer);
  } else {
    // Fallback: attempt HTML table parse (for dev/test environments)
    const html = await response.text();
    rows = parseHtmlPriceList(html);
  }

  if (rows.length === 0) {
    return { updated: 0, message: "No data extracted — check response format", content_type: contentType };
  }

  const today = new Date().toISOString().split("T")[0];

  const { data: stocks } = await supabase.from("stocks").select("id, ticker");
  const tickerMap = new Map(stocks?.map((s) => [s.ticker.toUpperCase(), s.id]) ?? []);

  let updated = 0;
  for (const row of rows) {
    const stockId = tickerMap.get(row.ticker.toUpperCase());
    if (!stockId) continue;

    const { error } = await supabase.from("stock_prices").upsert({
      stock_id: stockId,
      price_date: today,
      closing_price: row.close,
      opening_price: row.open ?? null,
      high_price: row.high ?? null,
      low_price: row.low ?? null,
      volume: row.volume ?? 0,
      value: row.value ?? null,
      price_change: row.change ?? null,
      change_percent: row.changePct ?? null,
      scrape_source: "ngx",
    }, { onConflict: "stock_id,price_date" });

    if (!error) updated++;
  }

  await supabase.rpc("create_portfolio_snapshot", { p_date: today });

  return { updated, total_rows: rows.length, date: today };
}

interface PriceRow {
  ticker: string;
  close: number;
  open?: number;
  high?: number;
  low?: number;
  volume?: number;
  value?: number;
  change?: number;
  changePct?: number;
}

// ── NGX Excel price list parser ──────────────────────────────────────────────
// The NGX price list Excel has columns (approximate order):
//   Symbol | Company | Listing Date | Market Cap | Open | High | Low | Close |
//   Change | %Change | Volume | Value | Trades
function parseExcelPriceList(buffer: ArrayBuffer): PriceRow[] {
  const wb = XLSX.read(buffer, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, raw: false, defval: "" });

  // Find the header row (first row containing "SYMBOL" or "TICKER" in any cell)
  let headerIdx = -1;
  for (let i = 0; i < Math.min(raw.length, 10); i++) {
    const row = raw[i].map((c) => String(c ?? "").toUpperCase().trim());
    if (row.some((c) => c === "SYMBOL" || c === "TICKER" || c === "COMPANY SYMBOL")) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) return [];

  const headers = raw[headerIdx].map((c) => String(c ?? "").toUpperCase().trim());

  // Map header names to column indices
  const col = (names: string[]) => names.map((n) => headers.indexOf(n)).find((i) => i >= 0) ?? -1;

  const iSymbol = col(["SYMBOL", "TICKER", "COMPANY SYMBOL"]);
  const iOpen   = col(["OPEN"]);
  const iHigh   = col(["HIGH"]);
  const iLow    = col(["LOW"]);
  const iClose  = col(["CLOSE", "CLOSING PRICE", "LAST PRICE"]);
  const iChange = col(["CHANGE", "PRICE CHANGE"]);
  const iChangePct = col(["% CHANGE", "CHANGE %", "%CHANGE", "CHANGE_PCT"]);
  const iVolume = col(["VOLUME"]);
  const iValue  = col(["VALUE"]);

  if (iSymbol < 0 || iClose < 0) return [];

  const rows: PriceRow[] = [];
  for (let i = headerIdx + 1; i < raw.length; i++) {
    const cells = raw[i];
    const ticker = String(cells[iSymbol] ?? "").trim().toUpperCase();
    if (!ticker || !/^[A-Z]/.test(ticker)) continue;

    const close = parseNum(cells[iClose]);
    if (!close || close <= 0) continue;

    rows.push({
      ticker,
      close,
      open:      iOpen      >= 0 ? parseNum(cells[iOpen])      : undefined,
      high:      iHigh      >= 0 ? parseNum(cells[iHigh])      : undefined,
      low:       iLow       >= 0 ? parseNum(cells[iLow])       : undefined,
      change:    iChange    >= 0 ? parseNum(cells[iChange])    : undefined,
      changePct: iChangePct >= 0 ? parseNum(cells[iChangePct]) : undefined,
      volume:    iVolume    >= 0 ? parseNum(cells[iVolume])    : undefined,
      value:     iValue     >= 0 ? parseNum(cells[iValue])     : undefined,
    });
  }
  return rows;
}

// ── HTML table fallback ───────────────────────────────────────────────────────
function parseHtmlPriceList(html: string): PriceRow[] {
  const rows: PriceRow[] = [];
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const tdRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;

  let trMatch;
  while ((trMatch = trRegex.exec(html)) !== null) {
    const cells: string[] = [];
    let tdMatch;
    while ((tdMatch = tdRegex.exec(trMatch[1])) !== null) {
      cells.push(tdMatch[1].replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").trim());
    }
    if (cells.length < 5) continue;
    const ticker = cells[0].toUpperCase();
    if (!ticker || !/^[A-Z]/.test(ticker)) continue;
    const close = parseNum(cells[4]);
    if (!close || close <= 0) continue;
    rows.push({
      ticker,
      open: parseNum(cells[1]),
      high: parseNum(cells[2]),
      low: parseNum(cells[3]),
      close,
      change: parseNum(cells[5]),
      changePct: parseNum(cells[6]),
      volume: parseNum(cells[7]),
      value: parseNum(cells[8]),
    });
  }
  return rows;
}

function parseNum(s: unknown): number | undefined {
  if (s == null || s === "") return undefined;
  const clean = String(s).replace(/,/g, "").replace(/[^0-9.\-]/g, "");
  const n = parseFloat(clean);
  return isNaN(n) ? undefined : n;
}
