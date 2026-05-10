-- Migration: 1254_operational_bridge_columns.sql
-- Description: Tambah kolom reference_type/reference_id di sales & purchases,
--              dan sale_id di workshop_work_orders untuk menghubungkan
--              dokumen operasional ke transaksi inti.

ALTER TABLE public.workshop_work_orders
  ADD COLUMN IF NOT EXISTS sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL;

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS reference_type TEXT,
  ADD COLUMN IF NOT EXISTS reference_id UUID;

ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS reference_type TEXT,
  ADD COLUMN IF NOT EXISTS reference_id UUID;

CREATE INDEX IF NOT EXISTS idx_sales_reference     ON public.sales(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_purchases_reference ON public.purchases(reference_type, reference_id);

NOTIFY pgrst, 'reload schema';
