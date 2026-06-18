-- EIG Platform — Update from EIG_Consolidated_Ledger_4.pdf (18-Jun-2026)
-- Source: Pooled Investment Ledger v4 — statement through 17-Jun-2026
--
-- Changes vs the database after migration 020:
--   1. Missing member contributions (May 2026 + Tobi Amida Mar-26)
--   2. The Initiates Plc IPO — allotment confirmed (42,000 @ ₦9.50)
--   3. FCMB restored as a CSCS holding (50,000 units, nil cost)
--   4. May–Jun 2026 stock purchase transactions (11 buys)
--   5. Missing dividends: GTCO Apr-26 (₦141,582.17) + NGXGROUP Apr-26 (₦6,930.00)
--   6. Apr–Jun 2026 bank ledger entries (charges, interest, broker flows)
--   7. Stock prices updated to CSCS valuation as at 16-Jun-2026

BEGIN;


-- ============================================================
-- STEP 1: Missing member contributions
--
-- All 6 members' May 2026 payments + Tobi Amida's overlooked
-- Mar-26 Zenith transfer (not in migration 020).
-- Guard: NOT EXISTS on (member_id, contribution_date, amount)
-- ============================================================

INSERT INTO public.member_contributions
  (member_id, amount, contribution_date, payment_method, bank_reference, notes)
SELECT m.id, v.amount, v.dt, 'bank_transfer', v.ref, v.note
FROM (VALUES
  -- ── Oluwagbemiga Omolokun ─────────────────────────────────────
  ('gbenga.omolokun@gmail.com',           200000.00, '2026-05-27'::date,
   'ISW/CIP', 'May 2026 contribution — VFD MFB a/c 1000073844'),

  -- ── Amida Oluwatosin James ────────────────────────────────────
  ('oluwatosin.james@eigmembers.ng',      200000.00, '2026-05-28'::date,
   'CIP', 'May 2026 contribution — CIP CR/AMIDA OLUWATOSIN JAMES'),

  -- ── Olujimi Curtis-Joseph ─────────────────────────────────────
  ('olujimi.curtisjoseph@eigmembers.ng',  200000.00, '2026-05-27'::date,
   'bank_transfer', 'May 2026 contribution — NIP/AELLA/Olujimi Curtis-joseph'),

  -- ── Gbolaro Ebenezer Olulade ──────────────────────────────────
  ('gbolaro.olulade@eigmembers.ng',       200000.00, '2026-05-28'::date,
   'bank_transfer', 'May 2026 contribution — NIP/STBC/GBOLARO EBENEZER OLULADE'),

  -- ── Amida Oluwatobi Paul (Tobi Amida) ────────────────────────
  ('oluwatobi.amida@eigmembers.ng',       200000.00, '2026-03-26'::date,
   'CIP', 'Mar 2026 contribution — CIP CR/AMIDA OLUWATOBI PAUL/NIP Transfer (Zenith)'),
  ('oluwatobi.amida@eigmembers.ng',       200000.00, '2026-05-26'::date,
   'bank_transfer', 'May 2026 contribution — NIP/AELLA/OLUWATOBI AMIDA/N/A'),

  -- ── Ayodeji Adegun ────────────────────────────────────────────
  ('ayodeji.adegun@eigmembers.ng',        200000.00, '2026-05-31'::date,
   'bank_transfer', 'May 2026 contribution — NIP/FCMB/MIKE AND MARY''S CATERING (Ayodeji Adegun)')

) AS v(email, amount, dt, ref, note)
JOIN public.members m ON m.email = v.email
WHERE NOT EXISTS (
  SELECT 1 FROM public.member_contributions mc
  WHERE mc.member_id        = m.id
    AND mc.contribution_date = v.dt
    AND mc.amount            = v.amount
);


-- ============================================================
-- STEP 2: The Initiates Plc — allotment confirmed
--
-- Migration 020 inserted the IPO subscription with NULL quantity
-- (units pending allotment). The CSCS register as at 16-Jun-2026
-- confirms 42,000 shares allotted at ₦9.50/share subscription price.
-- Update the transaction and insert the holdings row.
-- ============================================================

-- 2a. Update the IPO transaction to reflect confirmed allotment
UPDATE public.transactions
SET
  quantity      = 42000,
  price         = 9.50,
  gross_amount  = 399000.00,
  net_amount    = 399000.00,
  notes         = 'The Initiates Plc public offer — 42,000 shares allotted per CSCS register 16-Jun-2026; subscription ₦399,000'
WHERE contract_note_number = 'IPO-INITIATES-JAN26'
  AND quantity IS NULL;

-- 2b. Insert holding for The Initiates (trigger would have skipped NULL-qty row)
INSERT INTO public.holdings (asset_type, stock_id, broker_account_id, quantity, average_cost)
SELECT 'stock', s.id, ba.id, 42000, 9.50
FROM public.stocks s
CROSS JOIN (
  SELECT id FROM public.broker_accounts
  WHERE broker_name ILIKE '%chapel hill%' OR broker_name ILIKE '%chd%'
  LIMIT 1
) ba
WHERE s.ticker = 'INITIATES'
  AND NOT EXISTS (
    SELECT 1 FROM public.holdings h
    WHERE h.stock_id = s.id AND h.asset_type = 'stock'
  );


