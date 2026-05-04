-- EIG Platform — Seed: EIG members + historical contributions
-- Source: Zenith Bank Statement SA 2290556463 (Aug 2025 – May 2026)
-- Safe to re-run (ON CONFLICT DO NOTHING + NOT EXISTS guards)

-- ============================================================
-- STEP 1: Upsert EIG members
-- ============================================================
INSERT INTO public.members (full_name, email, join_date, is_active, notes)
VALUES
  ('Oluwagbemiga Omololu Omolokun', 'gbenga.omolokun@gmail.com',         '2025-08-01', TRUE, 'Founding member; account holder'),
  ('Oluwatobi Amida',               'oluwatobi.amida@eigmembers.ng',      '2025-08-01', TRUE, 'Co-account holder'),
  ('Amida Oluwatosin James',        'oluwatosin.james@eigmembers.ng',     '2025-08-01', TRUE, NULL),
  ('Olujimi Curtis-Joseph',         'olujimi.curtisjoseph@eigmembers.ng', '2025-08-01', TRUE, NULL),
  ('Gbolaro Ebenezer Olulade',      'gbolaro.olulade@eigmembers.ng',      '2025-08-01', TRUE, NULL),
  ('Mike and Mary Catering',        'mikeandmarys@eigmembers.ng',         '2025-08-01', TRUE, 'FCMB account; full name unconfirmed from bank statement')
ON CONFLICT (email) DO NOTHING;

-- ============================================================
-- STEP 2: Seed member contributions
-- Only inserts rows that do not already exist (matched on
-- member_id + contribution_date + amount).
-- ============================================================
INSERT INTO public.member_contributions
  (member_id, amount, contribution_date, payment_method, bank_reference, notes)
SELECT
  m.id,
  v.amount,
  v.contribution_date,
  'bank_transfer',
  v.bank_reference,
  v.notes
