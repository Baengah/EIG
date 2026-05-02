"""
NGX Exchange Price Scraper — GCP Cloud Function
Deployed as a Cloud Function (Gen 2) triggered by Cloud Scheduler at 18:00 WAT daily.
Scrapes closing prices from NGX and upserts into Supabase stock_prices table.
"""

import os
import json
import logging
import time
from datetime import datetime, date
from typing import Optional
import re

import requests
from bs4 import BeautifulSoup
from supabase import create_client, Client
import functions_framework
import pytz

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

WAT = pytz.timezone("Africa/Lagos")

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
SCRAPER_API_KEY = os.environ.get("SCRAPER_API_KEY", "")

NGX_PRICE_URL = "https://ngxgroup.com/exchange/data/equities-price-list/"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://ngxgroup.com/",
}


def parse_number(value: str) -> Optional[float]:
    """Parse numeric string, handling commas and empty values."""
    if not value:
        return None
    cleaned = re.sub(r"[^\d.\-]", "", value.replace(",", ""))
    try:
        return float(cleaned)
    except ValueError:
        return None


def fetch_ngx_prices() -> list[dict]:
    """
    Fetch and parse equity prices from NGX website.
    Returns list of dicts with keys: ticker, open, high, low, close,
    change, change_pct, volume, value, trades
    """
    logger.info(f"Fetching prices from {NGX_PRICE_URL}")

    try:
        session = requests.Session()
        # First request to get any session cookies
        session.get("https://ngxgroup.com", headers=HEADERS, timeout=30)
        time.sleep(1)

        response = session.get(NGX_PRICE_URL, headers=HEADERS, timeout=60)
        response.raise_for_status()
    except requests.RequestException as e:
        logger.error(f"Failed to fetch NGX page: {e}")
        raise

    soup = BeautifulSoup(response.text, "html.parser")

    # Try multiple table selectors (NGX site structure may vary)
    table = (
        soup.find("table", {"id": "equityPriceList"})
        or soup.find("table", {"class": lambda c: c and "price" in c.lower()})
        or soup.find("table", {"class": "table"})
        or soup.find("table")
    )

    if not table:
        logger.warning("No table found on NGX page — attempting JSON fallback")
        return fetch_ngx_prices_fallback()

    rows = []
    tbody = table.find("tbody") or table
    for tr in tbody.find_all("tr"):
        cells = [td.get_text(strip=True) for td in tr.find_all("td")]
        if len(cells) < 5:
            continue

        # Expected columns: Symbol, Open, High, Low, Close, Change, %Change, Volume, Value, Trades
        ticker = cells[0].strip().upper()
        if not ticker or not re.match(r"^[A-Z]", ticker):
            continue

        close = parse_number(cells[4] if len(cells) > 4 else cells[-1])
        if not close or close <= 0:
            continue

        rows.append({
            "ticker": ticker,
            "open": parse_number(cells[1]) if len(cells) > 1 else None,
            "high": parse_number(cells[2]) if len(cells) > 2 else None,
            "low": parse_number(cells[3]) if len(cells) > 3 else None,
            "close": close,
            "change": parse_number(cells[5]) if len(cells) > 5 else None,
            "change_pct": parse_number(cells[6]) if len(cells) > 6 else None,
            "volume": int(parse_number(cells[7]) or 0) if len(cells) > 7 else 0,
            "value": parse_number(cells[8]) if len(cells) > 8 else None,
            "trades": int(parse_number(cells[9]) or 0) if len(cells) > 9 else None,
        })

    logger.info(f"Parsed {len(rows)} equity price rows from NGX")
    return rows


def fetch_ngx_prices_fallback() -> list[dict]:
    """
    Fallback: Try NGX API endpoint (if available) or alternative data source.
    The NGX sometimes exposes data via a JSON endpoint.
    """
    fallback_urls = [
        "https://ngxgroup.com/wp-json/ngx/v1/equities",
        "https://api.ngxgroup.com/equities/prices",
    ]

    for url in fallback_urls:
        try:
            resp = requests.get(url, headers=HEADERS, timeout=30)
            if resp.ok:
                data = resp.json()
                if isinstance(data, list) and data:
                    logger.info(f"Got {len(data)} records from fallback API: {url}")
                    return [
                        {
                            "ticker": item.get("symbol") or item.get("ticker", ""),
                            "open": item.get("open"),
                            "high": item.get("high"),
                            "low": item.get("low"),
                            "close": item.get("close") or item.get("lastPrice"),
                            "change": item.get("change"),
                            "change_pct": item.get("changePercent") or item.get("pctChange"),
                            "volume": int(item.get("volume") or 0),
                            "value": item.get("value"),
                            "trades": item.get("trades"),
                        }
                        for item in data
                        if item.get("symbol") or item.get("ticker")
                    ]
        except Exception as e:
            logger.warning(f"Fallback {url} failed: {e}")

    return []


