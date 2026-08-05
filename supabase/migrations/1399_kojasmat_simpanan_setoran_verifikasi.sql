-- Setoran simpanan self-service anggota Kojasmat: anggota mengajukan setoran
-- (jenis + nominal + bukti transfer) lewat portal member, saldo & jurnal baru
-- diposting setelah pengurus memverifikasi & menyetujui secara manual — sama
-- persis pola verifikasi manual yang sudah dipakai di alur pendaftaran anggota.

ALTER TABLE public.kojasmat_simpanan_mutasi
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'DISETUJUI'
    CHECK (status IN ('PENDING', 'DISETUJUI', 'DITOLAK')),
  ADD COLUMN IF NOT EXISTS bukti_dokumen_id UUID REFERENCES public.kojasmat_dokumen(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS catatan_admin TEXT,
  ADD COLUMN IF NOT EXISTS direview_oleh UUID REFERENCES public.internal_auth_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS direview_at TIMESTAMPTZ;

-- saldo_sebelum/saldo_sesudah hanya bermakna setelah disetujui (saldo memang
-- berubah saat itu) — baris PENDING belum tahu nilainya, jadi harus boleh NULL.
ALTER TABLE public.kojasmat_simpanan_mutasi
  ALTER COLUMN saldo_sebelum DROP NOT NULL,
  ALTER COLUMN saldo_sebelum DROP DEFAULT,
  ALTER COLUMN saldo_sesudah DROP NOT NULL,
  ALTER COLUMN saldo_sesudah DROP DEFAULT;

-- Anggota bisa mengunggah bukti transfer setoran dan menautkannya ke baris mutasi.
ALTER TABLE public.kojasmat_dokumen
  DROP CONSTRAINT IF EXISTS kojasmat_dokumen_referensi_type_check;
ALTER TABLE public.kojasmat_dokumen
  ADD CONSTRAINT kojasmat_dokumen_referensi_type_check
    CHECK (referensi_type = ANY (ARRAY['PENDAFTARAN', 'ANGGOTA', 'PROYEK', 'LAPORAN', 'SIMPANAN']));

-- kojasmat_dokumen_jenis_check (bukan _jenis_dokumen_check — nama constraint live
-- berbeda dari migrasi asli 1354, jadi harus di-drop dengan nama live-nya).
ALTER TABLE public.kojasmat_dokumen
  DROP CONSTRAINT IF EXISTS kojasmat_dokumen_jenis_check;
ALTER TABLE public.kojasmat_dokumen
  ADD CONSTRAINT kojasmat_dokumen_jenis_check
    CHECK (jenis_dokumen = ANY (ARRAY[
      'KTP', 'PASSPORT', 'SURAT_USAHA', 'FOTO_USAHA', 'PROYEKSI_KEUANGAN',
      'ANALISA_BISNIS', 'PENAWARAN_SYIRKAH', 'LAPORAN_MINGGUAN', 'AKAD', 'LAINNYA',
      'KELAYAKAN_USAHA', 'PROPOSAL', 'PENAWARAN_HARGA', 'BUKTI_BAYAR', 'BUKTI_SETORAN'
    ]));

CREATE INDEX IF NOT EXISTS idx_kojasmat_simpanan_mutasi_status
  ON public.kojasmat_simpanan_mutasi (org_id, status)
  WHERE status = 'PENDING';
