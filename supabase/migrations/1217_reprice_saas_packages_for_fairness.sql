-- Reprice paket SaaS agar ladder harga lebih proporsional, mudah dijual,
-- dan konsisten dengan kalkulasi quotation bulanan di operator sales.

UPDATE public.saas_packages
SET price = 0, billing = 'Sekali', updated_at = NOW()
WHERE name = 'Demo';

UPDATE public.saas_packages
SET price = 49000, billing = 'Sekali', updated_at = NOW()
WHERE name = 'Trial';

UPDATE public.saas_packages
SET price = 149000, billing = 'Bulan', updated_at = NOW()
WHERE name = 'Lite';

UPDATE public.saas_packages
SET price = 299000, billing = 'Bulan', updated_at = NOW()
WHERE name = 'Basic';

UPDATE public.saas_packages
SET price = 599000, billing = 'Bulan', updated_at = NOW()
WHERE name = 'Pro';

UPDATE public.saas_packages
SET price = 1299000, billing = 'Bulan', updated_at = NOW()
WHERE name = 'Enterprise';

UPDATE public.saas_packages
SET price = 399000, billing = 'Bulan', updated_at = NOW()
WHERE name = 'ABS Special';
