-- Migration: 1434_sales_salesperson
-- Description: Add salesperson_id to sales table referencing employees

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS salesperson_id UUID REFERENCES public.employees(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sales_salesperson ON public.sales(salesperson_id);
