-- ========================================================
-- Add approval signature metadata for SaaS quotation approval
-- ========================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'saas_invoices'
      AND column_name = 'approved_at'
  ) THEN
    ALTER TABLE public.saas_invoices ADD COLUMN approved_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'saas_invoices'
      AND column_name = 'approved_by_user_id'
  ) THEN
    ALTER TABLE public.saas_invoices ADD COLUMN approved_by_user_id UUID REFERENCES auth.users(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'saas_invoices'
      AND column_name = 'approved_by_name'
  ) THEN
    ALTER TABLE public.saas_invoices ADD COLUMN approved_by_name TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'saas_invoices'
      AND column_name = 'approved_by_title'
  ) THEN
    ALTER TABLE public.saas_invoices ADD COLUMN approved_by_title TEXT;
  END IF;
END $$;

COMMENT ON COLUMN public.saas_invoices.approved_at IS 'Timestamp approval penawaran SaaS menjadi penjualan.';
COMMENT ON COLUMN public.saas_invoices.approved_by_user_id IS 'User ID pejabat yang menyetujui penawaran SaaS.';
COMMENT ON COLUMN public.saas_invoices.approved_by_name IS 'Nama pejabat penandatangan approval.';
COMMENT ON COLUMN public.saas_invoices.approved_by_title IS 'Jabatan pejabat penandatangan approval.';

NOTIFY pgrst, 'reload schema';
