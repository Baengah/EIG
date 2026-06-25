-- EIG Platform — Full contribution sync from EIG_Consolidated_Ledger_5.xlsx (24-Jun-2026)
--
-- Source of truth: xlsx "Consolidated Ledger" sheet, Category = Contribution
-- 76 rows · 6 members · ₦15,102,198 total
--
-- This migration is idempotent — safe to run even if earlier migrations (009–022)
-- have not yet been applied to this Supabase instance. All inserts are guarded.
--
-- Special handling for 2025-10-27: both Tobi Amida and Adegun each made TWO
-- ₦100,000 contributions that day (one CHD direct, one Zenith). Guards for those
-- rows include bank_reference to prevent duplicates when prior migrations exist.
--
-- After applying, run "Compute NAV" from /nav if the unit register (mig 023) is live.

BEGIN;


-- ============================================================
-- STEP 0: Ensure member identities are correct
-- (Defensive — these are no-ops if migrations 010/019/020 were
--  already applied. Safe to run multiple times.)
-- ============================================================

-- Mike and Mary Catering → Ayodeji Adegun (migration 020 fix)
UPDATE public.members
SET full_name = 'Ayodeji Adegun',
    email     = 'ayodeji.adegun@eigmembers.ng',
    notes     = 'Contributions via FCMB (Mike & Mary Catering business a/c); confirmed Ayodeji Adegun'
WHERE email = 'mikeandmarys@eigmembers.ng';

-- Canonical full name for Tobi Amida (migration 020 fix)
UPDATE public.members
SET full_name = 'Amida Oluwatobi Paul (Tobi Amida)'
WHERE email = 'oluwatobi.amida@eigmembers.ng';

-- Merge duplicate Tobi Amida record if it exists (migration 019 fix)
UPDATE public.member_contributions
SET member_id = (SELECT id FROM public.members WHERE email = 'oluwatobi.amida@eigmembers.ng')
WHERE member_id = (SELECT id FROM public.members WHERE email = 'oluwatobi.paul@eigmembers.ng')
  AND EXISTS (SELECT 1 FROM public.members WHERE email = 'oluwatobi.amida@eigmembers.ng')
  AND EXISTS (SELECT 1 FROM public.members WHERE email = 'oluwatobi.paul@eigmembers.ng');

DELETE FROM public.members WHERE email = 'oluwatobi.paul@eigmembers.ng';


-- ============================================================
-- STEP 1: Insert all 72 regular contributions
-- Guard: NOT EXISTS on (member_id, contribution_date, amount)
-- ============================================================

INSERT INTO public.member_contributions
  (member_id, amount, contribution_date, payment_method, bank_reference, notes)
