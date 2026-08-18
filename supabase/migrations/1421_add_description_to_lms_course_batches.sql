-- Migration: 1421_add_description_to_lms_course_batches
-- Description: Tambahkan kolom description di table lms_course_batches

ALTER TABLE public.lms_course_batches
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS payment_instructions TEXT;

COMMENT ON COLUMN public.lms_course_batches.description IS 'Deskripsi atau catatan detail mengenai batch course.';
COMMENT ON COLUMN public.lms_course_batches.payment_instructions IS 'Instruksi/panduan cara melakukan pembayaran untuk batch course ini.';
