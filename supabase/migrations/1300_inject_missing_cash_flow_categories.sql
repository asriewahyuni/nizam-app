-- 1300_inject_missing_cash_flow_categories.sql
-- Inject default cash_flow_category ke akun-akun yang masih NULL (96.6%)
-- Berdasarkan standard chart of account Indonesia

UPDATE accounts SET cash_flow_category = 
  CASE
    -- KAS & BANK (11xx) → OPERATING
    WHEN code ~ '^11' THEN 'OPERATING'
    -- PIUTANG (12xx) → OPERATING
    WHEN code ~ '^12' THEN 'OPERATING'
    -- PERSEDIAAN (13xx) → OPERATING
    WHEN code ~ '^13' THEN 'OPERATING'
    -- ASET LANCAR LAIN (14xx) → OPERATING
    WHEN code ~ '^14' THEN 'OPERATING'
    -- ASET TETAP (15xx-16xx) → INVESTING
    WHEN code ~ '^1[5-9]' THEN 'INVESTING'
    -- HUTANG LANCAR (21xx-24xx) → OPERATING
    WHEN code ~ '^2[1-4]' THEN 'OPERATING'
    -- HUTANG JANGKA PANJANG (25xx-29xx) → FINANCING
    WHEN code ~ '^2[5-9]' THEN 'FINANCING'
    -- EKUITAS (3xxx) → FINANCING
    WHEN code ~ '^3' THEN 'FINANCING'
    -- PENDAPATAN (4xxx, 7xxx, 8xxx) → OPERATING
    WHEN code ~ '^[478]' THEN 'OPERATING'
    -- BEBAN (5xxx, 6xxx, 9xxx) → OPERATING
    WHEN code ~ '^[569]' THEN 'OPERATING'
    ELSE 'OPERATING'
  END
WHERE cash_flow_category IS NULL;
