-- 1356: Tambah reference_type kojasmat ke enum + backfill jurnal transaksi lama
-- CATATAN: ALTER TYPE ADD VALUE tidak bisa dalam transaksi yang sama dengan DML yang
-- menggunakan nilai baru tersebut. Migration ini harus dijalankan dalam 2 koneksi
-- terpisah (atau 2 statement tanpa wrapping transaction) — sudah dieksekusi manual.

-- Step 1 (dieksekusi terpisah):
-- ALTER TYPE journal_reference_type ADD VALUE IF NOT EXISTS 'KOJASMAT_SIMPANAN_SETOR';
-- ALTER TYPE journal_reference_type ADD VALUE IF NOT EXISTS 'KOJASMAT_SIMPANAN_TARIK';
-- ALTER TYPE journal_reference_type ADD VALUE IF NOT EXISTS 'KOJASMAT_PEMBIAYAAN';
-- ALTER TYPE journal_reference_type ADD VALUE IF NOT EXISTS 'KOJASMAT_PENYALURAN';
-- ALTER TYPE journal_reference_type ADD VALUE IF NOT EXISTS 'KOJASMAT_UJRAH';
-- ALTER TYPE journal_reference_type ADD VALUE IF NOT EXISTS 'KOJASMAT_BAGI_HASIL';

-- Step 2: Backfill mutasi + jurnal untuk saldo simpanan yang sudah ada tapi belum punya mutasi
DO $$
DECLARE
  r         RECORD;
  acct_kas  UUID;
  acct_cr   UUID;
  je_id     UUID;
  mutasi_id UUID;
  coa_cr    TEXT;
  entry_num TEXT;
BEGIN
  FOR r IN
    SELECT s.id AS simpanan_id, s.jenis, s.saldo::numeric AS saldo,
           a.id AS anggota_id, a.org_id, a.kode_anggota
    FROM kojasmat_simpanan s
    JOIN kojasmat_anggota a ON a.id = s.anggota_id
    WHERE s.saldo > 0
      AND NOT EXISTS (
        SELECT 1 FROM kojasmat_simpanan_mutasi m WHERE m.simpanan_id = s.id
      )
  LOOP
    coa_cr := CASE r.jenis
      WHEN 'POKOK'    THEN '31-1000'
      WHEN 'WAJIB'    THEN '31-2000'
      WHEN 'SUKARELA' THEN '21-6000'
    END;

    SELECT id INTO acct_kas FROM accounts
      WHERE org_id = r.org_id AND code = '1101' AND is_active = TRUE LIMIT 1;
    SELECT id INTO acct_cr  FROM accounts
      WHERE org_id = r.org_id AND code = coa_cr  AND is_active = TRUE LIMIT 1;

    IF acct_kas IS NULL OR acct_cr IS NULL THEN
      RAISE NOTICE 'CoA belum ada untuk org=% jenis=% coa_cr=%, skip', r.org_id, r.jenis, coa_cr;
      CONTINUE;
    END IF;

    INSERT INTO kojasmat_simpanan_mutasi
      (org_id, simpanan_id, anggota_id, jenis_mutasi, jumlah, saldo_sebelum, saldo_sesudah, keterangan, tanggal)
    VALUES
      (r.org_id, r.simpanan_id, r.anggota_id, 'SETOR', r.saldo, 0, r.saldo, 'Saldo pembukaan (backfill)', CURRENT_DATE)
    RETURNING id INTO mutasi_id;

    entry_num := 'JNL-KJM-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM()*9999)::TEXT, 4, '0');

    INSERT INTO journal_entries
      (org_id, entry_number, entry_date, description, reference_type, reference_id, status, is_auto)
    VALUES
      (r.org_id, entry_num, CURRENT_DATE,
       'Setoran simpanan ' || r.jenis || ' — ' || r.kode_anggota || ' (backfill)',
       'KOJASMAT_SIMPANAN_SETOR', mutasi_id, 'POSTED', TRUE)
    RETURNING id INTO je_id;

    INSERT INTO journal_lines (entry_id, account_id, debit, credit, memo)
    VALUES
      (je_id, acct_kas, r.saldo, 0,      'Kas masuk — setoran simpanan ' || r.jenis),
      (je_id, acct_cr,  0,       r.saldo, 'Simpanan ' || r.jenis || ' — ' || r.kode_anggota);

    RAISE NOTICE 'Backfill OK: % % Rp %', r.kode_anggota, r.jenis, r.saldo;
  END LOOP;
END;
$$;
