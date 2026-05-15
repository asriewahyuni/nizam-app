-- MIGRATION 1306: LMS Session Mode (REVERTED - moved to batch level)
-- Mode pembelajaran dipindahkan ke lms_course_batches, bukan per sesi.

ALTER TABLE public.lms_course_batches
  ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'OFFLINE'
    CONSTRAINT lms_course_batches_mode_check CHECK (mode IN ('ONLINE', 'OFFLINE', 'HYBRID'));

-- Hapus kolom mode dari lms_batch_sessions jika sudah terlanjur ditambahkan
ALTER TABLE public.lms_batch_sessions
  DROP COLUMN IF EXISTS mode;
