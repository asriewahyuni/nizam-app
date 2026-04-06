-- ==============================================================================================
-- MIGRATION 1127: Organization Consolidation Foundation
-- ==============================================================================================
-- Menambahkan fungsi-fungsi dasar untuk mendukung penarikan laporan secara terkonsolidasi
-- antara Holding (Parent) ke seluruh struktur anak perusahaannya.

-- 1. Fungsi Rekursif untuk Mengambil Semua ID Organisasi secara Hierarkis
CREATE OR REPLACE FUNCTION get_consolidated_org_ids(p_parent_org_id UUID)
RETURNS TABLE (org_id UUID)
LANGUAGE sql
SECURITY DEFINER
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

-- 2. Fungsi Pembantu: Mengecek apakah suatu unit merupakan bagian dari struktur konsolidasi Holding tertentu
CREATE OR REPLACE FUNCTION is_org_in_consolidation_tree(p_target_org_id UUID, p_parent_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 
        FROM get_consolidated_org_ids(p_parent_org_id) 
        WHERE org_id = p_target_org_id
    );
$$;

-- 3. Fungsi Tampilan: Menghasilkan daftar hierarki organisasi 1 tingkat (Parent -> Child)
-- Contoh output:
-- Root Holding (Parent)
--   |__> Anak A
--   |__> Anak B
CREATE OR REPLACE FUNCTION get_consolidated_org_hierarchy(p_parent_org_id UUID)
RETURNS TABLE (
    org_id UUID,
    parent_org_id UUID,
    org_name TEXT,
    level_depth INTEGER,
    hierarchy_label TEXT
)
LANGUAGE sql
SECURITY DEFINER
AS $$
    WITH parent_and_direct_children AS (
        -- Root/Parent
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

        -- Direct children only (no grandchild traversal)
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
