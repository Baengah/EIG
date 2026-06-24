-- EIG Platform — Update from EIG_Consolidated_Ledger_5.pdf (18-Jun-2026)
-- Builds on migration 021 (which covered v4 changes through Jun-8-2026).
--
-- Delta from v4 → v5:
--   1. Two missing Oct-27-25 CHD direct contributions (Tobi Amida 100k, Adegun 100k)
--      — share of a single operator transfer, separate from same-day Zenith entries
--   2. FCMB purchase now traced: 50,000 @ ₦10.00 public offer 30-Oct-25 (₦500,000 cost)
--      — migration 021 inserted FCMB holding at nil avg cost; corrected here
--   3. Four new Jun-16-26 CHD buy transactions (NGXGROUP, ACCESSCORP, ARADEL ×2)
--   4. Full holdings reset to v5 CSCS-reconciled final positions
--      — covers both the v5 delta AND the May-Jun buy transactions added in mig021
--        that were never reflected in the holdings table

BEGIN;


-- ============================================================
-- STEP 1: Missing Oct-27-25 CHD direct contributions
--
-- The 27-Oct-2025 broker inflow (₦200,000 total, operator: Tobi Amida)
-- was split equally between Tobi Amida and Ayodeji Adegun (100k each).
-- Migration 009 captured same-day Zenith entries for both; these are the
-- CHD-side entries that were missed in migrations 020 and 021.
-- ============================================================

INSERT INTO public.member_contributions
  (member_id, amount, contribution_date, payment_method, bank_reference, notes)
SELECT m.id, v.amount, v.dt, 'bank_transfer', v.ref, v.note
FROM (VALUES
  ('oluwatobi.amida@eigmembers.ng', 100000.00, '2025-10-27'::date,
   'INV-AELLA TOBI AMIDA',
   'Oct 2025 contribution — CHD direct inflow 27-Oct-25 (shared: Tobi Amida 100k split)'),
  ('ayodeji.adegun@eigmembers.ng',  100000.00, '2025-10-27'::date,
   'INV-AELLA TOBI AMIDA',
   'Oct 2025 contribution — CHD direct inflow 27-Oct-25 (shared: Adegun 100k split)')
) AS v(email, amount, dt, ref, note)
JOIN public.members m ON m.email = v.email
WHERE NOT EXISTS (
  SELECT 1 FROM public.member_contributions mc
  WHERE mc.member_id         = m.id
    AND mc.contribution_date  = v.dt
    AND mc.amount             = v.amount
    AND mc.bank_reference     = v.ref
);


-- ============================================================
-- STEP 2: FCMB — add traced public-offer buy transaction
--
-- Migration 021 inserted the FCMB holding at nil average cost
-- because the purchase had not been traced. v5 traces it to a
-- 30-Oct-2025 NGX public offer: 50,000 shares @ ₦10.00 = ₦500,000.
-- The public offer was settled through CHD Securities on that date.
-- This is a public-offer buy, so no brokerage / SEC / CSCS fees apply.
-- ============================================================

INSERT INTO public.transactions (
  transaction_date, transaction_type, asset_type,
  stock_id, broker_account_id,
  quantity, price, gross_amount,
  brokerage_fee, sec_fee, cscs_fee, stamp_duty, total_fees, net_amount,
  contract_note_number, settlement_date, notes
)
SELECT
  '2025-10-30'::date,
  'buy',
  'stock',
  s.id,
  ba.id,
  50000,
  10.00,
  500000.00,
  0, 0, 0, 0, 0,
  500000.00,
  'PO-FCMB-OCT25',
  '2025-10-30'::date,
  'FCMB Group Plc public offer — 50,000 shares @ ₦10.00; per CHD broker statement 30-Oct-2025'
FROM public.stocks s
CROSS JOIN (
  SELECT id FROM public.broker_accounts
  WHERE broker_name ILIKE '%chapel hill%' OR broker_name ILIKE '%chd%'
  LIMIT 1
) ba
WHERE s.ticker = 'FCMB'
  AND NOT EXISTS (
    SELECT 1 FROM public.transactions t
    WHERE t.contract_note_number = 'PO-FCMB-OCT25'
  );


-- ============================================================
-- STEP 3: Jun-16-26 buy transactions
--
-- Four purchases on 16-Jun-2026 (settlement: 18-Jun-2026).
-- No bank transfer preceded these — the broker cash account
-- went negative (overdrawn ₦298,229.72) after settlement.
-- Fees back-calculated from ledger net amounts.
-- ============================================================

