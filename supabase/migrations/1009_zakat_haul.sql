-- ============================================================
-- MIGRATION 1009: Zakat Haul Tracking
-- Tracks the haul (lunar year) start date and prices for accurate zakat
-- ============================================================

CREATE TABLE IF NOT EXISTS public.zakat_haul (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  haul_start_date DATE NOT NULL,
  gold_price_per_gram NUMERIC NOT NULL,    -- Price at START of haul (fixed for the year)
  silver_price_per_gram NUMERIC NOT NULL,  -- Price at START of haul (fixed for the year)
  nishab_gold NUMERIC NOT NULL,            -- 85g * gold price at start
  nishab_silver NUMERIC NOT NULL,          -- 595g * silver price at start  
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'BATAL', 'COMPLETED', 'ARCHIVED')),
  batal_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Haul can only have one ACTIVE row per org
CREATE UNIQUE INDEX IF NOT EXISTS idx_zakat_haul_org_active
  ON public.zakat_haul (org_id) WHERE status = 'ACTIVE';

-- Zakat Haul History events
CREATE TABLE IF NOT EXISTS public.zakat_haul_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  haul_id UUID NOT NULL REFERENCES public.zakat_haul(id) ON DELETE CASCADE,
  org_id UUID NOT NULL,
  event_date DATE NOT NULL,
  total_assets NUMERIC NOT NULL,
  is_above_nishab BOOLEAN NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS (using correct table: org_members)
ALTER TABLE public.zakat_haul ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zakat_haul_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_zakat_haul" ON public.zakat_haul
  USING (org_id IN (
    SELECT org_id FROM public.org_members
    WHERE user_id = auth.uid() AND is_active = TRUE
  ));

CREATE POLICY "org_zakat_haul_events" ON public.zakat_haul_events
  USING (org_id IN (
    SELECT org_id FROM public.org_members
    WHERE user_id = auth.uid() AND is_active = TRUE
  ));
