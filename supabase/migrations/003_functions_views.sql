-- EIG Platform - Database Functions and Views

-- ============================================================
-- VIEW: Current holdings with latest market prices
-- ============================================================
CREATE OR REPLACE VIEW public.v_holdings_with_value AS
SELECT
  h.id,
  h.asset_type,
  h.stock_id,
  h.mutual_fund_id,
  h.broker_account_id,
  h.quantity,
  h.average_cost,
  h.total_cost,
  -- Stock details
  s.ticker,
  s.company_name,
  s.sector,
  -- Fund details
  mf.fund_name,
  mf.fund_manager,
  mf.fund_type,
  -- Latest price
  COALESCE(latest_price.closing_price, latest_nav.nav) AS current_price,
  COALESCE(latest_price.price_date, latest_nav.nav_date) AS price_date,
  -- Calculated values
  h.quantity * COALESCE(latest_price.closing_price, latest_nav.nav, 0) AS current_value,
  h.quantity * COALESCE(latest_price.closing_price, latest_nav.nav, 0) - h.total_cost AS unrealized_gain_loss,
  CASE
    WHEN h.total_cost > 0 THEN
      ROUND(((h.quantity * COALESCE(latest_price.closing_price, latest_nav.nav, 0) - h.total_cost) / h.total_cost) * 100, 2)
    ELSE 0
  END AS gain_loss_percent,
  h.created_at,
  h.updated_at
FROM public.holdings h
LEFT JOIN public.stocks s ON h.stock_id = s.id
LEFT JOIN public.mutual_funds mf ON h.mutual_fund_id = mf.id
LEFT JOIN LATERAL (
  SELECT closing_price, price_date
  FROM public.stock_prices
  WHERE stock_id = h.stock_id
  ORDER BY price_date DESC
  LIMIT 1
) latest_price ON h.asset_type = 'stock'
LEFT JOIN LATERAL (
  SELECT nav, nav_date
  FROM public.fund_nav_history
  WHERE mutual_fund_id = h.mutual_fund_id
  ORDER BY nav_date DESC
  LIMIT 1
) latest_nav ON h.asset_type = 'mutual_fund';

-- ============================================================
-- VIEW: Portfolio summary
-- ============================================================
CREATE OR REPLACE VIEW public.v_portfolio_summary AS
SELECT
  COUNT(*) AS total_positions,
  SUM(quantity) FILTER (WHERE asset_type = 'stock') AS total_stock_positions,
  SUM(quantity) FILTER (WHERE asset_type = 'mutual_fund') AS total_fund_positions,
  SUM(total_cost) AS total_cost,
  SUM(current_value) AS total_value,
  SUM(unrealized_gain_loss) AS total_unrealized_gain_loss,
  CASE
    WHEN SUM(total_cost) > 0 THEN
      ROUND((SUM(unrealized_gain_loss) / SUM(total_cost)) * 100, 2)
    ELSE 0
  END AS overall_gain_loss_percent,
  SUM(current_value) FILTER (WHERE asset_type = 'stock') AS stock_value,
  SUM(current_value) FILTER (WHERE asset_type = 'mutual_fund') AS fund_value
FROM public.v_holdings_with_value;

-- ============================================================
-- VIEW: Contribution status for current period
-- ============================================================
CREATE OR REPLACE VIEW public.v_contribution_status AS
SELECT
  m.id AS member_id,
  m.member_number,
  m.full_name,
  m.email,
  m.is_active,
  cp.id AS period_id,
  cp.year,
  cp.month,
  cp.amount_per_member,
  cp.due_date,
  c.id AS contribution_id,
  c.amount_paid,
  c.payment_date,
  c.payment_method,
  c.status,
  COALESCE(c.amount_paid, 0) AS paid_amount,
  cp.amount_per_member - COALESCE(c.amount_paid, 0) AS outstanding_amount
FROM public.members m
CROSS JOIN public.contribution_periods cp
LEFT JOIN public.contributions c ON c.member_id = m.id AND c.period_id = cp.id
WHERE m.is_active = TRUE
ORDER BY cp.year DESC, cp.month DESC, m.full_name;

-- ============================================================
-- FUNCTION: Update holdings after transaction
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_holding_after_transaction()
RETURNS TRIGGER AS $$
DECLARE
  v_holding_id UUID;
  v_current_qty NUMERIC;
  v_current_avg_cost NUMERIC;
  v_new_qty NUMERIC;
  v_new_avg_cost NUMERIC;
