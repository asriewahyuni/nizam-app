-- ==========================================
-- MIGRATION 1417: Workshop Fleet Mode
-- Extends the commercial Workshop module (bengkel motor) with an internal-fleet
-- mode: vehicles owned by the org itself (linked to fixed_assets), work orders
-- for internal fleet don't generate customer invoices — instead their cost is
-- auto-journaled as a maintenance expense.
-- ==========================================

ALTER TABLE workshop_vehicles
  ADD COLUMN IF NOT EXISTS fixed_asset_id UUID REFERENCES fixed_assets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS vehicle_category VARCHAR(20) NOT NULL DEFAULT 'EXTERNAL';
  -- EXTERNAL (default, bengkel komersial) | INTERNAL (armada milik perusahaan)

ALTER TABLE workshop_work_orders
  ADD COLUMN IF NOT EXISTS maintenance_cost_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_internal BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_workshop_vehicles_fixed_asset
  ON workshop_vehicles(fixed_asset_id)
  WHERE fixed_asset_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_workshop_vehicles_category
  ON workshop_vehicles(org_id, vehicle_category);

-- Fix pre-existing latent bug: postWorkshopJournal() (workshop.actions.ts) has always
-- posted with reference_type='WORKSHOP', which was never a valid journal_reference_type
-- enum value — every commercial-workshop DISERAHKAN journal has been silently failing
-- (caught + console.error'd, never surfaced to the user). Add it now, plus the new
-- internal-fleet maintenance reference type used by completeInternalWorkOrder().
ALTER TYPE journal_reference_type ADD VALUE IF NOT EXISTS 'WORKSHOP';
ALTER TYPE journal_reference_type ADD VALUE IF NOT EXISTS 'WORKSHOP_INTERNAL_MAINTENANCE';
