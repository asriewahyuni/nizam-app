-- ============================================================
-- MIGRATION 1152: BSC Configuration + KPI Scoring Engine
-- Adds configurable Balanced Scorecard setup per cycle and scope,
-- with hybrid scoring model:
--   - Internal score: 0..100
--   - Display score:  0..4
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1) Core table: bsc_cycles
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bsc_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  branch_scope_key TEXT NOT NULL DEFAULT 'ALL',
  cycle_key TEXT NOT NULL,
  cycle_name TEXT NOT NULL,
  period_type TEXT NOT NULL DEFAULT 'MONTHLY',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT bsc_cycles_period_type_check CHECK (period_type IN ('MONTHLY', 'QUARTERLY', 'YEARLY', 'CUSTOM')),
  CONSTRAINT bsc_cycles_status_check CHECK (status IN ('ACTIVE', 'CLOSED')),
  CONSTRAINT bsc_cycles_date_check CHECK (start_date <= end_date)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_bsc_cycles_scope_cycle
  ON public.bsc_cycles(org_id, branch_scope_key, cycle_key);

CREATE INDEX IF NOT EXISTS idx_bsc_cycles_org_status
  ON public.bsc_cycles(org_id, status, start_date DESC);

CREATE INDEX IF NOT EXISTS idx_bsc_cycles_branch
  ON public.bsc_cycles(branch_id, start_date DESC);

-- Keep branch_scope_key deterministic for unique upsert support.
CREATE OR REPLACE FUNCTION public.sync_bsc_cycle_scope_key()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.branch_scope_key := COALESCE(NEW.branch_id::TEXT, 'ALL');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_bsc_cycle_scope_key ON public.bsc_cycles;
CREATE TRIGGER trg_sync_bsc_cycle_scope_key
BEFORE INSERT OR UPDATE ON public.bsc_cycles
FOR EACH ROW EXECUTE FUNCTION public.sync_bsc_cycle_scope_key();

DROP TRIGGER IF EXISTS trg_bsc_cycles_updated_at ON public.bsc_cycles;
CREATE TRIGGER trg_bsc_cycles_updated_at
BEFORE UPDATE ON public.bsc_cycles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─────────────────────────────────────────────────────────────
-- 2) Perspective weights per cycle
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bsc_perspective_weights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id UUID NOT NULL REFERENCES public.bsc_cycles(id) ON DELETE CASCADE,
  perspective TEXT NOT NULL,
  weight_percent NUMERIC(5,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT bsc_perspective_weights_unique UNIQUE (cycle_id, perspective),
  CONSTRAINT bsc_perspective_weights_name_check CHECK (perspective IN ('FINANCIAL', 'CUSTOMER', 'INTERNAL_PROCESS', 'LEARNING_GROWTH')),
  CONSTRAINT bsc_perspective_weights_value_check CHECK (weight_percent >= 0 AND weight_percent <= 100)
);

CREATE INDEX IF NOT EXISTS idx_bsc_perspective_weights_cycle
  ON public.bsc_perspective_weights(cycle_id);

DROP TRIGGER IF EXISTS trg_bsc_perspective_weights_updated_at ON public.bsc_perspective_weights;
CREATE TRIGGER trg_bsc_perspective_weights_updated_at
BEFORE UPDATE ON public.bsc_perspective_weights
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─────────────────────────────────────────────────────────────
-- 3) KPI definitions per cycle
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bsc_kpis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id UUID NOT NULL REFERENCES public.bsc_cycles(id) ON DELETE CASCADE,
  perspective TEXT NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  unit TEXT,
  direction TEXT NOT NULL DEFAULT 'HIGHER_BETTER',
  weight_percent NUMERIC(5,2) NOT NULL,
  target_value NUMERIC(19,4) NOT NULL,
  baseline_value NUMERIC(19,4),
  source_type TEXT NOT NULL DEFAULT 'MANUAL',
  formula_key TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT bsc_kpis_unique_code UNIQUE (cycle_id, code),
  CONSTRAINT bsc_kpis_name_check CHECK (perspective IN ('FINANCIAL', 'CUSTOMER', 'INTERNAL_PROCESS', 'LEARNING_GROWTH')),
  CONSTRAINT bsc_kpis_direction_check CHECK (direction IN ('HIGHER_BETTER', 'LOWER_BETTER')),
  CONSTRAINT bsc_kpis_source_check CHECK (source_type IN ('AUTO', 'MANUAL')),
  CONSTRAINT bsc_kpis_weight_check CHECK (weight_percent >= 0 AND weight_percent <= 100)
);

CREATE INDEX IF NOT EXISTS idx_bsc_kpis_cycle
  ON public.bsc_kpis(cycle_id, perspective);

