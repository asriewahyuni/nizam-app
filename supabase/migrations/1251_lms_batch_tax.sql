-- Migration: 1251_lms_batch_tax.sql
-- Description: Add tax options to lms_course_batches

ALTER TABLE public.lms_course_batches 
ADD COLUMN tax_rate NUMERIC DEFAULT 0, -- Persentase pajak, e.g. 11 for PPN 11%
ADD COLUMN is_tax_included BOOLEAN DEFAULT false; -- Apakah harga total sudah termasuk pajak

NOTIFY pgrst, 'reload schema';
