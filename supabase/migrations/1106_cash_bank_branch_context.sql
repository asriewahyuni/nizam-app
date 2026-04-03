-- ============================================================
-- MIGRATION 1106: Cash & Bank Branch Context
-- Make bank accounts, bank transactions, and reconciliation
-- mutations unit-aware and ensure auto-posted cash journals carry
-- the correct branch_id.
-- ============================================================

ALTER TABLE public.bank_accounts
ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id);

ALTER TABLE public.bank_transactions
ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id);

ALTER TABLE public.bank_mutations
ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id);

CREATE INDEX IF NOT EXISTS idx_bank_accounts_org_branch_active
ON public.bank_accounts(org_id, branch_id, is_active);

CREATE INDEX IF NOT EXISTS idx_bank_transactions_org_branch_date
ON public.bank_transactions(org_id, branch_id, transaction_date DESC);

CREATE INDEX IF NOT EXISTS idx_bank_mutations_org_branch_date
ON public.bank_mutations(org_id, branch_id, mutation_date DESC);

UPDATE public.bank_accounts ba
SET branch_id = public.resolve_single_active_branch(ba.org_id)
WHERE ba.branch_id IS NULL
  AND public.resolve_single_active_branch(ba.org_id) IS NOT NULL;

UPDATE public.bank_transactions bt
SET branch_id = COALESCE(
  ba.branch_id,
  public.resolve_single_active_branch(bt.org_id)
)
FROM public.bank_accounts ba
WHERE ba.id = bt.bank_account_id
  AND bt.branch_id IS DISTINCT FROM COALESCE(
    ba.branch_id,
    public.resolve_single_active_branch(bt.org_id)
  );

UPDATE public.bank_mutations bm
SET branch_id = COALESCE(
  ba.branch_id,
  (
    SELECT branch_id
    FROM public.bank_transactions
    WHERE id = bm.transaction_id
    LIMIT 1
  ),
  public.resolve_single_active_branch(bm.org_id)
)
FROM public.bank_accounts ba
WHERE ba.id = bm.bank_account_id
  AND bm.branch_id IS DISTINCT FROM COALESCE(
    ba.branch_id,
    (
      SELECT branch_id
      FROM public.bank_transactions
      WHERE id = bm.transaction_id
      LIMIT 1
    ),
    public.resolve_single_active_branch(bm.org_id)
  );

UPDATE public.journal_entries je
SET branch_id = bt.branch_id
FROM public.bank_transactions bt
WHERE je.reference_id = bt.id
  AND je.reference_type IN ('CASH_IN', 'CASH_OUT')
  AND je.branch_id IS NULL
  AND bt.branch_id IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.bank_accounts
    WHERE branch_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Unresolved branch_id remains on bank_accounts.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.bank_transactions
    WHERE branch_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Unresolved branch_id remains on bank_transactions.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.bank_mutations
    WHERE branch_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Unresolved branch_id remains on bank_mutations.';
  END IF;
END $$;

ALTER TABLE public.bank_accounts
ALTER COLUMN branch_id SET NOT NULL;

ALTER TABLE public.bank_transactions
ALTER COLUMN branch_id SET NOT NULL;

ALTER TABLE public.bank_mutations
ALTER COLUMN branch_id SET NOT NULL;

CREATE OR REPLACE FUNCTION public.set_bank_account_branch_context()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.branch_id IS NULL THEN
    NEW.branch_id := public.resolve_single_active_branch(NEW.org_id);
  END IF;

  IF NEW.branch_id IS NULL THEN
    RAISE EXCEPTION 'branch_id is required for bank account on organization %', NEW.org_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.branches b
    WHERE b.id = NEW.branch_id
      AND b.org_id = NEW.org_id
  ) THEN
    RAISE EXCEPTION 'branch_id % tidak valid untuk organisasi %', NEW.branch_id, NEW.org_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bank_accounts_branch_context ON public.bank_accounts;
CREATE TRIGGER trg_bank_accounts_branch_context
  BEFORE INSERT OR UPDATE OF org_id, branch_id
  ON public.bank_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_bank_account_branch_context();