FROM (VALUES
  -- ── Oluwagbemiga Omololu Omolokun (Gbenga) ──────────────────
  ('gbenga.omolokun@gmail.com', 200000.00, '2025-08-26'::date, 'ISW/CIP',  'Aug contribution'),
  ('gbenga.omolokun@gmail.com', 400000.00, '2025-09-19'::date, 'ISW/CIP',  'Double contribution / advance payment'),
  ('gbenga.omolokun@gmail.com', 200000.00, '2025-09-26'::date, 'ISW/CIP',  'Sep contribution'),
  ('gbenga.omolokun@gmail.com', 200000.00, '2025-10-27'::date, 'ISW/CIP',  'Oct contribution'),
  ('gbenga.omolokun@gmail.com', 200000.00, '2025-11-26'::date, 'ISW/CIP',  'Nov contribution'),
  ('gbenga.omolokun@gmail.com', 200000.00, '2025-12-27'::date, 'ISW/CIP',  'Dec contribution'),
  ('gbenga.omolokun@gmail.com', 200000.00, '2026-01-27'::date, 'ISW/CIP',  'Jan 2026 contribution'),
  ('gbenga.omolokun@gmail.com', 200000.00, '2026-02-27'::date, 'ISW/CIP',  'Feb 2026 contribution'),
  ('gbenga.omolokun@gmail.com', 200000.00, '2026-03-26'::date, 'ISW/CIP',  'Mar 2026 contribution'),
  ('gbenga.omolokun@gmail.com', 200000.00, '2026-04-27'::date, 'ISW/CIP',  'Apr 2026 contribution'),

  -- ── Amida Oluwatosin James ───────────────────────────────────
  ('oluwatosin.james@eigmembers.ng', 200000.00, '2025-09-27'::date, 'bank_transfer', 'CIP CR - Sep contribution'),
  ('oluwatosin.james@eigmembers.ng', 300000.00, '2025-11-25'::date, 'bank_transfer', 'CIP CR - Nov contribution'),
  ('oluwatosin.james@eigmembers.ng', 300000.00, '2025-12-19'::date, 'bank_transfer', 'CIP CR - Dec contribution'),
  ('oluwatosin.james@eigmembers.ng', 200000.00, '2026-01-24'::date, 'bank_transfer', 'CIP CR - Jan 2026 contribution'),
  ('oluwatosin.james@eigmembers.ng', 200000.00, '2026-02-27'::date, 'bank_transfer', 'CIP CR - Feb 2026 contribution'),
  ('oluwatosin.james@eigmembers.ng', 200000.00, '2026-03-25'::date, 'bank_transfer', 'CIP CR - Mar 2026 contribution'),
  ('oluwatosin.james@eigmembers.ng', 200000.00, '2026-04-26'::date, 'bank_transfer', 'CIP CR - Apr 2026 contribution'),

  -- ── Olujimi Curtis-Joseph ────────────────────────────────────
  ('olujimi.curtisjoseph@eigmembers.ng', 200000.00, '2025-09-27'::date, 'bank_transfer', 'Aella - Sep contribution'),
  ('olujimi.curtisjoseph@eigmembers.ng', 200000.00, '2025-10-27'::date, 'bank_transfer', 'Aella - Oct contribution'),
  ('olujimi.curtisjoseph@eigmembers.ng', 200000.00, '2025-11-27'::date, 'bank_transfer', 'Aella - Nov contribution'),
  ('olujimi.curtisjoseph@eigmembers.ng', 200000.00, '2025-12-22'::date, 'bank_transfer', 'Aella - Dec contribution'),
  ('olujimi.curtisjoseph@eigmembers.ng', 200000.00, '2025-12-30'::date, 'bank_transfer', 'Aella - Dec contribution (2nd)'),
  ('olujimi.curtisjoseph@eigmembers.ng', 200000.00, '2026-01-26'::date, 'bank_transfer', 'Aella - Jan 2026 contribution'),
  ('olujimi.curtisjoseph@eigmembers.ng', 200000.00, '2026-02-25'::date, 'bank_transfer', 'Aella - Feb 2026 contribution'),
  ('olujimi.curtisjoseph@eigmembers.ng', 200000.00, '2026-03-26'::date, 'bank_transfer', 'Aella - Mar 2026 contribution'),
  ('olujimi.curtisjoseph@eigmembers.ng', 200000.00, '2026-04-27'::date, 'bank_transfer', 'Aella - Apr 2026 contribution'),

  -- ── Gbolaro Ebenezer Olulade ─────────────────────────────────
  ('gbolaro.olulade@eigmembers.ng', 150000.00, '2025-09-28'::date, 'bank_transfer', 'STBC - Sep contribution'),
  ('gbolaro.olulade@eigmembers.ng', 200000.00, '2025-10-31'::date, 'bank_transfer', 'STBC - Oct contribution'),
  ('gbolaro.olulade@eigmembers.ng', 200000.00, '2025-12-23'::date, 'bank_transfer', 'STBC - Dec contribution'),
  ('gbolaro.olulade@eigmembers.ng', 150000.00, '2026-02-02'::date, 'bank_transfer', 'STBC - Feb 2026 contribution'),
  ('gbolaro.olulade@eigmembers.ng', 150000.00, '2026-03-02'::date, 'bank_transfer', 'STBC - Mar 2026 contribution'),
  ('gbolaro.olulade@eigmembers.ng', 150000.00, '2026-03-28'::date, 'bank_transfer', 'STBC - Mar 2026 contribution (2nd)'),
  ('gbolaro.olulade@eigmembers.ng', 200000.00, '2026-04-29'::date, 'bank_transfer', 'STBC - Apr 2026 contribution'),

  -- ── Oluwatobi Amida ──────────────────────────────────────────
  ('oluwatobi.amida@eigmembers.ng',  2000.00, '2025-08-28'::date, 'bank_transfer', 'Aella - token transfer'),
  ('oluwatobi.amida@eigmembers.ng', 100000.00, '2025-10-27'::date, 'bank_transfer', 'Aella - Oct contribution'),
  ('oluwatobi.amida@eigmembers.ng', 200000.00, '2026-04-27'::date, 'bank_transfer', 'Aella - Apr 2026 contribution'),

  -- ── Mike and Mary Catering (FCMB) ────────────────────────────
  ('mikeandmarys@eigmembers.ng', 400000.00, '2025-09-17'::date, 'bank_transfer', 'FCMB - Sep contribution'),
  ('mikeandmarys@eigmembers.ng', 100000.00, '2025-10-27'::date, 'bank_transfer', 'FCMB - Oct contribution'),
  ('mikeandmarys@eigmembers.ng', 100000.00, '2025-11-27'::date, 'bank_transfer', 'FCMB - Nov contribution'),
  ('mikeandmarys@eigmembers.ng', 300000.00, '2025-12-18'::date, 'bank_transfer', 'FCMB - Dec contribution'),
  ('mikeandmarys@eigmembers.ng', 200000.00, '2026-02-02'::date, 'bank_transfer', 'FCMB - Feb 2026 contribution'),
  ('mikeandmarys@eigmembers.ng', 200000.00, '2026-03-03'::date, 'bank_transfer', 'FCMB - Mar 2026 contribution'),
  ('mikeandmarys@eigmembers.ng', 200000.00, '2026-03-27'::date, 'bank_transfer', 'FCMB - Mar 2026 contribution (2nd)'),
  ('mikeandmarys@eigmembers.ng', 200000.00, '2026-04-29'::date, 'bank_transfer', 'FCMB - Apr 2026 contribution')

) AS v(email, amount, contribution_date, bank_reference, notes)
JOIN public.members m ON m.email = v.email
WHERE NOT EXISTS (
  SELECT 1 FROM public.member_contributions mc
  WHERE mc.member_id = m.id
    AND mc.contribution_date = v.contribution_date
    AND mc.amount = v.amount
);
