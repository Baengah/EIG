-- EIG Platform — Correct stocks, holdings, and seed prices
-- Source: CHD portfolio statement as of 02-Apr-2026
-- Run in Supabase SQL Editor after migrations 005 and 006.

-- ============================================================
-- STEP 1: Upsert the 8 EIG portfolio stocks
-- ============================================================
INSERT INTO public.stocks (ticker, company_name, sector, market_cap_category, is_active)
VALUES
  ('ACCESSCORP', 'Access Holdings Plc',              'Banking & Finance',  'large',  TRUE),
  ('ARADEL',     'Aradel Holdings Plc',              'Oil & Gas',          'large',  TRUE),
  ('FCMB',       'FCMB Group Plc',                   'Banking & Finance',  'medium', TRUE),
  ('GTCO',       'Guaranty Trust Holding Company',   'Banking & Finance',  'large',  TRUE),
  ('MTNN',       'MTN Nigeria Communications Plc',   'Telecommunications', 'large',  TRUE),
  ('NGXGROUP',   'Nigerian Exchange Group Plc',      'Financial Services', 'medium', TRUE),
  ('PRESCO',     'Presco Plc',                       'Agriculture',        'medium', TRUE),
  ('ZENITHBANK', 'Zenith Bank Plc',                  'Banking & Finance',  'large',  TRUE)
ON CONFLICT (ticker) DO UPDATE SET
  company_name       = EXCLUDED.company_name,
  sector             = EXCLUDED.sector,
  market_cap_category = EXCLUDED.market_cap_category,
  is_active          = TRUE,
  updated_at         = NOW();

-- Also ensure the dividend tickers used in migration 006 exist
-- (ZENITH → ZENITHBANK alias handled above; ZENITH kept for legacy compat)
INSERT INTO public.stocks (ticker, company_name, sector, market_cap_category, is_active)
VALUES ('ZENITH', 'Zenith Bank Plc', 'Banking & Finance', 'large', TRUE)
ON CONFLICT (ticker) DO NOTHING;


-- ============================================================
-- STEP 2: Upsert holdings from CHD statement (02-Apr-2026)
-- Linked to the primary CHD broker account.
-- ============================================================
DO $$
DECLARE v_broker_id UUID;
BEGIN
  -- Find the CHD broker account
  SELECT id INTO v_broker_id
  FROM public.broker_accounts
  WHERE broker_name ILIKE '%chapel hill%' OR broker_name ILIKE '%chd%'
  LIMIT 1;

  IF v_broker_id IS NULL THEN
    RAISE EXCEPTION 'Chapel Hill Denham broker account not found — add it in Settings first';
  END IF;

  -- Upsert each holding (DELETE + INSERT pattern to replace stale data)
  -- We delete only holdings for these specific stocks to avoid wiping unrelated data
  DELETE FROM public.holdings
  WHERE broker_account_id = v_broker_id
    AND asset_type = 'stock'
    AND stock_id IN (SELECT id FROM public.stocks WHERE ticker IN (
      'ACCESSCORP','ARADEL','FCMB','GTCO','MTNN','NGXGROUP','PRESCO','ZENITHBANK'
    ));

  INSERT INTO public.holdings (asset_type, stock_id, broker_account_id, quantity, average_cost)
  SELECT 'stock', s.id, v_broker_id, v.qty, v.avg_cost
  FROM (
    VALUES
      ('ACCESSCORP',  7600.0,    26.4263),
      ('ARADEL',      1753.0,   867.8176),
      ('FCMB',       50000.0,    10.0000),
      ('GTCO',       13377.0,    95.0774),
      ('MTNN',        5339.0,   532.3462),
      ('NGXGROUP',    3850.0,   159.6592),
      ('PRESCO',       713.0,  1501.0646),
      ('ZENITHBANK', 40083.0,    70.3304)
  ) AS v(ticker, qty, avg_cost)
  JOIN public.stocks s ON s.ticker = v.ticker;
END $$;


-- ============================================================
-- STEP 3: Seed stock prices as of 02-Apr-2026 (from screenshot)
-- The daily scraper will overwrite these with fresher prices.
-- ============================================================
INSERT INTO public.stock_prices (stock_id, price_date, closing_price, scrape_source)
SELECT s.id, '2026-04-02'::date, v.price, 'manual_seed'
FROM (
  VALUES
    ('ACCESSCORP',   25.9500),
    ('ARADEL',     1260.0000),
    ('FCMB',         12.0000),
    ('GTCO',        122.0000),
    ('MTNN',        760.0000),
    ('NGXGROUP',    165.0000),
    ('PRESCO',     1980.0000),
    ('ZENITHBANK',  103.0000)
) AS v(ticker, price)
JOIN public.stocks s ON s.ticker = v.ticker
ON CONFLICT (stock_id, price_date) DO UPDATE SET
  closing_price = EXCLUDED.closing_price,
  scrape_source = EXCLUDED.scrape_source;

-- Refresh the portfolio snapshot for Apr 2
SELECT public.create_portfolio_snapshot('2026-04-02'::date);
