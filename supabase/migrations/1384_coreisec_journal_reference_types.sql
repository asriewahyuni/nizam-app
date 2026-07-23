-- Nilai enum harus dikomit pada migrasi tersendiri sebelum dipakai oleh
-- constraint atau indeks di migrasi berikutnya.
ALTER TYPE public.journal_reference_type ADD VALUE IF NOT EXISTS 'COMMERCE_PAYMENT';
ALTER TYPE public.journal_reference_type ADD VALUE IF NOT EXISTS 'COMMERCE_REFUND';
ALTER TYPE public.journal_reference_type ADD VALUE IF NOT EXISTS 'AFFILIATE_COMMISSION';
ALTER TYPE public.journal_reference_type ADD VALUE IF NOT EXISTS 'COMMERCE_FULFILLMENT';
