-- ============================================================
-- MIGRATION 1230: Delivery date for Surat Jalan print
-- ============================================================
-- Menyimpan tanggal kirim nyata pada dokumen sales agar
-- Surat Jalan bisa menampilkan tanggal pengiriman yang jelas.
-- ============================================================

ALTER TABLE public.sales
ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

COMMENT ON COLUMN public.sales.delivered_at IS
  'Tanggal dan waktu barang dikirim / delivery diproses.';

UPDATE public.sales
SET delivered_at = COALESCE(
  delivered_at,
  CASE
    WHEN sale_date IS NOT NULL THEN sale_date::timestamp AT TIME ZONE 'Asia/Jakarta'
    ELSE NULL
  END,
  created_at,
  NOW()
)
WHERE status = 'FINISHED'
  AND delivered_at IS NULL;

NOTIFY pgrst, 'reload schema';
