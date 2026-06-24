import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const apiKey = process.env.SCRAPER_API_KEY;

  const hasValidApiKey = !!apiKey && authHeader === `Bearer ${apiKey}`;
  if (!hasValidApiKey) {
    const supabase = await createServiceClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { data: profile } = await supabase
      .from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }
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

// ── Source URLs ───────────────────────────────────────────────────────────────
// NGX Doclib (primary): pageSize=1000 returns all 146 equities incl. Premium Board
const NGX_EQUITIES_URL =
  "https://doclib.ngxgroup.com/REST/api/statistics/equities/" +
  "?market=&sector=&orderby=&pageSize=1000&pageNo=0";

// NGX legacy (second fallback): fewer stocks, misses Premium Board intraday
const NGX_LEGACY_URL =
  "https://doclib.ngxgroup.com/REST/api/statistics/ticker" +
  "?$filter=TickerType%20eq%20%27EQUITIES%27";

// AFX Kwayisi (third fallback): configure base URL via AFX_BASE_URL env var.
// The endpoint should return JSON with Symbol and ClosePrice fields.
// Leave AFX_BASE_URL unset to disable this fallback.
const AFX_BASE_URL = process.env.AFX_BASE_URL ?? "";
const AFX_API_KEY  = process.env.AFX_API_KEY  ?? "";

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
    if (k in row && row[k] != null) return row[k];
    const found = Object.keys(row).find(
      (rk) => rk.toLowerCase() === k.toLowerCase(),
    );
    if (found && row[found] != null) return row[found];
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
  ticker: string;
  tradeDate: string;
  close: number;
  open: number | null;
  high: number | null;
  low: number | null;
  change: number | null;
  changePct: number | null;
  volume: number | null;
  value: number | null;
  source: string;
}

function parseRow(
  row: ApiRow,
  fallbackDate: string,
  source: string,
): PriceRow | null {
  const ticker = String(
    pick(row, "Symbol", "SYMBOL", "Ticker", "Code") ?? "",
  )
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase();
  if (!ticker || ticker.length > 20) return null;

  const isLegacy = source === "ngx_legacy";
  const close = isLegacy
    ? parseNum(
        pick(
          row,
          "Value",
          "ClosePrice",
          "ClosingPrice",
          "Close",
          "LastTradedPrice",
        ),
      )
    : parseNum(
        pick(
          row,
          "ClosePrice",
          "ClosingPrice",
          "Close",
          "LastTradedPrice",
          "PrevClosingPrice",
          "OpeningPrice",
        ),
      );
  if (!close || close <= 0) return null;

  const rowDate = pick(row, "TradeDate", "Date", "TradingDate");
  const tradeDate =
    typeof rowDate === "string" ? rowDate.slice(0, 10) : fallbackDate;

  return {
    ticker,
    tradeDate,
    close,
    source,
    open: parseNum(pick(row, "OpeningPrice", "OpenPrice", "Open")),
    high: parseNum(pick(row, "HighPrice", "DayHigh", "High")),
    low: parseNum(pick(row, "LowPrice", "DayLow", "Low")),
    change: parseNum(pick(row, "Change", "PriceChange")),
    changePct: parseNum(pick(row, "PercChange", "PercentageChange", "ChangePct")),
    volume: parseNum(pick(row, "Volume", "VolumeTraded")),
    value: isLegacy
      ? null
      : parseNum(pick(row, "Value", "Turnover", "TotalValue")),
  };
}

