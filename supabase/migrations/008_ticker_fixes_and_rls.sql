-- EIG Platform — Fix NGX ticker symbols + open profiles to all members

-- ============================================================
-- STEP 1: Fix ticker symbols to match NGX exchange API
-- ============================================================

-- FBN Holdings → renamed to First HoldCo Plc on NGX (ticker: FIRSTHOLDCO)
UPDATE public.stocks SET ticker = 'FIRSTHOLDCO', company_name = 'FBN Holdings Plc'
  WHERE ticker = 'FBNH';

-- Total Energies Nigeria → listed as TOTAL on NGX
UPDATE public.stocks SET ticker = 'TOTAL', company_name = 'TotalEnergies Marketing Nigeria Plc'
  WHERE ticker = 'TOTALENERGIES';

-- Sterling Bank → listed as STERLINGNG on NGX
UPDATE public.stocks SET ticker = 'STERLINGNG', company_name = 'Sterling Financial Holdings Company Plc'
  WHERE ticker = 'STERLINGBANK';

-- Flour Mills of Nigeria — not found in NGX data (suspended/delisted); deactivate
UPDATE public.stocks SET is_active = FALSE WHERE ticker = 'FLOURMILL';

-- ZENITH — old alias, ZENITHBANK is the correct active ticker
UPDATE public.stocks SET is_active = FALSE WHERE ticker = 'ZENITH';


-- ============================================================
-- STEP 2: Allow all members to view all profiles
-- (needed for admin UI to show member names across the app)
-- ============================================================
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

CREATE POLICY "Members can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.is_member());
