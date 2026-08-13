-- Migration: 1420_wacrm_dynamic_stages_subtasks_checklist.sql
-- Description: Convert stage column to TEXT for dynamic stages and add subtasks and checklist columns to wacrm_contacts

-- 1. Convert stage columns to TEXT to allow custom stages
ALTER TABLE public.wacrm_contacts ALTER COLUMN stage DROP DEFAULT;
ALTER TABLE public.wacrm_contacts ALTER COLUMN stage TYPE TEXT USING stage::text;
ALTER TABLE public.wacrm_contacts ALTER COLUMN stage SET DEFAULT 'masuk';

ALTER TABLE public.wacrm_pipeline_history ALTER COLUMN from_stage TYPE TEXT USING from_stage::text;
ALTER TABLE public.wacrm_pipeline_history ALTER COLUMN to_stage TYPE TEXT USING to_stage::text;

-- 2. Add JSONB columns for ClickUp-style subtasks and checklists
ALTER TABLE public.wacrm_contacts ADD COLUMN IF NOT EXISTS subtasks JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.wacrm_contacts ADD COLUMN IF NOT EXISTS checklist JSONB DEFAULT '[]'::jsonb;
