-- ============================================================
-- MIGRATION 1102: Fixed Assets Branch Context
-- Make fixed assets and depreciation logs aware of active
-- branch/unit and keep asset journals aligned to the same scope.
-- ============================================================

ALTER TABLE public.fixed_assets
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;

ALTER TABLE public.asset_depreciation_logs
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_fixed_assets_org_branch_status
  ON public.fixed_assets(org_id, branch_id, status, purchase_date DESC);

CREATE INDEX IF NOT EXISTS idx_asset_depreciation_logs_org_branch_period
  ON public.asset_depreciation_logs(org_id, branch_id, period_date DESC);

UPDATE public.fixed_assets fa
SET branch_id = public.resolve_single_active_branch(fa.org_id)
WHERE fa.branch_id IS NULL;

UPDATE public.asset_depreciation_logs adl
SET branch_id = fa.branch_id
FROM public.fixed_assets fa
WHERE adl.asset_id = fa.id
  AND (adl.branch_id IS NULL OR adl.branch_id IS DISTINCT FROM fa.branch_id)
  AND fa.branch_id IS NOT NULL;

UPDATE public.journal_entries je
SET branch_id = fa.branch_id
FROM public.fixed_assets fa
WHERE je.reference_id = fa.id
  AND je.reference_type IN ('ADJUSTMENT', 'DEPRECIATION')
  AND fa.branch_id IS NOT NULL
  AND (je.branch_id IS NULL OR je.branch_id IS DISTINCT FROM fa.branch_id);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.fixed_assets
    WHERE branch_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Unresolved branch_id remains on fixed_assets.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.asset_depreciation_logs
    WHERE branch_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Unresolved branch_id remains on asset_depreciation_logs.';
  END IF;
END $$;

ALTER TABLE public.fixed_assets
  ALTER COLUMN branch_id SET NOT NULL;

ALTER TABLE public.asset_depreciation_logs
  ALTER COLUMN branch_id SET NOT NULL;

ALTER TABLE public.asset_depreciation_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members_can_view_assets" ON public.fixed_assets;
CREATE POLICY "members_can_view_assets"
  ON public.fixed_assets FOR SELECT
  USING (
    org_id IN (SELECT get_my_org_ids())
    AND public.can_access_branch(org_id, branch_id)
  );

DROP POLICY IF EXISTS "admins_can_manage_assets" ON public.fixed_assets;
CREATE POLICY "admins_can_manage_assets"
  ON public.fixed_assets FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.org_members om
      WHERE om.org_id = fixed_assets.org_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'manager')
        AND om.is_active = TRUE
    )
    AND public.can_access_branch(org_id, branch_id)
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.org_members om
      WHERE om.org_id = fixed_assets.org_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'manager')
        AND om.is_active = TRUE
    )
    AND public.can_access_branch(org_id, branch_id)
  );

DROP POLICY IF EXISTS "members_can_view_asset_depreciation_logs" ON public.asset_depreciation_logs;
CREATE POLICY "members_can_view_asset_depreciation_logs"
  ON public.asset_depreciation_logs FOR SELECT
  USING (
    org_id IN (SELECT get_my_org_ids())
    AND public.can_access_branch(org_id, branch_id)
  );

DROP POLICY IF EXISTS "admins_can_manage_asset_depreciation_logs" ON public.asset_depreciation_logs;
CREATE POLICY "admins_can_manage_asset_depreciation_logs"
  ON public.asset_depreciation_logs FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.org_members om
      WHERE om.org_id = asset_depreciation_logs.org_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'manager')
        AND om.is_active = TRUE
    )
    AND public.can_access_branch(org_id, branch_id)
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.org_members om
      WHERE om.org_id = asset_depreciation_logs.org_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'manager')
        AND om.is_active = TRUE
    )
    AND public.can_access_branch(org_id, branch_id)
  );

CREATE OR REPLACE FUNCTION public.set_asset_depreciation_log_branch_context()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_asset_org_id UUID;
  v_asset_branch_id UUID;
BEGIN
  SELECT org_id, branch_id
  INTO v_asset_org_id, v_asset_branch_id
  FROM public.fixed_assets
  WHERE id = NEW.asset_id;

  IF v_asset_org_id IS NULL OR v_asset_branch_id IS NULL THEN
    RAISE EXCEPTION 'Aset untuk log penyusutan tidak valid.';
  END IF;

  NEW.org_id := v_asset_org_id;
  NEW.branch_id := v_asset_branch_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_asset_depreciation_log_branch_context ON public.asset_depreciation_logs;
CREATE TRIGGER trg_asset_depreciation_log_branch_context
  BEFORE INSERT OR UPDATE ON public.asset_depreciation_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_asset_depreciation_log_branch_context();

