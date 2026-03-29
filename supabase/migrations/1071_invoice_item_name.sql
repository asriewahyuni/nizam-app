-- 1. Add item_name and description to saas_invoices
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='saas_invoices' AND column_name='item_name') THEN
        ALTER TABLE saas_invoices ADD COLUMN item_name TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='saas_invoices' AND column_name='item_description') THEN
        ALTER TABLE saas_invoices ADD COLUMN item_description TEXT;
    END IF;
END $$;

-- 2. Update existing invoices if any (best effort)
UPDATE saas_invoices s
SET item_name = p.name
FROM saas_packages p
WHERE s.package_id = p.id AND s.item_name IS NULL;
