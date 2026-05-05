-- EIG Platform — Correct bank statement data from actual Zenith Bank statement
-- Fixes:
--   1. State Withholding Tax amounts (migration 006 calculated them wrong)
--   2. SMS charge amounts (migration 006 used flat ₦50 placeholder)
--   3. First CHD transfer date corrected to 28/08/2025 (was 2025-08-10)
--   4. FGN Stamp Duty entries replaced with correct dates/amounts
--      (₦50 per eligible incoming credit ≥ ₦10,000)
--   5. Adds missing member Amida Oluwatobi Paul (₦200,000 on 26/03/2026)
--   6. Resets and re-seeds bank_statement_txns from corrected data

BEGIN;

-- ============================================================
-- STEP 1: Fix State Withholding Tax amounts in bank_ledger
-- Actual amounts from Zenith Bank statement (Aug 2025 – Apr 2026)
-- ============================================================
UPDATE public.bank_ledger SET amount = -9.22
WHERE category = 'tax'
  AND description LIKE '%Withholding Tax%Aug 2025%';

UPDATE public.bank_ledger SET amount = -62.62
WHERE category = 'tax'
  AND description LIKE '%Withholding Tax%Sep 2025%';

UPDATE public.bank_ledger SET amount = -93.82
WHERE category = 'tax'
  AND description LIKE '%Withholding Tax%Oct 2025%';

UPDATE public.bank_ledger SET amount = -208.89
WHERE category = 'tax'
  AND description LIKE '%Withholding Tax%Nov 2025%';

UPDATE public.bank_ledger SET amount = -180.87
WHERE category = 'tax'
  AND description LIKE '%Withholding Tax%Dec 2025%';

UPDATE public.bank_ledger SET amount = -106.43
WHERE category = 'tax'
  AND description LIKE '%Withholding Tax%Jan 2026%';

UPDATE public.bank_ledger SET amount = -82.58
WHERE category = 'tax'
  AND description LIKE '%Withholding Tax%Feb 2026%';

UPDATE public.bank_ledger SET amount = -124.39
WHERE category = 'tax'
  AND description LIKE '%Withholding Tax%Mar 2026%';

UPDATE public.bank_ledger SET amount = -288.57
WHERE category = 'tax'
  AND description LIKE '%Withholding Tax%Apr 2026%';


-- ============================================================
-- STEP 2: Fix SMS Charge amounts in bank_ledger
-- Actual amounts from Zenith Bank statement
-- ============================================================
UPDATE public.bank_ledger SET amount = -88.00
WHERE category = 'bank_charge'
  AND description ILIKE '%SMS%'
  AND entry_date BETWEEN '2025-08-01' AND '2025-08-31';

UPDATE public.bank_ledger SET amount = -64.00
WHERE category = 'bank_charge'
  AND description ILIKE '%SMS%'
  AND entry_date BETWEEN '2025-09-01' AND '2025-09-30';

UPDATE public.bank_ledger SET amount = -160.00
WHERE category = 'bank_charge'
  AND description ILIKE '%SMS%'
  AND entry_date BETWEEN '2025-10-01' AND '2025-10-31';

UPDATE public.bank_ledger SET amount = -104.00
WHERE category = 'bank_charge'
  AND description ILIKE '%SMS%'
  AND entry_date BETWEEN '2025-11-01' AND '2025-11-30';

UPDATE public.bank_ledger SET amount = -40.00
WHERE category = 'bank_charge'
  AND description ILIKE '%SMS%'
  AND entry_date BETWEEN '2025-12-01' AND '2025-12-31';

UPDATE public.bank_ledger SET amount = -80.00
WHERE category = 'bank_charge'
  AND description ILIKE '%SMS%'
  AND entry_date BETWEEN '2026-01-01' AND '2026-01-31';

UPDATE public.bank_ledger SET amount = -104.00
WHERE category = 'bank_charge'
  AND description ILIKE '%SMS%'
  AND entry_date BETWEEN '2026-02-01' AND '2026-02-28';

UPDATE public.bank_ledger SET amount = -56.00
WHERE category = 'bank_charge'
  AND description ILIKE '%SMS%'
  AND entry_date BETWEEN '2026-03-01' AND '2026-03-31';