SELECT m.id, v.amount, v.dt, 'bank_transfer', v.ref, v.note
FROM (VALUES
  -- ── Oluwagbemiga Omololu Omolokun (Gbenga) ────────────────────
  ('gbenga.omolokun@gmail.com', 200000.00, '2025-07-31'::date,
   'CHD-Paramount', 'Jul 2025 — Chapel Hill Paramount Fund initial subscription'),
  ('gbenga.omolokun@gmail.com', 200000.00, '2025-08-26'::date,
   'ISW/CIP', 'Aug 2025 contribution'),
  ('gbenga.omolokun@gmail.com', 400000.00, '2025-09-19'::date,
   'ISW/CIP', 'Double contribution / advance payment'),
  ('gbenga.omolokun@gmail.com', 200000.00, '2025-09-26'::date,
   'ISW/CIP', 'Sep 2025 contribution'),
  ('gbenga.omolokun@gmail.com', 200000.00, '2025-10-27'::date,
   'ISW/CIP', 'Oct 2025 contribution'),
  ('gbenga.omolokun@gmail.com', 200000.00, '2025-11-25'::date,
   'ISW/VFD', 'Nov 2025 contribution 1 — VFD MFB a/c 1000073844 transfer 1'),
  ('gbenga.omolokun@gmail.com', 200000.00, '2025-11-26'::date,
   'ISW/CIP', 'Nov 2025 contribution 2'),
  ('gbenga.omolokun@gmail.com', 400000.00, '2025-12-20'::date,
   'ISW/VFD', 'Dec 2025 contribution — VFD MFB a/c 1000073844 transfer 1'),
  ('gbenga.omolokun@gmail.com', 200000.00, '2025-12-27'::date,
   'ISW/CIP', 'Dec 2025 contribution 2'),
  ('gbenga.omolokun@gmail.com', 200000.00, '2026-01-26'::date,
   'ISW/VFD', 'Jan 2026 contribution 1 — VFD MFB a/c 1000073844 transfer 26-Jan-2026'),
  ('gbenga.omolokun@gmail.com', 200000.00, '2026-01-27'::date,
   'ISW/CIP', 'Jan 2026 contribution 2'),
  ('gbenga.omolokun@gmail.com', 200000.00, '2026-02-27'::date,
   'ISW/CIP', 'Feb 2026 contribution'),
  ('gbenga.omolokun@gmail.com', 200000.00, '2026-03-26'::date,
   'ISW/CIP', 'Mar 2026 contribution'),
  ('gbenga.omolokun@gmail.com', 200000.00, '2026-04-27'::date,
   'ISW/CIP', 'Apr 2026 contribution'),
  ('gbenga.omolokun@gmail.com', 200000.00, '2026-05-27'::date,
   'ISW/CIP', 'May 2026 contribution — CIP CR/OLUWAGBEMIGA OMOLOLU OMOLOKUN'),

  -- ── Amida Oluwatosin James ────────────────────────────────────
  ('oluwatosin.james@eigmembers.ng', 150000.00, '2025-07-31'::date,
   'CHD-Paramount', 'Jul 2025 — Chapel Hill Paramount Fund initial subscription'),
  ('oluwatosin.james@eigmembers.ng', 250000.00, '2025-08-26'::date,
   'CHD-direct', 'Aug 2025 — paid directly into CHD brokerage (per broker stmt; confirmed GO)'),
  ('oluwatosin.james@eigmembers.ng', 200000.00, '2025-09-27'::date,
   'CIP', 'Sep 2025 contribution — CIP CR/AMIDA OLUWATOSIN JAMES'),
  ('oluwatosin.james@eigmembers.ng', 200000.00, '2025-10-25'::date,
   'CIP', 'Oct 2025 contribution — confirmed Amida Oluwatosin James (GO)'),
  ('oluwatosin.james@eigmembers.ng', 300000.00, '2025-11-25'::date,
   'CIP', 'Nov 2025 contribution — 1.5x (CIP CR/AMIDA OLUWATOSIN JAMES)'),
  ('oluwatosin.james@eigmembers.ng', 300000.00, '2025-12-19'::date,
   'CIP', 'Dec 2025 contribution — CIP CR/AMIDA OLUWATOSIN JAMES'),
  ('oluwatosin.james@eigmembers.ng', 200000.00, '2026-01-24'::date,
   'CIP', 'Jan 2026 contribution — CIP CR/AMIDA OLUWATOSIN JAMES'),
  ('oluwatosin.james@eigmembers.ng', 200000.00, '2026-02-27'::date,
   'CIP', 'Feb 2026 contribution — CIP CR/AMIDA OLUWATOSIN JAMES'),
  ('oluwatosin.james@eigmembers.ng', 200000.00, '2026-03-25'::date,
   'CIP', 'Mar 2026 contribution — CIP CR/AMIDA OLUWATOSIN JAMES'),
  ('oluwatosin.james@eigmembers.ng', 200000.00, '2026-04-26'::date,
   'CIP', 'Apr 2026 contribution — CIP CR/AMIDA OLUWATOSIN JAMES'),
  ('oluwatosin.james@eigmembers.ng', 200000.00, '2026-05-28'::date,
   'CIP', 'May 2026 contribution — CIP CR/AMIDA OLUWATOSIN JAMES'),

  -- ── Olujimi Curtis-Joseph ─────────────────────────────────────
  ('olujimi.curtisjoseph@eigmembers.ng', 200000.00, '2025-07-31'::date,
   'CHD-Paramount', 'Jul 2025 — Chapel Hill Paramount Fund initial subscription'),
  ('olujimi.curtisjoseph@eigmembers.ng', 200000.00, '2025-08-26'::date,
   'CHD-direct', 'Aug 2025 — paid directly into CHD brokerage (per broker stmt; confirmed GO)'),
  ('olujimi.curtisjoseph@eigmembers.ng', 200000.00, '2025-09-27'::date,
   'bank_transfer', 'Sep 2025 contribution — NIP/AELLA/Olujimi Curtis-Joseph'),
  ('olujimi.curtisjoseph@eigmembers.ng', 200000.00, '2025-10-27'::date,
   'bank_transfer', 'Oct 2025 contribution — NIP/AELLA/Olujimi Curtis-Joseph'),
  ('olujimi.curtisjoseph@eigmembers.ng', 200000.00, '2025-11-27'::date,
   'bank_transfer', 'Nov 2025 contribution — NIP/AELLA/Olujimi Curtis-Joseph'),
  ('olujimi.curtisjoseph@eigmembers.ng', 200000.00, '2025-12-22'::date,
   'bank_transfer', 'Dec 2025 contribution — NIP/AELLA/Olujimi Curtis-Joseph'),
  ('olujimi.curtisjoseph@eigmembers.ng', 200000.00, '2025-12-30'::date,
   'bank_transfer', 'Dec 2025 contribution 2 — NIP/AELLA/Olujimi Curtis-Joseph'),
  ('olujimi.curtisjoseph@eigmembers.ng', 200000.00, '2026-01-26'::date,
   'bank_transfer', 'Jan 2026 contribution — NIP/AELLA/Olujimi Curtis-Joseph'),
  ('olujimi.curtisjoseph@eigmembers.ng', 200000.00, '2026-02-25'::date,
   'bank_transfer', 'Feb 2026 contribution — NIP/AELLA/Olujimi Curtis-Joseph'),
  ('olujimi.curtisjoseph@eigmembers.ng', 200000.00, '2026-03-26'::date,
   'bank_transfer', 'Mar 2026 contribution — NIP/AELLA/Olujimi Curtis-Joseph'),
  ('olujimi.curtisjoseph@eigmembers.ng', 200000.00, '2026-04-27'::date,
   'bank_transfer', 'Apr 2026 contribution — NIP/AELLA/Olujimi Curtis-Joseph'),
  ('olujimi.curtisjoseph@eigmembers.ng', 200000.00, '2026-05-27'::date,
   'bank_transfer', 'May 2026 contribution — NIP/AELLA/Olujimi Curtis-Joseph'),

  -- ── Gbolaro Ebenezer Olulade ──────────────────────────────────
  ('gbolaro.olulade@eigmembers.ng', 200000.00, '2025-07-31'::date,
   'CHD-Paramount', 'Jul 2025 — Chapel Hill Paramount Fund initial subscription'),
  ('gbolaro.olulade@eigmembers.ng', 200000.00, '2025-09-01'::date,
   'CHD-direct', 'Sep 2025 — paid directly into CHD brokerage (per broker stmt; confirmed GO)'),
  ('gbolaro.olulade@eigmembers.ng', 150000.00, '2025-09-28'::date,
   'bank_transfer', 'Sep 2025 contribution — NIP/STBC/GBOLARO EBENEZER OLULADE'),
  ('gbolaro.olulade@eigmembers.ng', 200000.00, '2025-10-31'::date,
   'bank_transfer', 'Oct 2025 contribution — NIP/STBC/GBOLARO EBENEZER OLULADE'),
  ('gbolaro.olulade@eigmembers.ng', 200000.00, '2025-12-23'::date,
   'bank_transfer', 'Dec 2025 contribution — NIP/STBC/GBOLARO EBENEZER OLULADE'),
  ('gbolaro.olulade@eigmembers.ng', 150000.00, '2026-02-02'::date,
   'bank_transfer', 'Feb 2026 contribution — NIP/STBC/GBOLARO EBENEZER OLULADE'),
  ('gbolaro.olulade@eigmembers.ng', 150000.00, '2026-03-02'::date,
   'bank_transfer', 'Mar 2026 contribution — NIP/STBC/GBOLARO EBENEZER OLULADE'),
  ('gbolaro.olulade@eigmembers.ng', 150000.00, '2026-03-28'::date,
   'bank_transfer', 'Mar 2026 contribution 2 — NIP/STBC/GBOLARO EBENEZER OLULADE'),
  ('gbolaro.olulade@eigmembers.ng', 200000.00, '2026-04-29'::date,
   'bank_transfer', 'Apr 2026 contribution — NIP/STBC/GBOLARO EBENEZER OLULADE'),
  ('gbolaro.olulade@eigmembers.ng', 200000.00, '2026-05-28'::date,
   'bank_transfer', 'May 2026 contribution — NIP/STBC/GBOLARO EBENEZER OLULADE'),

  -- ── Amida Oluwatobi Paul (Tobi Amida) ────────────────────────
  ('oluwatobi.amida@eigmembers.ng', 200000.00, '2025-07-31'::date,
   'CHD-Paramount', 'Jul 2025 — Chapel Hill Paramount Fund initial subscription'),
  ('oluwatobi.amida@eigmembers.ng', 200000.00, '2025-08-26'::date,
   'CHD-direct', 'Aug 2025 — paid directly into CHD brokerage (per broker stmt; confirmed GO)'),
  ('oluwatobi.amida@eigmembers.ng',   2000.00, '2025-08-28'::date,
   'bank_transfer', 'Aug 2025 — NIP/AELLA/Tobi Amida/From Aella MFB (token / charges)'),
  ('oluwatobi.amida@eigmembers.ng', 100000.00, '2025-09-26'::date,
   'CHD-direct', 'Sep 2025 — paid directly into CHD brokerage (per broker stmt; confirmed GO)'),
  ('oluwatobi.amida@eigmembers.ng', 100198.00, '2025-10-06'::date,
   'CHD-direct', 'Oct 2025 — paid directly into CHD brokerage (per broker stmt; confirmed GO)'),
  ('oluwatobi.amida@eigmembers.ng', 100000.00, '2025-10-14'::date,
   'CHD-direct', 'Oct 2025 — paid directly into CHD brokerage (per broker stmt; confirmed GO)'),
  ('oluwatobi.amida@eigmembers.ng', 200000.00, '2025-11-25'::date,
   'CHD-direct', 'Nov 2025 — paid directly into CHD brokerage (per broker stmt; confirmed GO)'),
  ('oluwatobi.amida@eigmembers.ng', 400000.00, '2025-12-22'::date,
   'CHD-direct', 'Dec 2025 — paid directly into CHD brokerage (per broker stmt; confirmed GO)'),
  ('oluwatobi.amida@eigmembers.ng', 200000.00, '2026-01-26'::date,
   'CHD-direct', 'Jan 2026 — paid directly into CHD brokerage (per broker stmt; confirmed GO)'),
  ('oluwatobi.amida@eigmembers.ng', 200000.00, '2026-02-25'::date,
   'CHD-direct', 'Feb 2026 — paid directly into CHD brokerage (per broker stmt; confirmed GO)'),
  ('oluwatobi.amida@eigmembers.ng', 200000.00, '2026-03-26'::date,
   'CIP', 'Mar 2026 — CIP CR/AMIDA OLUWATOBI PAUL/NIP Transfer (Zenith)'),
  ('oluwatobi.amida@eigmembers.ng', 200000.00, '2026-04-27'::date,
   'bank_transfer', 'Apr 2026 — NIP/AELLA/OLUWATOBI AMIDA/N/A'),
  ('oluwatobi.amida@eigmembers.ng', 200000.00, '2026-05-26'::date,
   'bank_transfer', 'May 2026 — NIP/AELLA/OLUWATOBI AMIDA/N/A'),

  -- ── Ayodeji Adegun ────────────────────────────────────────────
  ('ayodeji.adegun@eigmembers.ng', 400000.00, '2025-07-31'::date,
   'CHD-Paramount', 'Jul 2025 — Chapel Hill Paramount Fund initial subscription'),
  ('ayodeji.adegun@eigmembers.ng', 400000.00, '2025-09-17'::date,
   'bank_transfer', 'Sep 2025 — NIP/FCMB/MIKE AND MARYS CATERING (Ayodeji Adegun)'),
  ('ayodeji.adegun@eigmembers.ng', 100000.00, '2025-11-25'::date,
   'CHD-direct', 'Nov 2025 — paid directly into CHD brokerage (per broker stmt; confirmed GO)'),
  ('ayodeji.adegun@eigmembers.ng', 100000.00, '2025-11-27'::date,
   'bank_transfer', 'Nov 2025 — NIP/FCMB/MIKE AND MARYS CATERING (Ayodeji Adegun)'),
  ('ayodeji.adegun@eigmembers.ng', 300000.00, '2025-12-18'::date,
   'bank_transfer', 'Dec 2025 — NIP/FCMB/MIKE AND MARYS CATERING (Ayodeji Adegun)'),
  ('ayodeji.adegun@eigmembers.ng', 100000.00, '2025-12-31'::date,
   'CHD-direct', 'Dec 2025 — paid directly into CHD brokerage (per broker stmt; confirmed GO)'),
  ('ayodeji.adegun@eigmembers.ng', 200000.00, '2026-02-02'::date,
   'bank_transfer', 'Feb 2026 — NIP/FCMB/MIKE AND MARYS CATERING (Ayodeji Adegun)'),
  ('ayodeji.adegun@eigmembers.ng', 200000.00, '2026-03-03'::date,
   'bank_transfer', 'Mar 2026 — NIP/FCMB/MIKE AND MARYS CATERING (Ayodeji Adegun)'),
  ('ayodeji.adegun@eigmembers.ng', 200000.00, '2026-03-27'::date,
   'bank_transfer', 'Mar 2026 contribution 2 — NIP/FCMB/MIKE AND MARYS CATERING (Ayodeji Adegun)'),
  ('ayodeji.adegun@eigmembers.ng', 200000.00, '2026-04-29'::date,
   'bank_transfer', 'Apr 2026 — NIP/FCMB/MIKE AND MARY''S CATERING (Ayodeji Adegun)'),
  ('ayodeji.adegun@eigmembers.ng', 200000.00, '2026-05-31'::date,
   'bank_transfer', 'May 2026 — NIP/FCMB/MIKE AND MARY''S CATERING (Ayodeji Adegun)')

) AS v(email, amount, dt, ref, note)
JOIN public.members m ON m.email = v.email
WHERE NOT EXISTS (
  SELECT 1 FROM public.member_contributions mc
  WHERE mc.member_id        = m.id
    AND mc.contribution_date = v.dt
    AND mc.amount            = v.amount
);


