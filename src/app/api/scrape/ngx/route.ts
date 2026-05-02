import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  // Validate API key for internal or cron-triggered calls
  const authHeader = request.headers.get("authorization");
  const apiKey = process.env.SCRAPER_API_KEY;

  // Allow admin users from the UI (cookie-based auth) or valid API key
  if (apiKey && authHeader !== `Bearer ${apiKey}`) {
    const supabase = await createServiceClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }
  }

  try {
    const gcpEndpoint = process.env.GCP_SCRAPER_ENDPOINT;

    if (gcpEndpoint) {
      // Forward to GCP Cloud Function
      const response = await fetch(gcpEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ trigger: "manual" }),
      });
      const data = await response.json();
      return NextResponse.json(data, { status: response.status });
    }

    // Fallback: inline scrape (for dev/testing)
    const result = await scrapeNGXInline();
    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error("NGX scrape error:", err);
    return NextResponse.json({ error: "Scrape failed", detail: String(err) }, { status: 500 });
  }
}

// Inline scraper for development (the Python scraper handles production)
async function scrapeNGXInline() {
  const supabase = await createServiceClient();

  // Fetch NGX equity price list
  const url = "https://ngxgroup.com/exchange/data/equities-price-list/";
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; EIG-Scraper/1.0; +https://equityinvestmentgroup.club)",
    },
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    throw new Error(`NGX returned ${response.status}`);
  }

  const html = await response.text();

  // Parse table rows — NGX page has a table with class "table"
  const rows = extractTableRows(html);
  if (rows.length === 0) {
    return { updated: 0, message: "No data extracted — page structure may have changed" };
  }

  const today = new Date().toISOString().split("T")[0];
  let updated = 0;

  // Fetch all stock tickers to map
  const { data: stocks } = await supabase.from("stocks").select("id, ticker");
  const tickerMap = new Map(stocks?.map((s) => [s.ticker.toUpperCase(), s.id]) ?? []);

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
      scrape_source: "ngx_inline",
    }, { onConflict: "stock_id,price_date" });

    if (!error) updated++;
  }

  // Create portfolio snapshot after price update
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

function extractTableRows(html: string): PriceRow[] {
  const rows: PriceRow[] = [];

  // Regex-based extraction (works without a DOM parser in Node)
  // NGX table columns: Symbol | Open | High | Low | Close | Change | %Change | Volume | Value | Trades
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;

  let trMatch;
  while ((trMatch = trRegex.exec(html)) !== null) {
    const rowHtml = trMatch[1];
    const cells: string[] = [];
    let tdMatch;
    while ((tdMatch = tdRegex.exec(rowHtml)) !== null) {
      cells.push(tdMatch[1].replace(/<[^>]+>/g, "").trim());
    }

    if (cells.length < 5) continue;
    const ticker = cells[0];
    if (!ticker || !/^[A-Z]+/.test(ticker)) continue;

    const open = parseNum(cells[1]);
    const high = parseNum(cells[2]);
    const low = parseNum(cells[3]);
    const close = parseNum(cells[4]);

    if (!close || close <= 0) continue;

    rows.push({
      ticker,
      open,
      high,
      low,
      close,
      change: parseNum(cells[5]),
      changePct: parseNum(cells[6]),
      volume: parseNum(cells[7]),
      value: parseNum(cells[8]),
    });
  }

  return rows;
}

function parseNum(s: string | undefined): number | undefined {
  if (!s) return undefined;
  const clean = s.replace(/,/g, "").replace(/[^0-9.\-]/g, "");
  const n = parseFloat(clean);
  return isNaN(n) ? undefined : n;
}
