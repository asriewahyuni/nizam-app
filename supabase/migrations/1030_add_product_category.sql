-- Migration 1030: Add product_category to products table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'category') THEN
        ALTER TABLE public.products ADD COLUMN category TEXT DEFAULT 'Bahan';
    END IF;
END $$;

COMMENT ON COLUMN public.products.category IS 'Kategori internal: Bahan, Setengah Jadi, Barang Jadi';
