-- ============================================================
-- MIGRATION 1023: SPRINT 1 HARDENING
-- Board Verdict Execution: Guardrails + Audit Trail
-- ============================================================

-- 1. ZAKAT HAUL AUDIT TRAIL
-- CFO requirement: simpan sumber harga emas, bukan hanya angka
-- "Anda dapat angka 1,3 juta/gram ini dari mana?" — harus terjawab
ALTER TABLE zakat_haul
  ADD COLUMN IF NOT EXISTS gold_price_source TEXT NOT NULL DEFAULT 'Manual Input',
  ADD COLUMN IF NOT EXISTS gold_price_evidence_url TEXT,
  ADD COLUMN IF NOT EXISTS gold_price_set_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS gold_price_set_at TIMESTAMPTZ DEFAULT NOW();

COMMENT ON COLUMN zakat_haul.gold_price_source IS 'Sumber harga: Manual Input | Antam | Logam Mulia | Bank Indonesia | etc.';
COMMENT ON COLUMN zakat_haul.gold_price_evidence_url IS 'URL screenshot/bukti harga emas saat haul dimulai. Bukti audit.';
COMMENT ON COLUMN zakat_haul.gold_price_set_by IS 'User yang menginput harga emas — accountability trail.';
COMMENT ON COLUMN zakat_haul.gold_price_set_at IS 'Timestamp eksak harga emas diinput.';

-- 2. JOURNAL BALANCE CONSTRAINT (Database-Level Guardrail)
-- Validasi sudah ada di application layer (journal.actions.ts line 59),
-- ini safety net kedua di database level.
-- Hanya apply pada status POSTED — DRAFT boleh unbalanced sementara.
-- CATATAN: Constraint ini tidak memblokir data existing yang sudah balance.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'chk_posted_journal_has_balanced_lines' 
    AND conrelid = 'journal_entries'::regclass
  ) THEN
    -- Kita tidak bisa bikin CHECK constraint pada aggregate,
    -- tapi kita bisa enforce via TRIGGER (lebih powerful)
    -- Trigger ini HANYA berjalan saat status berubah ke POSTED
    RAISE NOTICE 'Balance constraint akan di-enforce via existing application logic + trigger';
  END IF;
END $$;

-- Balance validation trigger: Cegah posting jurnal yang tidak balance
CREATE OR REPLACE FUNCTION validate_journal_balance_on_post()
RETURNS TRIGGER AS $$
DECLARE
  v_total_debit NUMERIC;
  v_total_credit NUMERIC;
BEGIN
  -- Hanya validate saat transisi ke POSTED
  IF NEW.status = 'POSTED' AND (OLD.status IS DISTINCT FROM 'POSTED') THEN
    SELECT 
      COALESCE(SUM(debit), 0),
      COALESCE(SUM(credit), 0)
    INTO v_total_debit, v_total_credit
    FROM journal_lines
    WHERE entry_id = NEW.id;

    IF ABS(v_total_debit - v_total_credit) > 0.01 THEN
      RAISE EXCEPTION 'LEDGER INTEGRITY VIOLATION: Jurnal % tidak balance. Debit: %, Credit: %. Selisih: %',
        NEW.id, v_total_debit, v_total_credit, ABS(v_total_debit - v_total_credit);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_validate_journal_balance ON journal_entries;
CREATE TRIGGER trg_validate_journal_balance
  BEFORE UPDATE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION validate_journal_balance_on_post();

-- 3. MULTI-BRANCH INTERCOMPANY INFRASTRUCTURE
-- CTO requirement: Isi migration 1004 yang kosong
-- Intercompany elimination untuk mencegah "laba konsolidasi membengkak semu"

-- 3a. Intercompany Accounts Mapping
CREATE TABLE IF NOT EXISTS public.intercompany_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  -- GL account yang digunakan untuk transaksi antar-cabang
  due_from_account_id UUID REFERENCES accounts(id), -- Piutang antar-cabang (Aset)
  due_to_account_id UUID REFERENCES accounts(id),   -- Hutang antar-cabang (Liabilitas)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(org_id, branch_id)
);

COMMENT ON TABLE intercompany_accounts IS 
  'Mapping akun GL untuk transaksi antar-cabang. 
   "Due From" (Piutang Cabang A ke B) harus di-eliminate saat konsolidasi 
   agar tidak menggembungkan total aset konsolidasi secara semu.';

-- 3b. Intercompany Transactions Log
CREATE TABLE IF NOT EXISTS public.intercompany_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  from_branch_id UUID REFERENCES branches(id),
  to_branch_id UUID REFERENCES branches(id),
  journal_entry_id UUID REFERENCES journal_entries(id),
  amount NUMERIC(20, 2) NOT NULL,
  description TEXT,
  transaction_date DATE NOT NULL,
  is_eliminated BOOLEAN NOT NULL DEFAULT FALSE, -- Sudah di-eliminate di laporan konsolidasi?
  eliminated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN intercompany_transactions.is_eliminated IS 
  'Flag eliminasi untuk konsolidasi. Jika TRUE, transaksi ini dikecualikan dari 
   laporan konsolidasi agar laba tidak membengkak semu (CTO requirement).';

-- 3c. Consolidated Reporting View
-- View ini otomatis mengeliminasi transaksi antar-cabang
CREATE OR REPLACE VIEW v_consolidated_journal_entries AS
SELECT 
  je.*,
  b.name as branch_name
FROM journal_entries je
LEFT JOIN branches b ON je.branch_id = b.id
WHERE je.status = 'POSTED'
  -- Exclude intercompany legs that are marked as eliminated
  AND je.id NOT IN (
    SELECT journal_entry_id 
    FROM intercompany_transactions 
    WHERE is_eliminated = TRUE
    AND journal_entry_id IS NOT NULL
  );

-- RLS for new tables
ALTER TABLE public.intercompany_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intercompany_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members_view_intercompany_accounts" ON public.intercompany_accounts;
CREATE POLICY "members_view_intercompany_accounts" ON public.intercompany_accounts
  FOR SELECT USING (org_id IN (
    SELECT org_id FROM org_members WHERE user_id = auth.uid() AND is_active = TRUE
  ));

DROP POLICY IF EXISTS "admins_manage_intercompany_accounts" ON public.intercompany_accounts;
CREATE POLICY "admins_manage_intercompany_accounts" ON public.intercompany_accounts
  FOR ALL USING (org_id IN (
    SELECT org_id FROM org_members WHERE user_id = auth.uid() 
    AND role IN ('owner', 'admin') AND is_active = TRUE
  ));

DROP POLICY IF EXISTS "members_view_intercompany_tx" ON public.intercompany_transactions;
CREATE POLICY "members_view_intercompany_tx" ON public.intercompany_transactions
  FOR SELECT USING (org_id IN (
    SELECT org_id FROM org_members WHERE user_id = auth.uid() AND is_active = TRUE
  ));

DROP POLICY IF EXISTS "admins_manage_intercompany_tx" ON public.intercompany_transactions;
CREATE POLICY "admins_manage_intercompany_tx" ON public.intercompany_transactions
  FOR ALL USING (org_id IN (
    SELECT org_id FROM org_members WHERE user_id = auth.uid() 
    AND role IN ('owner', 'admin') AND is_active = TRUE
  ));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_intercompany_org ON intercompany_transactions(org_id);
CREATE INDEX IF NOT EXISTS idx_intercompany_eliminated ON intercompany_transactions(is_eliminated);
CREATE INDEX IF NOT EXISTS idx_journal_branch ON journal_entries(branch_id) WHERE branch_id IS NOT NULL;
