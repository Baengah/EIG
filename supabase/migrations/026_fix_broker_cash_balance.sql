-- Migration 026: Correct broker_accounts.cash_balance
--
-- Background:
--   Migration 006 seeded cash_balance = ₦23,067.75 (pre-trade estimate).
--   Per the CHD contract note in migration 022 (PDF 5, Jun 16 2026), the
--   account went to -₦298,229.72 after settlement of the Jun 16 equity purchases.
--   The column has been stale since then, causing the P&L / NAV computation to
--   overstate total fund value by ~₦321K (₦23K reported vs -₦298K actual).
--
-- The navEngine now uses broker_accounts.cash_balance directly.
-- Admin should update this value after each settlement cycle.

UPDATE public.broker_accounts
SET    cash_balance = -298229.72
WHERE  is_active = true;
