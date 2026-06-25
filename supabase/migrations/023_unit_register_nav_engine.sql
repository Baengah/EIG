-- EIG Platform — Feature: Fund Unitisation & NAV Engine
-- Migration 023
--
-- Adds:
--   1. cash_balance column to bank_accounts (mirrors broker_accounts)
--   2. is_stale + fetched_at columns to stock_prices
--   3. ngx_holidays — NGX trading calendar (weekdays only minus holidays)
--   4. mutual_fund_valuations — manual CHD MMF / Paramount book values
--   5. fund_nav — EIG fund NAV history (one row per dealing day)
--   6. unit_transactions — immutable unit ledger (source of truth for ownership)
--   7. v_member_unit_balances — derived ownership view
--   8. is_ngx_trading_day() helper function
--   9. latest_nav_date_on_or_before() helper function
--  10. compute_and_save_fund_nav() — computes and persists daily NAV
--  11. price_unpriced_contributions() — batch-issues units for unpriced contributions
--
-- Seed data:
--   • 31-May-2026 baseline NAV: ₦100/unit, 151,021.98 units in issue
--   • Baseline unit_transactions (one per member, proportional to contributions)
--   • CHD MMF and Paramount values from v5 PDF (16-Jun-2026)
--   • Known NGX public holidays 2025-2026

BEGIN;


-- ============================================================
-- 1. bank_accounts — add cash_balance (same pattern as broker_accounts)
-- ============================================================
ALTER TABLE public.bank_accounts
  ADD COLUMN IF NOT EXISTS cash_balance NUMERIC(14,2) NOT NULL DEFAULT 0;


-- ============================================================
-- 2. stock_prices — add stale-price tracking columns
-- ============================================================
ALTER TABLE public.stock_prices
  ADD COLUMN IF NOT EXISTS is_stale BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS fetched_at TIMESTAMPTZ DEFAULT NOW();


-- ============================================================
-- 3. ngx_holidays — NGX market closure dates (weekends implicit)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ngx_holidays (
  holiday_date  DATE PRIMARY KEY,
  description   TEXT
);

ALTER TABLE public.ngx_holidays ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view ngx holidays"
  ON public.ngx_holidays FOR SELECT USING (public.is_member());
CREATE POLICY "Admins can manage ngx holidays"
  ON public.ngx_holidays FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Seed known NGX public holidays 2025-2026
INSERT INTO public.ngx_holidays (holiday_date, description) VALUES
  ('2025-01-01', 'New Year''s Day'),
  ('2025-03-18', 'Eid al-Fitr Day 1 (2025)'),
  ('2025-03-19', 'Eid al-Fitr Day 2 (2025)'),
  ('2025-04-18', 'Good Friday'),
  ('2025-04-21', 'Easter Monday'),
  ('2025-05-01', 'Workers'' Day'),
  ('2025-06-06', 'Eid el-Kabir Day 1 (2025)'),
  ('2025-06-09', 'Eid el-Kabir Day 2 (2025)'),
  ('2025-06-12', 'Democracy Day'),
  ('2025-08-15', 'Eid Mawlid (2025)'),
  ('2025-10-01', 'Independence Day'),
  ('2025-12-25', 'Christmas Day'),
  ('2025-12-26', 'Boxing Day'),
  ('2026-01-01', 'New Year''s Day'),
  ('2026-03-20', 'Eid al-Fitr Day 1 (2026)'),
  ('2026-04-03', 'Good Friday'),
  ('2026-04-06', 'Easter Monday'),
  ('2026-05-01', 'Workers'' Day'),
  ('2026-05-27', 'Eid el-Kabir Day 1 (2026)'),
  ('2026-05-28', 'Eid el-Kabir Day 2 (2026)'),
  ('2026-06-12', 'Democracy Day'),
  ('2026-10-01', 'Independence Day'),
  ('2026-12-25', 'Christmas Day'),
  ('2026-12-26', 'Boxing Day')
ON CONFLICT (holiday_date) DO NOTHING;


