-- Migration: 1397_lms_course_archived_at
-- Description: Tambahkan kolom archived_at ke learning_courses untuk mendukung fitur archive/unarchive kursus.
-- Kursus yang diarsipkan (archived_at IS NOT NULL) tidak akan muncul di katalog publik maupun list default admin.

ALTER TABLE public.learning_courses
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

COMMENT ON COLUMN public.learning_courses.archived_at IS
  'Timestamp saat kursus diarsipkan. Kursus yang diarsipkan tidak muncul di katalog LMS publik maupun daftar admin default.';

-- Index untuk mempercepat filter is_active + archived_at pada query katalog
CREATE INDEX IF NOT EXISTS idx_learning_courses_catalog_filter
  ON public.learning_courses (org_id, is_active, archived_at)
  WHERE deleted_at IS NULL;
