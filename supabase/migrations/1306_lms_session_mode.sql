-- MIGRATION 1306: LMS Session Mode
-- Menambahkan kolom mode pada lms_batch_sessions untuk membedakan Online, Offline, dan Hybrid.

ALTER TABLE public.lms_batch_sessions
  ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'OFFLINE'
    CONSTRAINT lms_batch_sessions_mode_check CHECK (mode IN ('ONLINE', 'OFFLINE', 'HYBRID'));
