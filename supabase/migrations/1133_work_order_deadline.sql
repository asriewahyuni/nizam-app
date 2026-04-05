-- Add deadline_date to production_work_orders
ALTER TABLE public.production_work_orders 
ADD COLUMN IF NOT EXISTS deadline_date DATE;

-- Create an index to quickly find urgent SPKs
CREATE INDEX IF NOT EXISTS idx_wo_deadline ON public.production_work_orders(org_id, deadline_date, status);
