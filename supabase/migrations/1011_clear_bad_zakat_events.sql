-- ============================================================
-- MIGRATION 1011: Perbaikan Data Ganda Zakat & Struktur Event
-- ============================================================

-- 1. Hapus batasan agar bisa merekam pergerakan real-time berulang kali di hari yang sama
ALTER TABLE public.zakat_haul_events 
DROP CONSTRAINT IF EXISTS zakat_haul_events_haul_id_event_date_key;

-- 2. Hapus data histori zakat hari ini yang direkam dengan "rumus salah" (3.3 Miliar)
-- Sistem akan otomatis merender & merekam ulang saldo 2.4 Miliar detik ini juga begitu halaman Zakat dimuat ulang.
DELETE FROM public.zakat_haul_events;
