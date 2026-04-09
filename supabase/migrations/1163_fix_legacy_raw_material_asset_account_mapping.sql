-- ============================================================
-- MIGRATION 1163: Fix legacy generic inventory account mapping
-- ============================================================
-- Why:
-- Some products were already assigned to account 1301 (Persediaan Barang
-- Dagangan) before category-based inventory segmentation was introduced.
-- When those products were later categorized as Bahan / Setengah Jadi /
-- Siap Jual, the old asset_account_id remained 1301 because it was non-null.
--
-- Result:
-- Purchasing could still debit 1301 even though the product was labeled
-- as raw material or other segmented inventory category.
--
-- This migration:
-- 1. upgrades the default trigger so legacy 1301 can be replaced by the
--    proper segmented inventory account based on category,
-- 2. backfills existing products that are still stuck on 1301.
-- ============================================================

CREATE OR REPLACE FUNCTION public.apply_inventory_asset_account_default()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target_code TEXT := '1301';
  v_account_id UUID;
  v_existing_account_code TEXT;
BEGIN
  IF COALESCE(NEW.type::TEXT, 'INVENTORY') <> 'INVENTORY' THEN
    RETURN NEW;
  END IF;

  IF NEW.category = 'Setengah Jadi' THEN
    v_target_code := '1302';
  ELSIF NEW.category IN ('Bahan', 'Pelengkap') THEN
    v_target_code := '1303';
  ELSIF NEW.category = 'Siap Jual' THEN
    v_target_code := '1304';
  END IF;

  IF NEW.asset_account_id IS NOT NULL THEN
    SELECT code
    INTO v_existing_account_code
    FROM public.accounts
    WHERE id = NEW.asset_account_id
      AND org_id = NEW.org_id
    LIMIT 1;

    IF COALESCE(v_existing_account_code, '') <> '1301' OR v_target_code = '1301' THEN
      RETURN NEW;
    END IF;
  END IF;

  SELECT id
  INTO v_account_id
  FROM public.accounts
  WHERE org_id = NEW.org_id
    AND code = v_target_code
  LIMIT 1;

  IF v_account_id IS NULL THEN
    SELECT id
    INTO v_account_id
    FROM public.accounts
    WHERE org_id = NEW.org_id
      AND type = 'ASSET'
    ORDER BY code
    LIMIT 1;
  END IF;

  NEW.asset_account_id := v_account_id;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  UPDATE public.products p
  SET asset_account_id = target.id
  FROM public.accounts current_acc,
       public.accounts target
  WHERE COALESCE(p.type::TEXT, 'INVENTORY') = 'INVENTORY'
    AND current_acc.id = p.asset_account_id
    AND current_acc.org_id = p.org_id
    AND current_acc.code = '1301'
    AND target.org_id = p.org_id
    AND target.code = CASE
      WHEN p.category = 'Setengah Jadi' THEN '1302'
      WHEN p.category IN ('Bahan', 'Pelengkap') THEN '1303'
      WHEN p.category = 'Siap Jual' THEN '1304'
      ELSE '1301'
    END
    AND target.code <> '1301';
END;
$$;

NOTIFY pgrst, 'reload schema';
