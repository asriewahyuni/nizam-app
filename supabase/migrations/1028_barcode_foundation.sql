-- ============================================================
-- MIGRATION 1028: BARCODE SYSTEM FOUNDATION
-- Adding Barcode Support for Products and Bins
-- ============================================================

-- Add barcode to products
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS barcode TEXT UNIQUE;

-- Add barcode to bins
ALTER TABLE public.warehouse_bins
ADD COLUMN IF NOT EXISTS barcode TEXT UNIQUE;

-- Create an index for ultra-fast barcode lookups during scanning
CREATE INDEX IF NOT EXISTS idx_products_barcode ON public.products(barcode);
CREATE INDEX IF NOT EXISTS idx_bins_barcode ON public.warehouse_bins(barcode);
