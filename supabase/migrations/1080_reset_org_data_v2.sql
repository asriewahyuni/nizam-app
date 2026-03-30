-- ============================================================
-- MIGRATION 1080: Safer Organization Reset + Closed Period Fix
-- ============================================================

-- Fix trigger function so DELETE on journal_entries does not crash.
CREATE OR REPLACE FUNCTION check_closed_period()
RETURNS TRIGGER AS $$
DECLARE
  v_org_id UUID;
  v_entry_date DATE;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_org_id := OLD.org_id;
    v_entry_date := OLD.entry_date;
  ELSE
    v_org_id := NEW.org_id;
    v_entry_date := NEW.entry_date;
  END IF;

  IF v_org_id IS NULL OR v_entry_date IS NULL THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM fiscal_periods
    WHERE org_id = v_org_id
      AND is_closed = TRUE
      AND v_entry_date BETWEEN start_date AND end_date
  ) THEN
    RAISE EXCEPTION 'Transaction is within a closed fiscal period and cannot be modified.';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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
    IF to_regclass('public.branches') IS NOT NULL THEN
      EXECUTE 'DELETE FROM public.branches WHERE org_id = $1' USING p_org_id;
    END IF;
    DELETE FROM public.products WHERE org_id = p_org_id;
    DELETE FROM public.contacts WHERE org_id = p_org_id;
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
      WHEN v_mode = 'all_data' THEN 'Operational and master data reset complete.'
      ELSE 'Transactional data reset complete.'
    END
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', FALSE, 'error', SQLERRM);
END;
$$;