BEGIN
  -- Only process buy/sell transactions
  IF NEW.transaction_type NOT IN ('buy', 'sell', 'transfer_in', 'transfer_out') THEN
    RETURN NEW;
  END IF;

  -- Find existing holding
  SELECT id, quantity, average_cost
  INTO v_holding_id, v_current_qty, v_current_avg_cost
  FROM public.holdings
  WHERE asset_type = NEW.asset_type
    AND (stock_id = NEW.stock_id OR mutual_fund_id = NEW.mutual_fund_id)
    AND (broker_account_id = NEW.broker_account_id OR (broker_account_id IS NULL AND NEW.broker_account_id IS NULL));

  IF NEW.transaction_type IN ('buy', 'transfer_in') THEN
    IF v_holding_id IS NULL THEN
      -- Create new holding
      INSERT INTO public.holdings (asset_type, stock_id, mutual_fund_id, broker_account_id, quantity, average_cost)
      VALUES (NEW.asset_type, NEW.stock_id, NEW.mutual_fund_id, NEW.broker_account_id, NEW.quantity, NEW.price);
    ELSE
      -- Update existing: weighted average cost
      v_new_qty := v_current_qty + NEW.quantity;
      v_new_avg_cost := ((v_current_qty * v_current_avg_cost) + (NEW.quantity * NEW.price)) / v_new_qty;
      UPDATE public.holdings
      SET quantity = v_new_qty, average_cost = v_new_avg_cost
      WHERE id = v_holding_id;
    END IF;

  ELSIF NEW.transaction_type IN ('sell', 'transfer_out') THEN
    IF v_holding_id IS NOT NULL THEN
      v_new_qty := v_current_qty - NEW.quantity;
      IF v_new_qty <= 0 THEN
        DELETE FROM public.holdings WHERE id = v_holding_id;
      ELSE
        UPDATE public.holdings SET quantity = v_new_qty WHERE id = v_holding_id;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_update_holdings
  AFTER INSERT ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_holding_after_transaction();

-- ============================================================
-- FUNCTION: Create daily portfolio snapshot
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_portfolio_snapshot(p_date DATE DEFAULT CURRENT_DATE)
RETURNS UUID AS $$
DECLARE
  v_snapshot_id UUID;
  v_total_value NUMERIC := 0;
  v_total_cost NUMERIC := 0;
  v_stock_value NUMERIC := 0;
  v_fund_value NUMERIC := 0;
  v_total_contributions NUMERIC := 0;
  v_detail JSONB;
BEGIN
  -- Calculate values from holdings
  SELECT
    COALESCE(SUM(current_value), 0),
    COALESCE(SUM(total_cost), 0),
    COALESCE(SUM(current_value) FILTER (WHERE asset_type = 'stock'), 0),
    COALESCE(SUM(current_value) FILTER (WHERE asset_type = 'mutual_fund'), 0)
  INTO v_total_value, v_total_cost, v_stock_value, v_fund_value
  FROM public.v_holdings_with_value;

  -- Total contributions to date
  SELECT COALESCE(SUM(amount_paid), 0)
  INTO v_total_contributions
  FROM public.contributions
  WHERE status IN ('paid', 'partial');

  -- Build detail JSON
  SELECT jsonb_agg(jsonb_build_object(
    'ticker', ticker,
    'fund_name', fund_name,
    'asset_type', asset_type,
    'quantity', quantity,
    'current_price', current_price,
    'current_value', current_value,
    'gain_loss', unrealized_gain_loss,
    'gain_loss_percent', gain_loss_percent
  ))
  INTO v_detail
  FROM public.v_holdings_with_value;

  -- Insert or update snapshot
  INSERT INTO public.portfolio_snapshots (
    snapshot_date, total_value, total_cost,
    stock_value, mutual_fund_value, total_contributions,
    gain_loss_percent, snapshot_detail
  ) VALUES (
    p_date, v_total_value, v_total_cost,
    v_stock_value, v_fund_value, v_total_contributions,
    CASE WHEN v_total_cost > 0 THEN ROUND(((v_total_value - v_total_cost) / v_total_cost) * 100, 2) ELSE 0 END,
    v_detail
  )
  ON CONFLICT (snapshot_date) DO UPDATE SET
    total_value = EXCLUDED.total_value,
    total_cost = EXCLUDED.total_cost,
    stock_value = EXCLUDED.stock_value,
    mutual_fund_value = EXCLUDED.mutual_fund_value,
    total_contributions = EXCLUDED.total_contributions,
    gain_loss_percent = EXCLUDED.gain_loss_percent,
    snapshot_detail = EXCLUDED.snapshot_detail
  RETURNING id INTO v_snapshot_id;

  RETURN v_snapshot_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FUNCTION: Auto-create contributions for all active members
-- when a new contribution period is added
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_contributions_for_period()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.contributions (member_id, period_id, status)
  SELECT m.id, NEW.id, 'pending'
  FROM public.members m
  WHERE m.is_active = TRUE
  ON CONFLICT (member_id, period_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_create_contributions
  AFTER INSERT ON public.contribution_periods
  FOR EACH ROW
  EXECUTE FUNCTION public.create_contributions_for_period();

-- ============================================================
-- FUNCTION: Handle new user signup (create profile)
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'member')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
