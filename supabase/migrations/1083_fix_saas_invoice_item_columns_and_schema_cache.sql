-- Ensure saas_invoices has item metadata columns used by SaaS Operator module.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'saas_invoices'
          AND column_name = 'item_name'
    ) THEN
        ALTER TABLE public.saas_invoices ADD COLUMN item_name TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'saas_invoices'
          AND column_name = 'item_description'
    ) THEN
        ALTER TABLE public.saas_invoices ADD COLUMN item_description TEXT;
    END IF;
END $$;

-- Refresh PostgREST schema cache to avoid stale "column not found" errors.
NOTIFY pgrst, 'reload schema';
