-- EIG Platform — Ledger corrections from EIG_Consolidated_Ledger_2.pdf
-- Source: Pooled Investment Ledger prepared 11-Jun-2026
--
-- Summary of changes:
--   1. Rename "Mike and Mary Catering" → Ayodeji Adegun (correct member identity)
--   2. Update Oluwatobi Amida full name to canonical form from PDF
--   3. Add 22 missing member_contributions (July 2025 Paramount fund
--      contributions + direct CHD broker payments not in Zenith statement)
--   4. Remove phantom FCMB holding (not in any contract note or PDF ledger)
--   5. Add missing dividend transactions (ZENITHBANK Oct-25 ticker fix +
--      ZENITHBANK and MTNN May-26 finals)
--   6. Add The Initiates Plc IPO subscription (13-Jan-26, ₦399,000)
--   7. Add Apr-26 SMS charge and May-26 stamp duties to bank_ledger
--   8. Rebuild bank_statement_txns from corrected source data

BEGIN;


-- ============================================================
-- STEP 1: Fix member identities
-- ============================================================

-- 1a. Rename Mike and Mary Catering → Ayodeji Adegun.
--     "MIKE AND MARYS CATERING AND BUFFET EVENT" is Ayodeji Adegun's
--     FCMB business account; the actual EIG member is Ayodeji Adegun.
UPDATE public.members
SET
  full_name = 'Ayodeji Adegun',
  email     = 'ayodeji.adegun@eigmembers.ng',
  notes     = 'Contributions via FCMB (Mike & Mary Catering business a/c); confirmed Ayodeji Adegun'
WHERE email = 'mikeandmarys@eigmembers.ng';

-- 1b. Canonical full name for Tobi Amida per PDF ("Amida Oluwatobi Paul (Tobi Amida)").
UPDATE public.members
SET full_name = 'Amida Oluwatobi Paul (Tobi Amida)'
WHERE email = 'oluwatobi.amida@eigmembers.ng';


-- ============================================================
-- STEP 2: Add missing member_contributions
--
-- Three sources not captured in earlier migrations:
--   a) July 2025 contributions paid directly to Chapel Hill (funded
--      the Paramount Fund initial subscription, 01-Aug-25)
--   b) Aug–Feb contributions paid directly into the CHD brokerage
--      account (never passed through Zenith, so absent from bank stmt)
--   c) Zenith bank credits that were overlooked in migration 009
--
-- Guard: NOT EXISTS on (member_id, contribution_date, amount)
-- ============================================================

INSERT INTO public.member_contributions
  (member_id, amount, contribution_date, payment_method, bank_reference, notes)
