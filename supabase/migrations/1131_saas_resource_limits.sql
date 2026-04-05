-- ============================================================
-- Migration 1131: SaaS Resource Limits
-- Tambah kolom limit resource ke saas_packages:
--   max_branches   = max cabang per organisasi
--   max_child_orgs = max anak perusahaan per holding
--   max_users      = max pengguna (anggota) per organisasi
--
-- NULL = unlimited (untuk paket Enterprise dan custom)
-- ============================================================

ALTER TABLE public.saas_packages
  ADD COLUMN IF NOT EXISTS max_branches    INTEGER DEFAULT 1;
ALTER TABLE public.saas_packages
  ADD COLUMN IF NOT EXISTS max_child_orgs  INTEGER DEFAULT 1;
ALTER TABLE public.saas_packages
  ADD COLUMN IF NOT EXISTS max_users       INTEGER DEFAULT 5;

COMMENT ON COLUMN public.saas_packages.max_branches    IS 'Maksimum cabang yang boleh dibuat per org. NULL = unlimited.';
COMMENT ON COLUMN public.saas_packages.max_child_orgs  IS 'Maksimum anak perusahaan yang boleh ditambahkan per holding. NULL = unlimited.';
COMMENT ON COLUMN public.saas_packages.max_users       IS 'Maksimum pengguna aktif per org. NULL = unlimited.';

-- ── Default values per paket ──────────────────────────────────
-- Trial
UPDATE public.saas_packages
SET max_branches = 1, max_child_orgs = 0, max_users = 3
WHERE name IN ('Trial', 'Demo', 'Demo/Latihan');

-- Starter / Basic
UPDATE public.saas_packages
SET max_branches = 3, max_child_orgs = 1, max_users = 10
WHERE name IN ('Starter', 'Basic', 'Paket Dasar');

-- Professional / Pro / Business
UPDATE public.saas_packages
SET max_branches = 10, max_child_orgs = 3, max_users = 30
WHERE name IN ('Professional', 'Pro', 'Business', 'Paket Bisnis');

-- Enterprise → unlimited (NULL)
UPDATE public.saas_packages
SET max_branches = NULL, max_child_orgs = NULL, max_users = NULL
WHERE name IN ('Enterprise', 'Enterprise Plus');

-- Paket yang tidak cocok dengan aturan di atas → default wajar
UPDATE public.saas_packages
SET
  max_branches    = COALESCE(max_branches,    3),
  max_child_orgs  = COALESCE(max_child_orgs,  1),
  max_users       = COALESCE(max_users,        10)
WHERE max_branches IS NULL
   OR max_child_orgs IS NULL
   OR max_users IS NULL;

NOTIFY pgrst, 'reload schema';
