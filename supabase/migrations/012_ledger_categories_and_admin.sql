-- EIG Platform — Ledger categories table + set founding admin

-- ============================================================
-- STEP 1: Set Gbenga's profile role to admin
-- ============================================================
UPDATE public.profiles
SET role = 'admin'
WHERE email = 'gbenga.omolokun@gmail.com';


-- ============================================================
-- STEP 2: Ledger categories (configurable income/cost/transfer
--         line items used in attribution and bank_ledger inserts)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ledger_categories (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code         TEXT UNIQUE NOT NULL,
  type         TEXT NOT NULL CHECK (type IN ('income', 'cost', 'transfer')),
  display_name TEXT NOT NULL,
  description  TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.ledger_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view ledger categories"
  ON public.ledger_categories FOR SELECT
  USING (public.is_member());

CREATE POLICY "Admins can manage ledger categories"
  ON public.ledger_categories FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

INSERT INTO public.ledger_categories (code, type, display_name, description, sort_order) VALUES
  ('interest_income', 'income',   'Interest Income',   'Bank interest credited on savings balance',            1),
  ('other_income',    'income',   'Other Income',      'Miscellaneous income credited to the group account',   2),
  ('bank_charge',     'cost',     'Bank Charges',      'NIP transfer fees, COT charges, SMS alert fees',       1),
  ('tax',             'cost',     'Tax',               'Withholding tax on interest, FGN stamp duty',          2),
  ('other_expense',   'cost',     'Other Expense',     'Miscellaneous expenses debited from group account',    3),
  ('broker_transfer', 'transfer', 'Broker Transfer',   'Transfers to/from CHD broker for investment purchases', 1)
ON CONFLICT (code) DO NOTHING;


-- ============================================================
-- STEP 3: Add other_expense to unmatched_bank_entries resolved_as
-- (was omitted from the original CHECK constraint in migration 011)
-- ============================================================
ALTER TABLE public.unmatched_bank_entries
  DROP CONSTRAINT IF EXISTS unmatched_bank_entries_resolved_as_check;

ALTER TABLE public.unmatched_bank_entries
  ADD CONSTRAINT unmatched_bank_entries_resolved_as_check
  CHECK (resolved_as IN (
    'contribution', 'interest_income', 'other_income',
    'bank_charge', 'tax', 'other_expense', 'broker_transfer', 'ignored'
  ));
