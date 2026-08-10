-- ==========================================
-- MIGRATION 1419: Canvasser customer-to-van assignment
-- Lets a customer/outlet be permanently assigned to a canvasser van (matching
-- real-world sales-rep territory assignment), so the "Tambah Kunjungan" outlet
-- picker can default to a van's own customer list instead of the full org list.
-- ==========================================

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS assigned_van_id UUID REFERENCES canvasser_vans(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_assigned_van
  ON contacts(assigned_van_id)
  WHERE assigned_van_id IS NOT NULL;
