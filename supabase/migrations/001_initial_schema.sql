-- EIG Platform - Initial Database Schema
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- PROFILES (extends auth.users)
-- ============================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member', 'viewer')),
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- MEMBERS (EIG group members)
-- ============================================================
CREATE TABLE public.members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  member_number TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  join_date DATE NOT NULL DEFAULT CURRENT_DATE,
  is_active BOOLEAN DEFAULT TRUE,
  bank_account_name TEXT,
  bank_name TEXT,
  bank_account_number TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-generate member number
CREATE SEQUENCE member_number_seq START 1;
CREATE OR REPLACE FUNCTION generate_member_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.member_number := 'EIG-' || LPAD(nextval('member_number_seq')::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_member_number
  BEFORE INSERT ON public.members
  FOR EACH ROW
  WHEN (NEW.member_number IS NULL OR NEW.member_number = '')
  EXECUTE FUNCTION generate_member_number();

-- ============================================================
-- CONTRIBUTION PERIODS (monthly)
-- ============================================================
CREATE TABLE public.contribution_periods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  year INTEGER NOT NULL CHECK (year >= 2020),
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  amount_per_member NUMERIC(12,2) NOT NULL CHECK (amount_per_member > 0),
  due_date DATE NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (year, month)
);

-- ============================================================
-- CONTRIBUTIONS (individual member payments)
-- ============================================================
CREATE TABLE public.contributions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE RESTRICT,
  period_id UUID NOT NULL REFERENCES public.contribution_periods(id) ON DELETE RESTRICT,
  amount_paid NUMERIC(12,2) CHECK (amount_paid >= 0),
  payment_date DATE,
  payment_method TEXT CHECK (payment_method IN ('bank_transfer', 'cash', 'online', 'other')),
  bank_reference TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'partial', 'overdue', 'waived')),
  document_id UUID, -- links to bank statement confirming payment
  notes TEXT,
  verified_by UUID REFERENCES public.profiles(id),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (member_id, period_id)
);

-- ============================================================
-- BANK ACCOUNTS
-- ============================================================
CREATE TABLE public.bank_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bank_name TEXT NOT NULL,
  account_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  account_type TEXT DEFAULT 'current',
  currency TEXT DEFAULT 'NGN',
  sort_code TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- BROKER ACCOUNTS
-- ============================================================
CREATE TABLE public.broker_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  broker_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  account_name TEXT NOT NULL,
  currency TEXT DEFAULT 'NGN',
  is_active BOOLEAN DEFAULT TRUE,
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- STOCKS (NGX listed companies)
-- ============================================================
CREATE TABLE public.stocks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticker TEXT UNIQUE NOT NULL,
  company_name TEXT NOT NULL,
  sector TEXT,
  sub_sector TEXT,
  market_cap_category TEXT CHECK (market_cap_category IN ('large', 'medium', 'small')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- MUTUAL FUNDS
-- ============================================================
CREATE TABLE public.mutual_funds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fund_name TEXT NOT NULL,
  fund_code TEXT UNIQUE,
  fund_manager TEXT,
  fund_type TEXT CHECK (fund_type IN ('equity', 'fixed_income', 'balanced', 'money_market', 'real_estate', 'ethical')),
  currency TEXT DEFAULT 'NGN',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- HOLDINGS (current portfolio positions)
-- ============================================================
CREATE TABLE public.holdings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_type TEXT NOT NULL CHECK (asset_type IN ('stock', 'mutual_fund')),
  stock_id UUID REFERENCES public.stocks(id),
  mutual_fund_id UUID REFERENCES public.mutual_funds(id),
  broker_account_id UUID REFERENCES public.broker_accounts(id),
  quantity NUMERIC(18,6) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  average_cost NUMERIC(18,6) NOT NULL DEFAULT 0 CHECK (average_cost >= 0),
  total_cost NUMERIC(18,2) GENERATED ALWAYS AS (quantity * average_cost) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT holdings_asset_check CHECK (
    (asset_type = 'stock' AND stock_id IS NOT NULL AND mutual_fund_id IS NULL) OR
    (asset_type = 'mutual_fund' AND mutual_fund_id IS NOT NULL AND stock_id IS NULL)
  )
);

