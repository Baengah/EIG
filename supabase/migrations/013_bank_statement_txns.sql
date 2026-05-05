-- EIG Platform — Bank statement reconciliation table
-- Canonical source of every raw Zenith bank entry.
-- Entries are linked to internal records (contributions / ledger / transactions).
-- Unlinked entries (status='unmatched') appear in the attribution schedule.

CREATE TABLE IF NOT EXISTS public.bank_statement_txns (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  txn_date        DATE NOT NULL,
  description     TEXT NOT NULL,
  debit           NUMERIC(14,2),    -- positive amount; NULL if this is a credit
  credit          NUMERIC(14,2),    -- positive amount; NULL if this is a debit
  bank_reference  TEXT,
  bank_account_id UUID REFERENCES public.bank_accounts(id),
  status          TEXT NOT NULL DEFAULT 'unmatched'
                  CHECK (status IN ('matched', 'unmatched', 'ignored')),
  matched_type    TEXT
                  CHECK (matched_type IN ('contribution', 'bank_ledger', 'transaction')),
  matched_id      UUID,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bst_date   ON public.bank_statement_txns(txn_date DESC);
CREATE INDEX IF NOT EXISTS idx_bst_status ON public.bank_statement_txns(status);
CREATE INDEX IF NOT EXISTS idx_bst_match  ON public.bank_statement_txns(matched_type, matched_id);

ALTER TABLE public.bank_statement_txns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view bank statement txns"
  ON public.bank_statement_txns FOR SELECT
  USING (public.is_member());

CREATE POLICY "Admins can manage bank statement txns"
  ON public.bank_statement_txns FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());


-- ============================================================
-- SEED from member_contributions (all credited transfers)
-- ============================================================
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
JOIN public.members m ON m.id = mc.member_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.bank_statement_txns t
  WHERE t.matched_type = 'contribution' AND t.matched_id = mc.id
);


-- ============================================================
-- SEED from bank_ledger (interest, charges, taxes, transfers)
-- ============================================================
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
FROM public.bank_ledger bl
WHERE NOT EXISTS (
  SELECT 1 FROM public.bank_statement_txns t
  WHERE t.matched_type = 'bank_ledger' AND t.matched_id = bl.id
);


-- ============================================================
-- SEED from transactions — dividends credited directly to bank
-- ============================================================
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
  AND t.net_amount IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.bank_statement_txns b
    WHERE b.matched_type = 'transaction' AND b.matched_id = t.id
  );


-- ============================================================
-- MIGRATE unmatched_bank_entries (pending only)
-- Resolved ones are already captured via bank_ledger / contributions above.
-- ============================================================
INSERT INTO public.bank_statement_txns
  (txn_date, description, credit, debit, bank_reference, notes, status)
SELECT
  u.entry_date,
  u.description,
  CASE WHEN u.amount > 0 THEN  u.amount ELSE NULL END,
  CASE WHEN u.amount < 0 THEN -u.amount ELSE NULL END,
  u.bank_reference,
  u.notes,
  'unmatched'
FROM public.unmatched_bank_entries u
WHERE u.status = 'pending'
  AND NOT EXISTS (
    SELECT 1 FROM public.bank_statement_txns t
    WHERE t.txn_date = u.entry_date
      AND COALESCE(t.credit, -1) = CASE WHEN u.amount > 0 THEN u.amount ELSE -1 END
      AND t.status = 'unmatched'
  );
