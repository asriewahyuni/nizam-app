-- ============================================================
-- MIGRATION 004: Journal Entries (Double-Entry Ledger)
-- Foundation of all financial transactions in NIZAM.
-- Principle: Every financial event = balanced debit/credit pair.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- Enum: journal entry status
-- ─────────────────────────────────────────────────────────────
CREATE TYPE journal_status AS ENUM ('DRAFT', 'POSTED', 'VOIDED');

-- ─────────────────────────────────────────────────────────────
-- Enum: reference types (what triggered this entry)
-- Extensible — add new types as modules are added
-- ─────────────────────────────────────────────────────────────
CREATE TYPE journal_reference_type AS ENUM (
  'MANUAL',          -- Manual journal entry
  'CASH_IN',         -- Cash receipt
  'CASH_OUT',        -- Cash payment
  'SALE',            -- Sales invoice
  'PURCHASE',        -- Purchase order
  'GOODS_RECEIPT',   -- Inventory received
  'GOODS_SHIPMENT',  -- Inventory shipped
  'PAYMENT_IN',      -- Customer payment
  'PAYMENT_OUT',     -- Supplier payment
  'BANK_TRANSFER',   -- Inter-bank transfer
  'PAYROLL',         -- Staff salary
  'ADJUSTMENT',      -- Stock or value adjustment
  'TAX',             -- Tax payment / filing
  'DEPRECIATION'     -- Asset depreciation
);

-- ─────────────────────────────────────────────────────────────
-- Table: journal_entries (header)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS journal_entries (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entry_number    TEXT NOT NULL,        -- auto-generated: JE-2024-000001
  entry_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  description     TEXT NOT NULL,
  reference_type  journal_reference_type NOT NULL DEFAULT 'MANUAL',
  reference_id    UUID,                 -- FK to source document (sale_id, po_id, etc.)
  status          journal_status NOT NULL DEFAULT 'DRAFT',
  is_auto         BOOLEAN NOT NULL DEFAULT FALSE,  -- TRUE = system-generated
  notes           TEXT,
  created_by      UUID REFERENCES auth.users(id),
  posted_at       TIMESTAMPTZ,
  voided_at       TIMESTAMPTZ,
  voided_by       UUID REFERENCES auth.users(id),
  void_reason     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(org_id, entry_number)
);

CREATE INDEX idx_journal_entries_org_id ON journal_entries(org_id);
CREATE INDEX idx_journal_entries_entry_date ON journal_entries(entry_date);
CREATE INDEX idx_journal_entries_reference ON journal_entries(reference_type, reference_id);
CREATE INDEX idx_journal_entries_status ON journal_entries(status);

CREATE TRIGGER trg_journal_entries_updated_at
  BEFORE UPDATE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─────────────────────────────────────────────────────────────
-- Table: journal_lines (detail lines — the actual debits/credits)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS journal_lines (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entry_id    UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id  UUID NOT NULL REFERENCES accounts(id),
  debit       NUMERIC(20, 2) NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit      NUMERIC(20, 2) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  memo        TEXT,
  -- Either debit OR credit must be non-zero
  CONSTRAINT chk_debit_or_credit CHECK (debit > 0 OR credit > 0),
  CONSTRAINT chk_not_both CHECK (NOT (debit > 0 AND credit > 0))
);

CREATE INDEX idx_journal_lines_entry_id ON journal_lines(entry_id);
CREATE INDEX idx_journal_lines_account_id ON journal_lines(account_id);

-- ─────────────────────────────────────────────────────────────
-- Constraint: balanced entry (debit = credit) on POSTED status
-- Implemented as a trigger to allow line-by-line insertion
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION validate_journal_balance()
RETURNS TRIGGER AS $$
DECLARE
  v_total_debit  NUMERIC;
  v_total_credit NUMERIC;