-- ============================================================
-- 4. mutual_fund_valuations — CHD MMF / Paramount book values
--    Admin enters these manually from CHD monthly statements
-- ============================================================
CREATE TABLE IF NOT EXISTS public.mutual_fund_valuations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fund_name       TEXT NOT NULL,
  valuation_date  DATE NOT NULL,
  value           NUMERIC(18,2) NOT NULL,
  source          TEXT NOT NULL DEFAULT 'manual',
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (fund_name, valuation_date)
);

CREATE INDEX IF NOT EXISTS idx_mfv_fund_date
  ON public.mutual_fund_valuations(fund_name, valuation_date DESC);

ALTER TABLE public.mutual_fund_valuations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view fund valuations"
  ON public.mutual_fund_valuations FOR SELECT USING (public.is_member());
CREATE POLICY "Admins can manage fund valuations"
  ON public.mutual_fund_valuations FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Seed CHD values from EIG_Consolidated_Ledger_5.pdf (16-Jun-2026)
INSERT INTO public.mutual_fund_valuations (fund_name, valuation_date, value, notes)
VALUES
  ('CHD Money Market Fund', '2026-06-16', 214542.64,
   'From EIG_Consolidated_Ledger_5.pdf (18-Jun-2026)'),
  ('CHD Paramount Fund',    '2026-06-16', 709934.66,
   'From EIG_Consolidated_Ledger_5.pdf (18-Jun-2026)')
ON CONFLICT (fund_name, valuation_date) DO NOTHING;


