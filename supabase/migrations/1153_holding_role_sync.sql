-- ============================================================
-- MIGRATION 1153: Holding Role Sync for Child Organizations
-- Ensures role permissions/hierarchy from holding are mirrored
-- into direct child organizations.
-- ============================================================

-- 1) Role mapping metadata for cross-org synchronization
ALTER TABLE public.roles
  ADD COLUMN IF NOT EXISTS source_org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;

ALTER TABLE public.roles
  ADD COLUMN IF NOT EXISTS source_role_id UUID REFERENCES public.roles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_roles_source_org_id
  ON public.roles(source_org_id);

CREATE INDEX IF NOT EXISTS idx_roles_source_role_id
  ON public.roles(source_role_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_roles_org_source_role
  ON public.roles(org_id, source_role_id)
  WHERE source_role_id IS NOT NULL;

-- 2) Core sync function: copy/update holding roles into one child org
CREATE OR REPLACE FUNCTION public.sync_parent_roles_to_child_org(
  p_parent_org_id UUID,
  p_child_org_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent_org_parent_id UUID;
  v_child_org_parent_id UUID;
  v_parent_role RECORD;
  v_target_role_id UUID;
  v_target_parent_id UUID;
  v_conflict_role_id UUID;
  v_target_name TEXT;
BEGIN
  IF p_parent_org_id IS NULL OR p_child_org_id IS NULL THEN
    RETURN;
  END IF;

  SELECT o.parent_org_id
    INTO v_parent_org_parent_id
  FROM public.organizations o
  WHERE o.id = p_parent_org_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Parent organization % tidak ditemukan.', p_parent_org_id;
  END IF;

  IF v_parent_org_parent_id IS NOT NULL THEN
    RAISE EXCEPTION 'Organisasi sumber % bukan holding/root.', p_parent_org_id;
  END IF;

  SELECT o.parent_org_id
    INTO v_child_org_parent_id
  FROM public.organizations o
  WHERE o.id = p_child_org_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Child organization % tidak ditemukan.', p_child_org_id;
  END IF;

  IF v_child_org_parent_id IS DISTINCT FROM p_parent_org_id THEN
    RAISE EXCEPTION 'Organisasi % bukan child langsung dari %.', p_child_org_id, p_parent_org_id;
  END IF;

  -- Pass 1: upsert role rows (without parent relation first)
  FOR v_parent_role IN
    SELECT
      r.id,
      r.name,
      COALESCE(r.permissions, '{}'::TEXT[]) AS permissions,
      COALESCE(r.is_system, FALSE) AS is_system,
      COALESCE(r.priority, 999) AS priority,
      r.department_id,
      COALESCE(r.department_ids, '{}'::TEXT[]) AS department_ids
    FROM public.roles r
    WHERE r.org_id = p_parent_org_id
    ORDER BY COALESCE(r.priority, 999), r.name, r.id
  LOOP
    v_target_role_id := NULL;
    v_conflict_role_id := NULL;
    v_target_name := v_parent_role.name;

    -- Strong mapping first
    SELECT r.id
      INTO v_target_role_id
    FROM public.roles r
    WHERE r.org_id = p_child_org_id
      AND r.source_role_id = v_parent_role.id
    LIMIT 1;

    -- Fallback to existing unmapped role by case-insensitive name
    IF v_target_role_id IS NULL THEN
      SELECT r.id
        INTO v_target_role_id
      FROM public.roles r
      WHERE r.org_id = p_child_org_id
        AND r.source_role_id IS NULL
        AND LOWER(TRIM(r.name)) = LOWER(TRIM(v_parent_role.name))
      ORDER BY r.created_at ASC
      LIMIT 1;
    END IF;

    IF v_target_role_id IS NULL THEN
      INSERT INTO public.roles (
        org_id,
        name,
        permissions,
        is_system,
        priority,
        department_id,
        department_ids,
        parent_id,
        source_org_id,
        source_role_id
      )
      VALUES (
        p_child_org_id,
        v_parent_role.name,
        v_parent_role.permissions,
        v_parent_role.is_system,
        v_parent_role.priority,
        v_parent_role.department_id,
        v_parent_role.department_ids,
        NULL,
        p_parent_org_id,
        v_parent_role.id
      )
      RETURNING id INTO v_target_role_id;
    ELSE
      -- Keep existing child name when rename collides with another child role.
      SELECT r.id
        INTO v_conflict_role_id
      FROM public.roles r
      WHERE r.org_id = p_child_org_id
        AND r.id <> v_target_role_id
        AND LOWER(TRIM(r.name)) = LOWER(TRIM(v_parent_role.name))
      ORDER BY r.created_at ASC
      LIMIT 1;

      IF v_conflict_role_id IS NOT NULL THEN
        SELECT r.name
          INTO v_target_name
        FROM public.roles r
        WHERE r.id = v_target_role_id
        LIMIT 1;
      END IF;

      UPDATE public.roles
      SET
        name = COALESCE(v_target_name, v_parent_role.name),
        permissions = v_parent_role.permissions,
        is_system = v_parent_role.is_system,
        priority = v_parent_role.priority,
        department_id = v_parent_role.department_id,
        department_ids = v_parent_role.department_ids,
        source_org_id = p_parent_org_id,
        source_role_id = v_parent_role.id
      WHERE id = v_target_role_id;
    END IF;
  END LOOP;

  -- Pass 2: parent hierarchy mapping
  FOR v_parent_role IN
    SELECT r.id, r.parent_id
    FROM public.roles r
    WHERE r.org_id = p_parent_org_id
  LOOP
    SELECT r.id
      INTO v_target_role_id
    FROM public.roles r
    WHERE r.org_id = p_child_org_id
      AND r.source_role_id = v_parent_role.id
    LIMIT 1;

    IF v_target_role_id IS NULL THEN
      CONTINUE;
    END IF;

    IF v_parent_role.parent_id IS NULL THEN
      v_target_parent_id := NULL;
    ELSE
      SELECT r.id
        INTO v_target_parent_id
      FROM public.roles r
      WHERE r.org_id = p_child_org_id
        AND r.source_role_id = v_parent_role.parent_id
      LIMIT 1;
    END IF;

    UPDATE public.roles
    SET parent_id = v_target_parent_id
    WHERE id = v_target_role_id;
  END LOOP;

  -- Any previously-synced role whose source no longer exists in parent is detached.
  UPDATE public.roles r
  SET
    source_org_id = NULL,
    source_role_id = NULL,
    parent_id = NULL
  WHERE r.org_id = p_child_org_id
    AND r.source_org_id = p_parent_org_id
    AND r.source_role_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.roles pr
      WHERE pr.org_id = p_parent_org_id
        AND pr.id = r.source_role_id
    );
