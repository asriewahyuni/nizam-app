-- ============================================================
-- MIGRATION 1141: Fix Missing Consolidation Tree Functions
-- ============================================================
-- Root cause: function public.is_org_in_consolidation_tree(uuid, uuid)
-- does not exist — either migration 1127 was never fully applied
-- or the function was inadvertently dropped.
--
-- This migration idempotently re-creates both:
--   1. get_consolidated_org_ids(uuid)        — recursive CTE
--   2. is_org_in_consolidation_tree(uuid, uuid) — membership check
--   3. get_consolidated_org_hierarchy(uuid)  — hierarchy display
-- And grants EXECUTE to authenticated role.
-- ============================================================

-- 1. Recursive function: get all org IDs in the consolidation tree
CREATE OR REPLACE FUNCTION public.get_consolidated_org_ids(p_parent_org_id UUID)
RETURNS TABLE (org_id UUID)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    WITH RECURSIVE org_tree AS (
        -- Base case: The parent organization
        SELECT id
        FROM organizations
        WHERE id = p_parent_org_id

        UNION ALL

        -- Recursive case: Find all organizations where parent is in the current tree
        SELECT o.id
        FROM organizations o
        INNER JOIN org_tree ot ON o.parent_org_id = ot.id
    )
    SELECT id FROM org_tree;
$$;

-- 2. Helper: check if a target org is within a parent's consolidation tree
CREATE OR REPLACE FUNCTION public.is_org_in_consolidation_tree(p_target_org_id UUID, p_parent_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.get_consolidated_org_ids(p_parent_org_id)
        WHERE org_id = p_target_org_id
    );
$$;

-- 3. Hierarchy display function
CREATE OR REPLACE FUNCTION public.get_consolidated_org_hierarchy(p_parent_org_id UUID)
RETURNS TABLE (
    org_id UUID,
    parent_org_id UUID,
    org_name TEXT,
    level_depth INTEGER,
    hierarchy_label TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    WITH parent_and_direct_children AS (
        SELECT
            o.id,
            o.parent_org_id,
            o.name,
            0::INT AS level_depth,
            0::INT AS sort_group,
            LOWER(o.name) AS sort_name
        FROM organizations o
        WHERE o.id = p_parent_org_id

        UNION ALL

        SELECT
            c.id,
            c.parent_org_id,
            c.name,
            1::INT AS level_depth,
            1::INT AS sort_group,
            LOWER(c.name) AS sort_name
        FROM organizations c
        WHERE c.parent_org_id = p_parent_org_id
    )
    SELECT
        id AS org_id,
        parent_org_id,
        name AS org_name,
        level_depth,
        CASE
            WHEN level_depth = 0 THEN name || ' (Parent)'
            ELSE '  |__> ' || name
        END AS hierarchy_label
    FROM parent_and_direct_children
    ORDER BY sort_group, sort_name;
$$;

-- 4. Grant EXECUTE to authenticated role
GRANT EXECUTE ON FUNCTION public.get_consolidated_org_ids(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_in_consolidation_tree(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_consolidated_org_hierarchy(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
