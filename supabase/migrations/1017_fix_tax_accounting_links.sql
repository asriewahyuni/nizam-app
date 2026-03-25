-- ============================================================
-- MIGRATION 1017: Fix Tax Accounting Links
-- 1. Auto-seed PPh 21 payroll component linked to account 2202 (Hutang PPh 21)
--    so payroll journals correctly post to the PPh tax account visible in Tax module.
-- 2. Auto-seed PPh 23 component linked to account 2203 (Hutang PPh 23)
-- ============================================================

DO $$
DECLARE
  v_org RECORD;
  v_acc_pph21 UUID;
  v_acc_pph23 UUID;
BEGIN
  -- Loop through every org that has the standard CoA seeded
  FOR v_org IN SELECT DISTINCT org_id FROM accounts WHERE code = '2202' LOOP

    -- Resolve account IDs for this org
    SELECT id INTO v_acc_pph21 FROM accounts WHERE org_id = v_org.org_id AND code = '2202' LIMIT 1;
    SELECT id INTO v_acc_pph23 FROM accounts WHERE org_id = v_org.org_id AND code = '2203' LIMIT 1;

    -- ── Seed PPh 21 component if not exists ──────────────────────────────
    IF v_acc_pph21 IS NOT NULL THEN
      INSERT INTO payroll_components (
        org_id, name, type, is_taxable, default_amount,
        is_percentage, percentage_value, account_id
      )
      VALUES (
        v_org.org_id,
        'PPh 21 Karyawan',
        'TAX',
        FALSE,        -- is_taxable = FALSE: PPh itself is not taxed again
        0,            -- default_amount: set to 0; HR will override per employee
        TRUE,         -- is_percentage = TRUE
        5.0,          -- 5% default effective rate (HR can adjust)
        v_acc_pph21   -- → Hutang PPh 21 (2202)
      )
      ON CONFLICT DO NOTHING; -- safe to re-run
    END IF;

    -- ── Seed PPh 23 component if not exists ──────────────────────────────
    IF v_acc_pph23 IS NOT NULL THEN
      INSERT INTO payroll_components (
        org_id, name, type, is_taxable, default_amount,
        is_percentage, percentage_value, account_id
      )
      VALUES (
        v_org.org_id,
        'PPh 23 (Jasa/Bunga)',
        'TAX',
        FALSE,
        0,
        TRUE,
        2.0,          -- 2% default withholding rate for services
        v_acc_pph23   -- → Hutang PPh 23 (2203)
      )
      ON CONFLICT DO NOTHING;
    END IF;

    -- ── Update existing PPh components that have NULL account_id ───────
    -- (Fixes components added manually before this migration)
    UPDATE payroll_components
    SET account_id = v_acc_pph21
    WHERE org_id = v_org.org_id
      AND type = 'TAX'
      AND name ILIKE '%pph 21%'
      AND account_id IS NULL
      AND v_acc_pph21 IS NOT NULL;

    UPDATE payroll_components
    SET account_id = v_acc_pph23
    WHERE org_id = v_org.org_id
      AND type = 'TAX'
      AND name ILIKE '%pph 23%'
      AND account_id IS NULL
      AND v_acc_pph23 IS NOT NULL;

  END LOOP;
END $$;

-- ── Index: speed up tax query on journal_lines by account_id ─────────────
-- This makes the new 2-step tax query in tax.actions.ts fast at scale.
CREATE INDEX IF NOT EXISTS idx_journal_lines_account_id 
  ON journal_lines(account_id);

CREATE INDEX IF NOT EXISTS idx_journal_lines_entry_account 
  ON journal_lines(entry_id, account_id);

-- ── Verify: show inserted PPh components (info only, no side effect) ─────
-- SELECT org_id, name, type, percentage_value, account_id 
-- FROM payroll_components 
-- WHERE type = 'TAX' ORDER BY org_id, name;