-- ============================================================
-- TRANSACTIONS (buy/sell/dividend)
-- ============================================================
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_date DATE NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('buy', 'sell', 'dividend', 'rights_issue', 'bonus', 'transfer_in', 'transfer_out')),
  asset_type TEXT NOT NULL CHECK (asset_type IN ('stock', 'mutual_fund')),
  stock_id UUID REFERENCES public.stocks(id),
  mutual_fund_id UUID REFERENCES public.mutual_funds(id),
  broker_account_id UUID REFERENCES public.broker_accounts(id),
  quantity NUMERIC(18,6),
  price NUMERIC(18,6),
  gross_amount NUMERIC(18,2),
  brokerage_fee NUMERIC(18,2) DEFAULT 0,
  sec_fee NUMERIC(18,2) DEFAULT 0,
  cscs_fee NUMERIC(18,2) DEFAULT 0,
  stamp_duty NUMERIC(18,2) DEFAULT 0,
  total_fees NUMERIC(18,2) DEFAULT 0,
  net_amount NUMERIC(18,2),
  contract_note_number TEXT,
  document_id UUID,
  settlement_date DATE,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- STOCK PRICES (daily NGX closing prices)
-- ============================================================
CREATE TABLE public.stock_prices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stock_id UUID NOT NULL REFERENCES public.stocks(id) ON DELETE CASCADE,
  price_date DATE NOT NULL,
  opening_price NUMERIC(18,6),
  high_price NUMERIC(18,6),
  low_price NUMERIC(18,6),
  closing_price NUMERIC(18,6) NOT NULL,
  volume BIGINT DEFAULT 0,
  value NUMERIC(18,2),
  trades INTEGER,
  price_change NUMERIC(18,6),
  change_percent NUMERIC(8,4),
  scrape_source TEXT DEFAULT 'ngx',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (stock_id, price_date)
);

-- ============================================================
-- MUTUAL FUND NAV HISTORY
-- ============================================================
CREATE TABLE public.fund_nav_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mutual_fund_id UUID NOT NULL REFERENCES public.mutual_funds(id) ON DELETE CASCADE,
  nav_date DATE NOT NULL,
  nav NUMERIC(18,6) NOT NULL,
  units_outstanding NUMERIC(18,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (mutual_fund_id, nav_date)
);

-- ============================================================
-- DOCUMENTS (uploaded files)
-- ============================================================
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_type TEXT NOT NULL CHECK (document_type IN ('bank_statement', 'contract_note', 'fund_statement', 'other')),
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  upload_date TIMESTAMPTZ DEFAULT NOW(),
  period_month INTEGER CHECK (period_month BETWEEN 1 AND 12),
  period_year INTEGER,
  processing_status TEXT DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
  extracted_data JSONB,
  processing_error TEXT,
  uploaded_by UUID REFERENCES public.profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PORTFOLIO SNAPSHOTS (daily valuations)
-- ============================================================
CREATE TABLE public.portfolio_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  snapshot_date DATE NOT NULL UNIQUE,
  total_value NUMERIC(18,2) DEFAULT 0,
  total_cost NUMERIC(18,2) DEFAULT 0,
  total_gain_loss NUMERIC(18,2) GENERATED ALWAYS AS (total_value - total_cost) STORED,
  gain_loss_percent NUMERIC(8,4),
  stock_value NUMERIC(18,2) DEFAULT 0,
  mutual_fund_value NUMERIC(18,2) DEFAULT 0,
  cash_value NUMERIC(18,2) DEFAULT 0,
  total_contributions NUMERIC(18,2) DEFAULT 0,
  snapshot_detail JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_contributions_member ON public.contributions(member_id);
CREATE INDEX idx_contributions_period ON public.contributions(period_id);
CREATE INDEX idx_contributions_status ON public.contributions(status);
CREATE INDEX idx_transactions_date ON public.transactions(transaction_date DESC);
CREATE INDEX idx_transactions_stock ON public.transactions(stock_id);
CREATE INDEX idx_stock_prices_stock_date ON public.stock_prices(stock_id, price_date DESC);
CREATE INDEX idx_stock_prices_date ON public.stock_prices(price_date DESC);
CREATE INDEX idx_holdings_asset ON public.holdings(asset_type, stock_id, mutual_fund_id);
CREATE INDEX idx_documents_type ON public.documents(document_type, upload_date DESC);
CREATE INDEX idx_portfolio_snapshots_date ON public.portfolio_snapshots(snapshot_date DESC);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_members_updated_at BEFORE UPDATE ON public.members FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_contribution_periods_updated_at BEFORE UPDATE ON public.contribution_periods FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_contributions_updated_at BEFORE UPDATE ON public.contributions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_holdings_updated_at BEFORE UPDATE ON public.holdings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
