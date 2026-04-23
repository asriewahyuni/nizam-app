-- Menyimpan rincian pajak dan biaya tambahan header penjualan.
ALTER TABLE public.sales
ADD COLUMN IF NOT EXISTS tax_breakdown JSONB;

ALTER TABLE public.sales
ADD COLUMN IF NOT EXISTS other_charge_breakdown JSONB;

ALTER TABLE public.sales
ADD COLUMN IF NOT EXISTS other_charge_amount NUMERIC(20, 2) DEFAULT 0;

UPDATE public.sales
SET tax_breakdown = jsonb_build_object(
  'PPN', jsonb_build_object(
    'mode',
    CASE
      WHEN GREATEST(COALESCE(total_amount, 0) - COALESCE(discount_amount, 0), 0) > 0
        AND COALESCE(tax_amount, 0) > 0
        THEN 'PERCENT'
      ELSE 'FIXED'
    END,
    'value',
    CASE
      WHEN GREATEST(COALESCE(total_amount, 0) - COALESCE(discount_amount, 0), 0) > 0
        AND COALESCE(tax_amount, 0) > 0
        THEN ROUND((COALESCE(tax_amount, 0) / GREATEST(COALESCE(total_amount, 0) - COALESCE(discount_amount, 0), 0)) * 100, 2)
      ELSE COALESCE(tax_amount, 0)
    END,
    'percent',
    CASE
      WHEN GREATEST(COALESCE(total_amount, 0) - COALESCE(discount_amount, 0), 0) > 0
        AND COALESCE(tax_amount, 0) > 0
        THEN ROUND((COALESCE(tax_amount, 0) / GREATEST(COALESCE(total_amount, 0) - COALESCE(discount_amount, 0), 0)) * 100, 2)
      ELSE 0
    END,
    'amount', COALESCE(tax_amount, 0)
  ),
  'PPH_21', jsonb_build_object('percent', 0, 'amount', 0),
  'PPH_23', jsonb_build_object('percent', 0, 'amount', 0),
  'PAJAK_DAERAH', jsonb_build_object('percent', 0, 'amount', 0)
)
WHERE tax_breakdown IS NULL;

UPDATE public.sales
SET other_charge_breakdown = '[]'::jsonb
WHERE other_charge_breakdown IS NULL;

UPDATE public.sales
SET other_charge_amount = 0
WHERE other_charge_amount IS NULL;

ALTER TABLE public.sales
ALTER COLUMN tax_breakdown SET DEFAULT jsonb_build_object(
  'PPN', jsonb_build_object('mode', 'PERCENT', 'value', 0, 'percent', 0, 'amount', 0),
  'PPH_21', jsonb_build_object('mode', 'PERCENT', 'value', 0, 'percent', 0, 'amount', 0),
  'PPH_23', jsonb_build_object('mode', 'PERCENT', 'value', 0, 'percent', 0, 'amount', 0),
  'PAJAK_DAERAH', jsonb_build_object('mode', 'PERCENT', 'value', 0, 'percent', 0, 'amount', 0)
);

ALTER TABLE public.sales
ALTER COLUMN tax_breakdown SET NOT NULL;

ALTER TABLE public.sales
ALTER COLUMN other_charge_breakdown SET DEFAULT '[]'::jsonb;

ALTER TABLE public.sales
ALTER COLUMN other_charge_breakdown SET NOT NULL;

ALTER TABLE public.sales
ALTER COLUMN other_charge_amount SET DEFAULT 0;

ALTER TABLE public.sales
ALTER COLUMN other_charge_amount SET NOT NULL;

COMMENT ON COLUMN public.sales.tax_breakdown IS 'Rincian pajak header penjualan per jenis pajak, mendukung mode persen atau nominal.';
COMMENT ON COLUMN public.sales.other_charge_breakdown IS 'Rincian biaya tambahan header penjualan seperti ongkir, admin, packing, dan biaya lain.';
COMMENT ON COLUMN public.sales.other_charge_amount IS 'Total biaya tambahan header penjualan di luar pajak.';
