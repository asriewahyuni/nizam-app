-- Syirkah gratis untuk semua paket (Lite, Mini, Enterprise)

UPDATE public.saas_packages
SET modules = modules || '["Syirkah"]'::jsonb, updated_at = NOW()
WHERE LOWER(name) = ANY(ARRAY['lite', 'mini', 'enterprise'])
  AND NOT (modules @> '["Syirkah"]'::jsonb);

NOTIFY pgrst, 'reload schema';
