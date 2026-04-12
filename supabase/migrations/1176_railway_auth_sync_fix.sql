-- ============================================================
-- MIGRATION 1176: Railway Auth Sync Fix
-- ============================================================
-- Problem: Setelah migrasi dari Supabase ke Railway, banyak bug:
--   1. internal_auth_users tanpa legacy_user_id tidak bisa akses org_members
--   2. User baru yang register via internal auth tidak terhubung ke auth.users
--   3. RLS policies bergantung pada auth.uid() yang tidak berjalan di internal auth mode
--   4. Kolom last_active_at dan last_active_branch_id mungkin hilang di org_members
--   5. Tabel active_context_preferences tidak ada
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. Ensure org_members columns for persisting active context
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.org_members
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_active_branch_id UUID,
  ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES public.roles(id) ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────────
-- 2. Ensure auth.users entry for every internal_auth_users
--    (bridge for FK constraints yang masih reference auth.users)
-- ─────────────────────────────────────────────────────────────
-- Sync: pastikan setiap user di internal_auth_users punya entry di auth.users
-- dengan ID yang sama sebagai legacy_user_id
INSERT INTO auth.users (id, email, aud, role, created_at, updated_at)
SELECT
  iau.legacy_user_id,
  iau.login_email,
  'authenticated',
  'authenticated',
  iau.created_at,
  iau.updated_at
FROM public.internal_auth_users iau
WHERE
  iau.legacy_user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM auth.users au WHERE au.id = iau.legacy_user_id
  )
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 3. Backfill legacy_user_id untuk internal_auth_users yang belum terpetakan
--    Cari di auth.users berdasarkan email cocok
-- ─────────────────────────────────────────────────────────────
UPDATE public.internal_auth_users iau
SET legacy_user_id = au.id
FROM auth.users au
WHERE
  iau.legacy_user_id IS NULL
  AND iau.login_email IS NOT NULL
  AND lower(iau.login_email) = lower(au.email)
  AND au.email NOT LIKE '%@users.nizam.local';

-- ─────────────────────────────────────────────────────────────
-- 4. Untuk internal_auth_users tanpa legacy_user_id dan tanpa match email,
--    buat auth.users entry baru dengan ID = internal_auth_users.id
-- ─────────────────────────────────────────────────────────────
INSERT INTO auth.users (id, email, aud, role, created_at, updated_at)
SELECT
  iau.id,
  iau.login_email,
  'authenticated',
  'authenticated',
  iau.created_at,
  iau.updated_at
FROM public.internal_auth_users iau
WHERE
  iau.legacy_user_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM auth.users au WHERE au.id = iau.id
  )
ON CONFLICT (id) DO NOTHING;

-- Set legacy_user_id = id untuk user yang tidak punya legacy match
UPDATE public.internal_auth_users iau
SET legacy_user_id = iau.id
WHERE
  iau.legacy_user_id IS NULL
  AND EXISTS (
    SELECT 1 FROM auth.users au WHERE au.id = iau.id
  );

-- ─────────────────────────────────────────────────────────────
-- 5. Backfill org_members untuk internal_auth_users yang punya
--    legacy_user_id tapi org_members menggunakan id internal
-- ─────────────────────────────────────────────────────────────
-- Jika ada org_member dengan user_id = internal_auth_users.id (bukan legacy_user_id),
-- update agar menggunakan legacy_user_id
UPDATE public.org_members om
SET user_id = iau.legacy_user_id
FROM public.internal_auth_users iau
WHERE
  om.user_id = iau.id
  AND iau.legacy_user_id IS NOT NULL
  AND iau.legacy_user_id != iau.id
  AND NOT EXISTS (
    SELECT 1 FROM public.org_members om2
    WHERE om2.user_id = iau.legacy_user_id AND om2.org_id = om.org_id
  );

-- ─────────────────────────────────────────────────────────────
-- 6. Function helper: resolve_internal_auth_user_id
--    Untuk query yang butuh cari user_id yang benar di org_members
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.resolve_internal_auth_legacy_user_id(p_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_legacy_id UUID;
BEGIN
  -- Cari legacy_user_id dari internal_auth_users
  SELECT coalesce(iau.legacy_user_id, iau.id)
  INTO v_legacy_id
  FROM public.internal_auth_users iau
  WHERE iau.id = p_user_id OR iau.legacy_user_id = p_user_id
  ORDER BY
    CASE WHEN iau.legacy_user_id IS NOT NULL THEN 0 ELSE 1 END
  LIMIT 1;

  RETURN COALESCE(v_legacy_id, p_user_id);
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 7. Index untuk performa resolusi user_id
-- ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_internal_auth_users_id
  ON public.internal_auth_users (id);

CREATE INDEX IF NOT EXISTS idx_org_members_user_id_active
  ON public.org_members (user_id, is_active)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_org_members_last_active
  ON public.org_members (user_id, last_active_at DESC NULLS LAST)
  WHERE is_active = true;

-- ─────────────────────────────────────────────────────────────
-- 8. Verify: report users yang masih tidak terhubung ke org_members
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE
  unlinked_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO unlinked_count
  FROM public.internal_auth_users iau
  WHERE NOT EXISTS (
    SELECT 1 FROM public.org_members om
    WHERE om.user_id = coalesce(iau.legacy_user_id, iau.id)
      AND om.is_active = true
  );

  IF unlinked_count > 0 THEN
    RAISE NOTICE 'WARNING: % internal_auth_users tidak terhubung ke org_members aktif.', unlinked_count;
  ELSE
    RAISE NOTICE 'OK: Semua internal_auth_users terhubung ke org_members.';
  END IF;
END;
$$;