CREATE OR REPLACE FUNCTION public.set_bank_transaction_branch_context()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_bank_account_branch_id UUID;
BEGIN
  SELECT branch_id
  INTO v_bank_account_branch_id
  FROM public.bank_accounts
  WHERE id = NEW.bank_account_id
    AND org_id = NEW.org_id;

  IF v_bank_account_branch_id IS NULL THEN
    v_bank_account_branch_id := public.resolve_single_active_branch(NEW.org_id);
  END IF;

  IF v_bank_account_branch_id IS NULL THEN
    RAISE EXCEPTION 'branch_id is required for bank transaction on organization %', NEW.org_id;
  END IF;

  IF NEW.branch_id IS NOT NULL AND NEW.branch_id IS DISTINCT FROM v_bank_account_branch_id THEN
    RAISE EXCEPTION 'bank transaction branch % does not match bank account branch %', NEW.branch_id, v_bank_account_branch_id;
  END IF;

  NEW.branch_id := v_bank_account_branch_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bank_transactions_branch_context ON public.bank_transactions;
CREATE TRIGGER trg_bank_transactions_branch_context
  BEFORE INSERT OR UPDATE OF org_id, branch_id, bank_account_id
  ON public.bank_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_bank_transaction_branch_context();

CREATE OR REPLACE FUNCTION public.set_bank_mutation_branch_context()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_bank_account_branch_id UUID;
BEGIN
  SELECT branch_id
  INTO v_bank_account_branch_id
  FROM public.bank_accounts
  WHERE id = NEW.bank_account_id
    AND org_id = NEW.org_id;

  IF v_bank_account_branch_id IS NULL THEN
    v_bank_account_branch_id := public.resolve_single_active_branch(NEW.org_id);
  END IF;

  IF v_bank_account_branch_id IS NULL THEN
    RAISE EXCEPTION 'branch_id is required for bank mutation on organization %', NEW.org_id;
  END IF;

  IF NEW.branch_id IS NOT NULL AND NEW.branch_id IS DISTINCT FROM v_bank_account_branch_id THEN
    RAISE EXCEPTION 'bank mutation branch % does not match bank account branch %', NEW.branch_id, v_bank_account_branch_id;
  END IF;

  NEW.branch_id := v_bank_account_branch_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bank_mutations_branch_context ON public.bank_mutations;
CREATE TRIGGER trg_bank_mutations_branch_context
  BEFORE INSERT OR UPDATE OF org_id, branch_id, bank_account_id
  ON public.bank_mutations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_bank_mutation_branch_context();

CREATE OR REPLACE FUNCTION public.auto_journal_bank_transaction()
RETURNS TRIGGER AS $$
DECLARE
  v_je_id UUID;
  v_bank_gl_account_id UUID;
  v_opp_gl_account_id UUID;
  v_ref_type journal_reference_type;
  v_bank_branch_id UUID;
BEGIN
  SELECT account_id, branch_id
  INTO v_bank_gl_account_id, v_bank_branch_id
  FROM public.bank_accounts
  WHERE id = NEW.bank_account_id
    AND org_id = NEW.org_id;

  IF v_bank_gl_account_id IS NULL THEN
    RAISE EXCEPTION 'Bank account % tidak ditemukan untuk organisasi %', NEW.bank_account_id, NEW.org_id;
  END IF;

  IF NEW.branch_id IS NULL THEN
    NEW.branch_id := COALESCE(v_bank_branch_id, public.resolve_single_active_branch(NEW.org_id));
  END IF;

  IF NEW.branch_id IS NULL THEN
    RAISE EXCEPTION 'branch_id is required for bank transaction journaling on organization %', NEW.org_id;
  END IF;

  IF v_bank_branch_id IS NOT NULL AND NEW.branch_id IS DISTINCT FROM v_bank_branch_id THEN
    RAISE EXCEPTION 'bank transaction branch % does not match bank account branch %', NEW.branch_id, v_bank_branch_id;
  END IF;

  v_opp_gl_account_id := NEW.category_id;

  IF v_opp_gl_account_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.type = 'IN' THEN
    v_ref_type := 'CASH_IN';
  ELSE
    v_ref_type := 'CASH_OUT';
  END IF;

  INSERT INTO public.journal_entries (
    org_id,
    branch_id,
    entry_date,
    description,
    reference_type,
    reference_id,
    status,
    is_auto,
    created_by
  ) VALUES (
    NEW.org_id,
    NEW.branch_id,
    NEW.transaction_date,
    NEW.description,
    v_ref_type,
    NEW.id,
    'POSTED',
    TRUE,
    NEW.created_by
  ) RETURNING id INTO v_je_id;

  IF NEW.type = 'IN' THEN
    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit, memo)
    VALUES (v_je_id, v_bank_gl_account_id, NEW.amount, 0, NEW.description);

    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit, memo)
    VALUES (v_je_id, v_opp_gl_account_id, 0, NEW.amount, NEW.description);
  ELSE
    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit, memo)
    VALUES (v_je_id, v_opp_gl_account_id, NEW.amount, 0, NEW.description);

    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit, memo)
    VALUES (v_je_id, v_bank_gl_account_id, 0, NEW.amount, NEW.description);
  END IF;

  NEW.journal_entry_id := v_je_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP POLICY IF EXISTS "members_can_view_bank_accounts" ON public.bank_accounts;
