-- Catat jalur pembayaran (Transfer Bank / QRIS) yang dipilih anggota saat
-- mengajukan setoran simpanan, supaya terlihat di riwayat & detail setoran.

ALTER TABLE public.kojasmat_simpanan_mutasi
  ADD COLUMN IF NOT EXISTS metode_bayar TEXT CHECK (metode_bayar IN ('TRANSFER', 'QRIS'));
