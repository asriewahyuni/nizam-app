-- =============================================================================
-- 1425_klinik_pratama_foundation.sql
-- Modul Klinik Pratama — Fase 1 (Fondasi): master data pasien, poli, tenaga
-- medis, jadwal praktik, tarif layanan, pemetaan akun jurnal, dan audit akses
-- rekam medis. Modul standalone (pola Kojasmat) yang terhubung ke ERP core
-- lewat lib/erp-bridge/klinik-journals.ts.
--
-- Multi-klinik memakai infrastruktur branches yang sudah ada (setiap lokasi
-- klinik = 1 row branches di bawah org anak) — TIDAK ada hierarki/entity
-- "klinik" baru. Kunjungan/rekam medis/resep/tagihan menyusul di migration
-- fase berikutnya (2a-4) setelah skema fondasi ini stabil.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─── Pasien ───────────────────────────────────────────────────────────────────
-- Org-level (pasien adalah orang, bukan aset cabang — bisa berobat di cabang
-- manapun dalam grup). Kontrol akses lintas-cabang diturunkan dari kunjungan
-- (klinik_kunjungan, fase 2a), bukan dari registered_branch_id di sini —
-- kolom itu murni default filter/pelaporan. Akses eksplisit lintas-cabang
-- wajib tercatat di klinik_akses_rekam_log.
CREATE TABLE IF NOT EXISTS public.klinik_pasien (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  no_rm TEXT NOT NULL,
  nik TEXT,
  nama TEXT NOT NULL,
  tgl_lahir DATE,
  jenis_kelamin TEXT CHECK (jenis_kelamin IN ('L', 'P')),
  alamat TEXT,
  no_hp TEXT,
  no_bpjs TEXT,
  golongan_darah TEXT,
  alergi TEXT,
  registered_branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, no_rm)
);

CREATE INDEX IF NOT EXISTS idx_klinik_pasien_org ON public.klinik_pasien (org_id);
CREATE INDEX IF NOT EXISTS idx_klinik_pasien_nik ON public.klinik_pasien (org_id, nik) WHERE nik IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_klinik_pasien_nama ON public.klinik_pasien (org_id, nama);

-- ─── Poli ─────────────────────────────────────────────────────────────────────
-- branch_id NOT NULL: poli adalah fasilitas fisik per lokasi (beda dari tarif
-- layanan yang boleh berlaku lintas cabang).
CREATE TABLE IF NOT EXISTS public.klinik_poli (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  kode TEXT NOT NULL,
  nama TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (branch_id, kode)
);

CREATE INDEX IF NOT EXISTS idx_klinik_poli_branch ON public.klinik_poli (branch_id);

-- ─── Tenaga medis berkredensial ───────────────────────────────────────────────
-- FK ke employees (WAJIB per AGENTS.md — presensi/payroll HRIS baca dari sini).
-- Hanya untuk tenaga berkredensial (dokter/perawat/bidan/apoteker); staf
-- admin/kasir cukup row employees biasa tanpa extension ini.
CREATE TABLE IF NOT EXISTS public.klinik_staf_medis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  jenis TEXT NOT NULL CHECK (jenis IN ('dokter', 'perawat', 'bidan', 'apoteker')),
  str_number TEXT,
  str_expiry DATE,
  sip_number TEXT,
  sip_expiry DATE,
  spesialisasi TEXT,
  poli_id UUID REFERENCES public.klinik_poli(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (employee_id)
);

CREATE INDEX IF NOT EXISTS idx_klinik_staf_medis_org ON public.klinik_staf_medis (org_id);

-- ─── Jadwal praktik rutin ─────────────────────────────────────────────────────
-- Mirror consulting_availability_rules (supabase/migrations/1390_consulting_360.sql)
-- supaya walk-in queue dan booking online (fase 2b) bisa berbagi fondasi jadwal
-- yang sama tanpa rombak skema.
CREATE TABLE IF NOT EXISTS public.klinik_jadwal_praktik (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  staf_medis_id UUID NOT NULL REFERENCES public.klinik_staf_medis(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  poli_id UUID NOT NULL REFERENCES public.klinik_poli(id) ON DELETE CASCADE,
  weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_local TIME NOT NULL,
  end_local TIME NOT NULL,
  valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until DATE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_local > start_local),
  CHECK (valid_until IS NULL OR valid_until >= valid_from)
);

