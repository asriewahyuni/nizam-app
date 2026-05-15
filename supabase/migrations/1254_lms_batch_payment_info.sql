-- Migration: 1254_lms_batch_payment_info.sql
-- Menambahkan kolom informasi pembayaran pada batch LMS.

ALTER TABLE public.lms_course_batches
  ADD COLUMN IF NOT EXISTS payment_instructions TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT;

NOTIFY pgrst, 'reload schema';