BEGIN
  -- Only validate when posting (status changing to POSTED)
  IF NEW.status = 'POSTED' AND OLD.status != 'POSTED' THEN
    SELECT
      COALESCE(SUM(debit), 0),
      COALESCE(SUM(credit), 0)
    INTO v_total_debit, v_total_credit
    FROM journal_lines
    WHERE entry_id = NEW.id;

    -- Must have at least 2 lines
    IF (SELECT COUNT(*) FROM journal_lines WHERE entry_id = NEW.id) < 2 THEN
      RAISE EXCEPTION 'Journal entry must have at least 2 lines';
    END IF;

    -- Debit must equal credit
    IF ABS(v_total_debit - v_total_credit) > 0.01 THEN
      RAISE EXCEPTION 'Journal entry is not balanced: debit=% credit=%',
        v_total_debit, v_total_credit;
    END IF;

    -- Set posted_at timestamp
    NEW.posted_at = NOW();
  END IF;

  -- Voided entries cannot be modified
  IF OLD.status = 'VOIDED' THEN
    RAISE EXCEPTION 'Cannot modify a voided journal entry';
  END IF;

  -- Posted entries: only allow status change to VOIDED
  IF OLD.status = 'POSTED' AND NEW.status NOT IN ('VOIDED', 'POSTED') THEN
    RAISE EXCEPTION 'Cannot change a posted entry back to draft';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_journal_balance
  BEFORE UPDATE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION validate_journal_balance();

-- ─────────────────────────────────────────────────────────────
-- Function: auto-generate entry number (JE-YYYY-NNNNNN)
-- ─────────────────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS journal_entry_seq START 1;

CREATE OR REPLACE FUNCTION generate_entry_number(p_org_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_year  TEXT := TO_CHAR(NOW(), 'YYYY');
  v_count INT;
BEGIN
  SELECT COUNT(*) + 1 INTO v_count
  FROM journal_entries
  WHERE org_id = p_org_id
    AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW());

  RETURN 'JE-' || v_year || '-' || LPAD(v_count::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION set_entry_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.entry_number IS NULL OR NEW.entry_number = '' THEN
    NEW.entry_number = generate_entry_number(NEW.org_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_entry_number
  BEFORE INSERT ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION set_entry_number();

-- ─────────────────────────────────────────────────────────────
-- RLS: journal_entries
-- ─────────────────────────────────────────────────────────────
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_can_view_journal"
  ON journal_entries FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM org_members
      WHERE user_id = auth.uid() AND is_active = TRUE
    )
  );

CREATE POLICY "staff_can_create_draft_journal"
  ON journal_entries FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM org_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin', 'manager', 'staff')
        AND is_active = TRUE
    )
  );

CREATE POLICY "managers_can_post_or_void"
  ON journal_entries FOR UPDATE
  USING (
    org_id IN (
      SELECT org_id FROM org_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin', 'manager')
        AND is_active = TRUE
    )
  );

-- ─────────────────────────────────────────────────────────────
-- RLS: journal_lines
-- ─────────────────────────────────────────────────────────────
ALTER TABLE journal_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_can_view_journal_lines"
  ON journal_lines FOR SELECT
  USING (
    entry_id IN (
      SELECT je.id FROM journal_entries je
      JOIN org_members om ON om.org_id = je.org_id
      WHERE om.user_id = auth.uid() AND om.is_active = TRUE
    )
  );

CREATE POLICY "staff_can_manage_draft_lines"
  ON journal_lines FOR ALL
  USING (
    entry_id IN (
      SELECT je.id FROM journal_entries je
      JOIN org_members om ON om.org_id = je.org_id
      WHERE om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'manager', 'staff')
        AND om.is_active = TRUE
        AND je.status = 'DRAFT'
    )
  );

-- ─────────────────────────────────────────────────────────────
-- View: account_balances (running balance per account per org)
-- Used by dashboard and reports
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW account_balances AS
SELECT
  a.org_id,
  a.id AS account_id,
  a.code,
  a.name,
  a.type,
  a.normal_balance,
  COALESCE(SUM(jl.debit), 0)  AS total_debit,
  COALESCE(SUM(jl.credit), 0) AS total_credit,
  CASE
    WHEN a.normal_balance = 'DEBIT'
      THEN COALESCE(SUM(jl.debit), 0) - COALESCE(SUM(jl.credit), 0)
    ELSE
      COALESCE(SUM(jl.credit), 0) - COALESCE(SUM(jl.debit), 0)
  END AS balance
FROM accounts a
LEFT JOIN journal_lines jl ON jl.account_id = a.id
LEFT JOIN journal_entries je ON je.id = jl.entry_id AND je.status = 'POSTED'
WHERE a.is_active = TRUE
GROUP BY a.org_id, a.id, a.code, a.name, a.type, a.normal_balance;
