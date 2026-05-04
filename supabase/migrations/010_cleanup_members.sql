-- EIG Platform — Clean up placeholder members and fix member data
-- Fixes: delete 3 placeholder members, merge duplicate Tobi record,
--        correct Gbenga's full name.

-- ============================================================
-- STEP 1: Delete placeholder seed members
-- ============================================================
-- Remove any contributions linked to them first (ON DELETE RESTRICT)
DELETE FROM public.member_contributions
WHERE member_id IN (
  SELECT id FROM public.members
  WHERE email IN ('member1@email.com', 'member2@email.com', 'member3@email.com')
     OR member_number IN ('EIG-001', 'EIG-002', 'EIG-003')
);

DELETE FROM public.members
WHERE email IN ('member1@email.com', 'member2@email.com', 'member3@email.com')
   OR member_number IN ('EIG-001', 'EIG-002', 'EIG-003');


-- ============================================================
-- STEP 2: Merge duplicate Tobi record
-- Migration 009 inserted oluwatobi.amida@eigmembers.ng but the
-- real record (EIG-0016) already existed with her gmail address.
-- Move contributions to the canonical record then drop the duplicate.
-- ============================================================
DO $$
DECLARE
  real_id   UUID;
  dupl_id   UUID;
BEGIN
  SELECT id INTO real_id FROM public.members WHERE email = 'oluwatobi.amida@gmail.com' LIMIT 1;
  SELECT id INTO dupl_id FROM public.members WHERE email = 'oluwatobi.amida@eigmembers.ng' LIMIT 1;

  IF real_id IS NOT NULL AND dupl_id IS NOT NULL THEN
    UPDATE public.member_contributions SET member_id = real_id WHERE member_id = dupl_id;
    DELETE FROM public.members WHERE id = dupl_id;
  END IF;
END $$;


-- ============================================================
-- STEP 3: Fix Gbenga's full name (was inserted in lowercase
--         from an earlier profile record)
-- ============================================================
UPDATE public.members
SET full_name = 'Oluwagbemiga Omololu Omolokun'
WHERE email = 'gbenga.omolokun@gmail.com';