SELECT m.id, v.amount, v.dt, 'bank_transfer', v.ref, v.note
FROM (VALUES
  -- ── Ayodeji Adegun ────────────────────────────────────────────
  --   (email updated in step 1; use new email to join)
  ('ayodeji.adegun@eigmembers.ng',  400000.00, '2025-07-31'::date,
   'CHD-Paramount', 'Jul 2025 contribution to Chapel Hill — funded Paramount initial subscription'),
  ('ayodeji.adegun@eigmembers.ng',  100000.00, '2025-11-25'::date,
   'CHD-direct',    'Nov 2025 contribution paid directly into CHD brokerage'),
  ('ayodeji.adegun@eigmembers.ng',  100000.00, '2025-12-31'::date,
   'CHD-direct',    'Dec 2025 contribution paid directly into CHD brokerage'),

  -- ── Oluwagbemiga Omololu Omolokun (Gbenga) ───────────────────
  ('gbenga.omolokun@gmail.com',     200000.00, '2025-07-31'::date,
   'CHD-Paramount', 'Jul 2025 contribution to Chapel Hill — funded Paramount initial subscription'),
  ('gbenga.omolokun@gmail.com',     200000.00, '2025-11-25'::date,
   'ISW/VFD',       'Nov 2025 contribution 2 — VFD MFB a/c 1000073844 transfer 1'),
  ('gbenga.omolokun@gmail.com',     400000.00, '2025-12-20'::date,
   'ISW/VFD',       'Dec 2025 contribution — VFD MFB a/c 1000073844 transfer 1'),
  ('gbenga.omolokun@gmail.com',     200000.00, '2026-01-26'::date,
   'ISW/VFD',       'Jan 2026 contribution 1 — VFD MFB a/c 1000073844 transfer 26-Jan-2026'),

  -- ── Amida Oluwatosin James ────────────────────────────────────
  ('oluwatosin.james@eigmembers.ng', 150000.00, '2025-07-31'::date,
   'CHD-Paramount', 'Jul 2025 contribution to Chapel Hill — funded Paramount initial subscription'),
  ('oluwatosin.james@eigmembers.ng', 250000.00, '2025-08-26'::date,
   'CHD-direct',    'Aug 2025 contribution paid directly into CHD brokerage (per broker stmt; confirmed GO)'),
  ('oluwatosin.james@eigmembers.ng', 200000.00, '2025-10-25'::date,
   'CIP',           'Oct 2025 contribution — confirmed Amida Oluwatosin James (GO)'),

  -- ── Olujimi Curtis-Joseph ─────────────────────────────────────
  ('olujimi.curtisjoseph@eigmembers.ng', 200000.00, '2025-07-31'::date,
   'CHD-Paramount', 'Jul 2025 contribution to Chapel Hill — funded Paramount initial subscription'),
  ('olujimi.curtisjoseph@eigmembers.ng', 200000.00, '2025-08-26'::date,
   'CHD-direct',    'Aug 2025 contribution paid directly into CHD brokerage (per broker stmt; confirmed GO)'),

  -- ── Gbolaro Ebenezer Olulade ──────────────────────────────────
  ('gbolaro.olulade@eigmembers.ng', 200000.00, '2025-07-31'::date,
   'CHD-Paramount', 'Jul 2025 contribution to Chapel Hill — funded Paramount initial subscription'),
  ('gbolaro.olulade@eigmembers.ng', 200000.00, '2025-09-01'::date,
   'CHD-direct',    'Sep 2025 contribution paid directly into CHD brokerage (per broker stmt; confirmed GO)'),

  -- ── Amida Oluwatobi Paul (Tobi Amida) ────────────────────────
  ('oluwatobi.amida@eigmembers.ng', 200000.00, '2025-07-31'::date,
   'CHD-Paramount', 'Jul 2025 contribution to Chapel Hill — funded Paramount initial subscription'),
  ('oluwatobi.amida@eigmembers.ng', 200000.00, '2025-08-26'::date,
   'CHD-direct',    'Aug 2025 contribution paid directly into CHD brokerage (per broker stmt; confirmed GO)'),
  ('oluwatobi.amida@eigmembers.ng', 100198.00, '2025-10-06'::date,
   'CHD-direct',    'Oct 2025 contribution paid directly into CHD brokerage (per broker stmt; confirmed GO)'),
  ('oluwatobi.amida@eigmembers.ng', 100000.00, '2025-10-14'::date,
   'CHD-direct',    'Oct 2025 contribution paid directly into CHD brokerage (per broker stmt; confirmed GO)'),
  ('oluwatobi.amida@eigmembers.ng', 200000.00, '2025-11-25'::date,
   'CHD-direct',    'Nov 2025 contribution paid directly into CHD brokerage (per broker stmt; confirmed GO)'),
  ('oluwatobi.amida@eigmembers.ng', 400000.00, '2025-12-22'::date,
   'CHD-direct',    'Dec 2025 contribution paid directly into CHD brokerage (per broker stmt; confirmed GO)'),
  ('oluwatobi.amida@eigmembers.ng', 200000.00, '2026-01-26'::date,
   'CHD-direct',    'Jan 2026 contribution paid directly into CHD brokerage (per broker stmt; confirmed GO)'),
  ('oluwatobi.amida@eigmembers.ng', 200000.00, '2026-02-25'::date,
   'CHD-direct',    'Feb 2026 contribution paid directly into CHD brokerage (per broker stmt; confirmed GO)')

) AS v(email, amount, dt, ref, note)
JOIN public.members m ON m.email = v.email
WHERE NOT EXISTS (
  SELECT 1 FROM public.member_contributions mc
  WHERE mc.member_id        = m.id
    AND mc.contribution_date = v.dt
    AND mc.amount            = v.amount
);


-- ============================================================
-- STEP 3: Remove phantom FCMB holding
--
-- FCMB (50,000 units @ ₦10.00) was set in migration 007 baseline
-- but does not appear in any CHD contract note or in the PDF ledger.
-- It has no corresponding buy transaction and distorts the NAV.
-- ============================================================
DELETE FROM public.holdings
WHERE stock_id IN (
  SELECT id FROM public.stocks WHERE ticker = 'FCMB'
);


-- ============================================================
-- STEP 4: Add missing dividend transactions
--
-- 4a. ZENITHBANK Oct-25 dividend was seeded with ticker 'ZENITH'
--     in migration 006 which doesn't match stocks.ticker = 'ZENITHBANK',
--     so the JOIN failed silently and the row was never inserted.
--
-- 4b. ZENITHBANK and MTNN May-26 final dividends were not yet seeded.
-- ============================================================
INSERT INTO public.transactions (
  transaction_date, transaction_type, asset_type,
  stock_id, broker_account_id,
  quantity, price, gross_amount,
  brokerage_fee, sec_fee, cscs_fee, stamp_duty, total_fees,
  net_amount, notes
)
SELECT
  v.txn_date, 'dividend', 'stock',
  s.id, NULL,
  NULL, NULL, v.amount,
  0, 0, 0, 0, 0,
  v.amount, v.note
