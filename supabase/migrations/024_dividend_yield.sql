-- EIG Platform — Feature: Dividend Yield Tracking
-- Migration 024
--
-- Adds:
--   1. equity_dividends — declared dividends for NGX stocks (ex-date, DPS)
--   2. v_dividend_yield — per-holding TTM yield + forward yield + annual income
--   3. v_portfolio_dividend_yield — weighted portfolio yield
--
-- Seed: GTCO and NGXGROUP FY2025 dividends derived from received cash
--   in the transactions table (admin should verify/correct ex-dates from NGX).

BEGIN;


-- ============================================================
-- 1. equity_dividends
--    Stores declared dividends for yield calculation.
--    Separate from the transactions table (which records cash receipts).
-- ============================================================
CREATE TABLE IF NOT EXISTS public.equity_dividends (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stock_id            UUID NOT NULL REFERENCES public.stocks(id) ON DELETE CASCADE,
  announcement_date   DATE,
  ex_date             DATE NOT NULL,
  pay_date            DATE,
  dividend_per_share  NUMERIC(18,6) NOT NULL CHECK (dividend_per_share > 0),
  currency            TEXT NOT NULL DEFAULT 'NGN',
  source              TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'ngx', 'itick', 'afx')),
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (stock_id, ex_date)
);

CREATE INDEX IF NOT EXISTS idx_eq_div_stock_date
  ON public.equity_dividends(stock_id, ex_date DESC);
CREATE INDEX IF NOT EXISTS idx_eq_div_ex_date
  ON public.equity_dividends(ex_date DESC);

ALTER TABLE public.equity_dividends ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view equity dividends"
  ON public.equity_dividends FOR SELECT USING (public.is_member());
CREATE POLICY "Admins can manage equity dividends"
  ON public.equity_dividends FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());


-- ============================================================
-- 2. Seed GTCO and NGXGROUP dividends from received amounts
--
-- GTCO Apr-26:  ₦141,582.17 received on 15,877 shares
-- NGXGROUP Apr-26: ₦6,930.00 received on 5,800 shares
--   (5,800 = post-mig022 6,510 − Jun-16 buy 710)
--
-- Ex-dates are approximate; admin should verify against NGX
-- corporate action notices and correct via the UI.
-- ============================================================
INSERT INTO public.equity_dividends
  (stock_id, announcement_date, ex_date, pay_date, dividend_per_share, source, notes)
SELECT
  s.id,
  '2026-03-12'::date,        -- approximate announcement date
  '2026-03-28'::date,        -- approximate ex-date
  '2026-04-14'::date,        -- approximate pay date
  ROUND(141582.17 / 15877.0, 4),  -- ₦8.9174/share approx
  'manual',
  'GTCO FY2025 final dividend — DPS derived from ₦141,582.17 received on 15,877 shares. Verify ex-date from NGX.'
FROM public.stocks s
WHERE s.ticker = 'GTCO'
ON CONFLICT (stock_id, ex_date) DO NOTHING;

INSERT INTO public.equity_dividends
  (stock_id, announcement_date, ex_date, pay_date, dividend_per_share, source, notes)
SELECT
  s.id,
  '2026-03-24'::date,
  '2026-04-07'::date,
  '2026-04-22'::date,
  ROUND(6930.00 / 5800.0, 4),  -- ₦1.1948/share approx
  'manual',
  'NGXGROUP FY2025 dividend — DPS derived from ₦6,930.00 received on 5,800 shares held pre-Jun-16. Verify ex-date from NGX.'
FROM public.stocks s
WHERE s.ticker = 'NGXGROUP'
ON CONFLICT (stock_id, ex_date) DO NOTHING;


-- ============================================================
-- 3. v_dividend_yield
--    Per-holding TTM yield, forward yield, and annual income.
--    TTM = trailing twelve months (ex-dates in last 365 days).
--    Forward = dividends declared but not yet paid.
-- ============================================================
CREATE OR REPLACE VIEW public.v_dividend_yield AS
WITH ttm AS (
  SELECT
    ed.stock_id,
    SUM(ed.dividend_per_share)                                             AS ttm_dps,
    SUM(ed.dividend_per_share)
      FILTER (WHERE ed.pay_date IS NULL OR ed.pay_date > CURRENT_DATE)    AS forward_dps,
    MAX(ed.ex_date)                                                        AS last_ex_date
  FROM public.equity_dividends ed
  WHERE ed.ex_date >= CURRENT_DATE - INTERVAL '12 months'
  GROUP BY ed.stock_id
)
SELECT
  h.id                                                              AS holding_id,
  s.id                                                              AS stock_id,
  s.ticker,
  s.company_name,
  s.sector,
  h.quantity,
  h.average_cost,
  h.total_cost,
  COALESCE(sp.closing_price, 0)                                     AS current_price,
  sp.price_date,
  h.quantity * COALESCE(sp.closing_price, 0)                        AS current_value,
  COALESCE(ttm.ttm_dps, 0)                                          AS ttm_dps,
  COALESCE(ttm.forward_dps, 0)                                      AS forward_dps,
  ttm.last_ex_date,
  -- Annual income EIG actually received (own shares × TTM DPS)
  COALESCE(ttm.ttm_dps, 0) * h.quantity                            AS annual_income,
  -- Trailing yield: TTM DPS ÷ current price
  CASE
    WHEN COALESCE(sp.closing_price, 0) > 0 AND COALESCE(ttm.ttm_dps, 0) > 0
    THEN ROUND(ttm.ttm_dps / sp.closing_price * 100, 4)
    ELSE 0
  END                                                               AS yield_pct,
  -- Forward yield: undeclared DPS ÷ current price
  CASE
    WHEN COALESCE(sp.closing_price, 0) > 0 AND COALESCE(ttm.forward_dps, 0) > 0
    THEN ROUND(ttm.forward_dps / sp.closing_price * 100, 4)
    ELSE 0
  END                                                               AS forward_yield_pct
FROM public.holdings h
JOIN public.stocks s ON s.id = h.stock_id
LEFT JOIN LATERAL (
  SELECT closing_price, price_date
  FROM public.stock_prices
  WHERE stock_id = h.stock_id
  ORDER BY price_date DESC LIMIT 1
) sp ON TRUE
LEFT JOIN ttm ON ttm.stock_id = h.stock_id
WHERE h.asset_type = 'stock';


-- ============================================================
-- 4. v_portfolio_dividend_yield
--    Weighted portfolio yield across all equity holdings.
-- ============================================================
CREATE OR REPLACE VIEW public.v_portfolio_dividend_yield AS
SELECT
  COALESCE(SUM(v.annual_income), 0)       AS total_annual_income,
  COALESCE(SUM(v.current_value), 0)       AS total_equity_value,
  CASE
    WHEN COALESCE(SUM(v.current_value), 0) > 0
    THEN ROUND(
           SUM(v.annual_income) / SUM(v.current_value) * 100,
           4
         )
    ELSE 0
  END                                      AS portfolio_yield_pct
FROM public.v_dividend_yield v;

COMMIT;
