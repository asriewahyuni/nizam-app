-- ============================================================
-- MIGRATION 1156: Enforce SaaS Plan Hierarchy
-- ============================================================
-- Problem:
-- - Paket SaaS child masih bisa berbeda dari parent/holding.
-- - Saat paket parent berubah, descendant tidak otomatis ikut berubah.
-- - Akibatnya modul, limit resource, dan billing bisa tidak sinkron.
--
-- Goal:
-- - settings.plan child selalu mengikuti parent langsung.
-- - Flag demo ikut diwariskan agar state paket tetap konsisten.
-- - Perubahan paket parent otomatis dipropagasikan ke seluruh descendant.
-- - Data existing dibackfill supaya hierarki lama langsung rapih.

CREATE OR REPLACE FUNCTION public.enforce_inherited_saas_plan_on_org()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent_plan TEXT;
  v_parent_is_demo BOOLEAN := FALSE;
BEGIN
  IF NEW.parent_org_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT
    NULLIF(BTRIM(o.settings ->> 'plan'), ''),
    (
      COALESCE(o.is_demo, FALSE)
      OR CASE
        WHEN jsonb_typeof(COALESCE(o.settings, '{}'::jsonb) -> 'is_demo') = 'boolean'
          THEN COALESCE((o.settings ->> 'is_demo')::BOOLEAN, FALSE)
        ELSE FALSE
      END
      OR LOWER(COALESCE(o.settings ->> 'plan', '')) = 'demo'
    )
  INTO v_parent_plan, v_parent_is_demo
  FROM public.organizations o
  WHERE o.id = NEW.parent_org_id;

  IF v_parent_plan IS NOT NULL THEN
    NEW.settings := jsonb_set(
      COALESCE(NEW.settings, '{}'::jsonb),
      '{plan}',
      to_jsonb(v_parent_plan),
      TRUE
    );
  END IF;

  NEW.settings := jsonb_set(
    COALESCE(NEW.settings, '{}'::jsonb),
    '{is_demo}',
    to_jsonb(v_parent_is_demo),
    TRUE
  );
  NEW.is_demo := v_parent_is_demo;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.propagate_saas_plan_to_descendant_orgs()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_effective_plan TEXT := NULLIF(BTRIM(COALESCE(NEW.settings ->> 'plan', '')), '');
  v_effective_is_demo BOOLEAN := (
    COALESCE(NEW.is_demo, FALSE)
    OR CASE
      WHEN jsonb_typeof(COALESCE(NEW.settings, '{}'::jsonb) -> 'is_demo') = 'boolean'
        THEN COALESCE((NEW.settings ->> 'is_demo')::BOOLEAN, FALSE)
      ELSE FALSE
    END
    OR LOWER(COALESCE(NEW.settings ->> 'plan', '')) = 'demo'
  );
BEGIN
  -- Nested updates are already handled by the root trigger invocation.
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.parent_org_id IS NOT DISTINCT FROM OLD.parent_org_id
     AND COALESCE(NEW.settings ->> 'plan', '') IS NOT DISTINCT FROM COALESCE(OLD.settings ->> 'plan', '')
     AND COALESCE(NEW.is_demo, FALSE) IS NOT DISTINCT FROM COALESCE(OLD.is_demo, FALSE)
     AND COALESCE(COALESCE(NEW.settings, '{}'::jsonb) ->> 'is_demo', '') IS NOT DISTINCT FROM COALESCE(COALESCE(OLD.settings, '{}'::jsonb) ->> 'is_demo', '')
  THEN
    RETURN NEW;
  END IF;

  IF v_effective_plan IS NULL AND NOT v_effective_is_demo THEN
    RETURN NEW;
  END IF;

  WITH RECURSIVE descendant_orgs AS (
    SELECT o.id
    FROM public.organizations o
    WHERE o.parent_org_id = NEW.id

    UNION ALL

    SELECT c.id
    FROM public.organizations c
    INNER JOIN descendant_orgs d ON c.parent_org_id = d.id
  )
  UPDATE public.organizations o
  SET
    settings = CASE
      WHEN v_effective_plan IS NOT NULL THEN
        jsonb_set(
          jsonb_set(
            COALESCE(o.settings, '{}'::jsonb),
            '{plan}',
            to_jsonb(v_effective_plan),
            TRUE
          ),
          '{is_demo}',
          to_jsonb(v_effective_is_demo),
          TRUE
        )
      ELSE
        jsonb_set(
          COALESCE(o.settings, '{}'::jsonb),
          '{is_demo}',
          to_jsonb(v_effective_is_demo),
          TRUE
        )
    END,
    is_demo = v_effective_is_demo,
    updated_at = NOW()
  WHERE o.id IN (SELECT id FROM descendant_orgs)
    AND (
      (v_effective_plan IS NOT NULL AND COALESCE(COALESCE(o.settings, '{}'::jsonb) ->> 'plan', '') IS DISTINCT FROM v_effective_plan)
      OR COALESCE(o.is_demo, FALSE) IS DISTINCT FROM v_effective_is_demo
      OR COALESCE(COALESCE(o.settings, '{}'::jsonb) ->> 'is_demo', '') IS DISTINCT FROM CASE
        WHEN v_effective_is_demo THEN 'true'
        ELSE 'false'
      END
    );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_005_enforce_inherited_saas_plan_on_org ON public.organizations;
