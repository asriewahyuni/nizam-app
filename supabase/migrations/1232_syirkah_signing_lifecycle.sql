-- Menyamakan lifecycle syirkah:
-- DRAFT -> SIGNING -> ACTIVE -> COMPLETED
-- Serta mengizinkan role gabungan PEMODAL_PENGELOLA.

WITH member_signature_summary AS (
  SELECT
    contract_id,
    bool_and(signed_at IS NOT NULL) AS all_members_signed,
    max(signed_at) AS latest_signed_at
  FROM public.syirkah_members
  GROUP BY contract_id
)
UPDATE public.syirkah_contracts AS contracts
SET
  status = CASE
    WHEN summary.all_members_signed THEN 'ACTIVE'
    WHEN COALESCE(contracts.wizard_step, 0) >= 9 THEN 'SIGNING'
    ELSE 'DRAFT'
  END,
  signed_at = CASE
    WHEN summary.all_members_signed THEN COALESCE(contracts.signed_at, summary.latest_signed_at)
    ELSE NULL
  END
FROM member_signature_summary AS summary
WHERE contracts.id = summary.contract_id
  AND COALESCE(contracts.status, 'DRAFT') IN ('DRAFT', 'SIGNING', 'ACTIVE');

UPDATE public.syirkah_contracts
SET status = 'SIGNING'
WHERE COALESCE(status, 'DRAFT') = 'DRAFT'
  AND COALESCE(wizard_step, 0) >= 9;

UPDATE public.syirkah_contracts
SET status = 'DRAFT'
WHERE status IS NULL
   OR status NOT IN ('DRAFT', 'SIGNING', 'ACTIVE', 'COMPLETED');

UPDATE public.syirkah_members
SET role = 'PENGELOLA'
WHERE role IS NULL
   OR role NOT IN ('PEMODAL', 'PENGELOLA', 'PEMODAL_PENGELOLA');

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'syirkah_contracts_status_check'
      AND conrelid = 'public.syirkah_contracts'::regclass
  ) THEN
    ALTER TABLE public.syirkah_contracts
      DROP CONSTRAINT syirkah_contracts_status_check;
  END IF;
END $$;

ALTER TABLE public.syirkah_contracts
  ADD CONSTRAINT syirkah_contracts_status_check
  CHECK (status IN ('DRAFT', 'SIGNING', 'ACTIVE', 'COMPLETED'));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'syirkah_members_role_check'
      AND conrelid = 'public.syirkah_members'::regclass
  ) THEN
    ALTER TABLE public.syirkah_members
      DROP CONSTRAINT syirkah_members_role_check;
  END IF;
END $$;

ALTER TABLE public.syirkah_members
  ADD CONSTRAINT syirkah_members_role_check
  CHECK (role IN ('PEMODAL', 'PENGELOLA', 'PEMODAL_PENGELOLA'));