CREATE OR REPLACE FUNCTION public.process_asset_disposal(
    p_org_id UUID,
    p_asset_id UUID,
    p_sale_price DECIMAL,
    p_sale_date DATE,
    p_cash_account_id UUID,
    p_notes TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_asset RECORD;
    v_je_id UUID;
    v_book_value DECIMAL;
    v_gain_loss DECIMAL;
    acc_gain UUID;
    acc_loss UUID;
BEGIN
    SELECT * INTO v_asset FROM public.fixed_assets WHERE id = p_asset_id AND org_id = p_org_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Aset tidak ditemukan.');
    END IF;
    IF v_asset.status = 'DISPOSED' OR v_asset.status = 'SOLD' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Aset ini sudah pernah dilepas/dijual sebelumnya.');
    END IF;

    v_book_value := COALESCE(v_asset.current_book_value, 0);
    v_gain_loss := p_sale_price - v_book_value;

    SELECT id INTO acc_gain FROM public.accounts WHERE org_id = p_org_id AND code = '7001' LIMIT 1;
    SELECT id INTO acc_loss FROM public.accounts WHERE org_id = p_org_id AND code = '7002' LIMIT 1;

    IF acc_gain IS NULL THEN
        INSERT INTO public.accounts (org_id, code, name, type, normal_balance, is_active)
        VALUES (p_org_id, '7001', 'Keuntungan Pelepasan Aset', 'REVENUE', 'CREDIT', true)
        RETURNING id INTO acc_gain;
    END IF;
    IF acc_loss IS NULL THEN
        INSERT INTO public.accounts (org_id, code, name, type, normal_balance, is_active)
        VALUES (p_org_id, '7002', 'Kerugian Pelepasan Aset', 'EXPENSE', 'DEBIT', true)
        RETURNING id INTO acc_loss;
    END IF;

    INSERT INTO public.journal_entries (org_id, branch_id, entry_date, description, reference_type, reference_id, status)
    VALUES (
        p_org_id,
        v_asset.branch_id,
        p_sale_date,
        COALESCE(p_notes, 'Pelepasan Aset: ' || v_asset.name),
        'ADJUSTMENT',
        p_asset_id,
        'POSTED'
    )
    RETURNING id INTO v_je_id;

    IF COALESCE(v_asset.accumulated_depreciation, 0) > 0 AND v_asset.accum_dep_account_id IS NOT NULL THEN
        INSERT INTO public.journal_lines (entry_id, account_id, debit, credit)
        VALUES (v_je_id, v_asset.accum_dep_account_id, v_asset.accumulated_depreciation, 0);
    END IF;

    IF p_sale_price > 0 THEN
        INSERT INTO public.journal_lines (entry_id, account_id, debit, credit)
        VALUES (v_je_id, p_cash_account_id, p_sale_price, 0);
    END IF;

    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit)
    VALUES (v_je_id, v_asset.asset_account_id, 0, v_asset.purchase_price);

    IF v_gain_loss > 0 THEN
        INSERT INTO public.journal_lines (entry_id, account_id, debit, credit)
        VALUES (v_je_id, acc_gain, 0, v_gain_loss);
    ELSIF v_gain_loss < 0 THEN
        INSERT INTO public.journal_lines (entry_id, account_id, debit, credit)
        VALUES (v_je_id, acc_loss, ABS(v_gain_loss), 0);
    END IF;

    UPDATE public.fixed_assets
    SET status = 'SOLD',
        current_book_value = 0,
        updated_at = NOW()
    WHERE id = p_asset_id;

    RETURN jsonb_build_object(
        'success', true,
        'journal_entry_id', v_je_id,
        'book_value', v_book_value,
        'sale_price', p_sale_price,
        'gain_loss', v_gain_loss
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

CREATE OR REPLACE VIEW public.fixed_asset_branch_backfill_audit AS
SELECT
  'fixed_assets'::TEXT AS source_table,
  fa.org_id,
  NULL::TEXT AS reference_type,
  COUNT(*)::BIGINT AS unresolved_count
FROM public.fixed_assets fa
WHERE fa.branch_id IS NULL
GROUP BY fa.org_id

UNION ALL

SELECT
  'asset_depreciation_logs'::TEXT AS source_table,
  adl.org_id,
  NULL::TEXT AS reference_type,
  COUNT(*)::BIGINT AS unresolved_count
FROM public.asset_depreciation_logs adl
WHERE adl.branch_id IS NULL
GROUP BY adl.org_id

UNION ALL

SELECT
  'journal_entries'::TEXT AS source_table,
  fa.org_id,
  je.reference_type::TEXT AS reference_type,
  COUNT(*)::BIGINT AS unresolved_count
FROM public.journal_entries je
JOIN public.fixed_assets fa ON fa.id = je.reference_id
WHERE je.reference_type IN ('ADJUSTMENT', 'DEPRECIATION')
  AND je.branch_id IS DISTINCT FROM fa.branch_id
GROUP BY fa.org_id, je.reference_type;

NOTIFY pgrst, 'reload schema';
