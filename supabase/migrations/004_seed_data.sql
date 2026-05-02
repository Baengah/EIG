-- EIG Platform - Seed Data

-- ============================================================
-- NGX Blue-chip stocks (common holdings)
-- ============================================================
INSERT INTO public.stocks (ticker, company_name, sector, sub_sector, market_cap_category) VALUES
  ('DANGCEM', 'Dangote Cement Plc', 'Industrial Goods', 'Building Materials', 'large'),
  ('MTNN', 'MTN Nigeria Communications Plc', 'Telecommunications', 'Mobile Telecoms', 'large'),
  ('GTCO', 'Guaranty Trust Holding Company Plc', 'Financial Services', 'Banks', 'large'),
  ('ZENITHBANK', 'Zenith Bank Plc', 'Financial Services', 'Banks', 'large'),
  ('ACCESSCORP', 'Access Holdings Plc', 'Financial Services', 'Banks', 'large'),
  ('UBA', 'United Bank for Africa Plc', 'Financial Services', 'Banks', 'large'),
  ('FBNH', 'FBN Holdings Plc', 'Financial Services', 'Banks', 'large'),
  ('NESTLE', 'Nestle Nigeria Plc', 'Consumer Goods', 'Food Products', 'large'),
  ('BUACEMENT', 'BUA Cement Plc', 'Industrial Goods', 'Building Materials', 'large'),
  ('BUAFOODS', 'BUA Foods Plc', 'Consumer Goods', 'Food Products', 'large'),
  ('AIRTELAFRI', 'Airtel Africa Plc', 'Telecommunications', 'Mobile Telecoms', 'large'),
  ('SEPLAT', 'Seplat Energy Plc', 'Oil and Gas', 'Exploration & Production', 'large'),
  ('STANBIC', 'Stanbic IBTC Holdings Plc', 'Financial Services', 'Banks', 'large'),
  ('WAPCO', 'Lafarge Africa Plc', 'Industrial Goods', 'Building Materials', 'medium'),
  ('NB', 'Nigerian Breweries Plc', 'Consumer Goods', 'Beverages', 'large'),
  ('GUINNESS', 'Guinness Nigeria Plc', 'Consumer Goods', 'Beverages', 'medium'),
  ('FLOURMILL', 'Flour Mills of Nigeria Plc', 'Consumer Goods', 'Food Products', 'medium'),
  ('OANDO', 'Oando Plc', 'Oil and Gas', 'Integrated Oil & Gas', 'medium'),
  ('TOTALENERGIES', 'TotalEnergies Marketing Nigeria Plc', 'Oil and Gas', 'Oil Marketing', 'medium'),
  ('PRESCO', 'Presco Plc', 'Agriculture', 'Agro-Chemicals & Food Processing', 'medium'),
  ('CONOIL', 'Conoil Plc', 'Oil and Gas', 'Oil Marketing', 'medium'),
  ('FIDELITYBK', 'Fidelity Bank Plc', 'Financial Services', 'Banks', 'medium'),
  ('FCMB', 'FCMB Group Plc', 'Financial Services', 'Banks', 'medium'),
  ('STERLINGBANK', 'Sterling Financial Holdings Plc', 'Financial Services', 'Banks', 'small'),
  ('TRANSCORP', 'Transnational Corporation Plc', 'Conglomerates', 'Conglomerates', 'medium')
ON CONFLICT (ticker) DO NOTHING;

-- ============================================================
-- Common Nigerian Mutual Funds
-- ============================================================
INSERT INTO public.mutual_funds (fund_name, fund_code, fund_manager, fund_type) VALUES
  ('Stanbic IBTC Money Market Fund', 'SIMM', 'Stanbic IBTC Asset Management', 'money_market'),
  ('ARM Discovery Fund', 'ARMDF', 'ARM Investment Managers', 'equity'),
  ('Coronation Money Market Fund', 'CMMF', 'Coronation Asset Management', 'money_market'),
  ('FBN Money Market Fund', 'FBNMM', 'FBN Asset Management', 'money_market'),
  ('United Capital Balanced Fund', 'UCBF', 'United Capital Asset Management', 'balanced'),
  ('Meristem Equity Market Fund', 'MEMF', 'Meristem Asset Management', 'equity'),
  ('Chapel Hill Denham Money Market Fund', 'CHDMM', 'Chapel Hill Denham', 'money_market'),
  ('Vetiva Griffin Fund', 'VGF', 'Vetiva Fund Managers', 'equity'),
  ('CardinalStone Fixed Income Fund', 'CSFIF', 'CardinalStone Asset Management', 'fixed_income')
ON CONFLICT (fund_code) DO NOTHING;