FROM (VALUES
  ('2025-10-31'::date, 'ZENITHBANK', 26321.62,
   'Zenith Bank dividend (ZB DIV31_490487_ZB) — Oct 2025'),
  ('2026-05-05'::date, 'ZENITHBANK', 337309.88,
   'Zenith Bank final dividend 2025 (ZENITH BANK FINAL DIV 2025_303899_ZB) — May 2026'),
  ('2026-05-05'::date, 'MTNN',       72076.50,
   'MTN Nigeria dividend (MTNN DIV 35 PYT BATCH 5) — Dec 2025 declared, paid May 2026')
) AS v(txn_date, ticker, amount, note)
JOIN public.stocks s ON s.ticker = v.ticker
WHERE NOT EXISTS (
  SELECT 1 FROM public.transactions t
  WHERE t.transaction_type    = 'dividend'
    AND t.stock_id             = s.id
    AND t.transaction_date     = v.txn_date
    AND t.net_amount           = v.amount
);


-- ============================================================
-- STEP 5: Add The Initiates Plc IPO subscription (13-Jan-26)
--
-- ₦399,000 transferred from CHD brokerage for the public offer.
-- Units not yet allotted so quantity/price are NULL.
-- The holdings trigger must be patched first (step 5a) to skip
-- transactions where quantity IS NULL, otherwise it tries to INSERT
-- a holding row with a NOT NULL quantity column and fails.
-- ============================================================

-- 5a. Patch trigger to guard against NULL quantity (IPO/public offers)
CREATE OR REPLACE FUNCTION public.update_holding_after_transaction()
RETURNS TRIGGER AS $$
DECLARE
  v_holding_id UUID;
  v_current_qty NUMERIC;
  v_current_avg_cost NUMERIC;
  v_new_qty NUMERIC;
  v_new_avg_cost NUMERIC;
BEGIN
  -- Only process buy/sell transactions
  IF NEW.transaction_type NOT IN ('buy', 'sell', 'transfer_in', 'transfer_out') THEN
    RETURN NEW;
  END IF;

  -- Skip if quantity is NULL (e.g. IPO / public offer pending allotment)
  IF NEW.quantity IS NULL THEN
    RETURN NEW;
  END IF;

  -- Find existing holding
  SELECT id, quantity, average_cost
  INTO v_holding_id, v_current_qty, v_current_avg_cost
  FROM public.holdings
  WHERE asset_type = NEW.asset_type
    AND (stock_id = NEW.stock_id OR mutual_fund_id = NEW.mutual_fund_id)
    AND (broker_account_id = NEW.broker_account_id OR (broker_account_id IS NULL AND NEW.broker_account_id IS NULL));

  IF NEW.transaction_type IN ('buy', 'transfer_in') THEN
    IF v_holding_id IS NULL THEN
      INSERT INTO public.holdings (asset_type, stock_id, mutual_fund_id, broker_account_id, quantity, average_cost)
      VALUES (NEW.asset_type, NEW.stock_id, NEW.mutual_fund_id, NEW.broker_account_id, NEW.quantity, NEW.price);
    ELSE
      v_new_qty      := v_current_qty + NEW.quantity;
      v_new_avg_cost := ((v_current_qty * v_current_avg_cost) + (NEW.quantity * NEW.price)) / v_new_qty;
      UPDATE public.holdings
      SET quantity = v_new_qty, average_cost = v_new_avg_cost
      WHERE id = v_holding_id;
    END IF;

  ELSIF NEW.transaction_type IN ('sell', 'transfer_out') THEN
    IF v_holding_id IS NOT NULL THEN
      v_new_qty := v_current_qty - NEW.quantity;
      IF v_new_qty <= 0 THEN
        DELETE FROM public.holdings WHERE id = v_holding_id;
      ELSE
        UPDATE public.holdings SET quantity = v_new_qty WHERE id = v_holding_id;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5b. Ensure stock exists
INSERT INTO public.stocks (ticker, company_name, sector, market_cap_category, is_active)
VALUES ('INITIATES', 'The Initiates Plc', 'Financial Services', 'small', TRUE)
ON CONFLICT (ticker) DO NOTHING;

