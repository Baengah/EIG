-- EIG Platform — Seed: Zenith Bank statement, CHD cash balance, dividends, member fixes
-- Period: 05-Aug-2025 to 04-May-2026   Account: Zenith SA 2290556463
-- IMPORTANT: Verify dates and amounts against actual bank statement before running.
-- Run AFTER migration 005.

-- ============================================================
-- STEP 1: Update CHD (Chapel Hill Denham) broker cash balance
-- ============================================================
UPDATE public.broker_accounts
SET cash_balance = 23067.75
WHERE broker_name ILIKE '%chapel hill%' OR broker_name ILIKE '%CHD%';


-- ============================================================
-- STEP 2: Fix Tobi / Oluwatobi duplicate member record
-- Merge "Tobi Amida" record into the real profile if needed.
-- ============================================================
-- First, reassign any member_contributions under the duplicate to the canonical record
UPDATE public.member_contributions
SET member_id = (
  SELECT id FROM public.members
  WHERE full_name ILIKE '%oluwatobi%amida%'
  LIMIT 1
)
WHERE member_id IN (
  SELECT id FROM public.members
  WHERE full_name ILIKE '%tobi amida%'
    AND full_name NOT ILIKE '%oluwatobi%'
);

-- Delete the duplicate/placeholder member rows
DELETE FROM public.members
WHERE
  -- Tobi short-name duplicate (if separate from Oluwatobi)
  (full_name ILIKE 'tobi amida' AND full_name NOT ILIKE '%oluwatobi%')
  OR
  -- Placeholder email rows created during invite flow
  email LIKE '%@placeholder.eig' OR email LIKE '%@eig.local';


-- ============================================================
-- STEP 3: Dividend transactions
-- These credits appear in the Zenith bank account.
-- category: dividend, asset_type: stock
-- broker_account_id is NULL (dividends paid directly to bank, not via CHD)
-- ============================================================
-- NOTE: Insert only if the stock ticker exists in the stocks table.
-- Run this block; rows with unknown tickers will simply not insert.

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
FROM (
  VALUES
    ('2025-10-15'::date, 'GTCO',    8347.50,   'GTCO dividend — Oct 2025'),
    ('2025-10-31'::date, 'ZENITH',  26321.62,  'Zenith Bank dividend — Oct 2025'),
    ('2025-11-28'::date, 'MTNN',    9454.50,   'MTN Nigeria dividend — Nov 2025'),
    ('2025-11-28'::date, 'ARADEL',  4140.00,   'Aradel Holdings dividend — Nov 2025'),
    ('2026-04-28'::date, 'GTCO',    141582.17, 'GTCO dividend (GTCODIV8) — Apr 2026'),
    ('2026-04-29'::date, 'NGXGROUP',6930.00,   'NGX Group dividend — Apr 2026')
) AS v(txn_date, ticker, amount, note)
JOIN public.stocks s ON s.ticker = v.ticker
WHERE NOT EXISTS (
  -- Avoid duplicates: skip if same ticker + date + net_amount already exists
  SELECT 1 FROM public.transactions t2
  WHERE t2.transaction_type = 'dividend'
    AND t2.stock_id = s.id
    AND t2.transaction_date = v.txn_date
    AND t2.net_amount = v.amount
);


-- ============================================================
-- STEP 4: Bank Ledger — Zenith Bank statement entries
-- Organised by category. Positive = credit, Negative = debit.
-- Dates are approximate where day is unknown — verify against statement.
-- ============================================================

INSERT INTO public.bank_ledger (entry_date, description, amount, category, bank_reference)
VALUES

-- ─── CAPITALISED INTEREST (monthly credits by Zenith) ────────────────────────
  ('2025-08-29', 'Capitalised Interest — Aug 2025',   92.16,   'interest_income', NULL),
  ('2025-09-30', 'Capitalised Interest — Sep 2025',   626.19,  'interest_income', NULL),
  ('2025-10-31', 'Capitalised Interest — Oct 2025',   938.23,  'interest_income', NULL),
  ('2025-11-28', 'Capitalised Interest — Nov 2025',   2088.85, 'interest_income', NULL),
  ('2025-12-31', 'Capitalised Interest — Dec 2025',   1808.66, 'interest_income', NULL),
  ('2026-01-30', 'Capitalised Interest — Jan 2026',   1064.32, 'interest_income', NULL),
  ('2026-02-27', 'Capitalised Interest — Feb 2026',   825.78,  'interest_income', NULL),
  ('2026-03-31', 'Capitalised Interest — Mar 2026',   1243.90, 'interest_income', NULL),
  ('2026-04-30', 'Capitalised Interest — Apr 2026',   2885.73, 'interest_income', NULL),

