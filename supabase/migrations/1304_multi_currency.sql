-- 1304_multi_currency.sql
-- Multi-Currency Engine — Org currency settings, exchange rates, FX tracking

-- 1. Org Currency Settings
CREATE TABLE IF NOT EXISTS org_currencies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  
  base_currency TEXT NOT NULL DEFAULT 'IDR',
  decimal_places INT NOT NULL DEFAULT 0,
  
  -- Auto-update rates
  auto_update_rates BOOLEAN NOT NULL DEFAULT false,
  rate_provider TEXT DEFAULT 'BANK_INDONESIA', -- BANK_INDONESIA | MANUAL
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Allowed foreign currencies per org
CREATE TABLE IF NOT EXISTS org_allowed_currencies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  currency_code TEXT NOT NULL, -- USD, SGD, MYR, etc.
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT unique_org_currency UNIQUE (org_id, currency_code)
);

-- 3. Exchange Rate History
CREATE TABLE IF NOT EXISTS exchange_rates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  from_currency TEXT NOT NULL, -- e.g. 'USD'
  to_currency TEXT NOT NULL DEFAULT 'IDR', -- base currency
  rate NUMERIC(20,6) NOT NULL, -- 1 from_currency = rate to_currency
  rate_date DATE NOT NULL DEFAULT CURRENT_DATE,
  source TEXT DEFAULT 'MANUAL', -- MANUAL | API | CSV_IMPORT
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  
  CONSTRAINT unique_rate_per_day UNIQUE (org_id, from_currency, to_currency, rate_date)
);

CREATE INDEX IF NOT EXISTS idx_exchange_rates_org_currency_date 
  ON exchange_rates(org_id, from_currency, rate_date DESC);

-- 4. Add currency columns to sales & purchases
ALTER TABLE sales ADD COLUMN IF NOT EXISTS currency_code TEXT DEFAULT 'IDR';
ALTER TABLE sales ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(20,6); -- rate used at transaction time
ALTER TABLE sales ADD COLUMN IF NOT EXISTS base_currency_amount NUMERIC(20,2); -- grand_total in base currency

ALTER TABLE purchases ADD COLUMN IF NOT EXISTS currency_code TEXT DEFAULT 'IDR';
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(20,6);
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS base_currency_amount NUMERIC(20,2);

-- 5. FX Gain/Loss tracking
CREATE TABLE IF NOT EXISTS forex_realized_gl (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entry_id UUID REFERENCES journal_entries(id) ON DELETE SET NULL,
  currency_code TEXT NOT NULL,
  amount_foreign NUMERIC(20,2) NOT NULL,
  rate_at_transaction NUMERIC(20,6) NOT NULL,
  rate_at_settlement NUMERIC(20,6) NOT NULL,
  fx_gain_loss NUMERIC(20,2) NOT NULL,
  is_gain BOOLEAN NOT NULL,
  realized_at DATE NOT NULL DEFAULT CURRENT_DATE,
  reference_type TEXT, -- 'SALE' | 'PURCHASE'
  reference_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Function: convert amount to base currency
CREATE OR REPLACE FUNCTION convert_to_base_currency(
  p_org_id UUID,
  p_amount NUMERIC,
  p_from_currency TEXT,
  p_rate_date DATE DEFAULT CURRENT_DATE
) RETURNS NUMERIC(20,2)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_rate NUMERIC(20,6);
  v_base_currency TEXT;
BEGIN
  IF p_from_currency = 'IDR' OR p_from_currency IS NULL THEN
    RETURN p_amount;
  END IF;

  -- Get base currency
  SELECT COALESCE(base_currency, 'IDR') INTO v_base_currency 
  FROM org_currencies WHERE org_id = p_org_id;
  
  -- Get rate for that date
  SELECT rate INTO v_rate FROM exchange_rates 
  WHERE org_id = p_org_id 
    AND from_currency = p_from_currency 
    AND to_currency = v_base_currency
    AND rate_date = p_rate_date
  ORDER BY created_at DESC LIMIT 1;
  
  IF v_rate IS NULL OR v_rate = 0 THEN
    RETURN p_amount; -- fallback, no rate
  END IF;
  
  RETURN ROUND(p_amount * v_rate, 2);
END;
$$;

-- 7. Function: get latest rate
CREATE OR REPLACE FUNCTION get_latest_rate(
  p_org_id UUID,
  p_from_currency TEXT
) RETURNS TABLE (
  rate NUMERIC(20,6),
  rate_date DATE,
  source TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT er.rate, er.rate_date, er.source
  FROM exchange_rates er
  WHERE er.org_id = p_org_id
    AND er.from_currency = p_from_currency
  ORDER BY er.rate_date DESC, er.created_at DESC
  LIMIT 1;
END;
$$;