END;
$$;

-- 3) Convenience sync for all active children of a holding
CREATE OR REPLACE FUNCTION public.sync_parent_roles_to_children(
  p_parent_org_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_child RECORD;
BEGIN
  IF p_parent_org_id IS NULL THEN
    RETURN;
  END IF;

  FOR v_child IN
    SELECT o.id
    FROM public.organizations o
    WHERE o.parent_org_id = p_parent_org_id
      AND COALESCE(o.is_active, TRUE) = TRUE
  LOOP
    PERFORM public.sync_parent_roles_to_child_org(p_parent_org_id, v_child.id);
  END LOOP;
END;
$$;

-- 4) Trigger: auto-sync whenever holding roles are changed
CREATE OR REPLACE FUNCTION public.trg_sync_parent_roles_after_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID := COALESCE(NEW.org_id, OLD.org_id);
  v_parent_org_id UUID;
BEGIN
  IF v_org_id IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  SELECT o.parent_org_id
    INTO v_parent_org_id
  FROM public.organizations o
  WHERE o.id = v_org_id
  LIMIT 1;

  -- Only holding/root roles propagate.
  IF NOT FOUND OR v_parent_org_id IS NOT NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  PERFORM public.sync_parent_roles_to_children(v_org_id);

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_parent_roles_after_change ON public.roles;
CREATE TRIGGER trg_sync_parent_roles_after_change
AFTER INSERT OR UPDATE OR DELETE ON public.roles
FOR EACH ROW
EXECUTE FUNCTION public.trg_sync_parent_roles_after_change();

-- 5) Backfill existing holding-child structures
DO $$
DECLARE
  v_rel RECORD;
BEGIN
  FOR v_rel IN
    SELECT o.parent_org_id AS parent_org_id, o.id AS child_org_id
    FROM public.organizations o
    WHERE o.parent_org_id IS NOT NULL
  LOOP
    BEGIN
      PERFORM public.sync_parent_roles_to_child_org(v_rel.parent_org_id, v_rel.child_org_id);
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE 'Role sync backfill skipped for parent %, child %: %',
          v_rel.parent_org_id,
          v_rel.child_org_id,
          SQLERRM;
    END;
  END LOOP;
END;
$$;

NOTIFY pgrst, 'reload schema';
