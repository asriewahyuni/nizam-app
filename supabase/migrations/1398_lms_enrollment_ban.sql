-- Migration: 1398_lms_enrollment_ban
-- Description: Tambahkan kolom ban (soft-delete + blokir akses) ke learning_enrollments.
-- Peserta yang di-ban tidak bisa akses kursus tapi history progress tetap tersimpan.

ALTER TABLE public.learning_enrollments
  ADD COLUMN IF NOT EXISTS banned_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS banned_by   UUID,
  ADD COLUMN IF NOT EXISTS banned_reason TEXT;

COMMENT ON COLUMN public.learning_enrollments.banned_at IS
  'Timestamp saat peserta di-ban dari kursus. NULL = aktif. NOT NULL = akses diblokir.';
COMMENT ON COLUMN public.learning_enrollments.banned_by IS
  'User ID admin yang melakukan ban.';
COMMENT ON COLUMN public.learning_enrollments.banned_reason IS
  'Alasan opsional kenapa peserta di-ban.';

-- Index untuk filter peserta aktif vs banned
CREATE INDEX IF NOT EXISTS idx_learning_enrollments_ban
  ON public.learning_enrollments (org_id, course_id, banned_at)
  WHERE banned_at IS NOT NULL;