-- 5c. Insert IPO transaction (idempotent on contract_note_number)
INSERT INTO public.transactions (
  transaction_date, transaction_type, asset_type,
  stock_id, broker_account_id,
  quantity, price, gross_amount,
  brokerage_fee, sec_fee, cscs_fee, stamp_duty, total_fees,
  net_amount, contract_note_number, settlement_date, notes
)
SELECT
  '2026-01-13'::date,
  'buy',
  'stock',
  s.id,
  ba.id,
  NULL,         -- units not yet confirmed (public offer)
  NULL,         -- price per unit not confirmed
  399000.00,
  0, 0, 0, 0, 0,
  399000.00,
  'IPO-INITIATES-JAN26',
  '2026-01-13'::date,
  'The Initiates Plc public offer subscription — transfer payment 13-Jan-26; units pending allotment'
FROM public.stocks s
CROSS JOIN (
  SELECT id FROM public.broker_accounts
  WHERE broker_name ILIKE '%chapel hill%' OR broker_name ILIKE '%chd%'
  LIMIT 1
) ba
WHERE s.ticker = 'INITIATES'
  AND NOT EXISTS (
    SELECT 1 FROM public.transactions t
    WHERE t.contract_note_number = 'IPO-INITIATES-JAN26'
  );


-- ============================================================
-- STEP 6: Bank ledger additions
--
-- 6a. April 2026 SMS charge (migration 006 only seeded through Mar-26;
--     migration 016 only updated through Mar-26)
-- 6b. May 2026 FGN Stamp Duty on the two May dividend credits
--     (₦50 per qualifying credit × 2 = ₦100)
-- ============================================================

-- 6a. Apr-26 SMS charge
INSERT INTO public.bank_ledger (entry_date, description, amount, category, bank_reference)
SELECT '2026-04-26', 'SMS Charges', -56.00, 'bank_charge', NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.bank_ledger
  WHERE category    = 'bank_charge'
    AND description ILIKE '%SMS%'
    AND entry_date BETWEEN '2026-04-01' AND '2026-04-30'
);

-- 6b. May-26 stamp duty on ZENITHBANK + MTNN dividend credits
INSERT INTO public.bank_ledger (entry_date, description, amount, category, bank_reference)
SELECT '2026-05-05', 'FGN Stamp Duty', -100.00, 'tax', NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.bank_ledger
  WHERE category    = 'tax'
    AND description ILIKE '%stamp duty%'
    AND entry_date BETWEEN '2026-05-01' AND '2026-05-31'
);


-- ============================================================
-- STEP 7: Rebuild bank_statement_txns from corrected data
--
-- Drops all rows and re-seeds from three sources:
--   a) member_contributions  — credited transfers into Zenith
--   b) bank_ledger           — interest, charges, taxes, CHD flows
--   c) transactions(dividend) — dividends credited to Zenith account
--
-- This is a full rebuild (same approach as migration 016 STEP 6),
-- which automatically picks up all additions from steps 1–6.
-- ============================================================

DELETE FROM public.bank_statement_txns;

-- a) Member contributions
INSERT INTO public.bank_statement_txns
  (txn_date, description, credit, bank_reference, notes, status, matched_type, matched_id)
SELECT
  mc.contribution_date,
  'Contribution — ' || m.full_name,
  mc.amount,
  mc.bank_reference,
  mc.notes,
  'matched',
  'contribution',
  mc.id
FROM public.member_contributions mc
JOIN public.members m ON m.id = mc.member_id;

-- b) Bank ledger (interest, charges, taxes, broker transfers)
INSERT INTO public.bank_statement_txns
  (txn_date, description, credit, debit, bank_reference, status, matched_type, matched_id)
SELECT
  bl.entry_date,
  bl.description,
  CASE WHEN bl.amount > 0 THEN  bl.amount ELSE NULL END,
  CASE WHEN bl.amount < 0 THEN -bl.amount ELSE NULL END,
  bl.bank_reference,
  'matched',
  'bank_ledger',
  bl.id
FROM public.bank_ledger bl;

-- c) Dividends (paid directly into Zenith bank account)
INSERT INTO public.bank_statement_txns
  (txn_date, description, credit, status, matched_type, matched_id)
SELECT
  t.transaction_date,
  'Dividend — ' || COALESCE(s.ticker || ' (' || s.company_name || ')', 'unknown'),
  t.net_amount,
  'matched',
  'transaction',
  t.id
FROM public.transactions t
LEFT JOIN public.stocks s ON s.id = t.stock_id
WHERE t.transaction_type = 'dividend'
  AND t.net_amount IS NOT NULL;


-- ============================================================
-- STEP 8: Refresh portfolio snapshot so dashboard picks up the
-- corrected NAV (FCMB removed; contributions now correct)
-- ============================================================
SELECT public.create_portfolio_snapshot(CURRENT_DATE);

COMMIT;
