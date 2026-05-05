-- EIG Platform — Merge duplicate member record for Oluwatobi Amida
--
-- Root cause: the original version of migration 016 incorrectly created a new
-- member "Amida Oluwatobi Paul" (oluwatobi.paul@eigmembers.ng) and assigned the
-- March 2026 ₦200,000 contribution to them, instead of using the existing member
-- Oluwatobi Amida (oluwatobi.amida@eigmembers.ng).
--
-- This migration:
--   1. Moves all contributions from the duplicate to the correct member
--   2. Handles period-payment tracking records (contributions table)
--   3. Ensures the Mar 2026 ₦200,000 contribution exists for the correct member
--   4. Removes duplicate bank_statement_txns entries for the same contribution
--   5. Fixes bank_statement_txns descriptions that reference the old name
--   6. Deletes the duplicate member row

BEGIN;

-- ============================================================
-- STEP 1: Re-point member_contributions to the correct member.
-- Skip any that would create an exact duplicate (same date + amount).
-- ============================================================
UPDATE public.member_contributions mc
SET member_id = (
  SELECT id FROM public.members WHERE email = 'oluwatobi.amida@eigmembers.ng'
)
WHERE mc.member_id = (
  SELECT id FROM public.members WHERE email = 'oluwatobi.paul@eigmembers.ng'
)
  AND NOT EXISTS (
    SELECT 1 FROM public.member_contributions mc2
    WHERE mc2.member_id = (
            SELECT id FROM public.members WHERE email = 'oluwatobi.amida@eigmembers.ng'
          )
      AND mc2.contribution_date = mc.contribution_date
      AND mc2.amount           = mc.amount
  );

-- Delete any remaining contributions for the duplicate member that couldn't be
-- merged because the same date+amount already exists for the correct member.
DELETE FROM public.member_contributions
WHERE member_id = (
  SELECT id FROM public.members WHERE email = 'oluwatobi.paul@eigmembers.ng'
);


-- ============================================================
-- STEP 2: Re-point contribution_periods tracking records
-- (contributions table — tracks paid/unpaid per period per member)
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

-- Delete any remaining period records for the duplicate member
DELETE FROM public.contributions
WHERE member_id = (
  SELECT id FROM public.members WHERE email = 'oluwatobi.paul@eigmembers.ng'
);


-- ============================================================
-- STEP 3: Ensure the Mar 2026 ₦200,000 contribution exists for
-- the correct member (guarded — no-op if already present).
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
--   a) Remove orphaned entries that still point to the old
--      duplicate member's contributions (which are now gone).
--   b) Rename any entries with the old name variants.
--   c) Add a matched entry for Mar 2026 if one is missing.
-- ============================================================

-- Remove any bank_statement_txns whose matched_id points to a
-- member_contributions row that no longer exists (dangling references
-- left over if the old contribution couldn't be moved in step 1).
DELETE FROM public.bank_statement_txns
WHERE matched_type = 'contribution'
  AND matched_id NOT IN (SELECT id FROM public.member_contributions);

-- Fix description for any remaining entries still using the old name
UPDATE public.bank_statement_txns
SET description = 'Contribution — Oluwatobi Amida'
WHERE matched_type = 'contribution'
  AND matched_id IN (
    SELECT mc.id FROM public.member_contributions mc
    JOIN public.members m ON m.id = mc.member_id
    WHERE m.email = 'oluwatobi.amida@eigmembers.ng'
  )
  AND description != 'Contribution — Oluwatobi Amida';

-- Also catch any description-only remnants (no matched_id, e.g. from old seeds)
UPDATE public.bank_statement_txns
SET description = 'Contribution — Oluwatobi Amida'
WHERE description ILIKE '%Amida Oluwatobi Paul%'
   OR description ILIKE '%Oluwatobi Paul%';

-- Add bank_statement_txn for Mar 2026 if missing
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
WHERE m.email            = 'oluwatobi.amida@eigmembers.ng'
  AND mc.contribution_date = '2026-03-26'
  AND mc.amount            = 200000.00
  AND NOT EXISTS (
    SELECT 1 FROM public.bank_statement_txns bst
    WHERE bst.matched_type = 'contribution'
      AND bst.matched_id   = mc.id
  );


-- ============================================================
-- STEP 5: Delete the duplicate member record
-- (safe — all FK-dependent rows already re-pointed or deleted above)
-- ============================================================
DELETE FROM public.members
WHERE email = 'oluwatobi.paul@eigmembers.ng';

COMMIT;
