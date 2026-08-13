-- Migration: 1420_lms_course_show_in_catalog
-- Description: Tambahkan kolom show_in_catalog ke learning_courses, terpisah dari is_active.
-- is_active tetap mengontrol status aktif/draft course (dan akses konten member).
-- show_in_catalog hanya mengontrol kemunculan course di katalog publik, sehingga course
-- yang programnya sudah tutup bisa disembunyikan dari katalog tanpa mencabut akses
-- member yang sudah pernah enroll.

ALTER TABLE public.learning_courses
  ADD COLUMN IF NOT EXISTS show_in_catalog BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.learning_courses.show_in_catalog IS
  'Kontrol visibilitas course di katalog publik, independen dari is_active. FALSE = course tetap aktif dan bisa diakses member yang sudah enroll, tapi tidak muncul di katalog untuk pendaftar baru.';

CREATE INDEX IF NOT EXISTS idx_learning_courses_catalog_visibility
  ON public.learning_courses (org_id, show_in_catalog)
  WHERE deleted_at IS NULL;
