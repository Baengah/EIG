-- EIG Platform — Update from Aug-2026 statement bundle
--   1. Zenith bank statement (SA 2290556463), Jan-2026 to 20-Aug-2026
--   2. ChapelHill Denham cash statement, Jul-2026 to 21-Aug-2026
--   3. CSCS holdings statement, as at 20-Aug-2026
--
-- Builds on migration 025 (contributions to 01-Jul-2026), migration 022
-- (bank_ledger to 05-May-2026, holdings/trades to 16-Jun-2026), and
-- migration 026 (broker cash balance fix — confirmed NOT applied to
-- production; this migration re-applies the correct value).
--
-- Delta:
--   1. 5 new member contributions (Jul/Aug 2026); Adegun has no new
--      contribution in this statement window.
--   2. 2 new dividends: ARADEL (30-Jul), NGXGROUP (05-Aug)
--   3. 30 new bank_ledger entries filling the gap from 07-May to
--      17-Aug-2026 (7 broker transfers + fees, 3 SMS charges, 3 months
--      of capitalised interest / withholding tax)
--   4. 8 new CHD buy transactions (Jul/Aug 2026)
--   5. Broker cash balance corrected to ChapelHill's 21-Aug-2026 closing
--      balance (₦240,094.12)
--   6. Full holdings reset to CSCS-reconciled values as at 20-Aug-2026
--
-- ⚠ KNOWN GAP: applying the 8 traced buy transactions on top of the
-- 16-Jun-2026 baseline does NOT fully explain the CSCS balances for
-- 4 counters. The CHD cash statement supplied does not itemise every
-- trade in this window (or there were bonus/rights shares processed
-- outside the cash account). CSCS is treated as the source of truth
-- for quantity (consistent with migration 022's approach for FCMB);
-- the untraced share deltas are absorbed into the average cost below
-- at the blended rate, same as migration 021/025 did for FCMB's
-- then-untraced purchase. Flagged here for correction if contract
-- notes for the gap surface later:
--   ACCESSCORP: +4,000 shares unexplained (18,439 known → 22,439 actual)
--   ZENITHBANK: +1,800 shares unexplained (44,543 known → 46,343 actual)
--   NGXGROUP:     +564 shares unexplained ( 8,834 known →  9,398 actual)
--   MTNN:          −88 shares unexplained ( 7,321 known →  7,233 actual;
--                  possible untraced sell — needs investigation)

BEGIN;


-- ============================================================
-- STEP 1: New member contributions (Jul/Aug 2026)
-- ============================================================

INSERT INTO public.member_contributions
  (member_id, amount, contribution_date, payment_method, bank_reference, notes)
SELECT m.id, v.amount, v.dt, 'bank_transfer', v.ref, v.note
FROM (VALUES
  ('gbenga.omolokun@gmail.com', 200000.00, '2026-07-27'::date,
   'ISW/CIP', 'Jul 2026 contribution — CIP CR/OLUWAGBEMIGA OMOLOLU OMOLOKUN'),
  ('oluwatosin.james@eigmembers.ng', 200000.00, '2026-07-27'::date,
   'CIP', 'Jul 2026 contribution — CIP CR/AMIDA OLUWATOSIN JAMES/July EIG Tosin Amida'),
  ('oluwatobi.amida@eigmembers.ng', 200000.00, '2026-07-27'::date,
   'bank_transfer', 'Jul 2026 — NIP/AELLA/OLUWATOBI AMIDA/N/A'),
  ('gbolaro.olulade@eigmembers.ng', 200000.00, '2026-08-02'::date,
   'bank_transfer', 'Aug 2026 contribution — NIP/STBC/GBOLARO EBENEZER OLULADE/equity'),
  ('olujimi.curtisjoseph@eigmembers.ng', 200000.00, '2026-08-06'::date,
   'bank_transfer', 'Aug 2026 contribution — NIP/AELLA/Olujimi Curtis-joseph/Investment Transfer')
) AS v(email, amount, dt, ref, note)
JOIN public.members m ON m.email = v.email
WHERE NOT EXISTS (
  SELECT 1 FROM public.member_contributions mc
  WHERE mc.member_id         = m.id
    AND mc.contribution_date  = v.dt
    AND mc.amount             = v.amount
);


-- ============================================================
-- STEP 2: New dividends
-- ============================================================

INSERT INTO public.transactions (
  transaction_date, transaction_type, asset_type, stock_id,
  gross_amount, net_amount, notes
)
SELECT v.dt, 'dividend', 'stock', s.id, v.amount, v.amount, v.note
FROM (VALUES
  ('2026-07-30'::date, 'ARADEL',   56800.80, 'ARADEL DIV 34 BATCH 2 — NEFT/ZIB/ARADEL PAYMENT 24 OF 31/12/2025'),
  ('2026-08-05'::date, 'NGXGROUP',  9117.81, 'NGX DIVIDEND 6 — NEFT/ZIB/NGXGROUPDIV6')
) AS v(dt, ticker, amount, note)
JOIN public.stocks s ON s.ticker = v.ticker
WHERE NOT EXISTS (
  SELECT 1 FROM public.transactions t
  WHERE t.transaction_date = v.dt
    AND t.transaction_type = 'dividend'
    AND t.stock_id          = s.id
    AND t.net_amount        = v.amount
);


-- ============================================================
-- STEP 3: New bank_ledger entries (07-May to 17-Aug-2026)
-- ============================================================

INSERT INTO public.bank_ledger (entry_date, description, amount, category)
SELECT v.dt, v.ledger_desc, v.amt, v.cat
FROM (VALUES
  -- Broker transfers + fees
  ('2026-05-07'::date, 'Transfer to CHD — Chapel Hill Denham', -400000.00, 'broker_transfer'),
  ('2026-05-07'::date, 'NIP Charge + VAT',                        -53.75, 'bank_charge'),
  ('2026-05-07'::date, 'FGN Stamp Duty',                           -50.00, 'tax'),
  ('2026-05-29'::date, 'Transfer to CHD — Chapel Hill Denham', -1000000.00, 'broker_transfer'),
  ('2026-05-29'::date, 'NIP Charge + VAT',                        -53.75, 'bank_charge'),
  ('2026-05-29'::date, 'FGN Stamp Duty',                           -50.00, 'tax'),
  ('2026-06-08'::date, 'Transfer to CHD — Chapel Hill Denham',  -200000.00, 'broker_transfer'),
  ('2026-06-08'::date, 'NIP Charge + VAT',                        -53.75, 'bank_charge'),
  ('2026-06-08'::date, 'FGN Stamp Duty',                           -50.00, 'tax'),
  ('2026-06-29'::date, 'Transfer to CHD — Chapel Hill Denham',  -800000.00, 'broker_transfer'),
  ('2026-06-29'::date, 'NIP Charge + VAT',                        -53.75, 'bank_charge'),
  ('2026-06-29'::date, 'FGN Stamp Duty',                           -50.00, 'tax'),
  ('2026-07-02'::date, 'Transfer to CHD — Chapel Hill Denham',  -400000.00, 'broker_transfer'),
  ('2026-07-02'::date, 'NIP Charge + VAT',                        -53.75, 'bank_charge'),
  ('2026-07-02'::date, 'FGN Stamp Duty',                           -50.00, 'tax'),
  ('2026-07-31'::date, 'Transfer to CHD — Chapel Hill Denham',  -650000.00, 'broker_transfer'),
  ('2026-07-31'::date, 'NIP Charge + VAT',                        -53.75, 'bank_charge'),
  ('2026-07-31'::date, 'FGN Stamp Duty',                           -50.00, 'tax'),
  ('2026-08-17'::date, 'Transfer to CHD — Chapel Hill Denham',  -400000.00, 'broker_transfer'),
  ('2026-08-17'::date, 'NIP Charge + VAT',                        -53.75, 'bank_charge'),
  ('2026-08-17'::date, 'FGN Stamp Duty',                           -50.00, 'tax'),
  -- SMS charges
  ('2026-05-30'::date, 'SMS Charges', -152.00, 'bank_charge'),
  ('2026-06-27'::date, 'SMS Charges',  -48.00, 'bank_charge'),
  ('2026-07-25'::date, 'SMS Charges',  -72.00, 'bank_charge'),
  -- Capitalised interest / withholding tax
  ('2026-05-31'::date, 'Capitalised Interest — May 2026',        735.17, 'interest_income'),
  ('2026-05-31'::date, 'State Withholding Tax — May 2026',       -73.52, 'tax'),
  ('2026-06-30'::date, 'Capitalised Interest — Jun 2026',        873.18, 'interest_income'),
  ('2026-06-30'::date, 'State Withholding Tax — Jun 2026',       -87.32, 'tax'),
  ('2026-07-31'::date, 'Capitalised Interest — Jul 2026',        762.71, 'interest_income'),
  ('2026-07-31'::date, 'State Withholding Tax — Jul 2026',       -76.27, 'tax')
) AS v(dt, ledger_desc, amt, cat)
WHERE NOT EXISTS (
  SELECT 1 FROM public.bank_ledger bl
  WHERE bl.entry_date   = v.dt
    AND bl.description  = v.ledger_desc
    AND bl.amount       = v.amt
);


-- ============================================================
-- STEP 4: New CHD buy transactions (Jul/Aug 2026)
--
-- Fees are not itemised in the ChapelHill cash statement (it only
-- gives net contract amounts), so total_fees = net − gross and the
-- brokerage/SEC/CSCS/stamp breakdown columns are left at 0.
-- ============================================================

INSERT INTO public.transactions (
  transaction_date, transaction_type, asset_type,
  stock_id, broker_account_id,
  quantity, price, gross_amount, total_fees, net_amount,
  contract_note_number, settlement_date, notes
)
SELECT
  v.txn_date, 'buy', 'stock', s.id, ba.id,
  v.qty, v.price, v.gross, v.net_amt - v.gross, v.net_amt,
  v.note_num, v.txn_date,
  'CHD cash statement — fees not itemised (net contract amount only)'
FROM (VALUES
  ('CHD-JUL26-01',  '2026-07-03'::date, 'ARADEL',       75, 1315.00,  98625.00, 100437.52),
  ('CHD-JUL26-02',  '2026-07-03'::date, 'ZENITHBANK',  950,  105.00,  99750.00, 101583.12),
  ('CHD-JUL26-03',  '2026-07-03'::date, 'MTNN',        270,  749.90, 202473.00, 206206.59),
  ('0000014399',    '2026-08-03'::date, 'NGXGROUP',   1605,  139.90, 224559.50, 228657.83),
  ('0000014536',    '2026-08-03'::date, 'ACCESSCORP', 1605,   26.40,  42372.00,  43154.39),
  ('0000014602',    '2026-08-03'::date, 'MTNN',        211,  833.50, 175868.50, 179095.54),
  ('0000033286',    '2026-08-21'::date, 'MTNN',        343,  779.70, 267395.10, 272340.99),
  ('0000033447',    '2026-08-21'::date, 'NGXGROUP',    719,  124.00,  89156.00,  90795.12)
) AS v(note_num, txn_date, ticker, qty, price, gross, net_amt)
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
-- STEP 5: Broker cash balance
-- Per ChapelHill Denham cash statement, closing balance 21-Aug-2026.
-- ============================================================

UPDATE public.broker_accounts
SET    cash_balance = 240094.12
WHERE  is_active = true;


-- ============================================================
-- STEP 6: Full holdings reset to CSCS-reconciled values (20-Aug-2026)
--
-- avg_cost for GTCO/ARADEL/PRESCO/INITIATES/FCMB is a clean weighted
-- average of the 16-Jun-2026 baseline plus fully-traced new buys.
-- avg_cost for ACCESSCORP/ZENITHBANK/NGXGROUP/MTNN blends the same
-- known cost basis across the CSCS actual quantity — see the gap
-- note at the top of this file for the untraced share deltas.
-- ============================================================

DELETE FROM public.holdings WHERE asset_type = 'stock';

INSERT INTO public.holdings (asset_type, stock_id, broker_account_id, quantity, average_cost)
SELECT 'stock', s.id, ba.id, v.qty, v.avg_cost
FROM (VALUES
  ('GTCO',       15877,  101.559827),
  ('ZENITHBANK', 46343,   72.432304),
  ('MTNN',        7233,  619.751944),
  ('ARADEL',      2744, 1208.664309),
  ('PRESCO',       713, 1501.069483),
  ('NGXGROUP',    9398,  140.524417),
  ('ACCESSCORP', 22439,   21.486080),
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
-- STEP 7: Rebuild bank_statement_txns from corrected source data
-- ============================================================

DELETE FROM public.bank_statement_txns;

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
-- STEP 8: Refresh portfolio snapshot
-- ============================================================
SELECT public.create_portfolio_snapshot(CURRENT_DATE);

COMMIT;
