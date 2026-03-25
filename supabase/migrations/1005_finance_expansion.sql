-- migration_1005_finance_expansion.sql

-- 1. Fiscal Periods for Closing
CREATE TABLE IF NOT EXISTS fiscal_periods (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name          TEXT NOT NULL, -- e.g. "Maret 2024"
  start_date    DATE NOT NULL,
  end_date      DATE NOT NULL,
  is_closed     BOOLEAN NOT NULL DEFAULT FALSE,
  closed_at     TIMESTAMPTZ,
  closed_by     UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(org_id, name)
);

ALTER TABLE fiscal_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_can_view_fiscal_periods"
  ON fiscal_periods FOR SELECT
  USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND is_active = TRUE));

CREATE POLICY "admins_can_manage_fiscal_periods"
  ON fiscal_periods FOR ALL
  USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'manager') AND is_active = TRUE));

-- 2. Reimbursements
CREATE TABLE IF NOT EXISTS reimbursements (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  claim_number  TEXT NOT NULL,
  user_id       UUID NOT NULL REFERENCES auth.users(id),
  description   TEXT NOT NULL,
  total_amount  NUMERIC(20, 2) NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'PENDING', -- PENDING, APPROVED, REJECTED, PAID
  notes         TEXT,
  journal_id    UUID REFERENCES journal_entries(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(org_id, claim_number)
);

ALTER TABLE reimbursements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_can_view_reimbursements"
  ON reimbursements FOR SELECT
  USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND is_active = TRUE));

CREATE POLICY "users_can_create_reimbursements"
  ON reimbursements FOR INSERT
  WITH CHECK (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND is_active = TRUE));

CREATE POLICY "admins_can_update_reimbursements"
  ON reimbursements FOR UPDATE
  USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'manager') AND is_active = TRUE));

CREATE TABLE IF NOT EXISTS reimbursement_items (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reimbursement_id  UUID NOT NULL REFERENCES reimbursements(id) ON DELETE CASCADE,
  expense_date      DATE NOT NULL,
  category_account_id UUID NOT NULL REFERENCES accounts(id),
  description       TEXT NOT NULL,
  amount            NUMERIC(20, 2) NOT NULL,
  receipt_url       TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE reimbursement_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_can_view_reimbursement_items"
  ON reimbursement_items FOR SELECT
  USING (reimbursement_id IN (SELECT id FROM reimbursements WHERE org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND is_active = TRUE)));

CREATE POLICY "users_can_manage_their_items"
  ON reimbursement_items FOR ALL
  USING (reimbursement_id IN (SELECT id FROM reimbursements WHERE user_id = auth.uid() AND status = 'PENDING'));

-- 3. Trigger to prevent modification in closed periods
CREATE OR REPLACE FUNCTION check_closed_period()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM fiscal_periods
    WHERE org_id = NEW.org_id
      AND is_closed = TRUE
      AND NEW.entry_date BETWEEN start_date AND end_date
  ) THEN
    RAISE EXCEPTION 'Transaction is within a closed fiscal period and cannot be modified.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_journal_closed_period
  BEFORE INSERT OR UPDATE OR DELETE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION check_closed_period();
