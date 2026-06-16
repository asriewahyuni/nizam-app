-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 1361: Pencatatan cash flow proyek (pendapatan/beban) untuk laporan
-- Laba/Rugi, Neraca, dan Cashflow proyek pembiayaan Kojasmat
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.kojasmat_proyek_transaksi (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  proyek_id    UUID NOT NULL REFERENCES public.kojasmat_proyek(id) ON DELETE CASCADE,
  laporan_id   UUID REFERENCES public.kojasmat_laporan_proyek(id) ON DELETE SET NULL,
  tanggal      DATE NOT NULL,
  jenis        TEXT NOT NULL CHECK (jenis IN ('PENDAPATAN', 'BEBAN')),
  kategori     TEXT NOT NULL,
  keterangan   TEXT,
  jumlah       NUMERIC(18,2) NOT NULL CHECK (jumlah > 0),
  created_by   UUID,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kjm_transaksi_proyek   ON public.kojasmat_proyek_transaksi(proyek_id);
CREATE INDEX IF NOT EXISTS idx_kjm_transaksi_laporan  ON public.kojasmat_proyek_transaksi(laporan_id);
CREATE INDEX IF NOT EXISTS idx_kjm_transaksi_org      ON public.kojasmat_proyek_transaksi(org_id);
