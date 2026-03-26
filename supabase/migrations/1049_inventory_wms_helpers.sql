-- Migration 1049: Inventory WMS Helpers
-- Provides unified RPC for stock adjustments across modules

CREATE OR REPLACE FUNCTION adjust_inventory_stock(
    p_org_id UUID,
    p_product_id UUID,
    p_warehouse_id UUID,
    p_diff NUMERIC,
    p_batch_number TEXT DEFAULT NULL,
    p_bin_id UUID DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.inventory_stocks (
        org_id, product_id, warehouse_id, quantity, batch_number, bin_id
    ) VALUES (
        p_org_id, p_product_id, p_warehouse_id, p_diff, p_batch_number, p_bin_id
    )
    ON CONFLICT (product_id, warehouse_id, COALESCE(batch_number, ''), COALESCE(bin_id, '00000000-0000-0000-0000-000000000000')) DO UPDATE
    SET quantity = inventory_stocks.quantity + EXCLUDED.quantity,
        updated_at = NOW();
END;
$$;

-- Standardize Inventory Stock Unique Constraint to support Bin & Batch NULLs
ALTER TABLE public.inventory_stocks DROP CONSTRAINT IF EXISTS inventory_stocks_product_id_warehouse_id_batch_number_key;
DROP INDEX IF EXISTS idx_inv_stocks_unique_wms;

CREATE UNIQUE INDEX idx_inv_stocks_unique_wms ON public.inventory_stocks (
    product_id, 
    warehouse_id, 
    COALESCE(batch_number, ''), 
    COALESCE(bin_id, '00000000-0000-0000-0000-000000000000')
);
