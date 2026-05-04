-- EIG Platform — Schema: bank_ledger, member_contributions, broker cash_balance
-- Run this in Supabase SQL Editor (idempotent — safe to re-run)

-- ============================================================
-- MEMBER CONTRIBUTIONS (simplified direct-payment table)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.member_contributions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE RESTRICT,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  contribution_date DATE NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'bank_transfer'
    CHECK (payment_method IN ('bank_transfer', 'cash', 'online', 'other')),
  bank_reference TEXT,
  notes TEXT,
  recorded_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_member_contributions_member
  ON public.member_contributions(member_id);
CREATE INDEX IF NOT EXISTS idx_member_contributions_date
  ON public.member_contributions(contribution_date DESC);

ALTER TABLE public.member_contributions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view all member_contributions" ON public.member_contributions;
CREATE POLICY "Members can view all member_contributions"
  ON public.member_contributions FOR SELECT
  USING (public.is_member());

DROP POLICY IF EXISTS "Admins can manage member_contributions" ON public.member_contributions;
CREATE POLICY "Admins can manage member_contributions"
  ON public.member_contributions FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================
-- BANK LEDGER (Zenith bank non-contribution entries)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.bank_ledger (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entry_date DATE NOT NULL,
  description TEXT NOT NULL,
  -- positive = credit (income to bank), negative = debit (expense from bank)
  amount NUMERIC(14,2) NOT NULL,
  category TEXT NOT NULL
    CHECK (category IN (
      'interest_income',   -- capitalised interest credited by bank
      'bank_charge',       -- COT, transfer fees, SMS charges
      'tax',               -- VAT, stamp duty, withholding tax
      'broker_transfer',   -- transfers to/from broker (negative=out, positive=in)
      'other_income',
      'other_expense'
    )),
  bank_account_id UUID REFERENCES public.bank_accounts(id),
  bank_reference TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bank_ledger_date
  ON public.bank_ledger(entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_bank_ledger_category
  ON public.bank_ledger(category);

ALTER TABLE public.bank_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view bank_ledger" ON public.bank_ledger;
CREATE POLICY "Members can view bank_ledger"
  ON public.bank_ledger FOR SELECT
  USING (public.is_member());

DROP POLICY IF EXISTS "Admins can manage bank_ledger" ON public.bank_ledger;
CREATE POLICY "Admins can manage bank_ledger"
  ON public.bank_ledger FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================
-- BROKER ACCOUNTS — add cash_balance column
-- ============================================================
ALTER TABLE public.broker_accounts
  ADD COLUMN IF NOT EXISTS cash_balance NUMERIC(14,2) NOT NULL DEFAULT 0;

-- ============================================================
-- BANK ACCOUNTS — fix missing INSERT policy for admins
-- ============================================================
DROP POLICY IF EXISTS "Admins can insert bank accounts" ON public.bank_accounts;
-- The existing "Admins can manage bank accounts" policy covers ALL operations
-- including INSERT, so no separate policy needed. If it's missing:
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'bank_accounts'
      AND policyname = 'Admins can manage bank accounts'
  ) THEN
    CREATE POLICY "Admins can manage bank accounts"
      ON public.bank_accounts FOR ALL
      USING (public.is_admin())
      WITH CHECK (public.is_admin());
  END IF;
END $$;
