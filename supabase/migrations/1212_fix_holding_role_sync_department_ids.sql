-- ============================================================
-- MIGRATION 1212: Fix holding role sync for department_ids
-- Avoid legacy department_id references and text[] COALESCE casts
-- now that roles.department_ids may be stored as nizam_department[].
-- ============================================================

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

  FOR v_parent_role IN
    SELECT
      r.id,
      r.name,
      COALESCE(r.permissions, '{}'::TEXT[]) AS permissions,
      COALESCE(r.is_system, FALSE) AS is_system,
      COALESCE(r.priority, 999) AS priority,
      r.department_ids
    FROM public.roles r
    WHERE r.org_id = p_parent_org_id
    ORDER BY COALESCE(r.priority, 999), r.name, r.id
  LOOP
    v_target_role_id := NULL;
    v_conflict_role_id := NULL;
    v_target_name := v_parent_role.name;

    SELECT r.id
      INTO v_target_role_id
    FROM public.roles r
    WHERE r.org_id = p_child_org_id
      AND r.source_role_id = v_parent_role.id
    LIMIT 1;

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
        v_parent_role.department_ids,
        NULL,
        p_parent_org_id,
        v_parent_role.id
      )
      RETURNING id INTO v_target_role_id;
    ELSE
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
        department_ids = v_parent_role.department_ids,
        source_org_id = p_parent_org_id,
        source_role_id = v_parent_role.id
      WHERE id = v_target_role_id;
    END IF;
  END LOOP;

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

NOTIFY pgrst, 'reload schema';