DROP POLICY IF EXISTS "admins_can_manage_bank_accounts" ON public.bank_accounts;

CREATE POLICY "members_can_view_bank_accounts"
  ON public.bank_accounts FOR SELECT
  USING (
    public.can_access_branch(org_id, branch_id)
    AND org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND is_active = TRUE
    )
  );

CREATE POLICY "admins_can_manage_bank_accounts"
  ON public.bank_accounts FOR ALL
  USING (
    public.can_access_branch(org_id, branch_id)
    AND org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'manager') AND is_active = TRUE
    )
  )
  WITH CHECK (
    public.can_access_branch(org_id, branch_id)
    AND org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'manager') AND is_active = TRUE
    )
  );

DROP POLICY IF EXISTS "members_can_view_bank_transactions" ON public.bank_transactions;
DROP POLICY IF EXISTS "staff_can_create_bank_transactions" ON public.bank_transactions;
DROP POLICY IF EXISTS "managers_can_delete_bank_transactions" ON public.bank_transactions;
DROP POLICY IF EXISTS "managers_can_update_bank_transactions" ON public.bank_transactions;

CREATE POLICY "members_can_view_bank_transactions"
  ON public.bank_transactions FOR SELECT
  USING (
    public.can_access_branch(org_id, branch_id)
    AND org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND is_active = TRUE
    )
  );

CREATE POLICY "staff_can_create_bank_transactions"
  ON public.bank_transactions FOR INSERT
  WITH CHECK (
    public.can_access_branch(org_id, branch_id)
    AND org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin', 'manager', 'staff')
        AND is_active = TRUE
    )
  );

CREATE POLICY "managers_can_update_bank_transactions"
  ON public.bank_transactions FOR UPDATE
  USING (
    public.can_access_branch(org_id, branch_id)
    AND org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin', 'manager')
        AND is_active = TRUE
    )
  )
  WITH CHECK (
    public.can_access_branch(org_id, branch_id)
    AND org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin', 'manager')
        AND is_active = TRUE
    )
  );

CREATE POLICY "managers_can_delete_bank_transactions"
  ON public.bank_transactions FOR DELETE
  USING (
    public.can_access_branch(org_id, branch_id)
    AND org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin', 'manager')
        AND is_active = TRUE
    )
  );

DROP POLICY IF EXISTS "members_can_view_bank_mutations" ON public.bank_mutations;
DROP POLICY IF EXISTS "staff_can_manage_bank_mutations" ON public.bank_mutations;

CREATE POLICY "members_can_view_bank_mutations"
  ON public.bank_mutations FOR SELECT
  USING (
    public.can_access_branch(org_id, branch_id)
    AND org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND is_active = TRUE
    )
  );

CREATE POLICY "staff_can_manage_bank_mutations"
  ON public.bank_mutations FOR ALL
  USING (
    public.can_access_branch(org_id, branch_id)
    AND org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin', 'manager', 'staff')
        AND is_active = TRUE
    )
  )
  WITH CHECK (
    public.can_access_branch(org_id, branch_id)
    AND org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin', 'manager', 'staff')
        AND is_active = TRUE
    )
  );

CREATE OR REPLACE VIEW public.bank_branch_backfill_audit AS
SELECT
  org_id,
  'bank_accounts'::TEXT AS table_name,
  COUNT(*) AS unresolved_count
FROM public.bank_accounts
WHERE branch_id IS NULL
GROUP BY org_id

UNION ALL

SELECT
  org_id,
  'bank_transactions'::TEXT AS table_name,
  COUNT(*) AS unresolved_count
FROM public.bank_transactions
WHERE branch_id IS NULL
GROUP BY org_id

UNION ALL

SELECT
  org_id,
  'bank_mutations'::TEXT AS table_name,
  COUNT(*) AS unresolved_count
FROM public.bank_mutations
WHERE branch_id IS NULL
GROUP BY org_id;

NOTIFY pgrst, 'reload schema';
