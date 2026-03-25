-- ============================================================
-- 048: Idempotency & Duplicate Prevention
-- Mencegah input berulang di level database (bukan hanya UI)
-- ============================================================

-- 1. UNIQUE constraint: mencegah 2 journal entry dengan reference yg sama di org yang sama
ALTER TABLE journal_entries 
  DROP CONSTRAINT IF EXISTS uq_journal_ref_per_org;

ALTER TABLE journal_entries
  ADD CONSTRAINT uq_journal_ref_per_org 
  UNIQUE (org_id, reference_type, reference_id)
  DEFERRABLE INITIALLY DEFERRED;

-- 2. UNIQUE pada payroll: satu periode hanya boleh 1 run per org
ALTER TABLE payroll_runs
  DROP CONSTRAINT IF EXISTS uq_payroll_period_per_org;

ALTER TABLE payroll_runs
  ADD CONSTRAINT uq_payroll_period_per_org
  UNIQUE (org_id, period_start, period_end)
  DEFERRABLE INITIALLY DEFERRED;

-- 3. UNIQUE pada budget: satu akun hanya boleh 1 budget per periode per org
ALTER TABLE budgets
  DROP CONSTRAINT IF EXISTS uq_budget_account_period;

ALTER TABLE budgets
  ADD CONSTRAINT uq_budget_account_period
  UNIQUE (org_id, account_id, period);

-- 4. PARTIAL INDEX: mencegah duplicate sales/purchase number per org
CREATE UNIQUE INDEX IF NOT EXISTS uq_sale_number_per_org
  ON sales (org_id, sale_number)
  WHERE status != 'VOIDED';

CREATE UNIQUE INDEX IF NOT EXISTS uq_purchase_number_per_org
  ON purchases (org_id, purchase_number)
  WHERE status != 'VOIDED';

-- 5. Prevent double payment for same invoice
-- sales_payments: tidak boleh total_paid melebihi grand_total
CREATE OR REPLACE FUNCTION check_sale_payment_limit()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_total numeric;
  v_grand_total numeric;
BEGIN
  SELECT grand_total INTO v_grand_total FROM sales WHERE id = NEW.sale_id;
  SELECT COALESCE(SUM(amount), 0) INTO v_total 
    FROM sales_payments 
    WHERE sale_id = NEW.sale_id AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

  IF (v_total + NEW.amount) > v_grand_total THEN
    RAISE EXCEPTION 'Pembayaran melebihi total faktur. Outstanding: %', (v_grand_total - v_total);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_sale_payment_limit ON sales_payments;
CREATE TRIGGER trg_check_sale_payment_limit
  BEFORE INSERT OR UPDATE ON sales_payments
  FOR EACH ROW EXECUTE FUNCTION check_sale_payment_limit();

-- purchase_payments: tidak boleh total_paid melebihi grand_total
CREATE OR REPLACE FUNCTION check_purchase_payment_limit()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_total numeric;
  v_grand_total numeric;
BEGIN
  SELECT grand_total INTO v_grand_total FROM purchases WHERE id = NEW.purchase_id;
  SELECT COALESCE(SUM(amount), 0) INTO v_total 
    FROM purchase_payments 
    WHERE purchase_id = NEW.purchase_id AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

  IF (v_total + NEW.amount) > v_grand_total THEN
    RAISE EXCEPTION 'Pembayaran melebihi total faktur. Outstanding: %', (v_grand_total - v_total);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_purchase_payment_limit ON purchase_payments;
CREATE TRIGGER trg_check_purchase_payment_limit
  BEFORE INSERT OR UPDATE ON purchase_payments
  FOR EACH ROW EXECUTE FUNCTION check_purchase_payment_limit();

-- 6. RLS: Pastikan semua tabel kritis punya RLS aktif dengan policy yg benar
-- journal_entries: user hanya bisa akses org mereka
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_isolation_journal_entries" ON journal_entries;
CREATE POLICY "org_isolation_journal_entries" ON journal_entries
  USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid()));

-- journal_lines: ikut isolasi via journal_entries
ALTER TABLE journal_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_isolation_journal_lines" ON journal_lines;
CREATE POLICY "org_isolation_journal_lines" ON journal_lines
  USING (entry_id IN (
    SELECT id FROM journal_entries 
    WHERE org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
  ));

-- accounts: user hanya lihat akun org mereka
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_isolation_accounts" ON accounts;
CREATE POLICY "org_isolation_accounts" ON accounts
  USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid()));

COMMENT ON TABLE journal_entries IS 'RLS enforced: org isolation guaranteed at DB level as of migration 048';