INSERT INTO public.transactions (
  transaction_date, transaction_type, asset_type,
  stock_id, broker_account_id,
  quantity, price, gross_amount,
  brokerage_fee, sec_fee, cscs_fee, stamp_duty, total_fees, net_amount,
  contract_note_number, settlement_date, notes
)
SELECT
  v.txn_date,
  'buy',
  'stock',
  s.id,
  ba.id,
  v.qty,
  v.price,
  v.gross,
  v.broker_fee,
  v.sec_fee,
  v.cscs_fee,
  v.stamp_duty,
  v.total_fees,
  v.net_amt,
  v.note_num,
  v.settle_date,
  'CHD contract note ' || v.note_num
FROM (VALUES
  ('CHD-JUN26-03','2026-06-16'::date,'NGXGROUP',  710, 134.950,  95814.50, 1392.66, 287.44, 4.30,  76.65, 1761.05,  97575.55,'2026-06-18'::date),
  ('CHD-JUN26-04','2026-06-16'::date,'ACCESSCORP',4100, 24.100,  98810.00, 1436.13, 296.43, 4.30,  79.05, 1815.91, 100625.91,'2026-06-18'::date),
  ('CHD-JUN26-05','2026-06-16'::date,'ARADEL',      60,1668.000, 100080.00, 1454.56, 300.24, 4.30,  80.06, 1839.16, 101919.16,'2026-06-18'::date),
  ('CHD-JUN26-06','2026-06-16'::date,'ARADEL',       2,1668.000,   3336.00,   50.56,  10.01, 4.30,   2.67,   67.54,   3403.54,'2026-06-18'::date)
) AS v(note_num, txn_date, ticker, qty, price, gross, broker_fee, sec_fee, cscs_fee, stamp_duty, total_fees, net_amt, settle_date)
JOIN public.stocks s ON s.ticker = v.ticker
CROSS JOIN (
  SELECT id FROM public.broker_accounts
  WHERE broker_name ILIKE '%chapel hill%' OR broker_name ILIKE '%chd%'
  LIMIT 1
) ba
WHERE NOT EXISTS (
  SELECT 1 FROM public.transactions t
  WHERE t.contract_note_number = v.note_num
);


-- ============================================================
-- STEP 4: Full holdings reset to v5 CSCS-reconciled values
--
-- Source of truth: NGX Equity Holdings table in v5, reconciled
-- to the CSCS register as at 16-Jun-2026 (including Jun-16 trades
-- that were pending settlement but now settled).
--
-- This replaces both:
--   a) The nil-cost FCMB holding from migration 021
--   b) The stale quantities for holdings that never had a trigger
--      updating them from the May–Jun buy transactions
--
-- avg_cost = total_cost / quantity (6dp to minimise rounding in
-- the GENERATED total_cost = quantity * average_cost column).
-- ============================================================

DELETE FROM public.holdings WHERE asset_type = 'stock';

INSERT INTO public.holdings (asset_type, stock_id, broker_account_id, quantity, average_cost)
SELECT 'stock', s.id, ba.id, v.qty, v.avg_cost
FROM (VALUES
  ('GTCO',       15877,  101.559827),
  ('ZENITHBANK', 43593,   74.671327),
  ('MTNN',        6497,  588.736754),
  ('ARADEL',      2669, 1204.997131),
  ('PRESCO',       713, 1501.069483),
  ('NGXGROUP',    6510,  153.793475),
  ('ACCESSCORP', 16834,   26.076497),
  ('INITIATES',  42000,    9.500000),
  ('FCMB',       50000,   10.000000)
) AS v(ticker, qty, avg_cost)
JOIN public.stocks s ON s.ticker = v.ticker
CROSS JOIN (
  SELECT id FROM public.broker_accounts
  WHERE broker_name ILIKE '%chapel hill%' OR broker_name ILIKE '%chd%'
  LIMIT 1
) ba;


-- ============================================================
-- STEP 5: Rebuild bank_statement_txns
-- (picks up the two new Oct-27-25 contributions and the FCMB
-- public-offer transaction added above)
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

-- b) Bank ledger entries (interest, charges, taxes, broker flows)
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

-- c) Dividends credited to Zenith bank account
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
-- STEP 6: Refresh portfolio snapshot
-- ============================================================
SELECT public.create_portfolio_snapshot(CURRENT_DATE);

COMMIT;
