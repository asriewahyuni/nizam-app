-- 1301_fiscal_period_closing_with_journal.sql
-- Fix: fiscal period closing harus generate closing journal entries
-- Transfer semua Revenue → Laba Ditahan, semua Expense → Laba Ditahan
-- Plus: periode yang sudah di-close gak bisa di-unclose kalo ada jurnal

-- 0. Add CLOSING to enum if not exists
ALTER TYPE journal_reference_type ADD VALUE IF NOT EXISTS 'CLOSING';

-- 1. Function: generate closing JE for a fiscal period
CREATE OR REPLACE FUNCTION generate_period_closing_journal(
  p_period_id UUID,
  p_closed_by UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_org_id UUID;
  v_period_name TEXT;
  v_period_start DATE;
  v_period_end DATE;
  v_retained_earnings_account_id UUID;
  v_entry_id UUID;
  v_total_revenue NUMERIC := 0;
  v_total_expense NUMERIC := 0;
  v_je_description TEXT;
BEGIN
  -- Get period info
  SELECT org_id, name, start_date, end_date
  INTO v_org_id, v_period_name, v_period_start, v_period_end
  FROM fiscal_periods
  WHERE id = p_period_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Periode tidak ditemukan');
  END IF;

  -- Cari akun Laba Ditahan (3002) di org ini
  SELECT id INTO v_retained_earnings_account_id
  FROM accounts
  WHERE org_id = v_org_id AND code = '3002' AND is_active = TRUE
  LIMIT 1;

  IF v_retained_earnings_account_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Akun Laba Ditahan (3002) tidak ditemukan. Buat dulu akun dengan kode 3002.');
  END IF;

  -- Hitung total Revenue periode ini
  SELECT COALESCE(SUM(jl.credit - jl.debit), 0)
  INTO v_total_revenue
  FROM journal_entries je
  JOIN journal_lines jl ON jl.entry_id = je.id
  JOIN accounts a ON a.id = jl.account_id
  WHERE je.org_id = v_org_id
    AND je.status = 'POSTED'
    AND je.entry_date BETWEEN v_period_start AND v_period_end
    AND a.type = 'REVENUE';

  -- Hitung total Expense periode ini
  SELECT COALESCE(SUM(jl.debit - jl.credit), 0)
  INTO v_total_expense
  FROM journal_entries je
  JOIN journal_lines jl ON jl.entry_id = je.id
  JOIN accounts a ON a.id = jl.account_id
  WHERE je.org_id = v_org_id
    AND je.status = 'POSTED'
    AND je.entry_date BETWEEN v_period_start AND v_period_end
    AND a.type = 'EXPENSE';

  v_je_description := 'Closing Periode ' || v_period_name || ' (' || v_period_start || ' s.d. ' || v_period_end || ')';

  -- Buat closing journal entry
  INSERT INTO journal_entries (
    org_id, entry_number, entry_date, description,
    reference_type, reference_id, status, is_auto, notes, created_by, posted_at
  ) VALUES (
    v_org_id,
    'CLS-' || v_period_name || '-' || to_char(now(), 'YYYYMMDD-HH24MISS'),
    v_period_end,
    v_je_description,
    'CLOSING', p_period_id, 'POSTED', TRUE,
    'Closing journal entry generated automatically. Revenue: ' || v_total_revenue || ', Expense: ' || v_total_expense || ', Net: ' || (v_total_revenue - v_total_expense),
    p_closed_by, now()
  )
  RETURNING id INTO v_entry_id;

  -- Line 1: Debit semua Revenue accounts → pindahin balance ke 0
  INSERT INTO journal_lines (entry_id, account_id, debit, credit)
  SELECT v_entry_id, a.id,
    CASE WHEN a.normal_balance = 'CREDIT'
      THEN COALESCE(SUM(jl.credit - jl.debit), 0)
      ELSE 0
    END,
    CASE WHEN a.normal_balance = 'DEBIT'
      THEN COALESCE(SUM(jl.debit - jl.credit), 0)
      ELSE 0
    END
  FROM accounts a
  JOIN journal_lines jl ON jl.account_id = a.id
  JOIN journal_entries je ON je.id = jl.entry_id
  WHERE je.org_id = v_org_id
    AND je.status = 'POSTED'
    AND je.entry_date BETWEEN v_period_start AND v_period_end
    AND a.type = 'REVENUE'
  GROUP BY a.id, a.normal_balance
  HAVING ABS(SUM(jl.debit - jl.credit)) > 0.01;

  -- Line 2: Credit semua Expense accounts → pindahin balance ke 0
  INSERT INTO journal_lines (entry_id, account_id, debit, credit)
  SELECT v_entry_id, a.id,
    CASE WHEN a.normal_balance = 'DEBIT'
      THEN COALESCE(SUM(jl.debit - jl.credit), 0)
      ELSE 0
    END,
    CASE WHEN a.normal_balance = 'CREDIT'
      THEN COALESCE(SUM(jl.credit - jl.debit), 0)
      ELSE 0
    END
  FROM accounts a
  JOIN journal_lines jl ON jl.account_id = a.id
  JOIN journal_entries je ON je.id = jl.entry_id
  WHERE je.org_id = v_org_id
    AND je.status = 'POSTED'
    AND je.entry_date BETWEEN v_period_start AND v_period_end
    AND a.type = 'EXPENSE'
  GROUP BY a.id, a.normal_balance
  HAVING ABS(SUM(jl.debit - jl.credit)) > 0.01;

  -- Line 3: Net balance ke Laba Ditahan
  IF v_total_revenue >= v_total_expense THEN
    -- Laba: Debit Revenue summary (already done in Line 1), Credit Laba Ditahan
    INSERT INTO journal_lines (entry_id, account_id, credit, debit)
    VALUES (v_entry_id, v_retained_earnings_account_id, v_total_revenue - v_total_expense, 0);
  ELSE
    -- Rugi: Debit Laba Ditahan, Credit Expense summary (already done in Line 2)
    INSERT INTO journal_lines (entry_id, account_id, debit, credit)
    VALUES (v_entry_id, v_retained_earnings_account_id, v_total_expense - v_total_revenue, 0);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'entry_id', v_entry_id,
    'total_revenue', v_total_revenue,
    'total_expense', v_total_expense,
    'net_profit', v_total_revenue - v_total_expense
  );
END;
$$;

-- 2. Update closeFiscalPeriod behavior — panggil function di atas
-- (ini di-handle di application layer, tapi trigger prevent unclose kalo ada JE)

-- 3. Cegah unclose kalo udah ada closing journal
CREATE OR REPLACE FUNCTION prevent_fiscal_period_unclose()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.is_closed = TRUE AND NEW.is_closed = FALSE THEN
    IF EXISTS (
      SELECT 1 FROM journal_entries
      WHERE reference_type = 'CLOSING'
        AND reference_id = OLD.id
        AND status = 'POSTED'
    ) THEN
      RAISE EXCEPTION 'Cannot reopen period: closing journal entry already exists. Void the closing journal first.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prevent_fiscal_period_unclose
  BEFORE UPDATE ON fiscal_periods
  FOR EACH ROW
  WHEN (OLD.is_closed = TRUE AND NEW.is_closed = FALSE)
  EXECUTE FUNCTION prevent_fiscal_period_unclose();
