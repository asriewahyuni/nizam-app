-- ============================================================
-- MIGRATION 1242: Add Syirkah Profit Sharing Allocation Amount
-- ============================================================
-- Tujuan:
-- 1. Menyimpan nominal laba yang benar-benar dialokasikan untuk dibagi
--    ke para syarik per akad.
-- 2. Menjadikan dashboard/detail syirkah tidak harus memakai 100% laba
--    bersih organisasi sebagai dasar pembagian.

ALTER TABLE public.syirkah_contracts
ADD COLUMN IF NOT EXISTS profit_sharing_allocation NUMERIC(15, 2) DEFAULT 0;

UPDATE public.syirkah_contracts
SET profit_sharing_allocation = 0
WHERE profit_sharing_allocation IS NULL;
