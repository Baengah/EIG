-- EIG Platform — Fix double-counted stock holdings
-- Root cause: migration 007 set holdings snapshot (baseline as of 02-Apr-2026),
-- then migration 014 inserted all 70 historical contract-note transactions and
-- the trigger on `transactions` added them ON TOP of the snapshot, doubling most positions.
--
-- Correct approach: baseline from migration 007 + post-02-Apr-2026 buys only.
-- UACN was fully sold out on 31-Mar-2026 and must be removed.

BEGIN;

-- ============================================================
-- STEP 1: Delete all CHD holdings (will re-insert correctly)
-- ============================================================
DELETE FROM public.holdings
WHERE broker_account_id IN (
  SELECT id FROM public.broker_accounts WHERE broker_name ILIKE '%chapel hill%'
);

-- ============================================================
-- STEP 2: Re-insert correct holdings
--
-- Baseline (migration 007, as of 02-Apr-2026):
--   ACCESSCORP  7,600  @ ₦26.4263
--   ARADEL      1,753  @ ₦867.8176
--   FCMB       50,000  @ ₦10.0000
--   GTCO       13,377  @ ₦95.0774
--   MTNN        5,339  @ ₦532.3462
--   NGXGROUP    3,850  @ ₦159.6592
--   PRESCO        713  @ ₦1,501.0646
--   ZENITHBANK 40,083  @ ₦70.3304
--
-- Post-02-Apr-2026 buys (migration 014):
--   ACCESSCORP +5,134 units  net ₦137,505.43   (0005387361, 15-Apr)
--   ARADEL      +2 units     net ₦2,521.69     (0005383584, 10-Apr)
--   ARADEL     +14 units     net ₦17,613.08    (0005383569, 10-Apr)
--   ARADEL    +200 units     net ₦310,385.95   (0005389355, 16-Apr)
--   ARADEL     +14 units     net ₦21,731.02    (0005389348, 16-Apr)
--   ARADEL      +1 unit      net ₦1,556.20     (0005389365, 16-Apr)
--   ARADEL    +350 units     net ₦720,984.83   (0005410518, 30-Apr)
--   GTCO      +2,500 units   net ₦340,629.83   (0005410534, 30-Apr)
--   MTNN        +290 units   net ₦265,488.56   (0005410549, 30-Apr)
--   ZENITHBANK +2,750 units  net ₦334,647.25   (0005387524, 15-Apr)
-- ============================================================
INSERT INTO public.holdings (asset_type, stock_id, broker_account_id, quantity, average_cost)
SELECT
  'stock',
  s.id,
  ba.id,
  v.qty,
  ROUND(v.total_cost / v.qty, 6)
FROM (VALUES
  ('ACCESSCORP',  12734.0,  7600.0  * 26.4263   + 137505.43),
  ('ARADEL',       2334.0,  1753.0  * 867.8176  + 2521.69 + 17613.08 + 310385.95 + 21731.02 + 1556.20 + 720984.83),
  ('FCMB',        50000.0,  50000.0 * 10.0),
  ('GTCO',        15877.0,  13377.0 * 95.0774   + 340629.83),
  ('MTNN',         5629.0,  5339.0  * 532.3462  + 265488.56),
  ('NGXGROUP',     3850.0,  3850.0  * 159.6592),
  ('PRESCO',        713.0,  713.0   * 1501.0646),
  ('ZENITHBANK',  42833.0,  40083.0 * 70.3304   + 334647.25)
) AS v(ticker, qty, total_cost)
JOIN public.stocks s ON s.ticker = v.ticker
CROSS JOIN (
  SELECT id FROM public.broker_accounts
  WHERE broker_name ILIKE '%chapel hill%'
  LIMIT 1
) ba;


-- ============================================================
-- STEP 3: Snapshot today so portfolio history reflects the fix
-- ============================================================
SELECT public.create_portfolio_snapshot(CURRENT_DATE);

COMMIT;