CREATE INDEX IF NOT EXISTS idx_klinik_jadwal_praktik_staf ON public.klinik_jadwal_praktik (staf_medis_id);
CREATE INDEX IF NOT EXISTS idx_klinik_jadwal_praktik_poli ON public.klinik_jadwal_praktik (poli_id, weekday);

-- ─── Pengecualian jadwal (cuti/libur/rapat) ──────────────────────────────────
-- Mirror consulting_availability_exceptions — kejadian harian di klinik yang
-- tidak boleh dilewatkan dari desain jadwal.
CREATE TABLE IF NOT EXISTS public.klinik_jadwal_pengecualian (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  staf_medis_id UUID NOT NULL REFERENCES public.klinik_staf_medis(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('AVAILABLE', 'BLOCKED')),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_klinik_jadwal_pengecualian_staf ON public.klinik_jadwal_pengecualian (staf_medis_id, starts_at, ends_at);

-- ─── Tarif layanan ────────────────────────────────────────────────────────────
-- branch_id nullable = berlaku semua cabang (fallback), mirror
-- workshop_service_rates (supabase/migrations/1255_workshop_service_rates_and_inventory.sql).
-- Terpisah dari `products` karena tarif medis butuh atribut khusus (poli,
-- kode_layanan untuk pemetaan BPJS/INA-CBG nanti).
CREATE TABLE IF NOT EXISTS public.klinik_tarif_layanan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  poli_id UUID REFERENCES public.klinik_poli(id) ON DELETE SET NULL,
  kode_layanan TEXT,
  nama_layanan TEXT NOT NULL,
  kategori TEXT NOT NULL DEFAULT 'Konsultasi' CHECK (kategori IN ('Konsultasi', 'Tindakan', 'Lainnya')),
  harga NUMERIC(15, 2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- branch_id NULL harus dianggap satu nilai tunggal untuk keunikan (bukan
-- "distinct NULL" default Postgres) supaya tidak ada duplikat baris default.
CREATE UNIQUE INDEX IF NOT EXISTS uq_klinik_tarif_layanan_scope
  ON public.klinik_tarif_layanan (org_id, COALESCE(branch_id, '00000000-0000-0000-0000-000000000000'::uuid), nama_layanan);

CREATE INDEX IF NOT EXISTS idx_klinik_tarif_layanan_branch ON public.klinik_tarif_layanan (org_id, branch_id);

-- ─── Pemetaan akun jurnal ─────────────────────────────────────────────────────
-- Dibaca oleh lib/erp-bridge/klinik-journals.ts. branch_id nullable = default
-- org-level (fallback kalau mapping spesifik cabang belum diisi) — BUKAN
-- UNIQUE(org_id) seperti kojasmat_account_mapping, karena grup klinik
-- multi-cabang lazimnya punya akun kas berbeda per cabang.
CREATE TABLE IF NOT EXISTS public.klinik_account_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,

  kas_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  pendapatan_konsultasi_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  pendapatan_tindakan_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  pendapatan_obat_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  hpp_obat_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  persediaan_obat_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  piutang_bpjs_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  kerugian_obat_kadaluarsa_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_klinik_account_mapping_scope
  ON public.klinik_account_mapping (org_id, COALESCE(branch_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- ─── Audit akses rekam medis lintas-cabang ────────────────────────────────────
-- kunjungan_id belum di-FK ke klinik_kunjungan karena tabel itu baru dibuat di
-- fase 2a — akan di-backfill jadi FK sungguhan begitu tabel itu ada.
CREATE TABLE IF NOT EXISTS public.klinik_akses_rekam_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  pasien_id UUID NOT NULL REFERENCES public.klinik_pasien(id) ON DELETE CASCADE,
  kunjungan_id UUID,
  alasan TEXT,
  accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_klinik_akses_rekam_log_pasien ON public.klinik_akses_rekam_log (pasien_id, accessed_at DESC);
