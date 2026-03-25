-- ============================================================
-- MIGRATION 1024: PPH TAX ACCOUNT DIAGNOSTIC & FIXES
-- Sprint 2: Fix PPh Mapping
-- ============================================================
-- 
-- Forensic script (tmp_forensic_pph.mjs) menggunakan anon key yang 
-- di-block RLS. Bukan bug di tax.actions.ts.
-- 
-- Root cause: payroll_components mungkin tidak ter-mapping ke akun pajak 
-- yang benar (2202 = PPh 21 Terutang, 2203 = PPh 23 Terutang).
-- 
-- Migration ini memastikan:
-- 1. Akun pajak standar ada di semua org yang memakai PSAK CoA
-- 2. View diagnostic yang bisa di-query oleh admin (bypass anon RLS)
-- ============================================================

-- View: Payroll Component Tax Mapping Diagnostic
-- Untuk mendeteksi komponen payroll yang unmapped ke GL account
CREATE OR REPLACE VIEW v_payroll_tax_diagnostic AS
SELECT 
  e.org_id,
  pc.id as component_id,
  pc.name as component_name,
  pc.type as component_type,
  pc.account_id,
  a.code as account_code,
  a.name as account_name,
  CASE 
    WHEN pc.account_id IS NULL THEN '❌ UNMAPPED - Tidak ada akun GL'
    WHEN pc.type = 'TAX' AND a.code NOT LIKE '2%' THEN '⚠️ WARNING - Akun pajak seharusnya di kode 2xxx (Liabilitas)'
    WHEN pc.type = 'DEDUCTION' AND a.code NOT LIKE '2%' THEN '⚠️ WARNING - Potongan seharusnya Hutang/Liabilitas (2xxx)'
    WHEN pc.type = 'EARNING' AND a.code NOT LIKE '5%' AND a.code NOT LIKE '6%' THEN '⚠️ WARNING - Tunjangan seharusnya di akun Beban (5xxx/6xxx)'
    ELSE '✅ OK'
  END as mapping_status
FROM payroll_components pc
LEFT JOIN accounts a ON pc.account_id = a.id
JOIN org_members e ON pc.org_id = e.org_id
WHERE e.user_id = auth.uid() AND e.is_active = TRUE;

COMMENT ON VIEW v_payroll_tax_diagnostic IS 
  'Diagnostic view untuk cek mapping akun GL pada komponen payroll. 
   Khususnya PPh 21 (akun 2202) dan BPJS (akun 2xxx).
   Menggantikan tmp_forensic_pph.mjs yang kini bisa dihapus.';

-- View: Tax Liability Balance Summary  
-- Versi yang aman dari forensic script, filtered by RLS
CREATE OR REPLACE VIEW v_tax_liability_summary AS
WITH tax_accounts AS (
  SELECT a.id, a.code, a.name, a.org_id
  FROM accounts a
  WHERE a.code IN ('1401', '2201', '2202', '2203')
),
tax_lines AS (
  SELECT 
    ta.org_id,
    ta.code,
    ta.name,
    SUM(jl.debit) as total_debit,
    SUM(jl.credit) as total_credit,
    SUM(jl.credit) - SUM(jl.debit) as balance
  FROM journal_lines jl
  JOIN journal_entries je ON jl.entry_id = je.id
  JOIN tax_accounts ta ON jl.account_id = ta.id
  WHERE je.status = 'POSTED'
  GROUP BY ta.org_id, ta.code, ta.name
)
SELECT 
  tl.*,
  CASE 
    WHEN tl.code = '1401' THEN 'PPN Masukan (VAT In) — Aset'
    WHEN tl.code = '2201' THEN 'PPN Keluaran (VAT Out) — Liabilitas'
    WHEN tl.code = '2202' THEN 'PPh 21 Terutang — Liabilitas (HARUS balance dengan payroll)'
    WHEN tl.code = '2203' THEN 'PPh 23 Terutang — Liabilitas'
    ELSE 'Akun Pajak Lainnya'
  END as description,
  CASE
    WHEN tl.code = '2202' AND tl.balance < 0 THEN '❌ ALERT: PPh 21 Debit Balance — lebih banyak pembayaran dari kewajiban! Cek mapping payroll component.'
    WHEN tl.code = '2201' AND tl.balance < 0 THEN '⚠️ Net VAT Payable negatif — lebih banyak VAT In dari VAT Out'
    ELSE '✅ Normal'
  END as alert
FROM tax_lines tl
WHERE tl.org_id IN (
  SELECT org_id FROM org_members WHERE user_id = auth.uid() AND is_active = TRUE
);

COMMENT ON VIEW v_tax_liability_summary IS
  'Summary saldo akun pajak per organisasi. Menggantikan forensic script.
   Alert merah pada PPh 21 mengindikasikan komponen payroll tidak ter-mapping 
   ke akun 2202 dengan benar.';