-- ─── STATE WITHHOLDING TAX on interest (10% of gross; gross = net/0.9) ──────
-- NOTE: These are calculated from net interest above. Verify exact amounts.
  ('2025-08-29', 'State Withholding Tax — Aug 2025',   -10.24,  'tax', NULL),
  ('2025-09-30', 'State Withholding Tax — Sep 2025',   -69.58,  'tax', NULL),
  ('2025-10-31', 'State Withholding Tax — Oct 2025',  -104.25,  'tax', NULL),
  ('2025-11-28', 'State Withholding Tax — Nov 2025',  -232.09,  'tax', NULL),
  ('2025-12-31', 'State Withholding Tax — Dec 2025',  -200.96,  'tax', NULL),
  ('2026-01-30', 'State Withholding Tax — Jan 2026',  -118.26,  'tax', NULL),
  ('2026-02-27', 'State Withholding Tax — Feb 2026',   -91.75,  'tax', NULL),
  ('2026-03-31', 'State Withholding Tax — Mar 2026',  -138.21,  'tax', NULL),
  ('2026-04-30', 'State Withholding Tax — Apr 2026',  -320.64,  'tax', NULL),

-- ─── NIP CHARGES (₦53.75 per CHD transfer — verify dates match transfer dates) ─
  ('2025-08-10', 'NIP Charge + VAT',  -53.75, 'bank_charge', NULL),
  ('2025-09-05', 'NIP Charge + VAT',  -53.75, 'bank_charge', NULL),
  ('2025-09-15', 'NIP Charge + VAT',  -53.75, 'bank_charge', NULL),
  ('2025-09-22', 'NIP Charge + VAT',  -53.75, 'bank_charge', NULL),
  ('2025-10-08', 'NIP Charge + VAT',  -53.75, 'bank_charge', NULL),
  ('2025-10-20', 'NIP Charge + VAT',  -53.75, 'bank_charge', NULL),
  ('2025-11-10', 'NIP Charge + VAT',  -53.75, 'bank_charge', NULL),
  ('2025-11-20', 'NIP Charge + VAT',  -53.75, 'bank_charge', NULL),
  ('2025-12-05', 'NIP Charge + VAT',  -53.75, 'bank_charge', NULL),
  ('2025-12-18', 'NIP Charge + VAT',  -53.75, 'bank_charge', NULL),
  ('2026-01-10', 'NIP Charge + VAT',  -53.75, 'bank_charge', NULL),
  ('2026-01-22', 'NIP Charge + VAT',  -53.75, 'bank_charge', NULL),
  ('2026-02-12', 'NIP Charge + VAT',  -53.75, 'bank_charge', NULL),
  ('2026-03-08', 'NIP Charge + VAT',  -53.75, 'bank_charge', NULL),
  ('2026-03-20', 'NIP Charge + VAT',  -53.75, 'bank_charge', NULL),
  ('2026-04-05', 'NIP Charge + VAT',  -53.75, 'bank_charge', NULL),
  ('2026-04-15', 'NIP Charge + VAT',  -53.75, 'bank_charge', NULL),
  ('2026-04-25', 'NIP Charge + VAT',  -53.75, 'bank_charge', NULL),

-- ─── FGN STAMP DUTY — PLACEHOLDER amounts/dates: update from bank statement ──
-- Stamp duty is charged on eligible credits. Typical rate: ₦50 per ₦10,000 credit.
-- TODO: Replace with exact amounts and dates from bank statement.
  ('2025-08-10', 'FGN Stamp Duty',    -50.00, 'tax', NULL),
  ('2025-09-05', 'FGN Stamp Duty',    -50.00, 'tax', NULL),
  ('2025-09-22', 'FGN Stamp Duty',    -50.00, 'tax', NULL),
  ('2025-10-08', 'FGN Stamp Duty',   -100.00, 'tax', NULL),
  ('2025-10-20', 'FGN Stamp Duty',   -100.00, 'tax', NULL),
  ('2025-11-10', 'FGN Stamp Duty',   -100.00, 'tax', NULL),
  ('2025-12-05', 'FGN Stamp Duty',   -150.00, 'tax', NULL),
  ('2025-12-18', 'FGN Stamp Duty',   -150.00, 'tax', NULL),
  ('2026-01-10', 'FGN Stamp Duty',   -100.00, 'tax', NULL),
  ('2026-01-22', 'FGN Stamp Duty',   -100.00, 'tax', NULL),
  ('2026-02-12', 'FGN Stamp Duty',   -100.00, 'tax', NULL),
  ('2026-03-08', 'FGN Stamp Duty',   -100.00, 'tax', NULL),
  ('2026-04-05', 'FGN Stamp Duty',   -150.00, 'tax', NULL),
  ('2026-04-15', 'FGN Stamp Duty',   -150.00, 'tax', NULL),
  ('2026-04-25', 'FGN Stamp Duty',   -150.00, 'tax', NULL),