-- ============================================================
-- STEP 3: FCMB — restore as CSCS holding (nil cost)
--
-- Migration 020 removed a phantom FCMB holding. The new PDF
-- (v4) confirms 50,000 FCMB shares appear in the CSCS register
-- as at 16-Jun-2026 with no traceable cash purchase. Restored
-- at nil cost; market value is ₦11.10 × 50,000 = ₦555,000.
-- ============================================================

INSERT INTO public.holdings (asset_type, stock_id, broker_account_id, quantity, average_cost)
SELECT 'stock', s.id, ba.id, 50000, 0.00
FROM public.stocks s
CROSS JOIN (
  SELECT id FROM public.broker_accounts
  WHERE broker_name ILIKE '%chapel hill%' OR broker_name ILIKE '%chd%'
  LIMIT 1
) ba
WHERE s.ticker = 'FCMB'
  AND NOT EXISTS (
    SELECT 1 FROM public.holdings h
    WHERE h.stock_id = s.id AND h.asset_type = 'stock'
  );


-- ============================================================
-- STEP 4: May–Jun 2026 stock purchase transactions
--
-- Migration 014 covered through 2026-04-30.
-- Guard: NOT EXISTS on (transaction_date, stock_id, quantity)
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
  -- 07-May-26
  ('CHD-MAY26-01','2026-05-07'::date,'MTNN',   245, 812.000, 198940.00, 2887.28,  596.82,  4.30, 159.15,  3647.55, 202587.55,'2026-05-09'::date),
  ('CHD-MAY26-02','2026-05-07'::date,'ARADEL',  100,1821.500, 182150.00, 2643.42,  546.45,  4.30, 145.72,  3339.89, 185489.89,'2026-05-09'::date),
  ('CHD-MAY26-03','2026-05-07'::date,'ARADEL',   15,1821.500,  27322.50,  396.55,   81.97,  4.30,  21.86,   504.68,  27827.18,'2026-05-09'::date),
  ('CHD-MAY26-04','2026-05-07'::date,'MTNN',     8, 812.000,   6496.00,   94.26,   19.49,  4.30,   5.20,   123.25,   6619.25,'2026-05-09'::date),
  -- 29-May-26
  ('CHD-MAY26-05','2026-05-29'::date,'MTNN',   370, 817.800, 302586.00, 4391.19, 907.76,   4.30, 242.07,  5545.32, 308131.32,'2026-06-02'::date),
  ('CHD-MAY26-06','2026-05-29'::date,'ARADEL',   7,1872.000,  13104.00,  190.23,   39.31,  4.30,  10.48,   244.32,  13348.32,'2026-06-02'::date),
  ('CHD-MAY26-07','2026-05-29'::date,'ARADEL', 151,1874.000, 282974.00, 4106.06, 848.92,   4.30, 226.38,  5185.66, 288159.66,'2026-06-02'::date),
  ('CHD-MAY26-08','2026-05-29'::date,'NGXGROUP',1950, 145.500, 283725.00, 4117.67, 851.18,  4.30, 226.98,  5200.13, 288925.13,'2026-06-02'::date),
  ('CHD-MAY26-09','2026-05-29'::date,'ZENITHBANK',710, 131.300,  93223.00, 1352.90, 279.67,  4.30,  74.58,  1711.45,  94934.45,'2026-06-02'::date),
  ('CHD-MAY26-10','2026-05-29'::date,'ZENITHBANK', 50, 131.300,   6565.00,   95.29,  19.70,  4.30,   5.25,   124.54,   6689.54,'2026-06-02'::date),
  -- 08-Jun-26
  ('CHD-JUN26-01','2026-06-08'::date,'MTNN',   235, 801.700, 188399.50, 2733.89, 565.20,   4.30, 150.72,  3454.11, 191853.61,'2026-06-10'::date),
  ('CHD-JUN26-02','2026-06-08'::date,'MTNN',    10, 801.700,   8017.00,  116.37,  24.05,   4.30,   6.41,   151.13,   8168.13,'2026-06-10'::date)
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
-- STEP 5: FCMB — add as CSCS-only holding (nil-cost transfer in)
--
-- No cash purchase traced. Record as a transfer_in at nil cost
-- so the holding is visible in the portfolio. This does NOT
-- flow through the trigger (the INSERT in step 3 handles it).
-- ============================================================
-- (Holding already inserted in step 3; no transaction row needed
--  for a CSCS-origin position with no confirmed contract note)