-- ============================================================
-- STEP 3: Fix August CHD transfer and NIP charge dates
-- Confirmed from actual bank statement: first transfer was 28/08/2025
-- (migration 006 used placeholder date 2025-08-10)
-- ============================================================
UPDATE public.bank_ledger
SET entry_date = '2025-08-28'
WHERE category = 'broker_transfer'
  AND amount = -200000.00
  AND entry_date = '2025-08-10';

UPDATE public.bank_ledger
SET entry_date = '2025-08-28'
WHERE category = 'bank_charge'
  AND description LIKE '%NIP%'
  AND entry_date = '2025-08-10';


-- ============================================================
-- STEP 4: Replace FGN Stamp Duty entries with correct data
-- Rate: ₦50 per eligible incoming credit ≥ ₦10,000 (EMTL)
-- Dates derived from actual member credit dates + dividends
-- ============================================================

-- Remove incorrect placeholder stamp duty entries
DELETE FROM public.bank_ledger
WHERE category = 'tax'
  AND description ILIKE '%stamp duty%';

-- Insert correct stamp duty entries
-- Note: amounts > ₦50 indicate multiple qualifying credits on that date
INSERT INTO public.bank_ledger (entry_date, description, amount, category, bank_reference)
VALUES

-- ── August 2025 ──────────────────────────────────────────────
-- 26/08: Gbenga ₦200,000
  ('2025-08-26', 'FGN Stamp Duty', -50.00, 'tax', NULL),

-- ── September 2025 ───────────────────────────────────────────
-- 17/09: Mike & Mary ₦400,000
  ('2025-09-17', 'FGN Stamp Duty', -50.00, 'tax', NULL),
-- 19/09: Gbenga ₦400,000
  ('2025-09-19', 'FGN Stamp Duty', -50.00, 'tax', NULL),
-- 26/09: Gbenga ₦200,000
  ('2025-09-26', 'FGN Stamp Duty', -50.00, 'tax', NULL),
-- 28/09: Gbolaro ₦150,000 + Oluwatosin ₦200,000 + Olujimi ₦200,000
  ('2025-09-28', 'FGN Stamp Duty', -150.00, 'tax', NULL),

-- ── October 2025 ─────────────────────────────────────────────
-- 27/10: Gbenga ₦200,000 + Olujimi ₦200,000 + Oluwatobi ₦100,000 + Mike & Mary ₦100,000
  ('2025-10-27', 'FGN Stamp Duty', -200.00, 'tax', NULL),
-- 31/10: Gbolaro ₦200,000 + Zenith dividend ₦26,321.62
  ('2025-10-31', 'FGN Stamp Duty', -100.00, 'tax', NULL),

-- ── November 2025 ────────────────────────────────────────────
-- 25/11: Oluwatosin ₦300,000
  ('2025-11-25', 'FGN Stamp Duty', -50.00, 'tax', NULL),
-- 26/11: Gbenga ₦200,000
  ('2025-11-26', 'FGN Stamp Duty', -50.00, 'tax', NULL),
-- 27/11: Olujimi ₦200,000 + Mike & Mary ₦100,000
  ('2025-11-27', 'FGN Stamp Duty', -100.00, 'tax', NULL),

-- ── December 2025 ────────────────────────────────────────────
-- 18/12: Mike & Mary ₦300,000
  ('2025-12-18', 'FGN Stamp Duty', -50.00, 'tax', NULL),
-- 19/12: Oluwatosin ₦300,000
  ('2025-12-19', 'FGN Stamp Duty', -50.00, 'tax', NULL),
-- 22/12: Olujimi ₦200,000
  ('2025-12-22', 'FGN Stamp Duty', -50.00, 'tax', NULL),
-- 23/12: Gbolaro ₦200,000
  ('2025-12-23', 'FGN Stamp Duty', -50.00, 'tax', NULL),
-- 27/12: Gbenga ₦200,000
  ('2025-12-27', 'FGN Stamp Duty', -50.00, 'tax', NULL),
-- 30/12: Olujimi ₦200,000
  ('2025-12-30', 'FGN Stamp Duty', -50.00, 'tax', NULL),

-- ── January 2026 ─────────────────────────────────────────────
-- 24/01: Oluwatosin ₦200,000
  ('2026-01-24', 'FGN Stamp Duty', -50.00, 'tax', NULL),
-- 26/01: Olujimi ₦200,000
  ('2026-01-26', 'FGN Stamp Duty', -50.00, 'tax', NULL),
