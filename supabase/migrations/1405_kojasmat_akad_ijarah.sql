-- Kojasmat — akad ijarah (sewa manfaat platform) berulang tiap 30 hari.
-- Terms (nominal_fee, periode_hari) di-snapshot per-akad per-anggota saat dibuat,
-- supaya perubahan tarif default org di masa depan tidak mengubah akad yang sudah
-- berjalan, dan admin bisa memberi harga custom / menonaktifkan per anggota tanpa
-- memengaruhi anggota lain (status='BERHENTI' = nonaktif permanen sampai diaktifkan lagi).

CREATE TABLE public.kojasmat_akad_ijarah (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  anggota_id         UUID NOT NULL REFERENCES public.kojasmat_anggota(id) ON DELETE CASCADE,
  nominal_fee        NUMERIC(18,2) NOT NULL,
  periode_hari       INT NOT NULL DEFAULT 30,
  status             TEXT NOT NULL DEFAULT 'AKTIF' CHECK (status IN ('AKTIF','DIBEKUKAN','BERHENTI')),
  tanggal_mulai      DATE NOT NULL,
  tagihan_berikutnya DATE NOT NULL,
  catatan_admin      TEXT,
  diubah_oleh        UUID REFERENCES public.internal_auth_users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (anggota_id)
);

CREATE INDEX idx_kjm_akad_ijarah_due ON public.kojasmat_akad_ijarah (status, tagihan_berikutnya)
  WHERE status IN ('AKTIF','DIBEKUKAN');