-- ============================================================
-- STEP 6: Missing dividends
--
-- Migration 020 added ZENITHBANK and MTNN May-26 dividends.
-- GTCO Apr-26 and NGXGROUP Apr-26 were not in any prior migration.
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
  ('2026-04-28'::date, 'GTCO',     141582.17,
   'GTCO dividend payment 67 — NEFT/ZIB/DATAMAX REGISTRARS/PYT 67/GTCODIV8'),
  ('2026-04-29'::date, 'NGXGROUP',   6930.00,
   'NGX Group dividend 5 — NEFT/ZIB/NGX DIVIDEND 5/NGXGROUPDIV5')
) AS v(txn_date, ticker, amount, note)
JOIN public.stocks s ON s.ticker = v.ticker
WHERE NOT EXISTS (
  SELECT 1 FROM public.transactions t
  WHERE t.transaction_type = 'dividend'
    AND t.stock_id          = s.id
    AND t.transaction_date  = v.txn_date
    AND t.net_amount        = v.amount
);


-- ============================================================
-- STEP 7: Apr–Jun 2026 bank ledger entries
--
-- Migration 006 seeded through Mar-26. Migration 020 added Apr-26
-- SMS charge and May-26 stamp duty (for dividends). Remaining
-- entries for Apr–Jun 2026 are added here.
-- ============================================================

INSERT INTO public.bank_ledger (entry_date, description, amount, category, bank_reference)
SELECT v.dt, v.desc, v.amt, v.cat, NULL
FROM (VALUES
  -- Apr 2026
  ('2026-04-14'::date, 'NIP Charge + VAT',            -53.75,  'bank_charge'),
  ('2026-04-14'::date, 'FGN Stamp Duty',               -50.00,  'tax'),
  ('2026-04-14'::date, 'To Broker (CHD)',           -805000.00, 'broker_transfer'),
  ('2026-04-14'::date, 'From Broker (UACN proceeds)', 798206.87,'broker_transfer'),
  ('2026-04-30'::date, 'NIP Charge + VAT',            -53.75,  'bank_charge'),
  ('2026-04-30'::date, 'FGN Stamp Duty',               -50.00,  'tax'),
  ('2026-04-30'::date, 'To Broker (CHD)',          -1350000.00, 'broker_transfer'),
  ('2026-04-30'::date, 'Bank Interest',                2885.73, 'interest_income'),
  ('2026-04-30'::date, 'State Withholding Tax',        -288.57, 'tax'),
  -- May 2026
  ('2026-05-07'::date, 'NIP Charge + VAT',             -53.75, 'bank_charge'),
  ('2026-05-07'::date, 'FGN Stamp Duty',                -50.00, 'tax'),
  ('2026-05-07'::date, 'To Broker (CHD)',           -400000.00, 'broker_transfer'),
  ('2026-05-29'::date, 'NIP Charge + VAT',             -53.75, 'bank_charge'),
  ('2026-05-29'::date, 'FGN Stamp Duty',                -50.00, 'tax'),
  ('2026-05-29'::date, 'To Broker (CHD)',          -1000000.00, 'broker_transfer'),
  ('2026-05-30'::date, 'SMS Charges 24-Apr to 28-May', -152.00, 'bank_charge'),
  ('2026-05-31'::date, 'Bank Interest',                  735.17, 'interest_income'),
  ('2026-05-31'::date, 'State Withholding Tax',           -73.52, 'tax'),
  -- Jun 2026
  ('2026-06-08'::date, 'NIP Charge + VAT',              -53.75, 'bank_charge'),
  ('2026-06-08'::date, 'FGN Stamp Duty',                 -50.00, 'tax'),
  ('2026-06-08'::date, 'To Broker (CHD)',            -200000.00, 'broker_transfer')
) AS v(dt, desc, amt, cat)
WHERE NOT EXISTS (
  SELECT 1 FROM public.bank_ledger bl
  WHERE bl.entry_date   = v.dt
    AND bl.category     = v.cat
    AND bl.amount       = v.amt
    AND bl.description  = v.desc
);


-- ============================================================
-- STEP 8: Update stock prices to CSCS valuation 16-Jun-2026
--
-- Prices from the NGX Equity Holdings table in the PDF.
-- Also adds price for THE INITIATES (IPO allotted).
-- ============================================================

INSERT INTO public.stock_prices (stock_id, price_date, closing_price, scrape_source)
SELECT s.id, '2026-06-16'::date, v.price, 'manual_seed_pdf4'
FROM (VALUES
  ('GTCO',         126.00),
  ('ZENITHBANK',   120.00),
  ('MTNN',         800.00),
  ('ARADEL',      1670.00),
  ('PRESCO',      2300.00),
  ('NGXGROUP',     135.00),
  ('ACCESSCORP',    23.95),
  ('INITIATES',     31.30),
  ('FCMB',          11.10)
) AS v(ticker, price)
JOIN public.stocks s ON s.ticker = v.ticker
ON CONFLICT (stock_id, price_date) DO UPDATE SET
  closing_price = EXCLUDED.closing_price,
  scrape_source = EXCLUDED.scrape_source;


-- ============================================================
-- STEP 9: Rebuild bank_statement_txns from corrected data
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

-- b) Bank ledger entries
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

-- c) Dividends paid into Zenith bank account
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
-- STEP 10: Refresh portfolio snapshot
-- ============================================================
SELECT public.create_portfolio_snapshot(CURRENT_DATE);

COMMIT;
