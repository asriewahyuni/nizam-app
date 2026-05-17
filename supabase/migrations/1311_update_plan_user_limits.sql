-- Update batas user, anak perusahaan, dan cabang
-- sesuai struktur plan baru: Lite / Mini / Enterprise

UPDATE public.saas_packages
SET max_users = 3, max_child_orgs = 0, max_branches = 1, updated_at = NOW()
WHERE LOWER(name) = 'lite';

UPDATE public.saas_packages
SET max_users = 15, max_child_orgs = 1, max_branches = 3, updated_at = NOW()
WHERE LOWER(name) = 'mini';

UPDATE public.saas_packages
SET max_users = 30, max_child_orgs = 5, max_branches = 10, updated_at = NOW()
WHERE LOWER(name) = 'enterprise';

NOTIFY pgrst, 'reload schema';
