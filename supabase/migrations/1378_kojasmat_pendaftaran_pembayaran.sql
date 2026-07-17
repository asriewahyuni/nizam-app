-- 1378: Pembayaran biaya admin + simpanan pokok di alur pendaftaran Kojasmat

ALTER TABLE kojasmat_pendaftaran
  ADD COLUMN biaya_admin_dibayar NUMERIC(18,2),
  ADD COLUMN simpanan_pokok_dibayar NUMERIC(18,2),
  ADD COLUMN bukti_bayar_dokumen_id UUID REFERENCES kojasmat_dokumen(id),
  ADD COLUMN status_bayar TEXT NOT NULL DEFAULT 'BELUM' CHECK (status_bayar IN ('BELUM','SUDAH')),
  ADD COLUMN dibayar_at TIMESTAMPTZ;

ALTER TABLE kojasmat_dokumen DROP CONSTRAINT kojasmat_dokumen_jenis_check;
ALTER TABLE kojasmat_dokumen ADD CONSTRAINT kojasmat_dokumen_jenis_check
  CHECK (jenis_dokumen = ANY (ARRAY[
    'KTP','PASSPORT','SURAT_USAHA','FOTO_USAHA',
    'PROYEKSI_KEUANGAN','ANALISA_BISNIS','PENAWARAN_SYIRKAH','LAPORAN_MINGGUAN',
    'AKAD','LAINNYA','KELAYAKAN_USAHA','PROPOSAL','PENAWARAN_HARGA','BUKTI_BAYAR'
  ]::text[]));
