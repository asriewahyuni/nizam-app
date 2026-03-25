-- ============================================================
-- MIGRATION 009: Fix Missing RLS Policies
-- Adding INSERT, UPDATE, DELETE policies for phase 3 tables
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- TABLE: contacts
-- ─────────────────────────────────────────────────────────────
CREATE POLICY "members_can_insert_contacts"
  ON contacts FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM org_members 
      WHERE user_id = auth.uid() AND is_active = TRUE
    )
  );

CREATE POLICY "members_can_update_contacts"
  ON contacts FOR UPDATE
  USING (
    org_id IN (
      SELECT org_id FROM org_members 
      WHERE user_id = auth.uid() AND is_active = TRUE
    )
  );

CREATE POLICY "members_can_delete_contacts"
  ON contacts FOR DELETE
  USING (
    org_id IN (
      SELECT org_id FROM org_members 
      WHERE user_id = auth.uid() AND is_active = TRUE
    )
  );

-- ─────────────────────────────────────────────────────────────
-- TABLE: purchases
-- ─────────────────────────────────────────────────────────────
CREATE POLICY "members_can_insert_purchases"
  ON purchases FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM org_members 
      WHERE user_id = auth.uid() AND is_active = TRUE
    )
  );

CREATE POLICY "members_can_update_purchases"
  ON purchases FOR UPDATE
  USING (
    org_id IN (
      SELECT org_id FROM org_members 
      WHERE user_id = auth.uid() AND is_active = TRUE
    )
  );

CREATE POLICY "members_can_delete_purchases"
  ON purchases FOR DELETE
  USING (
    org_id IN (
      SELECT org_id FROM org_members 
      WHERE user_id = auth.uid() AND is_active = TRUE
    )
  );

-- ─────────────────────────────────────────────────────────────
-- TABLE: sales
-- ─────────────────────────────────────────────────────────────
CREATE POLICY "members_can_insert_sales"
  ON sales FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM org_members 
      WHERE user_id = auth.uid() AND is_active = TRUE
    )
  );

CREATE POLICY "members_can_update_sales"
  ON sales FOR UPDATE
  USING (
    org_id IN (
      SELECT org_id FROM org_members 
      WHERE user_id = auth.uid() AND is_active = TRUE
    )
  );

CREATE POLICY "members_can_delete_sales"
  ON sales FOR DELETE
  USING (
    org_id IN (
      SELECT org_id FROM org_members 
      WHERE user_id = auth.uid() AND is_active = TRUE
    )
  );

-- ─────────────────────────────────────────────────────────────
-- TABLE: sales_items
-- Note: SELECT and ALL using nizam_has_permission already exists, 
-- but let's make sure INSERT is safe too if ALL doesn't cover it 
-- due to WITH CHECK evaluation.
-- Actually: 'FOR ALL' covers SELECT, INSERT, UPDATE, and DELETE.
-- WITH CHECK defaults to USING expression if omitted. 
-- So sales_items and purchase_items are already fully covered by:
-- CREATE POLICY ... ON sales_items FOR ALL USING (nizam_has_permission(...));
-- We only need to fix contacts, sales, purchases.
-- ─────────────────────────────────────────────────────────────