-- ============================================================
-- 5. fund_nav — EIG fund's own NAV (one row per dealing day)
--    Distinct from fund_nav_history which tracks third-party fund NAVs
-- ============================================================
CREATE TABLE IF NOT EXISTS public.fund_nav (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nav_date            DATE NOT NULL UNIQUE,
  total_fund_value    NUMERIC(18,2) NOT NULL,
  units_in_issue      NUMERIC(18,4) NOT NULL,
  nav_per_unit        NUMERIC(18,6) NOT NULL,
  -- Component breakdown
  stock_equity_value  NUMERIC(18,2) NOT NULL DEFAULT 0,
  mmf_value           NUMERIC(18,2) NOT NULL DEFAULT 0,
  paramount_value     NUMERIC(18,2) NOT NULL DEFAULT 0,
  cash_at_bank        NUMERIC(18,2) NOT NULL DEFAULT 0,
  cash_at_broker      NUMERIC(18,2) NOT NULL DEFAULT 0,
  liabilities         NUMERIC(18,2) NOT NULL DEFAULT 0,
  source              TEXT NOT NULL DEFAULT 'calculated'
    CHECK (source IN ('baseline', 'calculated', 'manual')),
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fund_nav_date ON public.fund_nav(nav_date DESC);

ALTER TABLE public.fund_nav ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view fund nav"
  ON public.fund_nav FOR SELECT USING (public.is_member());
CREATE POLICY "Admins can manage fund nav"
  ON public.fund_nav FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Seed 31-May-2026 baseline NAV
-- Total fund value = 151,021.98 units × ₦100 par = ₦15,102,198.00
INSERT INTO public.fund_nav (
  nav_date, total_fund_value, units_in_issue, nav_per_unit, source, notes
) VALUES (
  '2026-05-31',
  15102198.00,
  151021.9800,
  100.000000,
  'baseline',
  'Par conversion — 151,021.98 units at ₦100/unit per EIG_Consolidated_Ledger_5.pdf'
)
ON CONFLICT (nav_date) DO NOTHING;


-- ============================================================
-- 6. unit_transactions — immutable unit ledger
--    Source of truth for all member unit balances.
--    Append-only. running_balance records the system balance at
--    insertion time; v_member_unit_balances recomputes from scratch.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.unit_transactions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  txn_date        DATE NOT NULL,
  member_id       UUID NOT NULL REFERENCES public.members(id) ON DELETE RESTRICT,
  txn_type        TEXT NOT NULL CHECK (txn_type IN ('baseline', 'issue', 'redeem')),
  -- positive cash_amount = contribution/in, negative = redemption/out
  cash_amount     NUMERIC(14,2) NOT NULL,
  nav_per_unit    NUMERIC(18,6) NOT NULL,
  -- positive units = issued, negative = redeemed
  units           NUMERIC(18,4) NOT NULL,
  -- running_balance at time of insertion (for audit); view is authoritative
  running_balance NUMERIC(18,4) NOT NULL,
  source_id       UUID REFERENCES public.member_contributions(id),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_unit_txns_member_date
  ON public.unit_transactions(member_id, txn_date);
CREATE INDEX IF NOT EXISTS idx_unit_txns_date
  ON public.unit_transactions(txn_date DESC);
CREATE INDEX IF NOT EXISTS idx_unit_txns_source
  ON public.unit_transactions(source_id);

ALTER TABLE public.unit_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view unit transactions"
  ON public.unit_transactions FOR SELECT USING (public.is_member());
CREATE POLICY "Admins can manage unit transactions"
  ON public.unit_transactions FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Seed baseline unit_transactions (one per member, proportional to contributions ≤ 31-May-2026)
-- units = total_contributions / ₦100 par
INSERT INTO public.unit_transactions (
  txn_date, member_id, txn_type, cash_amount, nav_per_unit, units, running_balance, notes
)
SELECT
  '2026-05-31'::date,
  mc.member_id,
  'baseline',
  ROUND(SUM(mc.amount)::numeric, 2),
  100.000000,
  ROUND(SUM(mc.amount)::numeric / 100.0, 4),
  ROUND(SUM(mc.amount)::numeric / 100.0, 4),
  'Opening unit balance at par ₦100/unit — 31-May-2026 baseline conversion'
FROM public.member_contributions mc
WHERE mc.contribution_date <= '2026-05-31'
GROUP BY mc.member_id
ON CONFLICT DO NOTHING;


-- ============================================================
-- 7. v_member_unit_balances — live ownership derived from ledger
--    Ownership % always sums to 100% (computes live total).
-- ============================================================
CREATE OR REPLACE VIEW public.v_member_unit_balances AS
WITH live_totals AS (
  SELECT
    COALESCE(SUM(units), 0)       AS total_units_in_issue,
    COALESCE(SUM(cash_amount), 0) AS total_invested
  FROM public.unit_transactions
),
latest_nav AS (
  SELECT nav_per_unit
  FROM public.fund_nav
  ORDER BY nav_date DESC
  LIMIT 1
),
member_units AS (
  SELECT
    member_id,
    COALESCE(SUM(units), 0)       AS units_held,
    COALESCE(SUM(cash_amount), 0) AS total_invested
  FROM public.unit_transactions
  GROUP BY member_id
)
SELECT
  m.id                                                AS member_id,
  m.member_number,
  m.full_name,
  m.email,
  COALESCE(mu.units_held, 0)                          AS units_held,
  COALESCE(mu.total_invested, 0)                      AS total_invested,
  lt.total_units_in_issue,
  CASE
    WHEN lt.total_units_in_issue > 0
    THEN ROUND(COALESCE(mu.units_held, 0)
               / lt.total_units_in_issue * 100, 6)
    ELSE 0
  END                                                 AS ownership_pct,
  ROUND(COALESCE(mu.units_held, 0)
        * COALESCE(ln.nav_per_unit, 100), 2)          AS current_value,
  COALESCE(ln.nav_per_unit, 100)                      AS nav_per_unit
FROM public.members m
LEFT JOIN member_units mu ON mu.member_id = m.id
CROSS JOIN live_totals lt
CROSS JOIN latest_nav ln
WHERE m.is_active = TRUE
ORDER BY COALESCE(mu.units_held, 0) DESC;


-- ============================================================
-- 8. is_ngx_trading_day(date) — Saturday=0, Sunday=6 in PG DOW
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_ngx_trading_day(p_date DATE)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  IF EXTRACT(DOW FROM p_date) IN (0, 6) THEN
    RETURN FALSE;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.ngx_holidays WHERE holiday_date = p_date
  ) THEN
    RETURN FALSE;
  END IF;
  RETURN TRUE;
