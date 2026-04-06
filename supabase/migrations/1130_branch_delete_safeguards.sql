-- Migration: 1130_branch_delete_safeguards.sql
-- ============================================================
-- Perbaikan constraint FK pada tabel-tabel yang mereferensikan
-- branches(id) tanpa ON DELETE clause (default = NO ACTION/RESTRICT).
--
-- Tabel yang punya branch_id NOT NULL (tidak bisa SET NULL):
--   bank_accounts, bank_transactions, bank_mutations
--   service_orders, fleet_assets, fleet_bookings, fleet_routes,
--   fleet_schedules, fleet_tickets, fleet_maintenance_labs, fleet_terminals
--   payroll_runs, payroll_payslips, hris_leave_transactions
--   expenses, journal_entries (sebagian)
--
-- Solusi: Ganti FK tanpa ON DELETE → ON DELETE RESTRICT secara eksplisit
-- agar pesan error lebih jelas, dan biarkan server action yang menangani
-- pengecekan data sebelum delete.
--
-- Untuk tabel yang boleh NULL, ganti ke ON DELETE SET NULL.
-- ============================================================

-- ── bank_accounts ──────────────────────────────────────────
ALTER TABLE public.bank_accounts
  DROP CONSTRAINT IF EXISTS bank_accounts_branch_id_fkey;

ALTER TABLE public.bank_accounts
  ADD CONSTRAINT bank_accounts_branch_id_fkey
    FOREIGN KEY (branch_id) REFERENCES public.branches(id)
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── bank_transactions ──────────────────────────────────────
ALTER TABLE public.bank_transactions
  DROP CONSTRAINT IF EXISTS bank_transactions_branch_id_fkey;

ALTER TABLE public.bank_transactions
  ADD CONSTRAINT bank_transactions_branch_id_fkey
    FOREIGN KEY (branch_id) REFERENCES public.branches(id)
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── bank_mutations ─────────────────────────────────────────
ALTER TABLE public.bank_mutations
  DROP CONSTRAINT IF EXISTS bank_mutations_branch_id_fkey;

ALTER TABLE public.bank_mutations
  ADD CONSTRAINT bank_mutations_branch_id_fkey
    FOREIGN KEY (branch_id) REFERENCES public.branches(id)
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── service_orders ─────────────────────────────────────────
ALTER TABLE public.service_orders
  DROP CONSTRAINT IF EXISTS service_orders_branch_id_fkey;

ALTER TABLE public.service_orders
  ADD CONSTRAINT service_orders_branch_id_fkey
    FOREIGN KEY (branch_id) REFERENCES public.branches(id)
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── fleet_assets ───────────────────────────────────────────
ALTER TABLE public.fleet_assets
  DROP CONSTRAINT IF EXISTS fleet_assets_branch_id_fkey;

ALTER TABLE public.fleet_assets
  ADD CONSTRAINT fleet_assets_branch_id_fkey
    FOREIGN KEY (branch_id) REFERENCES public.branches(id)
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── fleet_bookings ─────────────────────────────────────────
ALTER TABLE public.fleet_bookings
  DROP CONSTRAINT IF EXISTS fleet_bookings_branch_id_fkey;

ALTER TABLE public.fleet_bookings
  ADD CONSTRAINT fleet_bookings_branch_id_fkey
    FOREIGN KEY (branch_id) REFERENCES public.branches(id)
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── fleet_routes ───────────────────────────────────────────
ALTER TABLE public.fleet_routes
  DROP CONSTRAINT IF EXISTS fleet_routes_branch_id_fkey;

ALTER TABLE public.fleet_routes
  ADD CONSTRAINT fleet_routes_branch_id_fkey
    FOREIGN KEY (branch_id) REFERENCES public.branches(id)
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── fleet_schedules ────────────────────────────────────────
ALTER TABLE public.fleet_schedules
  DROP CONSTRAINT IF EXISTS fleet_schedules_branch_id_fkey;

ALTER TABLE public.fleet_schedules
  ADD CONSTRAINT fleet_schedules_branch_id_fkey
    FOREIGN KEY (branch_id) REFERENCES public.branches(id)
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── fleet_tickets ──────────────────────────────────────────
ALTER TABLE public.fleet_tickets
  DROP CONSTRAINT IF EXISTS fleet_tickets_branch_id_fkey;

ALTER TABLE public.fleet_tickets
  ADD CONSTRAINT fleet_tickets_branch_id_fkey
    FOREIGN KEY (branch_id) REFERENCES public.branches(id)
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── fleet_maintenance_labs ─────────────────────────────────
ALTER TABLE public.fleet_maintenance_labs
  DROP CONSTRAINT IF EXISTS fleet_maintenance_labs_branch_id_fkey;

ALTER TABLE public.fleet_maintenance_labs
  ADD CONSTRAINT fleet_maintenance_labs_branch_id_fkey
    FOREIGN KEY (branch_id) REFERENCES public.branches(id)
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── fleet_terminals ────────────────────────────────────────
ALTER TABLE public.fleet_terminals
  DROP CONSTRAINT IF EXISTS fleet_terminals_branch_id_fkey;

ALTER TABLE public.fleet_terminals
  ADD CONSTRAINT fleet_terminals_branch_id_fkey
    FOREIGN KEY (branch_id) REFERENCES public.branches(id)
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── payroll_runs (jika ada) ────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'payroll_runs_branch_id_fkey'
      AND table_name = 'payroll_runs'
  ) THEN
    ALTER TABLE public.payroll_runs
      DROP CONSTRAINT payroll_runs_branch_id_fkey;
    ALTER TABLE public.payroll_runs
      ADD CONSTRAINT payroll_runs_branch_id_fkey
        FOREIGN KEY (branch_id) REFERENCES public.branches(id)
        ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'payroll_payslips_branch_id_fkey'
      AND table_name = 'payroll_payslips'
  ) THEN
    ALTER TABLE public.payroll_payslips
      DROP CONSTRAINT payroll_payslips_branch_id_fkey;
    ALTER TABLE public.payroll_payslips
      ADD CONSTRAINT payroll_payslips_branch_id_fkey
        FOREIGN KEY (branch_id) REFERENCES public.branches(id)
        ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- ── hris_leave_transactions / expenses ────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'hris_leave_transactions_branch_id_fkey'
      AND table_name = 'hris_leave_transactions'
  ) THEN
    ALTER TABLE public.hris_leave_transactions
      DROP CONSTRAINT hris_leave_transactions_branch_id_fkey;
    ALTER TABLE public.hris_leave_transactions
      ADD CONSTRAINT hris_leave_transactions_branch_id_fkey
        FOREIGN KEY (branch_id) REFERENCES public.branches(id)
        ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'expenses_branch_id_fkey'
      AND table_name = 'expenses'
  ) THEN
    ALTER TABLE public.expenses
      DROP CONSTRAINT expenses_branch_id_fkey;
    ALTER TABLE public.expenses
      ADD CONSTRAINT expenses_branch_id_fkey
        FOREIGN KEY (branch_id) REFERENCES public.branches(id)
        ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
