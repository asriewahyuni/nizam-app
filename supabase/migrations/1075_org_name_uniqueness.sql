-- ============================================================
-- MIGRATION 1075: Organization Name Uniqueness
-- Ensuring that no two entities can share the same name (case-insensitive).
-- ============================================================

-- 1. Create a case-insensitive unique index on the name column
-- This prevents "PT Nizam" and "pt nizam" from co-existing.
-- Note: slug is already UNIQUE, but name provides a second layer of defense.

CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_name_unique_ci 
ON public.organizations (LOWER(TRIM(name)));

-- 2. Optional: Standardize existing names (if any) or just leave it for new ones.
-- The index will fail to create if duplicates already exist.
-- If it fails, manual cleanup is required.
