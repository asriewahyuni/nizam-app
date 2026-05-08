-- ============================================================
-- Migration target: Railway Postgres (applied via DATABASE_URL)
-- MIGRATION 1179: POS Shift Foundation
-- Add shift/session tracking and settlement audit trail without
-- changing the existing POS flow for organizations that do not
-- enable the feature.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.pos_shift_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  cashier_user_id UUID NOT NULL,
  opened_by UUID NOT NULL,
  closed_by UUID NULL,
  register_code TEXT NOT NULL DEFAULT 'REG-1',
  opening_cash NUMERIC(18, 2) NOT NULL DEFAULT 0,
  expected_cash NUMERIC(18, 2) NOT NULL DEFAULT 0,
  closing_cash NUMERIC(18, 2) NULL,
  variance_amount NUMERIC(18, 2) NULL,
  cash_account_id UUID NULL REFERENCES public.accounts(id) ON DELETE SET NULL,
  transfer_account_id UUID NULL REFERENCES public.accounts(id) ON DELETE SET NULL,
  qris_account_id UUID NULL REFERENCES public.accounts(id) ON DELETE SET NULL,
  opening_notes TEXT NULL,
  closing_notes TEXT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED')),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  closed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_pos_shift_sessions_org_branch_status
  ON public.pos_shift_sessions(org_id, branch_id, status, opened_at DESC);

CREATE INDEX IF NOT EXISTS idx_pos_shift_sessions_cashier_status
  ON public.pos_shift_sessions(org_id, cashier_user_id, status, opened_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_pos_shift_open_per_cashier_branch
  ON public.pos_shift_sessions(org_id, branch_id, cashier_user_id)
  WHERE status = 'OPEN';

CREATE TABLE IF NOT EXISTS public.pos_shift_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.pos_shift_sessions(id) ON DELETE CASCADE,
  settlement_method TEXT NOT NULL CHECK (settlement_method IN ('CASH', 'TRANSFER', 'QRIS')),
  source_account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  target_account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  gross_amount NUMERIC(18, 2) NOT NULL CHECK (gross_amount > 0),
  fee_amount NUMERIC(18, 2) NOT NULL DEFAULT 0 CHECK (fee_amount >= 0),
  net_amount NUMERIC(18, 2) NOT NULL CHECK (net_amount >= 0),
  journal_entry_id UUID NULL REFERENCES public.journal_entries(id) ON DELETE SET NULL,
  notes TEXT NULL,
  settled_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_pos_shift_settlements_session
  ON public.pos_shift_settlements(org_id, session_id, settlement_method, created_at DESC);

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS pos_session_id UUID NULL REFERENCES public.pos_shift_sessions(id) ON DELETE SET NULL;

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS pos_payment_method TEXT NULL;

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS pos_amount_tendered NUMERIC(18, 2) NULL;

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS pos_change_amount NUMERIC(18, 2) NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_sales_org_branch_pos_session
  ON public.sales(org_id, branch_id, pos_session_id);

CREATE OR REPLACE FUNCTION public.set_pos_shift_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := timezone('utc', now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pos_shift_sessions_updated_at ON public.pos_shift_sessions;
CREATE TRIGGER trg_pos_shift_sessions_updated_at
  BEFORE UPDATE ON public.pos_shift_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_pos_shift_updated_at();

DROP TRIGGER IF EXISTS trg_pos_shift_settlements_updated_at ON public.pos_shift_settlements;
CREATE TRIGGER trg_pos_shift_settlements_updated_at
  BEFORE UPDATE ON public.pos_shift_settlements
  FOR EACH ROW
  EXECUTE FUNCTION public.set_pos_shift_updated_at();

ALTER TABLE public.pos_shift_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_shift_settlements ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pos_shift_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pos_shift_settlements TO authenticated;

DROP POLICY IF EXISTS "members_can_view_pos_shift_sessions" ON public.pos_shift_sessions;
CREATE POLICY "members_can_view_pos_shift_sessions"
  ON public.pos_shift_sessions
  FOR SELECT
  USING (
    public.nizam_has_permission('pos:read', org_id)
    OR public.nizam_has_permission('pos:write', org_id)
    OR public.nizam_has_permission('sales:write', org_id)
    OR public.nizam_member_has_any_role(org_id, ARRAY['owner', 'admin', 'manager', 'staff'])
  );

DROP POLICY IF EXISTS "staff_can_manage_pos_shift_sessions" ON public.pos_shift_sessions;
CREATE POLICY "staff_can_manage_pos_shift_sessions"
  ON public.pos_shift_sessions
  FOR ALL
  USING (
    public.nizam_has_permission('pos:write', org_id)
    OR public.nizam_has_permission('sales:write', org_id)
    OR public.nizam_member_has_any_role(org_id, ARRAY['owner', 'admin', 'manager', 'staff'])
  )
  WITH CHECK (
    public.nizam_has_permission('pos:write', org_id)
    OR public.nizam_has_permission('sales:write', org_id)
    OR public.nizam_member_has_any_role(org_id, ARRAY['owner', 'admin', 'manager', 'staff'])
  );

DROP POLICY IF EXISTS "members_can_view_pos_shift_settlements" ON public.pos_shift_settlements;
CREATE POLICY "members_can_view_pos_shift_settlements"
  ON public.pos_shift_settlements
  FOR SELECT
  USING (
    public.nizam_has_permission('pos:read', org_id)
    OR public.nizam_has_permission('pos:write', org_id)
    OR public.nizam_has_permission('cash:read', org_id)
    OR public.nizam_has_permission('cash:write', org_id)
    OR public.nizam_member_has_any_role(org_id, ARRAY['owner', 'admin', 'manager', 'staff'])
  );

DROP POLICY IF EXISTS "staff_can_manage_pos_shift_settlements" ON public.pos_shift_settlements;
CREATE POLICY "staff_can_manage_pos_shift_settlements"
  ON public.pos_shift_settlements
  FOR ALL
  USING (
    public.nizam_has_permission('pos:write', org_id)
    OR public.nizam_has_permission('cash:write', org_id)
    OR public.nizam_member_has_any_role(org_id, ARRAY['owner', 'admin', 'manager', 'staff'])
  )
  WITH CHECK (
    public.nizam_has_permission('pos:write', org_id)
    OR public.nizam_has_permission('cash:write', org_id)
    OR public.nizam_member_has_any_role(org_id, ARRAY['owner', 'admin', 'manager', 'staff'])
  );