def upsert_prices(supabase: Client, prices: list[dict], price_date: str) -> int:
    """Upsert price records into Supabase. Returns count of updated records."""
    if not prices:
        return 0

    # Fetch all stock tickers from DB
    result = supabase.table("stocks").select("id, ticker").execute()
    ticker_map = {s["ticker"].upper(): s["id"] for s in (result.data or [])}

    records = []
    skipped = 0
    for p in prices:
        stock_id = ticker_map.get(p["ticker"].upper())
        if not stock_id:
            skipped += 1
            continue

        records.append({
            "stock_id": stock_id,
            "price_date": price_date,
            "opening_price": p.get("open"),
            "high_price": p.get("high"),
            "low_price": p.get("low"),
            "closing_price": p["close"],
            "volume": p.get("volume") or 0,
            "value": p.get("value"),
            "trades": p.get("trades"),
            "price_change": p.get("change"),
            "change_percent": p.get("change_pct"),
            "scrape_source": "ngx",
        })

    if not records:
        logger.warning(f"No matching tickers. Skipped {skipped}/{len(prices)} rows.")
        return 0

    # Batch upsert in chunks of 100
    updated = 0
    chunk_size = 100
    for i in range(0, len(records), chunk_size):
        chunk = records[i : i + chunk_size]
        result = supabase.table("stock_prices").upsert(
            chunk, on_conflict="stock_id,price_date"
        ).execute()
        updated += len(result.data or [])

    logger.info(f"Upserted {updated} price records (skipped {skipped} unknown tickers)")
    return updated


def create_snapshot(supabase: Client, price_date: str) -> None:
    """Trigger portfolio snapshot creation after price update."""
    try:
        supabase.rpc("create_portfolio_snapshot", {"p_date": price_date}).execute()
        logger.info(f"Portfolio snapshot created for {price_date}")
    except Exception as e:
        logger.warning(f"Failed to create portfolio snapshot: {e}")


@functions_framework.http
def ngx_scraper(request):
    """
    GCP Cloud Function entry point.
    Accepts HTTP POST from Cloud Scheduler or manual trigger.
    """
    # Validate API key
    auth = request.headers.get("Authorization", "")
    if SCRAPER_API_KEY and auth != f"Bearer {SCRAPER_API_KEY}":
        return (json.dumps({"error": "Unauthorized"}), 401, {"Content-Type": "application/json"})

    now_wat = datetime.now(WAT)
    price_date = now_wat.strftime("%Y-%m-%d")

    # Skip weekends (NGX is closed)
    if now_wat.weekday() in (5, 6):
        msg = f"NGX closed on weekends. Skipping {price_date}."
        logger.info(msg)
        return (json.dumps({"skipped": True, "reason": msg}), 200, {"Content-Type": "application/json"})

    # Skip known public holidays (extend list as needed)
    holidays_2025 = {
        "2025-01-01", "2025-04-18", "2025-04-21", "2025-04-28",
        "2025-05-01", "2025-05-29", "2025-06-12", "2025-10-01",
        "2025-12-25", "2025-12-26",
    }
    if price_date in holidays_2025:
        msg = f"NGX closed (public holiday). Skipping {price_date}."
        logger.info(msg)
        return (json.dumps({"skipped": True, "reason": msg}), 200, {"Content-Type": "application/json"})

    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
        prices = fetch_ngx_prices()

        if not prices:
            return (
                json.dumps({"error": "No prices fetched", "date": price_date}),
                200,
                {"Content-Type": "application/json"},
            )

        updated = upsert_prices(supabase, prices, price_date)
        create_snapshot(supabase, price_date)

        result = {
            "success": True,
            "date": price_date,
            "prices_fetched": len(prices),
            "updated": updated,
            "timestamp": datetime.now(WAT).isoformat(),
        }
        logger.info(f"Scrape complete: {result}")
        return (json.dumps(result), 200, {"Content-Type": "application/json"})

    except Exception as e:
        logger.error(f"Scraper failed: {e}", exc_info=True)
        return (
            json.dumps({"error": str(e), "date": price_date}),
            500,
            {"Content-Type": "application/json"},
        )


if __name__ == "__main__":
    # Local test run
    import sys
    logging.basicConfig(level=logging.DEBUG)

    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    today = date.today().isoformat()

    prices = fetch_ngx_prices()
    print(f"Fetched {len(prices)} prices")
    if prices:
        print("Sample:", prices[:3])
        updated = upsert_prices(supabase, prices, today)
        print(f"Updated {updated} records")
