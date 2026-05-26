-- ============================================================
-- Migration 1317: Add contact_id + due_date to journal_entries
--
-- Tujuan: Agar jurnal manual (MANUAL reference_type) bisa
-- diattribusikan ke contact tertentu sehingga muncul di
-- laporan Aging AP/AR dengan nama contact yang benar,
-- bukan hanya sebagai "Unallocated (Buku Besar)".
-- ============================================================

-- 1. Tambah kolom contact_id (FK ke contacts)
ALTER TABLE journal_entries
  ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id);

-- 2. Tambah kolom due_date untuk perhitungan aging bucket
ALTER TABLE journal_entries
  ADD COLUMN IF NOT EXISTS due_date DATE;

-- 3. Performance indexes
CREATE INDEX IF NOT EXISTS idx_journal_entries_contact_id
  ON journal_entries(contact_id, org_id)
  WHERE contact_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_journal_entries_status_contact_org
  ON journal_entries(org_id, status, contact_id)
  WHERE contact_id IS NOT NULL AND status = 'POSTED';

-- 4. Backfill: isi contact_id dari referensi SALE yang sudah ada
UPDATE journal_entries je
SET contact_id = s.customer_id
FROM sales s
WHERE je.reference_type = 'SALE'
  AND je.reference_id = s.id
  AND je.contact_id IS NULL
  AND s.customer_id IS NOT NULL
  AND s.org_id = je.org_id;

-- 5. Backfill: isi contact_id dari referensi PURCHASE yang sudah ada
UPDATE journal_entries je
SET contact_id = p.vendor_id
FROM purchases p
WHERE je.reference_type = 'PURCHASE'
  AND je.reference_id = p.id
  AND je.contact_id IS NULL
  AND p.vendor_id IS NOT NULL
  AND p.org_id = je.org_id;

-- 6. Backfill: isi due_date dari referensi SALE yang sudah ada
UPDATE journal_entries je
SET due_date = s.due_date::date
FROM sales s
WHERE je.reference_type = 'SALE'
  AND je.reference_id = s.id
  AND je.due_date IS NULL
  AND s.due_date IS NOT NULL
  AND s.org_id = je.org_id;

-- 7. Backfill: isi due_date dari referensi PURCHASE yang sudah ada
UPDATE journal_entries je
SET due_date = p.due_date::date
FROM purchases p
WHERE je.reference_type = 'PURCHASE'
  AND je.reference_id = p.id
  AND je.due_date IS NULL
  AND p.due_date IS NOT NULL
  AND p.org_id = je.org_id;