CREATE INDEX IF NOT EXISTS idx_bsc_kpis_active
  ON public.bsc_kpis(cycle_id, is_active);

DROP TRIGGER IF EXISTS trg_bsc_kpis_updated_at ON public.bsc_kpis;
CREATE TRIGGER trg_bsc_kpis_updated_at
BEFORE UPDATE ON public.bsc_kpis
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─────────────────────────────────────────────────────────────
-- 4) KPI measurements per cycle/date
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bsc_kpi_measurements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id UUID NOT NULL REFERENCES public.bsc_cycles(id) ON DELETE CASCADE,
  kpi_id UUID NOT NULL REFERENCES public.bsc_kpis(id) ON DELETE CASCADE,
  measurement_date DATE NOT NULL,
  actual_value NUMERIC(19,4) NOT NULL,
  achievement_percent NUMERIC(7,2) NOT NULL DEFAULT 0,
  score_100 NUMERIC(7,2) NOT NULL DEFAULT 0,
  score_4 NUMERIC(6,3) NOT NULL DEFAULT 0,
  note TEXT,
  measured_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT bsc_kpi_measurements_unique UNIQUE (cycle_id, kpi_id, measurement_date)
);

CREATE INDEX IF NOT EXISTS idx_bsc_kpi_measurements_kpi_date
  ON public.bsc_kpi_measurements(kpi_id, measurement_date DESC);

CREATE INDEX IF NOT EXISTS idx_bsc_kpi_measurements_cycle_date
  ON public.bsc_kpi_measurements(cycle_id, measurement_date DESC);

DROP TRIGGER IF EXISTS trg_bsc_kpi_measurements_updated_at ON public.bsc_kpi_measurements;
CREATE TRIGGER trg_bsc_kpi_measurements_updated_at
BEFORE UPDATE ON public.bsc_kpi_measurements
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─────────────────────────────────────────────────────────────
-- 5) Score helper functions
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.bsc_calculate_achievement_percent(
  p_actual NUMERIC,
  p_target NUMERIC,
  p_direction TEXT
)
RETURNS NUMERIC
LANGUAGE plpgsql
AS $$
DECLARE
  v_actual NUMERIC := COALESCE(p_actual, 0);
  v_target NUMERIC := COALESCE(p_target, 0);
  v_result NUMERIC := 0;
BEGIN
  IF v_target <= 0 THEN
    RETURN 0;
  END IF;

  IF p_direction = 'LOWER_BETTER' THEN
    IF v_actual <= 0 THEN
      RETURN 100;
    END IF;
    v_result := (v_target / v_actual) * 100;
  ELSE
    v_result := (v_actual / v_target) * 100;
  END IF;

  RETURN GREATEST(0, v_result);
END;
$$;

CREATE OR REPLACE FUNCTION public.bsc_score_100_from_achievement(p_achievement NUMERIC)
RETURNS NUMERIC
LANGUAGE SQL
AS $$
  SELECT LEAST(100, GREATEST(0, COALESCE(p_achievement, 0)));
$$;

CREATE OR REPLACE FUNCTION public.bsc_score_4_from_score_100(p_score_100 NUMERIC)
RETURNS NUMERIC
LANGUAGE SQL
AS $$
  SELECT ROUND((LEAST(100, GREATEST(0, COALESCE(p_score_100, 0))) / 25.0)::NUMERIC, 3);
$$;

CREATE OR REPLACE FUNCTION public.fill_bsc_measurement_scores()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_target NUMERIC;
  v_direction TEXT;
  v_achievement NUMERIC;
  v_score_100 NUMERIC;
BEGIN
  SELECT k.target_value, k.direction
    INTO v_target, v_direction
  FROM public.bsc_kpis k
  WHERE k.id = NEW.kpi_id
    AND k.cycle_id = NEW.cycle_id
  LIMIT 1;

  IF v_target IS NULL THEN
    RAISE EXCEPTION 'KPI tidak ditemukan untuk measurement ini.';
  END IF;

  v_achievement := public.bsc_calculate_achievement_percent(NEW.actual_value, v_target, v_direction);
  v_score_100 := public.bsc_score_100_from_achievement(v_achievement);

  NEW.achievement_percent := ROUND(v_achievement::NUMERIC, 2);
  NEW.score_100 := ROUND(v_score_100::NUMERIC, 2);
  NEW.score_4 := public.bsc_score_4_from_score_100(v_score_100);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fill_bsc_measurement_scores ON public.bsc_kpi_measurements;
CREATE TRIGGER trg_fill_bsc_measurement_scores
BEFORE INSERT OR UPDATE OF actual_value, kpi_id, cycle_id
ON public.bsc_kpi_measurements
FOR EACH ROW
EXECUTE FUNCTION public.fill_bsc_measurement_scores();

