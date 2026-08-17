-- =============================================================================
-- 1429_klinik_pratama_kasir.sql
-- Modul Klinik Pratama — Fase 4 (Kasir/Billing): tagihan per kunjungan,
-- gabung layanan (dari klinik_tarif_layanan) + obat (dari resep yang sudah
-- di-dispensing). Jurnal diposting dari layer TS (lib/erp-bridge/klinik-journals.ts)
-- via postJurnal(), bukan di sini — pola sama seperti Apotek (pemisahan
-- fisik/operasional vs finansial).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.klinik_tagihan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  kunjungan_id UUID NOT NULL UNIQUE REFERENCES public.klinik_kunjungan(id) ON DELETE CASCADE,
  pasien_id UUID NOT NULL REFERENCES public.klinik_pasien(id) ON DELETE CASCADE,
  total_layanan NUMERIC(15, 2) NOT NULL DEFAULT 0,
  total_obat NUMERIC(15, 2) NOT NULL DEFAULT 0,
  total_tagihan NUMERIC(15, 2) NOT NULL DEFAULT 0,
  metode_bayar TEXT NOT NULL DEFAULT 'tunai' CHECK (metode_bayar IN ('tunai', 'bpjs', 'asuransi')),
  status TEXT NOT NULL DEFAULT 'BELUM_BAYAR' CHECK (status IN ('BELUM_BAYAR', 'LUNAS', 'VOID')),
  no_klaim_bpjs TEXT,
  tanggal_bayar TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_klinik_tagihan_branch_status ON public.klinik_tagihan (branch_id, status);
CREATE INDEX IF NOT EXISTS idx_klinik_tagihan_pasien ON public.klinik_tagihan (pasien_id);

CREATE TABLE IF NOT EXISTS public.klinik_tagihan_detail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tagihan_id UUID NOT NULL REFERENCES public.klinik_tagihan(id) ON DELETE CASCADE,
  jenis TEXT NOT NULL CHECK (jenis IN ('layanan', 'obat')),
  deskripsi TEXT NOT NULL,
  ref_id UUID,
  qty NUMERIC(15, 2) NOT NULL DEFAULT 1,
  harga_satuan NUMERIC(15, 2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(15, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_klinik_tagihan_detail_tagihan ON public.klinik_tagihan_detail (tagihan_id);
