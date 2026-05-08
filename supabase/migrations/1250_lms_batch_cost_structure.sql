-- Migration: 1250_lms_batch_cost_structure.sql
-- Description: Add fee_structure and cost_structure to lms_course_batches

ALTER TABLE public.lms_course_batches 
ADD COLUMN fee_structure JSONB DEFAULT '[]'::jsonb, -- Breakdown harga jual ke peserta
ADD COLUMN cost_structure JSONB DEFAULT '[]'::jsonb; -- Breakdown estimasi biaya operasional batch

NOTIFY pgrst, 'reload schema';
