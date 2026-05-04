import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

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

// ── NGX doclib REST API (same source used by the NGX website itself) ──────────
// Primary:  equities endpoint — JSON, ClosePrice + TradeDate per row
// Fallback: legacy ticker endpoint
const NGX_EQUITIES_URL =
  "https://doclib.ngxgroup.com/REST/api/statistics/equities/" +
  "?market=&sector=&orderby=&pageSize=300&pageNo=0";

const NGX_LEGACY_URL =
  "https://doclib.ngxgroup.com/REST/api/statistics/ticker" +
  "?$filter=TickerType%20eq%20%27EQUITIES%27";

const HEADERS: HeadersInit = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.5",
  "Cache-Control": "no-cache",
  Referer: "https://ngxgroup.com/",
};

type ApiRow = Record<string, unknown>;

function pick(row: ApiRow, ...keys: string[]): unknown {
  for (const k of keys) {
    if (k in row) return row[k];
    const found = Object.keys(row).find((rk) => rk.toLowerCase() === k.toLowerCase());
    if (found) return row[found];
  }
  return undefined;
}

function parseNum(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number") return isFinite(v) ? v : null;
  const s = String(v).trim();
  if (!s || s === "-" || s.toUpperCase() === "N/A") return null;
  const neg = s.startsWith("(") && s.endsWith(")");
  const n = parseFloat(s.replace(/[(),\s]/g, "").replace(/,/g, ""));
  if (isNaN(n)) return null;
  return neg ? -n : n;
}

interface PriceRow {
  ticker: string; tradeDate: string;
  close: number; open: number | null; high: number | null; low: number | null;
  change: number | null; changePct: number | null;
  volume: number | null; value: number | null;
}

function parseRow(row: ApiRow, fallbackDate: string): PriceRow | null {
  const ticker = String(pick(row, "Symbol", "SYMBOL", "Ticker", "Code") ?? "")
    .replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (!ticker || ticker.length > 20) return null;

  const close = parseNum(pick(row, "ClosePrice", "ClosingPrice", "Close", "LastTradedPrice", "Value"));
  if (!close || close <= 0) return null;

  const rowDate = pick(row, "TradeDate", "Date", "TradingDate");
  const tradeDate = typeof rowDate === "string" ? rowDate.slice(0, 10) : fallbackDate;

  return {
    ticker, tradeDate, close,
    open:      parseNum(pick(row, "OpenPrice", "OpeningPrice", "Open")),
    high:      parseNum(pick(row, "HighPrice", "DayHigh", "High")),
    low:       parseNum(pick(row, "LowPrice", "DayLow", "Low")),
    change:    parseNum(pick(row, "Change", "PriceChange")),
    changePct: parseNum(pick(row, "PercChange", "PercentageChange", "ChangePct")),
    volume:    parseNum(pick(row, "Volume", "VolumeTraded")),
    value:     parseNum(pick(row, "Value", "Turnover", "TotalValue")),
  };
}

async function fetchRows(url: string, fallbackDate: string): Promise<PriceRow[] | null> {
  try {
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(25_000) });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("json")) return null;

    const json = await res.json() as unknown;
    const rows: ApiRow[] = Array.isArray(json)
      ? json
      : Array.isArray((json as Record<string, unknown>).value)
        ? (json as { value: ApiRow[] }).value
        : [];

    if (rows.length === 0) return null;

    // Use TradeDate from first row as the authoritative date for the batch
    const firstDate = pick(rows[0], "TradeDate", "Date");
    const tradeDate = typeof firstDate === "string" ? firstDate.slice(0, 10) : fallbackDate;

    return rows.flatMap((r) => { const p = parseRow(r, tradeDate); return p ? [p] : []; });
  } catch {
    return null;
  }
}

async function scrapeNGX() {
  const supabase = await createServiceClient();
  const today = new Date().toISOString().split("T")[0];

  // Try primary equities endpoint, then legacy fallback
  let rows = await fetchRows(NGX_EQUITIES_URL, today);
  if (!rows || rows.length === 0) {
    rows = await fetchRows(NGX_LEGACY_URL, today);
  }
  if (!rows || rows.length === 0) {
    return { updated: 0, message: "NGX doclib API returned no data — market may be closed" };
  }

  // Build a map of DB ticker → stock ID
  const { data: stocks } = await supabase.from("stocks").select("id, ticker").eq("is_active", true);
  const tickerMap = new Map(stocks?.map((s) => [s.ticker.toUpperCase(), s.id]) ?? []);

  // Index fetched rows by ticker for fast lookup
  const priceMap = new Map(rows.map((r) => [r.ticker, r]));

  let updated = 0;
  const tradeDate = rows[0].tradeDate;

  for (const [ticker, stockId] of Array.from(tickerMap)) {
    const row = priceMap.get(ticker);
    if (!row) continue;

    const { error } = await supabase.from("stock_prices").upsert({
      stock_id: stockId,
      price_date: row.tradeDate,
      closing_price: row.close,
      opening_price: row.open,
      high_price: row.high,
      low_price: row.low,
      volume: row.volume ?? 0,
      value: row.value,
      price_change: row.change,
      change_percent: row.changePct,
      scrape_source: "ngx_doclib",
    }, { onConflict: "stock_id,price_date" });

    if (!error) updated++;
  }

  await supabase.rpc("create_portfolio_snapshot", { p_date: tradeDate });

  return { updated, total_fetched: rows.length, trade_date: tradeDate };
}
