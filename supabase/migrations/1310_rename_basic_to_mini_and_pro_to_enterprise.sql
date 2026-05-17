-- Rename paket "Basic" → "Mini" dan "Pro" → "Enterprise"
-- untuk menyelaraskan nama paket dengan branding produk terbaru.

UPDATE public.saas_packages
SET name = 'Mini', updated_at = NOW()
WHERE name = 'Basic';

UPDATE public.saas_packages
SET name = 'Enterprise', updated_at = NOW()
WHERE name = 'Pro';

NOTIFY pgrst, 'reload schema';
