-- ============================================================
-- MIGRATION 1155: Keep One Branch During Full Organization Reset
-- ============================================================
-- Problem:
-- - Mode reset all_data sebelumnya menghapus seluruh branches.
-- - Sejak accounts.managed_branch_id wajib mengarah ke branches(id),
--   reset penuh bisa gagal dengan FK violation.
--
-- Goal:
-- - Tetap hapus data operasional/master seperti sebelumnya.
-- - Sisakan atau buat ulang satu branch default "Unit Utama".
-- - Rebind accounts.managed_branch_id ke branch yang dipertahankan.

CREATE OR REPLACE FUNCTION public.reset_org_data(
  p_org_id UUID,
  p_mode TEXT DEFAULT 'transactions'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_user_role TEXT;
  v_mode TEXT := COALESCE(NULLIF(trim(p_mode), ''), 'transactions');
  v_preserved_branch_id UUID;
BEGIN
  SELECT role INTO v_user_role
  FROM public.org_members
  WHERE org_id = p_org_id
    AND user_id = v_user_id
    AND is_active = TRUE
  LIMIT 1;

  IF v_user_role <> 'owner' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Unauthorized: only owner can reset data.');
  END IF;

  IF v_mode NOT IN ('transactions', 'all_data') THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Invalid reset mode.');
  END IF;

  DELETE FROM public.approval_requests WHERE org_id = p_org_id;
  DELETE FROM public.intercompany_transactions WHERE org_id = p_org_id;
  DELETE FROM public.bank_mutations WHERE org_id = p_org_id;
  DELETE FROM public.bank_transactions WHERE org_id = p_org_id;
  DELETE FROM public.inventory_transfers WHERE org_id = p_org_id;
  DELETE FROM public.inventory_adjustments WHERE org_id = p_org_id;
  DELETE FROM public.payroll_runs WHERE org_id = p_org_id;
  DELETE FROM public.expense_claims WHERE org_id = p_org_id;
  DELETE FROM public.reimbursements WHERE org_id = p_org_id;
  DELETE FROM public.attendance WHERE org_id = p_org_id;
  DELETE FROM public.leave_requests WHERE org_id = p_org_id;
  DELETE FROM public.fleet_tickets WHERE org_id = p_org_id;
  DELETE FROM public.fleet_schedules WHERE org_id = p_org_id;
  DELETE FROM public.fleet_bookings WHERE org_id = p_org_id;
  DELETE FROM public.fleet_maintenance_labs WHERE org_id = p_org_id;
  DELETE FROM public.service_orders WHERE org_id = p_org_id;
  DELETE FROM public.purchase_requests WHERE org_id = p_org_id;
  DELETE FROM public.production_work_orders WHERE org_id = p_org_id;
  DELETE FROM public.zakat_asset_timeline WHERE org_id = p_org_id;
  DELETE FROM public.zakat_haul_events WHERE org_id = p_org_id;
  DELETE FROM public.zakat_haul WHERE org_id = p_org_id;
  DELETE FROM public.budgets WHERE org_id = p_org_id;
  DELETE FROM public.fiscal_periods WHERE org_id = p_org_id;
  DELETE FROM public.fixed_assets WHERE org_id = p_org_id;
  DELETE FROM public.sales_returns WHERE org_id = p_org_id;
  DELETE FROM public.purchase_returns WHERE org_id = p_org_id;
  DELETE FROM public.sales_payments WHERE org_id = p_org_id;
  DELETE FROM public.purchase_payments WHERE org_id = p_org_id;
  DELETE FROM public.journal_entries WHERE org_id = p_org_id;
  DELETE FROM public.sales WHERE org_id = p_org_id;
  DELETE FROM public.purchases WHERE org_id = p_org_id;
  DELETE FROM public.stock_movements WHERE org_id = p_org_id;
  DELETE FROM public.inventory_stocks WHERE org_id = p_org_id;
  DELETE FROM public.audit_logs WHERE org_id = p_org_id;

  IF v_mode = 'all_data' THEN
    DELETE FROM public.org_invitations WHERE org_id = p_org_id;
    DELETE FROM public.bank_accounts WHERE org_id = p_org_id;
    DELETE FROM public.payroll_components WHERE org_id = p_org_id;
    DELETE FROM public.employees WHERE org_id = p_org_id;
    DELETE FROM public.fleet_routes WHERE org_id = p_org_id;
    DELETE FROM public.fleet_assets WHERE org_id = p_org_id;
    DELETE FROM public.fleet_terminals WHERE org_id = p_org_id;
    DELETE FROM public.production_boms WHERE org_id = p_org_id;
    DELETE FROM public.production_operations WHERE org_id = p_org_id;
    DELETE FROM public.intercompany_accounts WHERE org_id = p_org_id;
    DELETE FROM public.warehouse_bins WHERE org_id = p_org_id;
    DELETE FROM public.warehouses WHERE org_id = p_org_id;
    DELETE FROM public.products WHERE org_id = p_org_id;
    DELETE FROM public.contacts WHERE org_id = p_org_id;

    IF to_regclass('public.branches') IS NOT NULL THEN
      SELECT b.id
      INTO v_preserved_branch_id
      FROM public.branches b
      WHERE b.org_id = p_org_id
      ORDER BY b.created_at ASC, b.id ASC
      LIMIT 1;

      IF v_preserved_branch_id IS NULL THEN
        INSERT INTO public.branches (org_id, name, code, address, is_active)
        VALUES (p_org_id, 'Unit Utama', 'MAIN', NULL, TRUE)
        RETURNING id INTO v_preserved_branch_id;
      END IF;

      IF to_regclass('public.accounts') IS NOT NULL THEN
        UPDATE public.accounts
        SET managed_branch_id = v_preserved_branch_id
        WHERE org_id = p_org_id;
      END IF;

      DELETE FROM public.branches
      WHERE org_id = p_org_id
        AND id <> v_preserved_branch_id;

      UPDATE public.branches
      SET
        name = 'Unit Utama',
        code = 'MAIN',
        address = NULL,
        is_active = TRUE,
        updated_at = NOW()
      WHERE id = v_preserved_branch_id
        AND org_id = p_org_id;
    END IF;
  END IF;

  INSERT INTO public.audit_logs (org_id, user_id, action, table_name, record_id, new_data, user_agent)
  VALUES (
    p_org_id,
    v_user_id,
    'DELETE',
    'SYSTEM_RESET',
    p_org_id,
    jsonb_build_object(
      'mode', v_mode,
      'status', 'SUCCESS',
      'preserved', ARRAY['organizations', 'org_members', 'roles', 'accounts', 'saas_*']
    ),
    'NIZAM ERP System'
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'mode', v_mode,
    'message', CASE
      WHEN v_mode = 'all_data' THEN 'Operational data reset complete. Default branch preserved for CoA integrity.'
      ELSE 'Transactional data reset complete.'
    END
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', FALSE, 'error', SQLERRM);
END;
$$;

NOTIFY pgrst, 'reload schema';
