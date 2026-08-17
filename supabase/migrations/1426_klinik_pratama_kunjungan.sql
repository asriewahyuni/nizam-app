-- =============================================================================
-- 1426_klinik_pratama_kunjungan.sql
-- Modul Klinik Pratama — Fase 2a (Pendaftaran Walk-in & Antrian): kunjungan
-- pasien. Penomoran antrian di-generate di layer aplikasi (MAX+1 dengan retry
-- saat bentrok unique constraint — pola sama seperti penomoran jurnal di
-- modules/accounting/actions/journal.actions.ts, dibuat karena
-- SELECT COUNT(*)+1 pernah menyebabkan tabrakan nomor di kondisi concurrent,
-- lihat supabase/migrations/1366_fix_journal_entry_number_collision.sql).
--
-- `sumber` membedakan asal kunjungan (WALK_IN vs BOOKING) supaya fondasi
-- jadwal yang sama (klinik_jadwal_praktik/klinik_jadwal_pengecualian) bisa
-- dipakai booking online (Fase 2b) tanpa rombak skema kunjungan.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.klinik_kunjungan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  pasien_id UUID NOT NULL REFERENCES public.klinik_pasien(id) ON DELETE CASCADE,
  poli_id UUID NOT NULL REFERENCES public.klinik_poli(id) ON DELETE CASCADE,
  staf_medis_id UUID REFERENCES public.klinik_staf_medis(id) ON DELETE SET NULL,
  tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
  no_antrian INTEGER NOT NULL,
  jenis_kunjungan TEXT NOT NULL DEFAULT 'umum' CHECK (jenis_kunjungan IN ('umum', 'bpjs', 'asuransi')),
  status TEXT NOT NULL DEFAULT 'MENUNGGU' CHECK (status IN ('MENUNGGU', 'DIPERIKSA', 'SELESAI', 'BATAL')),
  sumber TEXT NOT NULL DEFAULT 'WALK_IN' CHECK (sumber IN ('WALK_IN', 'BOOKING')),
  keluhan TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (branch_id, poli_id, tanggal, no_antrian)
);

CREATE INDEX IF NOT EXISTS idx_klinik_kunjungan_pasien ON public.klinik_kunjungan (pasien_id, tanggal DESC);
CREATE INDEX IF NOT EXISTS idx_klinik_kunjungan_antrian_hari_ini ON public.klinik_kunjungan (branch_id, poli_id, tanggal, status);

-- Backfill FK sungguhan ke klinik_akses_rekam_log.kunjungan_id — ditunda dari
-- 1425_klinik_pratama_foundation.sql karena tabel ini belum ada saat itu.
ALTER TABLE public.klinik_akses_rekam_log
  ADD CONSTRAINT fk_klinik_akses_rekam_log_kunjungan
  FOREIGN KEY (kunjungan_id) REFERENCES public.klinik_kunjungan(id) ON DELETE SET NULL;
