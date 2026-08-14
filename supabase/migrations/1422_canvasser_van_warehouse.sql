-- ==========================================
-- MIGRATION 1422: Canvasser van sebagai lokasi stok riil
-- Setiap van butuh "gudang virtual" sendiri agar stok yang dimuat ke van
-- bisa dimutasi dari gudang cabang (bukan sekadar angka JSON di
-- canvasser_sessions.opening_stock), dan stok itu benar-benar berkurang
-- saat canvasser mencatat order ke pelanggan (createOrder).
-- ==========================================

ALTER TABLE canvasser_vans
  ADD COLUMN IF NOT EXISTS warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL;

-- Backfill: buat 1 warehouse per van yang sudah ada dan belum punya warehouse_id.
DO $$
DECLARE
  v RECORD;
  new_wh_id UUID;
BEGIN
  FOR v IN
    SELECT id, org_id, branch_id, code, name
    FROM canvasser_vans
    WHERE warehouse_id IS NULL
  LOOP
    INSERT INTO warehouses (org_id, code, name, branch_id, is_active)
    VALUES (v.org_id, 'VAN-' || v.code, 'Van - ' || v.name, v.branch_id, true)
    RETURNING id INTO new_wh_id;

    UPDATE canvasser_vans SET warehouse_id = new_wh_id WHERE id = v.id;
  END LOOP;
END $$;
