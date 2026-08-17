-- =============================================================================
-- 1428_klinik_pratama_apotek.sql
-- Modul Klinik Pratama — Fase 3 (Apotek): resep obat + dispensing dengan
-- batch/expiry wajib sejak hari pertama (retrofit batch di kemudian hari
-- tidak mungkin dilakukan benar — lihat unique index inventory_stocks yang
-- men-COALESCE batch_number, supabase/migrations/1049_inventory_wms_helpers.sql).
--
-- process_klinik_dispensing() HANYA menangani sisi FISIK (potong stok per
-- batch FEFO + catat stock_movements) — TIDAK memposting jurnal apapun.
-- Jurnal HPP diposting terpisah dari layer TS (lib/erp-bridge/klinik-journals.ts)
-- SETELAH RPC ini sukses. Alasannya: trigger check_closed_period()
-- (1423_fiscal_period_explicit_link.sql) bisa RAISE EXCEPTION untuk periode
-- fiskal tertutup — kalau jurnal ada di dalam RPC yang sama dengan
-- pengurangan stok, exception itu akan me-rollback pengurangan stok juga,
-- artinya penutupan buku bulan lalu bisa memblokir pemberian obat ke pasien
-- hari ini. Tidak bisa diterima di fasilitas kesehatan.
--
-- Obat kadaluarsa (expiry_date < CURRENT_DATE) di-skip permanen dalam
-- pemilihan batch FEFO — RPC ini TIDAK PERNAH men-dispensing batch kadaluarsa,
-- bahkan kalau itu satu-satunya stok tersisa (RAISE EXCEPTION, staf harus
-- lakukan write-off/adjustment obat ED secara eksplisit lewat modul
-- Inventori, bukan lewat dispensing pasien).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.klinik_resep (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  kunjungan_id UUID NOT NULL REFERENCES public.klinik_kunjungan(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
  staf_medis_id UUID REFERENCES public.klinik_staf_medis(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'DISPENSED', 'BATAL')),
  catatan TEXT,
  dispensed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_klinik_resep_kunjungan ON public.klinik_resep (kunjungan_id);
CREATE INDEX IF NOT EXISTS idx_klinik_resep_branch_status ON public.klinik_resep (branch_id, status);

CREATE TABLE IF NOT EXISTS public.klinik_resep_detail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resep_id UUID NOT NULL REFERENCES public.klinik_resep(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  jumlah NUMERIC(15, 2) NOT NULL CHECK (jumlah > 0),
  dosis TEXT,
  -- Diisi otomatis oleh process_klinik_dispensing() saat dispensing — batch
  -- terakhir yang disentuh kalau 1 item span >1 batch (jejak lengkap per
  -- batch tetap ada di stock_movements.reference_id = resep.id; pemecahan
  -- baris per-batch di klinik_resep_detail ditunda ke fase berikutnya).
  batch_number TEXT,
  expiry_date DATE,
  avg_cost_snapshot NUMERIC(15, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_klinik_resep_detail_resep ON public.klinik_resep_detail (resep_id);

CREATE OR REPLACE FUNCTION public.process_klinik_dispensing(
  p_org_id UUID,
  p_resep_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_resep RECORD;
  v_item RECORD;
  v_stock RECORD;
  v_remaining NUMERIC;
  v_take NUMERIC;
  v_total_hpp NUMERIC := 0;
  v_avg_cost NUMERIC;
BEGIN
  SELECT id, org_id, branch_id, warehouse_id, status
  INTO v_resep
  FROM public.klinik_resep
  WHERE id = p_resep_id AND org_id = p_org_id
  FOR UPDATE;

  IF v_resep.id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Resep tidak ditemukan.');
  END IF;

  IF v_resep.status = 'DISPENSED' THEN
    RETURN jsonb_build_object('success', TRUE, 'already_dispensed', TRUE, 'total_hpp', 0);
  END IF;

  IF v_resep.status = 'BATAL' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Resep sudah dibatalkan.');
  END IF;

  FOR v_item IN
    SELECT id, product_id, jumlah FROM public.klinik_resep_detail WHERE resep_id = p_resep_id FOR UPDATE
  LOOP
    v_remaining := v_item.jumlah;

    SELECT COALESCE(average_cost, 0) INTO v_avg_cost FROM public.products WHERE id = v_item.product_id;

    -- FEFO: batch dengan expiry_date paling awal duluan. Batch tanpa
    -- expiry_date (NULL) diperlakukan "tidak pernah kadaluarsa" tapi tetap
    -- diprioritaskan belakangan (NULLS LAST) supaya batch yang punya
    -- tanggal ED selalu habis duluan.
    FOR v_stock IN
      SELECT id, batch_number, expiry_date, quantity
      FROM public.inventory_stocks
      WHERE org_id = p_org_id AND product_id = v_item.product_id AND warehouse_id = v_resep.warehouse_id
        AND quantity > 0
      ORDER BY expiry_date ASC NULLS LAST, created_at ASC
      FOR UPDATE
    LOOP
      EXIT WHEN v_remaining <= 0;

      -- Blok keras: batch kadaluarsa TIDAK PERNAH di-dispensing ke pasien,
      -- walau itu satu-satunya stok tersisa. Ini risiko keselamatan pasien,
      -- bukan sekadar aturan akuntansi.
      IF v_stock.expiry_date IS NOT NULL AND v_stock.expiry_date < CURRENT_DATE THEN
        CONTINUE;
      END IF;

      v_take := LEAST(v_remaining, v_stock.quantity);
      IF v_take <= 0 THEN CONTINUE; END IF;

      PERFORM public.adjust_inventory_stock(p_org_id, v_item.product_id, v_resep.warehouse_id, -v_take, v_stock.batch_number, NULL);

      INSERT INTO public.stock_movements
        (org_id, branch_id, product_id, movement_date, quantity, unit_price, reference_type, reference_id, notes)
      VALUES
        (p_org_id, v_resep.branch_id, v_item.product_id, NOW(), -v_take, v_avg_cost, 'KLINIK_RESEP', p_resep_id,
         'Dispensing resep ' || p_resep_id::text || ' batch ' || COALESCE(v_stock.batch_number, '(tanpa batch)'));

      UPDATE public.klinik_resep_detail
      SET batch_number = v_stock.batch_number, expiry_date = v_stock.expiry_date, avg_cost_snapshot = v_avg_cost
      WHERE id = v_item.id;

      v_total_hpp := v_total_hpp + (v_take * v_avg_cost);
      v_remaining := v_remaining - v_take;
    END LOOP;

    IF v_remaining > 0 THEN
      RAISE EXCEPTION 'Stok obat tidak cukup atau seluruh batch tersisa sudah kadaluarsa (product_id=%). Kurang % unit.', v_item.product_id, v_remaining;
    END IF;
  END LOOP;

  UPDATE public.klinik_resep SET status = 'DISPENSED', dispensed_at = NOW(), updated_at = NOW() WHERE id = p_resep_id;

  RETURN jsonb_build_object('success', TRUE, 'already_dispensed', FALSE, 'total_hpp', v_total_hpp);
END;
$$;

NOTIFY pgrst, 'reload schema';
