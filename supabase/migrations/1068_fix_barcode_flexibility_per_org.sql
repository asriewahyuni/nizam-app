-- Migration 1068: Fix Barcode Flexibility Per-Organization
-- The previous global uniqueness on barcode caused registration failures 
-- when multiple organizations left barcodes empty or used common strings.

DO $$ 
BEGIN
    -- 1. Drop the strict global uniqueness on Products
    DROP INDEX IF EXISTS public.idx_products_barcode;
    ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_barcode_key;
    
    -- 2. Drop the strict global uniqueness on Warehouse Bins
    DROP INDEX IF EXISTS public.idx_bins_barcode;
    ALTER TABLE public.warehouse_bins DROP CONSTRAINT IF EXISTS warehouse_bins_barcode_key;

    -- 3. Create per-organization unique index (allows multiple empty strings across orgs)
    -- We use a partial index to allow multiple empty or null values within the SAME org
    -- but unique barcode if it's actually provided.
    CREATE UNIQUE INDEX IF NOT EXISTS idx_products_barcode_unique_per_org 
    ON public.products(org_id, barcode) 
    WHERE barcode IS NOT NULL AND barcode != '';

    CREATE UNIQUE INDEX IF NOT EXISTS idx_bins_barcode_unique_per_org 
    ON public.warehouse_bins(org_id, barcode) 
    WHERE barcode IS NOT NULL AND barcode != '';

    -- 4. Cleanup any existing index name variations from previous attempts
    DROP INDEX IF EXISTS public.products_barcode_key;
    DROP INDEX IF EXISTS public.warehouse_bins_barcode_key;
END $$;

COMMENT ON INDEX idx_products_barcode_unique_per_org IS 'Ensures barcode is unique only within an organization, ignoring empty/null values.';
