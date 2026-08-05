-- Kojasmat — reference type baru untuk journal tagihan ijarah platform.
-- ALTER TYPE ADD VALUE tidak boleh digabung transaksi dengan DML lain, jadi file terpisah.
ALTER TYPE journal_reference_type ADD VALUE IF NOT EXISTS 'KOJASMAT_IJARAH_TAGIHAN';