async function fetchRows(
  url: string,
  fallbackDate: string,
  source: string,
  extraHeaders?: Record<string, string>,
): Promise<PriceRow[] | null> {
  try {
    const res = await fetch(url, {
      headers: { ...HEADERS, ...extraHeaders },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("json")) return null;

    const json = (await res.json()) as unknown;
    const rows: ApiRow[] = Array.isArray(json)
      ? json
      : Array.isArray((json as Record<string, unknown>).value)
        ? (json as { value: ApiRow[] }).value
        : Array.isArray((json as Record<string, unknown>).data)
          ? (json as { data: ApiRow[] }).data
          : [];

    if (rows.length === 0) return null;

    const firstDate = pick(rows[0], "TradeDate", "Date");
    const tradeDate =
      typeof firstDate === "string" ? firstDate.slice(0, 10) : fallbackDate;

    return rows.flatMap((r) => {
      const p = parseRow(r, tradeDate, source);
      return p ? [p] : [];
    });
  } catch {
    return null;
  }
}

async function scrapeNGX() {
  const supabase = await createServiceClient();
  const today = new Date().toISOString().split("T")[0];

  // ── 1. Fetch prices (NGX Doclib → NGX Legacy → AFX Kwayisi) ──────────────
  let rows = await fetchRows(NGX_EQUITIES_URL, today, "ngx_doclib");

  if (!rows || rows.length === 0) {
    rows = await fetchRows(NGX_LEGACY_URL, today, "ngx_legacy");
  }

  if ((!rows || rows.length === 0) && AFX_BASE_URL) {
    const afxHeaders: Record<string, string> = AFX_API_KEY
      ? { Authorization: `Bearer ${AFX_API_KEY}` }
      : {};
    rows = await fetchRows(AFX_BASE_URL, today, "afx_kwayisi", afxHeaders);
  }

  if (!rows || rows.length === 0) {
    return {
      updated: 0,
      message:
        "All price sources returned no data — market may be closed or all feeds are down",
    };
  }

  const priceMap = new Map(rows.map((r) => [r.ticker, r]));

  // ── 2. Build DB ticker → stock ID map ────────────────────────────────────
  const { data: stocks } = await supabase
    .from("stocks")
    .select("id, ticker")
    .eq("is_active", true);
  const tickerMap = new Map(
    stocks?.map((s) => [s.ticker.toUpperCase(), s.id]) ?? [],
  );

  const tradeDate = rows[0].tradeDate;
  let updated = 0;
  const skipped: string[] = [];
  const staleMarked: string[] = [];

  // ── 3. Upsert prices for tickers that appeared in the feed ───────────────
  for (const [ticker, stockId] of Array.from(tickerMap)) {
    const row = priceMap.get(ticker);
    if (!row) {
      skipped.push(ticker);
      continue;
    }

    const { error } = await supabase.from("stock_prices").upsert(
      {
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
        scrape_source: row.source,
        is_stale: false,
        fetched_at: new Date().toISOString(),
      },
      { onConflict: "stock_id,price_date" },
    );

    if (!error) updated++;
  }

  // ── 4. Flag stale prices: carry last known price forward for missed tickers ─
  // For each tracked ticker that NGX didn't return today, insert a stale copy
  // of the most recent price so holdings value stays populated.
  if (skipped.length > 0) {
    for (const ticker of skipped) {
      const stockId = tickerMap.get(ticker);
      if (!stockId) continue;

      const { data: lastPrice } = await supabase
        .from("stock_prices")
        .select("closing_price, opening_price, high_price, low_price, scrape_source")
        .eq("stock_id", stockId)
        .order("price_date", { ascending: false })
        .limit(1)
        .single();

      if (!lastPrice) continue;

      const { error } = await supabase.from("stock_prices").upsert(
        {
          stock_id: stockId,
          price_date: tradeDate,
          closing_price: lastPrice.closing_price,
          opening_price: lastPrice.opening_price,
          high_price: lastPrice.high_price,
          low_price: lastPrice.low_price,
          volume: 0,
          scrape_source: lastPrice.scrape_source,
          is_stale: true,
          fetched_at: new Date().toISOString(),
        },
        { onConflict: "stock_id,price_date" },
      );

      if (!error) staleMarked.push(ticker);
    }
  }

  // ── 5. Compute and persist today's fund NAV ────────────────────────────────
  await supabase.rpc("compute_and_save_fund_nav", { p_date: tradeDate });

  // ── 6. Price any contributions that can now be priced ─────────────────────
  await supabase.rpc("price_unpriced_contributions");

  // ── 7. Snapshot portfolio value ───────────────────────────────────────────
  await supabase.rpc("create_portfolio_snapshot", { p_date: tradeDate });

  return {
    updated,
    total_fetched: rows.length,
    trade_date: tradeDate,
    skipped: skipped.filter((t) => !staleMarked.includes(t)),
    stale_carried_forward: staleMarked,
    all_tickers: Array.from(priceMap.keys()).sort(),
  };
}
