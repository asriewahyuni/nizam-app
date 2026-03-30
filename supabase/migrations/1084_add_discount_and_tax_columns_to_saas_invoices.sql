-- Add discount/tax columns used by SaaS Operator quotation form.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'saas_invoices'
          AND column_name = 'discount_percent'
    ) THEN
        ALTER TABLE public.saas_invoices ADD COLUMN discount_percent NUMERIC(5,2) DEFAULT 0;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'saas_invoices'
          AND column_name = 'discount_amount'
    ) THEN
        ALTER TABLE public.saas_invoices ADD COLUMN discount_amount NUMERIC(15,2) DEFAULT 0;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'saas_invoices'
          AND column_name = 'tax_percent'
    ) THEN
        ALTER TABLE public.saas_invoices ADD COLUMN tax_percent NUMERIC(5,2) DEFAULT 0;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'saas_invoices'
          AND column_name = 'tax_amount'
    ) THEN
        ALTER TABLE public.saas_invoices ADD COLUMN tax_amount NUMERIC(15,2) DEFAULT 0;
    END IF;
END $$;

NOTIFY pgrst, 'reload schema';