CREATE TRIGGER trg_005_enforce_inherited_saas_plan_on_org
  BEFORE INSERT OR UPDATE OF parent_org_id, settings, is_demo
  ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_inherited_saas_plan_on_org();

DROP TRIGGER IF EXISTS trg_905_propagate_saas_plan_to_descendant_orgs ON public.organizations;
CREATE TRIGGER trg_905_propagate_saas_plan_to_descendant_orgs
  AFTER INSERT OR UPDATE OF parent_org_id, settings, is_demo
  ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.propagate_saas_plan_to_descendant_orgs();

WITH RECURSIVE org_tree AS (
  SELECT
    o.id,
    o.parent_org_id,
    NULLIF(BTRIM(COALESCE(o.settings ->> 'plan', '')), '') AS effective_plan,
    (
      COALESCE(o.is_demo, FALSE)
      OR CASE
        WHEN jsonb_typeof(COALESCE(o.settings, '{}'::jsonb) -> 'is_demo') = 'boolean'
          THEN COALESCE((o.settings ->> 'is_demo')::BOOLEAN, FALSE)
        ELSE FALSE
      END
      OR LOWER(COALESCE(o.settings ->> 'plan', '')) = 'demo'
    ) AS effective_is_demo
  FROM public.organizations o
  WHERE o.parent_org_id IS NULL

  UNION ALL

  SELECT
    c.id,
    c.parent_org_id,
    COALESCE(
      NULLIF(BTRIM(COALESCE(p.effective_plan, '')), ''),
      NULLIF(BTRIM(COALESCE(c.settings ->> 'plan', '')), '')
    ) AS effective_plan,
    p.effective_is_demo AS effective_is_demo
  FROM public.organizations c
  INNER JOIN org_tree p ON c.parent_org_id = p.id
)
UPDATE public.organizations o
SET
  settings = CASE
    WHEN t.effective_plan IS NOT NULL THEN
      jsonb_set(
        jsonb_set(
          COALESCE(o.settings, '{}'::jsonb),
          '{plan}',
          to_jsonb(t.effective_plan),
          TRUE
        ),
        '{is_demo}',
        to_jsonb(t.effective_is_demo),
        TRUE
      )
    ELSE
      jsonb_set(
        COALESCE(o.settings, '{}'::jsonb),
        '{is_demo}',
        to_jsonb(t.effective_is_demo),
        TRUE
      )
  END,
  is_demo = t.effective_is_demo,
  updated_at = NOW()
FROM org_tree t
WHERE o.id = t.id
  AND o.parent_org_id IS NOT NULL
  AND (
    (t.effective_plan IS NOT NULL AND COALESCE(COALESCE(o.settings, '{}'::jsonb) ->> 'plan', '') IS DISTINCT FROM t.effective_plan)
    OR COALESCE(o.is_demo, FALSE) IS DISTINCT FROM t.effective_is_demo
    OR COALESCE(COALESCE(o.settings, '{}'::jsonb) ->> 'is_demo', '') IS DISTINCT FROM CASE
      WHEN t.effective_is_demo THEN 'true'
      ELSE 'false'
    END
  );

NOTIFY pgrst, 'reload schema';
