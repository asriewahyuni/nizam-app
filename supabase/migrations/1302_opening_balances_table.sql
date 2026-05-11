-- 1302_opening_balances_table.sql
-- Opening balance system untuk setting saldo awal akun
-- Memudahkan UMKM yang pindah dari sistem lain

CREATE TABLE IF NOT EXISTS opening_balances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  amount NUMERIC(19,4) NOT NULL DEFAULT 0,
  period_id UUID REFERENCES fiscal_periods(id) ON DELETE CASCADE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_opening_balances_org ON opening_balances(org_id);
CREATE INDEX IF NOT EXISTS idx_opening_balances_period ON opening_balances(period_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_opening_balances_org_account_period 
  ON opening_balances(org_id, account_id) WHERE period_id IS NULL;

-- Function: apply opening balances as journal entry
CREATE OR REPLACE FUNCTION apply_opening_balances(p_org_id UUID, p_period_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_period_name TEXT;
  v_period_start DATE;
  v_entry_id UUID;
  v_total_debit NUMERIC := 0;
  v_total_credit NUMERIC := 0;
  v_entry_number TEXT;
BEGIN
  -- Cek apakah sudah pernah di-apply
  IF EXISTS (
    SELECT 1 FROM journal_entries
    WHERE org_id = p_org_id
      AND reference_type = 'OPENING_BALANCE'
      AND (p_period_id IS NULL OR reference_id = p_period_id)
      AND status = 'POSTED'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Opening balance sudah pernah di-apply. Tidak bisa duplicate.');
  END IF;

  -- Hitung total
  SELECT COALESCE(SUM(amount), 0) INTO v_total_debit
  FROM opening_balances
  WHERE org_id = p_org_id
    AND (p_period_id IS NULL OR period_id = p_period_id)
    AND amount > 0;

  SELECT COALESCE(SUM(ABS(amount)), 0) INTO v_total_credit
  FROM opening_balances
  WHERE org_id = p_org_id
    AND (p_period_id IS NULL OR period_id = p_period_id)
    AND amount < 0;

  IF ABS(v_total_debit - v_total_credit) > 1 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Opening balance tidak balance. Debit: ' || v_total_debit || ', Credit: ' || v_total_credit || ', Selisih: ' || ABS(v_total_debit - v_total_credit)
    );
  END IF;

  -- Buat entry number
  v_entry_number := 'OPN-BAL-' || to_char(now(), 'YYYYMMDD-HH24MISS');

  -- Buat journal entry
  INSERT INTO journal_entries (
    org_id, entry_number, entry_date, description,
    reference_type, status, is_auto, notes, posted_at
  ) VALUES (
    p_org_id, v_entry_number, CURRENT_DATE,
    'Opening Balance Saldo Awal',
    'OPENING_BALANCE', 'POSTED', TRUE,
    'Opening balance otomatis. Debit: ' || v_total_debit || ', Credit: ' || v_total_credit,
    now()
  ) RETURNING id INTO v_entry_id;

  -- Insert lines: amount positif → DEBIT, amount negatif → CREDIT
  INSERT INTO journal_lines (entry_id, account_id, debit, credit)
  SELECT
    v_entry_id,
    account_id,
    CASE WHEN amount > 0 THEN amount ELSE 0 END,
    CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END
  FROM opening_balances
  WHERE org_id = p_org_id
    AND (p_period_id IS NULL OR period_id = p_period_id)
    AND amount != 0;

  RETURN jsonb_build_object(
    'success', true,
    'entry_id', v_entry_id,
    'total_debit', v_total_debit,
    'total_credit', v_total_credit
  );
END;
$$;

-- Add OPENING_BALANCE to reference type enum
ALTER TYPE journal_reference_type ADD VALUE IF NOT EXISTS 'OPENING_BALANCE';
