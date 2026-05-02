-- EIG Platform - Row Level Security Policies

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contribution_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broker_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mutual_funds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fund_nav_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_snapshots ENABLE ROW LEVEL SECURITY;

-- Helper function: check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function: check if user is authenticated member
CREATE OR REPLACE FUNCTION public.is_member()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'member')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- PROFILES
-- ============================================================
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (id = auth.uid() OR public.is_admin());

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "Admins can insert profiles"
  ON public.profiles FOR INSERT
  WITH CHECK (public.is_admin() OR id = auth.uid());

-- ============================================================
-- MEMBERS (all authenticated users can read, admins can write)
-- ============================================================
CREATE POLICY "Members can view all members"
  ON public.members FOR SELECT
  USING (public.is_member());

CREATE POLICY "Admins can manage members"
  ON public.members FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================
-- CONTRIBUTION PERIODS
-- ============================================================
CREATE POLICY "Members can view contribution periods"
  ON public.contribution_periods FOR SELECT
  USING (public.is_member());

CREATE POLICY "Admins can manage contribution periods"
  ON public.contribution_periods FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================
-- CONTRIBUTIONS
-- ============================================================
CREATE POLICY "Members can view all contributions"
  ON public.contributions FOR SELECT
  USING (public.is_member());

CREATE POLICY "Admins can manage contributions"
  ON public.contributions FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================
-- BANK & BROKER ACCOUNTS
-- ============================================================
CREATE POLICY "Members can view bank accounts"
  ON public.bank_accounts FOR SELECT
  USING (public.is_member());

CREATE POLICY "Admins can manage bank accounts"
  ON public.bank_accounts FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Members can view broker accounts"
  ON public.broker_accounts FOR SELECT
  USING (public.is_member());

CREATE POLICY "Admins can manage broker accounts"
  ON public.broker_accounts FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================
-- STOCKS & MUTUAL FUNDS (public read, admin write)
-- ============================================================
CREATE POLICY "Anyone authenticated can view stocks"
  ON public.stocks FOR SELECT
  USING (public.is_member());

CREATE POLICY "Admins can manage stocks"
  ON public.stocks FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Anyone authenticated can view mutual funds"
  ON public.mutual_funds FOR SELECT
  USING (public.is_member());

CREATE POLICY "Admins can manage mutual funds"
  ON public.mutual_funds FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================
-- HOLDINGS
-- ============================================================
CREATE POLICY "Members can view holdings"
  ON public.holdings FOR SELECT
  USING (public.is_member());

CREATE POLICY "Admins can manage holdings"
  ON public.holdings FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================
-- TRANSACTIONS
-- ============================================================
CREATE POLICY "Members can view transactions"
  ON public.transactions FOR SELECT
  USING (public.is_member());

CREATE POLICY "Admins can manage transactions"
  ON public.transactions FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================
-- STOCK PRICES & FUND NAV (readable by all members)
-- ============================================================
CREATE POLICY "Members can view stock prices"
  ON public.stock_prices FOR SELECT
  USING (public.is_member());

CREATE POLICY "Service role can insert stock prices"
  ON public.stock_prices FOR INSERT
  WITH CHECK (TRUE); -- Scraper uses service_role key

CREATE POLICY "Service role can update stock prices"
  ON public.stock_prices FOR UPDATE
  USING (TRUE);

CREATE POLICY "Members can view fund NAV"
  ON public.fund_nav_history FOR SELECT
  USING (public.is_member());

CREATE POLICY "Service role can manage fund NAV"
  ON public.fund_nav_history FOR ALL
  USING (TRUE)
  WITH CHECK (TRUE);

-- ============================================================
-- DOCUMENTS
-- ============================================================
CREATE POLICY "Members can view all documents"
  ON public.documents FOR SELECT
  USING (public.is_member());

CREATE POLICY "Members can upload documents"
  ON public.documents FOR INSERT
  WITH CHECK (public.is_member() AND uploaded_by = auth.uid());

CREATE POLICY "Admins and uploaders can update documents"
  ON public.documents FOR UPDATE
  USING (public.is_admin() OR uploaded_by = auth.uid());

CREATE POLICY "Admins can delete documents"
  ON public.documents FOR DELETE
  USING (public.is_admin());

-- ============================================================
-- PORTFOLIO SNAPSHOTS
-- ============================================================
CREATE POLICY "Members can view portfolio snapshots"
  ON public.portfolio_snapshots FOR SELECT
  USING (public.is_member());

CREATE POLICY "Service role can manage snapshots"
  ON public.portfolio_snapshots FOR ALL
  USING (TRUE)
  WITH CHECK (TRUE);