-- ─── SMS CHARGES — PLACEHOLDER: update from bank statement ───────────────────
  ('2025-08-31', 'SMS Charges',   -50.00, 'bank_charge', NULL),
  ('2025-09-30', 'SMS Charges',   -50.00, 'bank_charge', NULL),
  ('2025-10-31', 'SMS Charges',   -50.00, 'bank_charge', NULL),
  ('2025-11-30', 'SMS Charges',   -50.00, 'bank_charge', NULL),
  ('2025-12-31', 'SMS Charges',   -50.00, 'bank_charge', NULL),
  ('2026-01-31', 'SMS Charges',   -50.00, 'bank_charge', NULL),
  ('2026-02-28', 'SMS Charges',   -50.00, 'bank_charge', NULL),
  ('2026-03-31', 'SMS Charges',   -50.00, 'bank_charge', NULL),

-- ─── BROKER TRANSFERS — Zenith to CHD (outflows) ─────────────────────────────
-- Dates are approximate. Update with exact dates from bank statement.
  ('2025-08-10', 'Transfer to CHD — Chapel Hill Denham',  -200000.00, 'broker_transfer', NULL),
  ('2025-09-05', 'Transfer to CHD — Chapel Hill Denham',  -400000.00, 'broker_transfer', NULL),
  ('2025-09-15', 'Transfer to CHD — Chapel Hill Denham',  -400000.00, 'broker_transfer', NULL),
  ('2025-09-22', 'Transfer to CHD — Chapel Hill Denham',  -550000.00, 'broker_transfer', NULL),
  ('2025-10-08', 'Transfer to CHD — Chapel Hill Denham',  -200000.00, 'broker_transfer', NULL),
  ('2025-10-20', 'Transfer to CHD — Chapel Hill Denham',  -600000.00, 'broker_transfer', NULL),
  ('2025-11-10', 'Transfer to CHD — Chapel Hill Denham',  -205000.00, 'broker_transfer', NULL),
  ('2025-11-20', 'Transfer to CHD — Chapel Hill Denham',  -200000.00, 'broker_transfer', NULL),
  ('2025-12-05', 'Transfer to CHD — Chapel Hill Denham', -1000000.00, 'broker_transfer', NULL),
  ('2025-12-18', 'Transfer to CHD — Chapel Hill Denham', -1200000.00, 'broker_transfer', NULL),
  ('2026-01-10', 'Transfer to CHD — Chapel Hill Denham',  -600000.00, 'broker_transfer', NULL),
  ('2026-01-22', 'Transfer to CHD — Chapel Hill Denham',  -830000.00, 'broker_transfer', NULL),
  ('2026-02-12', 'Transfer to CHD — Chapel Hill Denham',  -350000.00, 'broker_transfer', NULL),
  ('2026-03-08', 'Transfer to CHD — Chapel Hill Denham',  -600000.00, 'broker_transfer', NULL),
  ('2026-03-20', 'Transfer to CHD — Chapel Hill Denham',  -360000.00, 'broker_transfer', NULL),
  ('2026-04-05', 'Transfer to CHD — Chapel Hill Denham', -1150000.00, 'broker_transfer', NULL),
  ('2026-04-15', 'Transfer to CHD — Chapel Hill Denham',  -805000.00, 'broker_transfer', NULL),
  ('2026-04-25', 'Transfer to CHD — Chapel Hill Denham', -1350000.00, 'broker_transfer', NULL),

-- ─── NSE SETTLEMENT — UACN sell proceeds returned from CHD to Zenith ─────────
  ('2026-04-02', 'NSE Settlement — UACN sell proceeds transferred from CHD',
   798206.87, 'broker_transfer', 'NSE-SETTLEMENT-UACN');
