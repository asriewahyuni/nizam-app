-- ============================================================
-- MIGRATION 1392: Safety-net trigger — auto-void jurnal SALE saat sales di-void
--
-- Masalah: voidSale() di aplikasi sudah benar membalik journal_entries
-- (reference_type='SALE') saat sebuah sale di-void. Tapi jika status sales
-- diubah ke 'VOIDED' lewat jalur lain di luar voidSale() (mis. koreksi data
-- manual langsung ke Postgres), journal_entries terkait tidak ikut ter-void,
-- sehingga revenue & HPP "hantu" tetap POSTED dan mengotori Laporan Laba Rugi.
--
-- Ditemukan pada org AHE PUSAT: 5 sales (SO-2026-000048/068/072/077/086)
-- ter-VOIDED dengan audit_logs.user_id NULL (bukan lewat voidSale()), dan
-- journal_entries reference_type='SALE' miliknya tetap POSTED.
--
-- Fix: trigger AFTER UPDATE di tabel sales yang membalik journal_entries
-- terkait kapan pun status berpindah ke VOIDED, apapun jalur yang dipakai
-- (Supabase client, raw pg, ataupun psql manual) — karena trigger berjalan
-- di level database, bukan di level aplikasi.
-- ============================================================

CREATE OR REPLACE FUNCTION sync_void_sale_journal()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'VOIDED' AND (OLD.status IS DISTINCT FROM 'VOIDED') THEN
    UPDATE journal_entries
    SET
      status = 'VOIDED',
      voided_at = NOW(),
      void_reason = COALESCE(void_reason, 'AUTO_SYNC: sales voided outside voidSale() action')
    WHERE org_id = NEW.org_id
      AND reference_type = 'SALE'
      AND reference_id = NEW.id
      AND status = 'POSTED';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_void_sale_journal ON sales;
CREATE TRIGGER trg_sync_void_sale_journal
  AFTER UPDATE ON sales
  FOR EACH ROW
  EXECUTE FUNCTION sync_void_sale_journal();

NOTIFY pgrst, 'reload schema';
