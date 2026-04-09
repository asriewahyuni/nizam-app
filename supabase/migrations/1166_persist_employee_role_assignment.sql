-- ============================================================
-- MIGRATION 1166: Persist Employee Role Assignment
-- ============================================================
-- Why:
-- Form HRIS saat ini menyimpan pilihan "role/jabatan" ke employees.job_title.
-- Sementara hak akses sistem membaca org_members.role_id.
--
-- Dampaknya:
-- 1. Role pilihan di master karyawan tidak punya referensi stabil ke tabel roles.
-- 2. Saat jabatan diubah, user yang sudah terhubung belum tentu ikut berubah role aksesnya.
-- 3. Aktivasi akun baru masih bergantung pada pencocokan nama job_title -> roles.name.
--
-- This migration:
-- 1. Menambahkan employees.role_id sebagai sumber kebenaran role pilihan HRIS.
-- 2. Backfill dari org_members.role_id untuk user yang sudah aktif.
-- 3. Fallback backfill dari pencocokan nama jabatan ke role organisasi.

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES public.roles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_employees_role_id
  ON public.employees(role_id);

UPDATE public.employees e
SET role_id = om.role_id
FROM public.org_members om
WHERE e.user_id IS NOT NULL
  AND om.org_id = e.org_id
  AND om.user_id = e.user_id
  AND om.is_active = TRUE
  AND om.role_id IS NOT NULL
  AND e.role_id IS DISTINCT FROM om.role_id;

UPDATE public.employees e
SET role_id = (
  SELECT r.id
  FROM public.roles r
  WHERE r.org_id = e.org_id
    AND LOWER(BTRIM(r.name)) = LOWER(BTRIM(COALESCE(e.job_title, '')))
  ORDER BY r.created_at ASC, r.id ASC
  LIMIT 1
)
WHERE e.role_id IS NULL;

NOTIFY pgrst, 'reload schema';
