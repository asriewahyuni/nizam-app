-- ============================================================
-- MIGRATION 005: Cash & Bank Management
-- Phase 2 of NIZAM ERP Roadmap.
-- Manages multiple bank accounts and cash flow transactions.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- Enum: transaction type (In/Out)
-- ─────────────────────────────────────────────────────────────
CREATE TYPE cash_transaction_type AS ENUM ('IN', 'OUT');

-- ─────────────────────────────────────────────────────────────
-- Table: bank_accounts
-- Links specific bank details to an accounting GL account.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bank_accounts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  account_id      UUID NOT NULL REFERENCES accounts(id), -- Pointer to the Ledger Account (ASSET)
  bank_name       TEXT NOT NULL,            -- e.g. "BCA", "Mandiri", "Petty Cash"
  account_number  TEXT,                     -- null for petty cash
  account_holder  TEXT,                     -- null for petty cash
  currency        TEXT NOT NULL DEFAULT 'IDR',
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(org_id, account_number)
);

CREATE INDEX idx_bank_accounts_org_id ON bank_accounts(org_id);
CREATE INDEX idx_bank_accounts_account_id ON bank_accounts(account_id);

CREATE TRIGGER trg_bank_accounts_updated_at
  BEFORE UPDATE ON bank_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─────────────────────────────────────────────────────────────
-- Table: bank_transactions
-- Records physical cash/bank movements before/during GL posting.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bank_transactions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id            UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  bank_account_id   UUID NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
  transaction_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  description       TEXT NOT NULL,
  amount            NUMERIC(20, 2) NOT NULL CHECK (amount > 0),
  type              cash_transaction_type NOT NULL,
  reference_number  TEXT,                 -- Check number, slip ID, etc.
  category_id       UUID REFERENCES accounts(id), -- Opposite Ledger Account (e.g. Expense, Revenue)
  journal_entry_id  UUID REFERENCES journal_entries(id) ON DELETE SET NULL, -- Link to GL
  status            TEXT NOT NULL DEFAULT 'POSTED', -- Status: DRAFT, POSTED, RECONCILED
  created_by        UUID REFERENCES auth.users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bank_transactions_org_id ON bank_transactions(org_id);
CREATE INDEX idx_bank_transactions_bank_account ON bank_transactions(bank_account_id);
CREATE INDEX idx_bank_transactions_date ON bank_transactions(transaction_date);

CREATE TRIGGER trg_bank_transactions_updated_at
  BEFORE UPDATE ON bank_transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─────────────────────────────────────────────────────────────
-- Function: auto_journal_bank_transaction
-- Automatically creates a double-entry journal when a bank transaction is posted.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION auto_journal_bank_transaction()
RETURNS TRIGGER AS $$
DECLARE
  v_je_id UUID;
  v_bank_gl_account_id UUID;
  v_opp_gl_account_id UUID;
  v_ref_type journal_reference_type;
BEGIN
  -- 1. Get the GL Account ID for the bank account
  SELECT account_id INTO v_bank_gl_account_id FROM bank_accounts WHERE id = NEW.bank_account_id;
  
  -- 2. Use category_id as the opposite account (Revenue/Expense/etc.)
  v_opp_gl_account_id := NEW.category_id;
  
  -- If category_id is NULL, we might not be able to auto-journal perfectly, 
  -- but usually for simple cash in/out it's required in the UI.
  IF v_opp_gl_account_id IS NULL THEN
    RETURN NEW; -- Or raise exception depending on business rule
  END IF;

  -- 3. Determine Journal Reference Type
  IF NEW.type = 'IN' THEN
    v_ref_type := 'CASH_IN';
  ELSE
    v_ref_type := 'CASH_OUT';
  END IF;

  -- 4. Create Journal Entry Header
  INSERT INTO journal_entries (
    org_id, 
    entry_date, 
    description, 
    reference_type, 
    reference_id, 
    status, 
    is_auto,
    created_by
  ) VALUES (
    NEW.org_id,
    NEW.transaction_date,
    NEW.description,
    v_ref_type,
    NEW.id,
    'POSTED', -- Auto-post for simple transactions
    TRUE,
    NEW.created_by
  ) RETURNING id INTO v_je_id;

  -- 5. Create Journal Lines (Double-Entry)
  -- If CASH_IN: Debit Bank (+), Credit Category (-)
  -- If CASH_OUT: Credit Bank (-), Debit Category (+)
  IF NEW.type = 'IN' THEN
    -- Debit Bank
    INSERT INTO journal_lines (entry_id, account_id, debit, credit, memo)
    VALUES (v_je_id, v_bank_gl_account_id, NEW.amount, 0, NEW.description);
    
    -- Credit Category (Revenue / Liability / etc)
    INSERT INTO journal_lines (entry_id, account_id, debit, credit, memo)
    VALUES (v_je_id, v_opp_gl_account_id, 0, NEW.amount, NEW.description);
  ELSE
    -- Debit Category (Expense / Asset / etc)
    INSERT INTO journal_lines (entry_id, account_id, debit, credit, memo)
    VALUES (v_je_id, v_opp_gl_account_id, NEW.amount, 0, NEW.description);
    
    -- Credit Bank
    INSERT INTO journal_lines (entry_id, account_id, debit, credit, memo)
    VALUES (v_je_id, v_bank_gl_account_id, 0, NEW.amount, NEW.description);
  END IF;

  -- 6. Link back to Bank Transaction
  NEW.journal_entry_id := v_je_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to run auto-journal on INSERT (if status is POSTED)
CREATE TRIGGER trg_bank_transaction_auto_journal
  BEFORE INSERT ON bank_transactions
  FOR EACH ROW
  WHEN (NEW.status = 'POSTED')
  EXECUTE FUNCTION auto_journal_bank_transaction();

-- ─────────────────────────────────────────────────────────────
-- RLS: bank_accounts
-- ─────────────────────────────────────────────────────────────
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_can_view_bank_accounts"
  ON bank_accounts FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM org_members
      WHERE user_id = auth.uid() AND is_active = TRUE
    )
  );

CREATE POLICY "admins_can_manage_bank_accounts"
  ON bank_accounts FOR ALL
  USING (
    org_id IN (
      SELECT org_id FROM org_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'manager') AND is_active = TRUE
    )
  );

-- ─────────────────────────────────────────────────────────────
-- RLS: bank_transactions
-- ─────────────────────────────────────────────────────────────
ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_can_view_bank_transactions"
  ON bank_transactions FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM org_members
      WHERE user_id = auth.uid() AND is_active = TRUE
    )
  );

CREATE POLICY "staff_can_create_bank_transactions"
  ON bank_transactions FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM org_members
      WHERE user_id = auth.uid() 
        AND role IN ('owner', 'admin', 'manager', 'staff')
        AND is_active = TRUE
    )
  );
