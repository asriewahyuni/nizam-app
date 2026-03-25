-- 1021: Create reimbursement tables with correct policies + AI receipt detection columns
-- (replaces partial 1005 migration that may not have been applied to remote)

-- ==========================================
-- 1. Tabel reimbursements
-- ==========================================
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

DROP POLICY IF EXISTS "members_can_view_reimbursements"    ON reimbursements;
DROP POLICY IF EXISTS "users_can_create_reimbursements"    ON reimbursements;
DROP POLICY IF EXISTS "admins_can_update_reimbursements"   ON reimbursements;

CREATE POLICY "members_can_view_reimbursements"
  ON reimbursements FOR SELECT
  USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND is_active = TRUE));

CREATE POLICY "users_can_create_reimbursements"
  ON reimbursements FOR INSERT
  WITH CHECK (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND is_active = TRUE));

CREATE POLICY "admins_can_update_reimbursements"
  ON reimbursements FOR UPDATE
  USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'manager') AND is_active = TRUE));

-- ==========================================
-- 2. Tabel reimbursement_items
-- ==========================================
CREATE TABLE IF NOT EXISTS reimbursement_items (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reimbursement_id    UUID NOT NULL REFERENCES reimbursements(id) ON DELETE CASCADE,
  expense_date        DATE NOT NULL,
  category_account_id UUID NOT NULL REFERENCES accounts(id),
  description         TEXT NOT NULL,
  amount              NUMERIC(20, 2) NOT NULL,
  receipt_url         TEXT,
  -- AI receipt detection columns (prepared for future AI/OCR integration)
  ai_detected_amount  NUMERIC,          -- Amount auto-detected from receipt image
  ai_detected_vendor  TEXT,             -- Merchant/vendor name from receipt
  ai_detected_date    DATE,             -- Transaction date from receipt
  ai_confidence_score NUMERIC,          -- 0.0-1.0 confidence score of AI extraction
  ai_raw_text         TEXT,             -- Full OCR text dump for debugging
  ai_processed_at     TIMESTAMPTZ,      -- Timestamp of last AI processing
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE reimbursement_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members_can_view_reimbursement_items" ON reimbursement_items;
DROP POLICY IF EXISTS "users_can_manage_their_items"         ON reimbursement_items;
DROP POLICY IF EXISTS "users_can_insert_their_items"         ON reimbursement_items;
DROP POLICY IF EXISTS "users_can_modify_their_items"         ON reimbursement_items;
DROP POLICY IF EXISTS "users_can_delete_their_items"         ON reimbursement_items;

CREATE POLICY "members_can_view_reimbursement_items"
  ON reimbursement_items FOR SELECT
  USING (reimbursement_id IN (
    SELECT id FROM reimbursements
    WHERE org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND is_active = TRUE)
  ));

-- INSERT: must use WITH CHECK (not USING) for RLS on INSERT
CREATE POLICY "users_can_insert_their_items"
  ON reimbursement_items FOR INSERT
  WITH CHECK (reimbursement_id IN (
    SELECT id FROM reimbursements WHERE user_id = auth.uid() AND status = 'PENDING'
  ));

CREATE POLICY "users_can_modify_their_items"
  ON reimbursement_items FOR UPDATE
  USING (reimbursement_id IN (
    SELECT id FROM reimbursements WHERE user_id = auth.uid() AND status = 'PENDING'
  ));

CREATE POLICY "users_can_delete_their_items"
  ON reimbursement_items FOR DELETE
  USING (reimbursement_id IN (
    SELECT id FROM reimbursements WHERE user_id = auth.uid() AND status = 'PENDING'
  ));