END;
$$;


-- ============================================================
-- 9. latest_nav_date_on_or_before(date) — find most recent NAV ≤ date
-- ============================================================
CREATE OR REPLACE FUNCTION public.latest_nav_date_on_or_before(p_date DATE)
RETURNS DATE
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT nav_date FROM public.fund_nav
  WHERE nav_date <= p_date
  ORDER BY nav_date DESC LIMIT 1;
$$;


-- ============================================================
-- 10. compute_and_save_fund_nav(date)
--     Reads live positions + prices + cash balances to compute NAV.
--     Must be called AFTER the daily price update and BEFORE
--     pricing new contributions (so no new units inflate the count).
-- ============================================================
CREATE OR REPLACE FUNCTION public.compute_and_save_fund_nav(
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS public.fund_nav
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_stock   NUMERIC(18,2);
  v_mmf     NUMERIC(18,2);
  v_param   NUMERIC(18,2);
  v_bank    NUMERIC(18,2);
  v_broker  NUMERIC(18,2);
  v_liab    NUMERIC(18,2) := 0;
  v_total   NUMERIC(18,2);
  v_units   NUMERIC(18,4);
  v_nav     NUMERIC(18,6);
  v_result  public.fund_nav;
BEGIN
  -- Stock equity value: quantity × latest closing price ≤ p_date
  SELECT COALESCE(SUM(h.quantity * sp.closing_price), 0)
  INTO v_stock
  FROM public.holdings h
  JOIN LATERAL (
    SELECT closing_price FROM public.stock_prices
    WHERE stock_id = h.stock_id AND price_date <= p_date
    ORDER BY price_date DESC LIMIT 1
  ) sp ON TRUE
  WHERE h.asset_type = 'stock';

  -- CHD Money Market Fund (latest valuation ≤ p_date)
  SELECT COALESCE(value, 0) INTO v_mmf
  FROM public.mutual_fund_valuations
  WHERE fund_name = 'CHD Money Market Fund'
    AND valuation_date <= p_date
  ORDER BY valuation_date DESC LIMIT 1;
  v_mmf := COALESCE(v_mmf, 0);

  -- CHD Paramount Fund (latest valuation ≤ p_date)
  SELECT COALESCE(value, 0) INTO v_param
  FROM public.mutual_fund_valuations
  WHERE fund_name = 'CHD Paramount Fund'
    AND valuation_date <= p_date
  ORDER BY valuation_date DESC LIMIT 1;
  v_param := COALESCE(v_param, 0);

  -- Cash at bank (all active bank accounts)
  SELECT COALESCE(SUM(cash_balance), 0) INTO v_bank
  FROM public.bank_accounts WHERE is_active = TRUE;

  -- Cash at broker (can be negative/overdrawn)
  SELECT COALESCE(SUM(cash_balance), 0) INTO v_broker
  FROM public.broker_accounts WHERE is_active = TRUE;

  v_total := v_stock + v_mmf + v_param + v_bank + v_broker - v_liab;

  -- Units in issue = live sum of all unit_transactions
  -- (pre-money: contributions priced AFTER this NAV is saved)
  SELECT COALESCE(SUM(units), 0) INTO v_units
  FROM public.unit_transactions;

  IF v_units <= 0 THEN
    RAISE EXCEPTION
      'No units in issue — seed the baseline unit_transactions first.';
  END IF;

  v_nav := ROUND(v_total / v_units, 6);

  INSERT INTO public.fund_nav (
    nav_date, total_fund_value, units_in_issue, nav_per_unit,
    stock_equity_value, mmf_value, paramount_value,
    cash_at_bank, cash_at_broker, liabilities, source
  ) VALUES (
    p_date, v_total, v_units, v_nav,
    v_stock, v_mmf, v_param,
    v_bank, v_broker, v_liab, 'calculated'
  )
  ON CONFLICT (nav_date) DO UPDATE SET
    total_fund_value   = EXCLUDED.total_fund_value,
    units_in_issue     = EXCLUDED.units_in_issue,
    nav_per_unit       = EXCLUDED.nav_per_unit,
    stock_equity_value = EXCLUDED.stock_equity_value,
    mmf_value          = EXCLUDED.mmf_value,
    paramount_value    = EXCLUDED.paramount_value,
    cash_at_bank       = EXCLUDED.cash_at_bank,
    cash_at_broker     = EXCLUDED.cash_at_broker,
    liabilities        = EXCLUDED.liabilities,
    source             = EXCLUDED.source
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;


-- ============================================================
-- 11. price_unpriced_contributions()
--     Issues units for all member_contributions after 31-May-2026
--     that don't yet have a corresponding unit_transaction.
--     Uses the most recent NAV STRICTLY BEFORE the contribution date
--     (pre-money dealing price rule — the contribution never prices itself).
--     Safe to call repeatedly (idempotent via source_id guard).
-- ============================================================
CREATE OR REPLACE FUNCTION public.price_unpriced_contributions()
RETURNS TABLE (
  contribution_id UUID,
  member_id       UUID,
  amount          NUMERIC,
  dealing_nav_date DATE,
  nav_per_unit    NUMERIC,
  units_issued    NUMERIC
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_row      RECORD;
  v_nav_date DATE;
  v_nav      NUMERIC(18,6);
  v_units    NUMERIC(18,4);
  v_balance  NUMERIC(18,4);
BEGIN
  FOR v_row IN
    SELECT mc.id AS cid, mc.member_id, mc.amount, mc.contribution_date
    FROM public.member_contributions mc
    WHERE mc.contribution_date > '2026-05-31'
      AND NOT EXISTS (
        SELECT 1 FROM public.unit_transactions ut WHERE ut.source_id = mc.id
      )
    ORDER BY mc.contribution_date ASC, mc.created_at ASC
  LOOP
    -- Dealing NAV: strictly before contribution date (pre-money rule)
    SELECT fn.nav_date, fn.nav_per_unit
    INTO v_nav_date, v_nav
    FROM public.fund_nav fn
    WHERE fn.nav_date < v_row.contribution_date
    ORDER BY fn.nav_date DESC
    LIMIT 1;

    IF v_nav IS NULL THEN
      CONTINUE; -- No prior NAV available yet; skip
    END IF;

    v_units := ROUND(v_row.amount / v_nav, 4);

    -- Running balance for this member just before this insert
    SELECT COALESCE(SUM(ut.units), 0) + v_units
    INTO v_balance
    FROM public.unit_transactions ut
    WHERE ut.member_id = v_row.member_id;

    INSERT INTO public.unit_transactions (
      txn_date, member_id, txn_type, cash_amount,
      nav_per_unit, units, running_balance, source_id, notes
    ) VALUES (
      v_row.contribution_date,
      v_row.member_id,
      'issue',
      v_row.amount,
      v_nav,
      v_units,
      v_balance,
      v_row.cid,
      'Contribution priced at dealing NAV of '
        || v_nav_date || ' (₦' || v_nav || '/unit)'
    );

    contribution_id  := v_row.cid;
    member_id        := v_row.member_id;
    amount           := v_row.amount;
    dealing_nav_date := v_nav_date;
    nav_per_unit     := v_nav;
    units_issued     := v_units;
    RETURN NEXT;
  END LOOP;
END;
$$;


-- ============================================================
-- Attempt to compute today's NAV.  Wrapped in a DO block so that
-- transient failures (e.g. no stock prices yet) do NOT roll back
-- the schema + seed data above.  Admin can click "Compute NAV"
-- from the /nav page once prices are available.
-- ============================================================
DO $$
BEGIN
  PERFORM public.compute_and_save_fund_nav(CURRENT_DATE);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'compute_and_save_fund_nav skipped: %.  Run manually from /nav.', SQLERRM;
END;
$$;

COMMIT;
