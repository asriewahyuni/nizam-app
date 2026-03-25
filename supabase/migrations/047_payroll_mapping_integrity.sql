-- ==========================================
-- MIGRATION 047: Payroll Accounting Integrity
-- Force mapping of PPh 21 components to 2202
-- ==========================================

DO $$
BEGIN
    -- 1. Ensure PPh 21 components are mapped to account 2202 (Hutang PPh 21)
    UPDATE payroll_components pc
    SET account_id = a.id
    FROM accounts a
    WHERE a.org_id = pc.org_id
      AND a.code = '2202'
      AND (pc.name ILIKE '%PPh%' OR pc.type = 'TAX');

    -- 2. Ensure Basic Salary (Gaji Pokok) components are mapped to account 6001 (Beban Gaji)
    UPDATE payroll_components pc
    SET account_id = a.id
    FROM accounts a
    WHERE a.org_id = pc.org_id
      AND a.code = '6001'
      AND (pc.name ILIKE '%Gaji%' OR pc.name ILIKE '%Salary%');
END;
$$;
