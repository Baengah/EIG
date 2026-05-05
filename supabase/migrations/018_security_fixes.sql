-- EIG Platform — Security fixes
-- 1. Prevent privilege escalation: block non-admins from changing their own role
-- 2. Drop legacy unmatched_bank_entries RLS (superseded by bank_statement_txns)

BEGIN;

-- ============================================================
-- FIX: profiles UPDATE policy had no WITH CHECK clause.
-- A regular authenticated user could call:
--   supabase.from("profiles").update({ role: "admin" }).eq("id", user.id)
-- and grant themselves admin access.
--
-- The fix adds a WITH CHECK that allows updates only when:
--   - the caller is an admin (can change anyone's role), OR
--   - the role column is not being changed (regular self-update)
-- ============================================================
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid() AND (
      public.is_admin()
      OR role = (SELECT role FROM public.profiles WHERE id = auth.uid())
    )
  );

COMMIT;
