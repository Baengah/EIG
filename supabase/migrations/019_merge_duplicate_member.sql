-- EIG Platform — Merge duplicate member record for Oluwatobi Amida
--
-- Root cause: the original version of migration 016 incorrectly created a new
-- member "Amida Oluwatobi Paul" (oluwatobi.paul@eigmembers.ng) and assigned the
-- March 2026 ₦200,000 contribution to them, instead of using the existing member
-- Oluwatobi Amida (oluwatobi.amida@eigmembers.ng).
--
-- This migration:
--   1. Moves ALL contributions from the duplicate to the correct member (no exclusions)
--   2. Handles period-payment tracking records (contributions table)
--   3. Ensures the Mar 2026 ₦200,000 contribution exists for the correct member
--   4. Fixes bank_statement_txns descriptions that reference the old name
--   5. Adds bank_statement_txn entries for any contributions lacking one
--   6. Deletes the duplicate member row

BEGIN;

-- ============================================================
-- STEP 1: Re-point ALL member_contributions to the correct member.
-- No exclusions — every payment attributed to the duplicate is a
-- real payment by Oluwatobi Amida and must be preserved.
-- ============================================================
UPDATE public.member_contributions
SET member_id = (
  SELECT id FROM public.members WHERE email = 'oluwatobi.amida@eigmembers.ng'
)
WHERE member_id = (
  SELECT id FROM public.members WHERE email = 'oluwatobi.paul@eigmembers.ng'
);


-- ============================================================
-- STEP 2: Re-point contribution_periods tracking records.
-- (Guarded to avoid unique-constraint violations on period_id
--  since each member can only have one record per period.)
-- ============================================================
UPDATE public.contributions c
SET member_id = (
  SELECT id FROM public.members WHERE email = 'oluwatobi.amida@eigmembers.ng'
)
WHERE c.member_id = (
  SELECT id FROM public.members WHERE email = 'oluwatobi.paul@eigmembers.ng'
)
  AND NOT EXISTS (
    SELECT 1 FROM public.contributions c2
    WHERE c2.member_id = (
            SELECT id FROM public.members WHERE email = 'oluwatobi.amida@eigmembers.ng'
          )
      AND c2.period_id = c.period_id
  );

-- Delete any period records for the duplicate that couldn't be merged
DELETE FROM public.contributions
WHERE member_id = (
  SELECT id FROM public.members WHERE email = 'oluwatobi.paul@eigmembers.ng'
);


-- ============================================================
-- STEP 3: Ensure the Mar 2026 ₦200,000 contribution exists for
-- the correct member (no-op if already moved from step 1 above).
-- ============================================================
INSERT INTO public.member_contributions
  (member_id, amount, contribution_date, payment_method, notes)
SELECT
  m.id,
  200000.00,
  '2026-03-26'::date,
  'bank_transfer',
  'Mar 2026 contribution'
FROM public.members m
WHERE m.email = 'oluwatobi.amida@eigmembers.ng'
  AND NOT EXISTS (
    SELECT 1 FROM public.member_contributions mc
    WHERE mc.member_id       = m.id
      AND mc.contribution_date = '2026-03-26'
      AND mc.amount            = 200000.00
  );


-- ============================================================
-- STEP 4: Fix bank_statement_txns
--   a) Remove orphaned matched entries (matched_id points to
--      a contribution row that no longer exists).
--   b) Rename remaining entries that still use the old name.
--   c) Add matched entries for any contributions that lack one.
-- ============================================================

-- Remove orphaned entries
DELETE FROM public.bank_statement_txns
WHERE matched_type = 'contribution'
  AND matched_id NOT IN (SELECT id FROM public.member_contributions);

-- Rename entries for Oluwatobi Amida's contributions that still show the old name
UPDATE public.bank_statement_txns
SET description = 'Contribution — Oluwatobi Amida'
WHERE matched_type = 'contribution'
  AND matched_id IN (
    SELECT mc.id FROM public.member_contributions mc
    JOIN public.members m ON m.id = mc.member_id
    WHERE m.email = 'oluwatobi.amida@eigmembers.ng'
  )
  AND description != 'Contribution — Oluwatobi Amida';

-- Catch any loose description-only remnants
UPDATE public.bank_statement_txns
SET description = 'Contribution — Oluwatobi Amida'
WHERE description ILIKE '%Amida Oluwatobi Paul%'
   OR description ILIKE '%Oluwatobi Paul%';

-- Add missing bank_statement_txns entries for any contribution without one
INSERT INTO public.bank_statement_txns
  (txn_date, description, credit, bank_reference, notes, status, matched_type, matched_id)
SELECT
  mc.contribution_date,
  'Contribution — Oluwatobi Amida',
  mc.amount,
  mc.bank_reference,
  mc.notes,
  'matched',
  'contribution',
  mc.id
FROM public.member_contributions mc
JOIN public.members m ON m.id = mc.member_id
WHERE m.email = 'oluwatobi.amida@eigmembers.ng'
  AND NOT EXISTS (
    SELECT 1 FROM public.bank_statement_txns bst
    WHERE bst.matched_type = 'contribution'
      AND bst.matched_id   = mc.id
  );


-- ============================================================
-- STEP 5: Delete the duplicate member record
-- ============================================================
DELETE FROM public.members
WHERE email = 'oluwatobi.paul@eigmembers.ng';

COMMIT;
