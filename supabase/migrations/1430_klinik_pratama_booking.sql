-- =============================================================================
-- 1430_klinik_pratama_booking.sql
-- Modul Klinik Pratama — Fase 2b (Booking Online): reservasi slot publik di
-- atas fondasi jadwal yang sama dengan walk-in (klinik_jadwal_praktik +
-- klinik_jadwal_pengecualian, Fase 1). Mirror consulting_slot_holds
-- (supabase/migrations/1390_consulting_360.sql) — EXCLUDE USING gist mencegah
-- dokter yang sama dipesan dua kali untuk rentang waktu yang tumpang tindih,
-- ditegakkan di level database (bukan cuma validasi aplikasi yang bisa race).
--
-- Booking publik TIDAK memerlukan login/akun pasien (guest booking, mirip
-- booking appointment dokter pada umumnya) — pasien baru ditautkan/dibuat
-- sebagai klinik_pasien saat check-in di loket pada hari-H, sama seperti
-- alur walk-in.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE IF NOT EXISTS public.klinik_slot_hold (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  poli_id UUID NOT NULL REFERENCES public.klinik_poli(id) ON DELETE CASCADE,
  staf_medis_id UUID NOT NULL REFERENCES public.klinik_staf_medis(id) ON DELETE CASCADE,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'CONFIRMED' CHECK (status IN ('HELD', 'CONFIRMED', 'CANCELLED', 'EXPIRED', 'CHECKED_IN')),
  held_until TIMESTAMPTZ,
  token_hash TEXT,
  pasien_nama TEXT NOT NULL,
  pasien_kontak TEXT NOT NULL,
  keluhan TEXT,
  kunjungan_id UUID REFERENCES public.klinik_kunjungan(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_at > starts_at)
);

ALTER TABLE public.klinik_slot_hold
  ADD CONSTRAINT klinik_slot_hold_no_overlap
  EXCLUDE USING gist (
    staf_medis_id WITH =,
    tstzrange(starts_at, ends_at) WITH &&
  ) WHERE (status IN ('HELD', 'CONFIRMED'));

CREATE INDEX IF NOT EXISTS idx_klinik_slot_hold_branch_date ON public.klinik_slot_hold (branch_id, poli_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_klinik_slot_hold_staf_date ON public.klinik_slot_hold (staf_medis_id, starts_at);
