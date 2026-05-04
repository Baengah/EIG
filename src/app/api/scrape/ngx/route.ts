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

    const result = await scrapeYahooFinance();
    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error("Price scrape error:", err);
    return NextResponse.json({ error: "Scrape failed", detail: String(err) }, { status: 500 });
  }
}

// Yahoo Finance covers NGX stocks with the .LG suffix (Lagos Stock Exchange)
// This is free, reliable, and doesn't require scraping JavaScript-rendered pages.
async function scrapeYahooFinance() {
  const supabase = await createServiceClient();

  // Fetch all stocks from DB and build Yahoo Finance symbol list
  const { data: stocks } = await supabase.from("stocks").select("id, ticker").eq("is_active", true);
  if (!stocks?.length) return { updated: 0, message: "No active stocks in database" };

  // Map DB ticker → Yahoo Finance symbol (append .LG for NGX)
  const symbols = stocks.map((s) => `${s.ticker}.LG`).join(",");
  const tickerToId = new Map(stocks.map((s) => [s.ticker.toUpperCase(), s.id]));

  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols}&fields=regularMarketPrice,regularMarketOpen,regularMarketDayHigh,regularMarketDayLow,regularMarketVolume,regularMarketChange,regularMarketChangePercent`;

  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; EIG-PriceFetcher/1.0)",
      "Accept": "application/json",
    },
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) throw new Error(`Yahoo Finance returned HTTP ${response.status}`);

  const json = await response.json() as YahooResponse;
  const quotes = json?.quoteResponse?.result ?? [];

  if (quotes.length === 0) {
    return { updated: 0, message: "Yahoo Finance returned no quotes", symbols };
  }

  const today = new Date().toISOString().split("T")[0];
  let updated = 0;
  const skipped: string[] = [];

  for (const quote of quotes) {
    // Strip .LG suffix to get the DB ticker
    const ticker = quote.symbol.replace(/\.LG$/i, "").toUpperCase();
    const stockId = tickerToId.get(ticker);
    if (!stockId) { skipped.push(ticker); continue; }

    const close = quote.regularMarketPrice;
    if (!close || close <= 0) { skipped.push(ticker); continue; }

    const { error } = await supabase.from("stock_prices").upsert({
      stock_id: stockId,
      price_date: today,
      closing_price: close,
      opening_price: quote.regularMarketOpen ?? null,
      high_price: quote.regularMarketDayHigh ?? null,
      low_price: quote.regularMarketDayLow ?? null,
      volume: quote.regularMarketVolume ?? 0,
      price_change: quote.regularMarketChange ?? null,
      change_percent: quote.regularMarketChangePercent ?? null,
      scrape_source: "yahoo_finance",
    }, { onConflict: "stock_id,price_date" });

    if (!error) updated++;
  }

  await supabase.rpc("create_portfolio_snapshot", { p_date: today });

  return { updated, total_quotes: quotes.length, skipped, date: today };
}

interface YahooQuote {
  symbol: string;
  regularMarketPrice: number;
  regularMarketOpen?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  regularMarketVolume?: number;
  regularMarketChange?: number;
  regularMarketChangePercent?: number;
}

interface YahooResponse {
  quoteResponse?: {
    result?: YahooQuote[];
  };
}