-- ─────────────────────────────────────────────────────────────
-- 6) View: latest measurement per KPI
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_bsc_latest_kpi_measurements AS
SELECT
  ranked.id,
  ranked.cycle_id,
  ranked.kpi_id,
  ranked.measurement_date,
  ranked.actual_value,
  ranked.achievement_percent,
  ranked.score_100,
  ranked.score_4,
  ranked.note,
  ranked.measured_by,
  ranked.created_at,
  ranked.updated_at
FROM (
  SELECT
    m.*,
    ROW_NUMBER() OVER (
      PARTITION BY m.kpi_id
      ORDER BY m.measurement_date DESC, m.created_at DESC
    ) AS rn
  FROM public.bsc_kpi_measurements m
) ranked
WHERE ranked.rn = 1;

-- ─────────────────────────────────────────────────────────────
-- 7) RLS
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.bsc_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bsc_perspective_weights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bsc_kpis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bsc_kpi_measurements ENABLE ROW LEVEL SECURITY;

-- bsc_cycles
DROP POLICY IF EXISTS "members_view_bsc_cycles" ON public.bsc_cycles;
CREATE POLICY "members_view_bsc_cycles"
ON public.bsc_cycles
FOR SELECT
USING (
  public.nizam_has_permission('strategy:read', org_id)
  OR public.nizam_has_permission('reports:read', org_id)
);

DROP POLICY IF EXISTS "members_manage_bsc_cycles" ON public.bsc_cycles;
CREATE POLICY "members_manage_bsc_cycles"
ON public.bsc_cycles
FOR ALL
USING (public.nizam_has_permission('strategy:write', org_id))
WITH CHECK (public.nizam_has_permission('strategy:write', org_id));

-- bsc_perspective_weights
DROP POLICY IF EXISTS "members_view_bsc_perspective_weights" ON public.bsc_perspective_weights;
CREATE POLICY "members_view_bsc_perspective_weights"
ON public.bsc_perspective_weights
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.bsc_cycles c
    WHERE c.id = bsc_perspective_weights.cycle_id
      AND (
        public.nizam_has_permission('strategy:read', c.org_id)
        OR public.nizam_has_permission('reports:read', c.org_id)
      )
  )
);

DROP POLICY IF EXISTS "members_manage_bsc_perspective_weights" ON public.bsc_perspective_weights;
CREATE POLICY "members_manage_bsc_perspective_weights"
ON public.bsc_perspective_weights
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.bsc_cycles c
    WHERE c.id = bsc_perspective_weights.cycle_id
      AND public.nizam_has_permission('strategy:write', c.org_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.bsc_cycles c
    WHERE c.id = bsc_perspective_weights.cycle_id
      AND public.nizam_has_permission('strategy:write', c.org_id)
  )
);

-- bsc_kpis
DROP POLICY IF EXISTS "members_view_bsc_kpis" ON public.bsc_kpis;
CREATE POLICY "members_view_bsc_kpis"
ON public.bsc_kpis
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.bsc_cycles c
    WHERE c.id = bsc_kpis.cycle_id
      AND (
        public.nizam_has_permission('strategy:read', c.org_id)
        OR public.nizam_has_permission('reports:read', c.org_id)
      )
  )
);

DROP POLICY IF EXISTS "members_manage_bsc_kpis" ON public.bsc_kpis;
CREATE POLICY "members_manage_bsc_kpis"
ON public.bsc_kpis
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.bsc_cycles c
    WHERE c.id = bsc_kpis.cycle_id
      AND public.nizam_has_permission('strategy:write', c.org_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.bsc_cycles c
    WHERE c.id = bsc_kpis.cycle_id
      AND public.nizam_has_permission('strategy:write', c.org_id)
  )
);

-- bsc_kpi_measurements
DROP POLICY IF EXISTS "members_view_bsc_measurements" ON public.bsc_kpi_measurements;
CREATE POLICY "members_view_bsc_measurements"
ON public.bsc_kpi_measurements
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.bsc_cycles c
    WHERE c.id = bsc_kpi_measurements.cycle_id
      AND (
        public.nizam_has_permission('strategy:read', c.org_id)
        OR public.nizam_has_permission('reports:read', c.org_id)
      )
  )
);

DROP POLICY IF EXISTS "members_manage_bsc_measurements" ON public.bsc_kpi_measurements;
CREATE POLICY "members_manage_bsc_measurements"
ON public.bsc_kpi_measurements
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.bsc_cycles c
    WHERE c.id = bsc_kpi_measurements.cycle_id
      AND public.nizam_has_permission('strategy:write', c.org_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.bsc_cycles c
    WHERE c.id = bsc_kpi_measurements.cycle_id
      AND public.nizam_has_permission('strategy:write', c.org_id)
  )
);

NOTIFY pgrst, 'reload schema';
