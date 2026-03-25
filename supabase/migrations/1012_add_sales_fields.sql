-- ============================================================
-- MIGRATION 1012: Tambah Kolom Sales & Refresh Schema Cache
-- ============================================================

-- Tambahkan kolom yang dibutuhkan untuk fitur cicilan / pembayaran di muka
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS payment_term TEXT DEFAULT 'TEMPO';
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS shariah_mode TEXT DEFAULT 'CASH';

-- Paksa Supabase API (PostgREST) untuk memuat ulang skema 
-- Ini WAJIB dipanggil setiap kali ada penambahan kolom agar Supabase Client tidak error "column not found in schema cache"
NOTIFY pgrst, 'reload schema';
