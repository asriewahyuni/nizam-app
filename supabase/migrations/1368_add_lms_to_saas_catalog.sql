-- MIGRATION 1368: Add LMS to SaaS Catalog
-- Menambahkan modul LMS ke dalam daftar Addons agar muncul di Marketplace

UPDATE public.saas_packages
SET addons = (
  SELECT jsonb_agg(DISTINCT elem)
  FROM jsonb_array_elements(
    CASE 
      WHEN addons IS NULL OR jsonb_typeof(addons) != 'array' THEN '[]'::jsonb 
      ELSE addons 
    END || '["LMS"]'::jsonb
  ) AS elem
);

NOTIFY pgrst, 'reload schema';
