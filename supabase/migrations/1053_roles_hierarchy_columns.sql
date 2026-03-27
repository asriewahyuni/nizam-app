-- ============================================================
-- MIGRATION 1051: Add missing columns to roles table
-- Supports: hierarchy (parent_id), ordering (priority),
-- and multi-department assignment (department_ids)
-- ============================================================

-- 1. Add priority for ordering
ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 999;

-- 2. Add parent_id for hierarchical roles
ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.roles(id) ON DELETE SET NULL;

-- 3. Add department_ids as text array (replaces the single department_id enum)
--    Stores values like: ['FINANCE', 'HRIS', 'OPERASIONAL']
ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS department_ids TEXT[] DEFAULT '{}';

-- 4. Set default priorities for existing roles
UPDATE public.roles SET priority = 0 WHERE name = 'Owner' OR (is_system = TRUE AND name = 'Manager');
UPDATE public.roles SET priority = 1 WHERE is_system = TRUE AND name = 'Staff';
UPDATE public.roles SET priority = 2 WHERE is_system = TRUE AND name = 'Viewer';

-- 5. Create index for ordering
CREATE INDEX IF NOT EXISTS idx_roles_priority ON public.roles(org_id, priority);
CREATE INDEX IF NOT EXISTS idx_roles_parent ON public.roles(parent_id);
