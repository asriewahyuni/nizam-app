-- Migration 1033: Fix Barcode Uniqueness
-- Removes the strict uniqueness constraint on the barcode column to allow multiple products with empty barcodes.
-- This is useful when organizations don't use barcodes and barcodes are set as '' (empty string).

DO $$ 
BEGIN
    -- For Products
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_barcode_key') THEN
        ALTER TABLE public.products DROP CONSTRAINT products_barcode_key;
    END IF;

    -- For Warehouse Bins
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'warehouse_bins_barcode_key') THEN
        ALTER TABLE public.warehouse_bins DROP CONSTRAINT warehouse_bins_barcode_key;
    END IF;
END $$;

-- Keep the index for fast lookups (optional/non-unique)
-- Migration 1028 already created it, but we'll ensure it exists
CREATE INDEX IF NOT EXISTS idx_products_barcode_fast ON public.products(barcode) WHERE barcode IS NOT NULL AND barcode != '';
CREATE INDEX IF NOT EXISTS idx_bins_barcode_fast ON public.warehouse_bins(barcode) WHERE barcode IS NOT NULL AND barcode != '';