-- 27/01: Gbenga ₦200,000
  ('2026-01-27', 'FGN Stamp Duty', -50.00, 'tax', NULL),

-- ── February 2026 ────────────────────────────────────────────
-- 02/02: Gbolaro ₦150,000 + Mike & Mary ₦200,000
  ('2026-02-02', 'FGN Stamp Duty', -100.00, 'tax', NULL),
-- 25/02: Olujimi ₦200,000
  ('2026-02-25', 'FGN Stamp Duty', -50.00, 'tax', NULL),
-- 27/02: Gbenga ₦200,000 + Oluwatosin ₦200,000
  ('2026-02-27', 'FGN Stamp Duty', -100.00, 'tax', NULL),

-- ── March 2026 ───────────────────────────────────────────────
-- 02/03: Gbolaro ₦150,000
  ('2026-03-02', 'FGN Stamp Duty', -50.00, 'tax', NULL),
-- 03/03: Mike & Mary ₦200,000
  ('2026-03-03', 'FGN Stamp Duty', -50.00, 'tax', NULL),
-- 25/03: Oluwatosin ₦200,000
  ('2026-03-25', 'FGN Stamp Duty', -50.00, 'tax', NULL),
-- 26/03: Gbenga ₦200,000 + Olujimi ₦200,000 + Amida Oluwatobi Paul ₦200,000
  ('2026-03-26', 'FGN Stamp Duty', -150.00, 'tax', NULL),
-- 27/03: Mike & Mary ₦200,000
  ('2026-03-27', 'FGN Stamp Duty', -50.00, 'tax', NULL),
-- 28/03: Gbolaro ₦150,000
  ('2026-03-28', 'FGN Stamp Duty', -50.00, 'tax', NULL),

-- ── April 2026 ───────────────────────────────────────────────
-- 02/04: UACN NSE settlement proceeds ₦798,206.87
  ('2026-04-02', 'FGN Stamp Duty', -50.00, 'tax', NULL),
-- 26/04: Oluwatosin ₦200,000
  ('2026-04-26', 'FGN Stamp Duty', -50.00, 'tax', NULL),
-- 27/04: Gbenga ₦200,000 + Oluwatobi ₦200,000 + Olujimi ₦200,000
  ('2026-04-27', 'FGN Stamp Duty', -150.00, 'tax', NULL),
-- 28/04: GTCO dividend ₦141,582.17
  ('2026-04-28', 'FGN Stamp Duty', -50.00, 'tax', NULL),
-- 29/04: Gbolaro ₦200,000 + Mike & Mary ₦200,000
  ('2026-04-29', 'FGN Stamp Duty', -100.00, 'tax', NULL);


-- ============================================================
-- STEP 5: Add missing member Amida Oluwatobi Paul
-- Identified from March 2026 bank credits
-- ============================================================
INSERT INTO public.members (full_name, email, join_date, is_active, notes)
VALUES (
  'Amida Oluwatobi Paul',
  'oluwatobi.paul@eigmembers.ng',
  '2026-03-26',
  TRUE,
  'Added Mar 2026 — confirmed first contribution 26/03/2026'
)
ON CONFLICT (email) DO NOTHING;


-- ============================================================
-- STEP 6: Add Amida Oluwatobi Paul contribution
-- ============================================================
INSERT INTO public.member_contributions
  (member_id, amount, contribution_date, payment_method, bank_reference, notes)
SELECT
  m.id,
  200000.00,
  '2026-03-26'::date,
  'bank_transfer',
  NULL,
  'Mar 2026 contribution'
FROM public.members m
WHERE m.email = 'oluwatobi.paul@eigmembers.ng'
  AND NOT EXISTS (
    SELECT 1 FROM public.member_contributions mc
    WHERE mc.member_id = m.id
      AND mc.contribution_date = '2026-03-26'
      AND mc.amount = 200000.00
  );


-- ============================================================
-- STEP 7: Reset and re-seed bank_statement_txns
-- Deletes all rows and rebuilds from corrected source data
-- ============================================================

DELETE FROM public.bank_statement_txns;

-- Seed from member_contributions (all credited transfers)
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

-- Seed from bank_ledger (interest, charges, taxes, CHD transfers)
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

-- Seed from transactions — dividends credited directly to bank
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

COMMIT;
