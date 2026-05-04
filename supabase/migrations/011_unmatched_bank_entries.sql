-- EIG Platform — Unmatched bank statement entries
-- Holds credits/debits from the Zenith statement that could not be
-- automatically attributed to a member contribution, bank ledger entry,
-- or transaction.  Admins attribute each entry manually via the UI.

CREATE TABLE IF NOT EXISTS public.unmatched_bank_entries (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entry_date   DATE        NOT NULL,
  description  TEXT        NOT NULL,
  amount       NUMERIC(14,2) NOT NULL,   -- positive = credit, negative = debit
  bank_reference TEXT,
  notes        TEXT,
  status       TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'resolved', 'ignored')),
  resolved_as  TEXT
               CHECK (resolved_as IN (
                 'contribution', 'interest_income', 'other_income',
                 'bank_charge', 'tax', 'broker_transfer', 'ignored'
               )),
  resolved_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_unmatched_status
  ON public.unmatched_bank_entries(status);

ALTER TABLE public.unmatched_bank_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view unmatched entries"
  ON public.unmatched_bank_entries FOR SELECT
  USING (public.is_member());

CREATE POLICY "Admins can manage unmatched entries"
  ON public.unmatched_bank_entries FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================
-- Seed: 4 unattributed credits from Zenith statement
-- (ISW/CIP transfers whose sender could not be confirmed)
-- ============================================================
INSERT INTO public.unmatched_bank_entries
  (entry_date, description, amount, bank_reference, notes)
SELECT v.entry_date, v.description, v.amount, v.bank_reference, v.notes
FROM (VALUES
  ('2025-11-25'::date, 'ISW/CIP Transfer — sender unconfirmed', 200000.00, 'ISW',
   'Possible Nov advance from Gbenga; falls 1 day before confirmed 26-Nov entry'),
  ('2025-12-20'::date, 'ISW/CIP Transfer — sender unconfirmed', 400000.00, 'ISW',
   'Possible Dec double payment from Gbenga; falls 7 days before confirmed 27-Dec entry'),
  ('2026-01-26'::date, 'ISW/CIP Transfer — sender unconfirmed', 200000.00, 'ISW',
   'Possible Jan 2026 contribution; falls 1 day before confirmed 27-Jan entry'),
  ('2026-03-26'::date, 'Credit — Oluwatobi Paul', 200000.00, 'ISW',
   'Name on transfer: Oluwatobi Paul; may be Oluwatobi Amida (Tobi) or a different sender')
) AS v(entry_date, description, amount, bank_reference, notes)
WHERE NOT EXISTS (
  SELECT 1 FROM public.unmatched_bank_entries u
  WHERE u.entry_date = v.entry_date AND u.amount = v.amount
);
