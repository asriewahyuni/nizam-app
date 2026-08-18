-- =============================================================================
-- 1432_klinik_pratama_rawat_inap.sql
-- Modul Klinik Pratama — Rawat Inap: kamar (VIP/BPJS/dst) + tempat tidur +
-- admisi/discharge pasien. Mirror pola anti-double-booking klinik_slot_hold
-- (1430_klinik_pratama_booking.sql) yang sendiri adalah mirror
-- consulting_slot_holds (1390_consulting_360.sql) — EXCLUDE USING gist
-- mencegah 1 tempat tidur diisi 2 pasien aktif sekaligus, ditegakkan di
-- level database.
--
-- Admisi WAJIB ditautkan ke klinik_kunjungan (poli "Rawat Inap" seperti poli
-- lain) supaya mesin Kasir/RME/jurnal yang sudah ada otomatis berlaku saat
-- discharge — bukan jalur akuntansi/billing paralel (HUKUM BESI ANTI-SILO).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.klinik_kamar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  tipe_kamar TEXT NOT NULL,
  nama TEXT NOT NULL,
  ukuran_m2 NUMERIC(6, 2),
  tarif_per_malam NUMERIC(15, 2) NOT NULL DEFAULT 0,
  fasilitas TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_klinik_kamar_branch ON public.klinik_kamar (branch_id, is_active);

CREATE TABLE IF NOT EXISTS public.klinik_tempat_tidur (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kamar_id UUID NOT NULL REFERENCES public.klinik_kamar(id) ON DELETE CASCADE,
  kode_bed TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'TERSEDIA' CHECK (status IN ('TERSEDIA', 'TERISI', 'MAINTENANCE')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (kamar_id, kode_bed)
);

CREATE INDEX IF NOT EXISTS idx_klinik_tempat_tidur_kamar ON public.klinik_tempat_tidur (kamar_id, status);

CREATE TABLE IF NOT EXISTS public.klinik_rawat_inap (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  kamar_id UUID NOT NULL REFERENCES public.klinik_kamar(id) ON DELETE RESTRICT,
  tempat_tidur_id UUID NOT NULL REFERENCES public.klinik_tempat_tidur(id) ON DELETE RESTRICT,
  pasien_id UUID NOT NULL REFERENCES public.klinik_pasien(id) ON DELETE RESTRICT,
  kunjungan_id UUID NOT NULL UNIQUE REFERENCES public.klinik_kunjungan(id) ON DELETE CASCADE,
  admitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  discharged_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'DIRAWAT' CHECK (status IN ('DIRAWAT', 'PULANG', 'DIBATALKAN')),
  tarif_per_malam_snapshot NUMERIC(15, 2) NOT NULL,
  diagnosis_masuk TEXT,
  dokter_penanggung_jawab_id UUID REFERENCES public.klinik_staf_medis(id) ON DELETE SET NULL,
  catatan TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (discharged_at IS NULL OR discharged_at > admitted_at)
);

ALTER TABLE public.klinik_rawat_inap
  ADD CONSTRAINT klinik_rawat_inap_bed_no_overlap
  EXCLUDE USING gist (
    tempat_tidur_id WITH =,
    tstzrange(admitted_at, COALESCE(discharged_at, 'infinity'), '[)') WITH &&
  ) WHERE (status = 'DIRAWAT');

CREATE INDEX IF NOT EXISTS idx_klinik_rawat_inap_branch_status ON public.klinik_rawat_inap (branch_id, status);
CREATE INDEX IF NOT EXISTS idx_klinik_rawat_inap_pasien ON public.klinik_rawat_inap (pasien_id);

-- Baris tagihan kamar rawat inap (qty = malam, harga_satuan = tarif snapshot saat admisi).
ALTER TABLE public.klinik_tagihan_detail
  DROP CONSTRAINT klinik_tagihan_detail_jenis_check,
  ADD CONSTRAINT klinik_tagihan_detail_jenis_check CHECK (jenis IN ('layanan', 'obat', 'kamar'));

-- Role akun baru untuk jurnal pendapatan kamar (dipetakan admin di tab
-- Pengaturan Akun; postJurnal() sudah skip non-fatal kalau belum dipetakan).
ALTER TABLE public.klinik_account_mapping
  ADD COLUMN IF NOT EXISTS pendapatan_kamar_inap_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL;
