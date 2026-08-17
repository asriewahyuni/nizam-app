-- =============================================================================
-- 1424_klinik_pratama_user_type.sql
-- Modul Klinik Pratama — tambah 'pasien' sebagai user_type baru untuk portal
-- pasien (app/pasien/*), mengikuti pola 'anggota' (portal Kojasmat).
--
-- PENTING: menambah nilai ini ke constraint SAJA tidak cukup — fungsi
-- normalizeInternalUserType() di lib/auth/internal-auth.server.ts juga wajib
-- dipatch di commit yang sama, karena fungsi itu fallback ke 'staff' untuk
-- user_type yang tidak dikenalinya. Tanpa patch itu, akun pasien yang lewat
-- ensureInternalAuthUserRecord() akan diam-diam berubah jadi 'staff' dan lolos
-- guard dashboard ERP.
-- =============================================================================

ALTER TABLE public.internal_auth_users
  DROP CONSTRAINT IF EXISTS internal_auth_users_user_type_check;

ALTER TABLE public.internal_auth_users
  ADD CONSTRAINT internal_auth_users_user_type_check
  CHECK (user_type IN (
    'owner', 'admin', 'staff', 'member', 'anggota', 'tutor', 'affiliate', 'pasien'
  ));
