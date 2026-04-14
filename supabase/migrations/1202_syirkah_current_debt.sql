-- Migration: 1202_syirkah_current_debt.sql
-- Description: Add current_debt column to syirkah_contracts

ALTER TABLE public.syirkah_contracts
ADD COLUMN IF NOT EXISTS current_debt NUMERIC(15, 2) DEFAULT 0;
