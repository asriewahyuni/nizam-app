-- ============================================================
-- MIGRATION 006: Bank Reconciliation & Mutasi (Phase 2 Continued)
-- Logic for uploading bank CSV statements and matching them.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- Table: bank_mutations
-- The raw rows from a bank CSV/Statement.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bank_mutations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  bank_account_id UUID NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
  mutation_date   DATE NOT NULL,
  description     TEXT NOT NULL,
  amount          NUMERIC(20, 2) NOT NULL, -- positive for IN, negative for OUT or use type
  type            cash_transaction_type NOT NULL,
  balance         NUMERIC(20, 2), -- running balance from bank
  is_matched      BOOLEAN NOT NULL DEFAULT FALSE,
  transaction_id  UUID REFERENCES bank_transactions(id) ON DELETE SET NULL, -- Link when matched
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bank_mutations_org_id ON bank_mutations(org_id);
CREATE INDEX idx_bank_mutations_account ON bank_mutations(bank_account_id);
CREATE INDEX idx_bank_mutations_matched ON bank_mutations(is_matched);

-- ─────────────────────────────────────────────────────────────
-- RLS: bank_mutations
-- ─────────────────────────────────────────────────────────────
ALTER TABLE bank_mutations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_can_view_bank_mutations"
  ON bank_mutations FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM org_members
      WHERE user_id = auth.uid() AND is_active = TRUE
    )
  );

CREATE POLICY "staff_can_manage_bank_mutations"
  ON bank_mutations FOR ALL
  USING (
    org_id IN (
      SELECT org_id FROM org_members
      WHERE user_id = auth.uid() 
        AND role IN ('owner', 'admin', 'manager', 'staff')
        AND is_active = TRUE
    )
  );