-- ============================================================
-- STEP 2: Special handling for 2025-10-27 duplicate pairs
--
-- Both Tobi Amida and Adegun each made TWO ₦100,000 contributions
-- on this date (one CHD Securities direct, one Zenith bank transfer).
-- Guard includes bank_reference to avoid inserting duplicates when
-- earlier migrations already inserted one of the pair.
--
-- bank_reference values match those used in migrations 009 / 022:
--   Zenith entries (mig 009):  'Aella - Oct contribution' / 'FCMB - Oct contribution'
--   CHD entries   (mig 022):  'INV-AELLA TOBI AMIDA'
-- ============================================================

INSERT INTO public.member_contributions
  (member_id, amount, contribution_date, payment_method, bank_reference, notes)
SELECT m.id, v.amount, v.dt, 'bank_transfer', v.ref, v.note
FROM (VALUES
  -- Tobi Amida CHD (mig022 reference)
  ('oluwatobi.amida@eigmembers.ng', 100000.00, '2025-10-27'::date,
   'INV-AELLA TOBI AMIDA',
   'Oct 2025 — CHD direct inflow 27-Oct-25 (shared: Tobi Amida 100k split)'),
  -- Tobi Amida Zenith (mig009 reference)
  ('oluwatobi.amida@eigmembers.ng', 100000.00, '2025-10-27'::date,
   'Aella - Oct contribution',
   'Oct 2025 — NIP/AELLA/Tobi Amida/Adegun (Zenith bank)'),
  -- Adegun CHD (mig022 reference)
  ('ayodeji.adegun@eigmembers.ng', 100000.00, '2025-10-27'::date,
   'INV-AELLA TOBI AMIDA',
   'Oct 2025 — CHD direct inflow 27-Oct-25 (shared: Adegun 100k split)'),
  -- Adegun Zenith (mig009 reference)
  ('ayodeji.adegun@eigmembers.ng', 100000.00, '2025-10-27'::date,
   'FCMB - Oct contribution',
   'Oct 2025 — NIP/FCMB/MIKE AND MARYS CATERING (Zenith bank)')
) AS v(email, amount, dt, ref, note)
JOIN public.members m ON m.email = v.email
WHERE NOT EXISTS (
  SELECT 1 FROM public.member_contributions mc
  WHERE mc.member_id        = m.id
    AND mc.contribution_date = v.dt
    AND mc.amount            = v.amount
    AND mc.bank_reference    = v.ref
);


-- ============================================================
-- STEP 3: Rebuild bank_statement_txns from corrected source data
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
