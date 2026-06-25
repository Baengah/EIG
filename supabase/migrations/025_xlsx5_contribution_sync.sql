-- EIG Platform — Contribution sync from EIG_Consolidated_Ledger_5.xlsx (24-Jun-2026)
--
-- Compared all 76 contribution rows in the xlsx against the DB after migrations 009–022.
-- Delta: exactly ONE row is missing from the DB.
--
-- Missing entry:
--   Amida Oluwatobi Paul (Tobi Amida)
--   Date: 2025-09-26
--   Amount: ₦100,000
--   Account: CHD Securities (brokerage direct — not via Zenith bank)
--   Source: "Contribution paid directly into brokerage (per broker stmt; confirmed GO)"
--
-- This row was present in every other migration's NOT EXISTS guard but was never
-- explicitly seeded. Migration 020 added Sep 2025 CHD-direct entries for Tobi Amida
-- only for Oct 2025 onwards (10-06, 10-14). The 26-Sep-25 CHD entry was omitted.
--
-- After applying this migration, if the unit register (migration 023) is live,
-- run "Compute NAV" from the /nav admin page to price this contribution.

BEGIN;


-- ============================================================
-- STEP 1: Insert missing Sep-2025 CHD contribution for Tobi Amida
-- ============================================================

INSERT INTO public.member_contributions
  (member_id, amount, contribution_date, payment_method, bank_reference, notes)
SELECT
  m.id,
  100000.00,
  '2025-09-26'::date,
  'bank_transfer',
  'CHD-direct',
  'Sep 2025 contribution paid directly into CHD brokerage (per broker stmt; confirmed GO)'
FROM public.members m
WHERE m.email = 'oluwatobi.amida@eigmembers.ng'
  AND NOT EXISTS (
    SELECT 1 FROM public.member_contributions mc
    WHERE mc.member_id        = m.id
      AND mc.contribution_date = '2025-09-26'::date
      AND mc.amount            = 100000.00
  );


-- ============================================================
-- STEP 2: Rebuild bank_statement_txns from corrected source data
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


COMMIT;
