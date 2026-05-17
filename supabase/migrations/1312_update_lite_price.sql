-- Update harga paket Lite dari 149.000 menjadi 299.000

UPDATE public.saas_packages
SET price = 299000, updated_at = NOW()
WHERE LOWER(name) = 'lite';

NOTIFY pgrst, 'reload schema';
