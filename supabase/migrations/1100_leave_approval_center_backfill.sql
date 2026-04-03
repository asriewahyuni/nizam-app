-- Leave Approval Center integration hardening:
-- 1. Backfill approval_requests for existing leave_requests
-- 2. Expose unresolved legacy rows for audit

CREATE OR REPLACE VIEW public.leave_approval_backfill_audit AS
WITH missing_leave_approvals AS (
  SELECT
    lr.id AS leave_id,
    lr.org_id,
    lr.branch_id,
    lr.employee_id,
    lr.leave_type,
    lr.start_date,
    lr.end_date,
    lr.reason,
    lr.status,
    lr.created_at,
    lr.updated_at,
    lr.approved_at,
    lr.approved_by,
    e.user_id AS employee_user_id,
    (
      SELECT om.user_id
      FROM public.org_members om
      WHERE om.org_id = lr.org_id
        AND om.is_active = TRUE
        AND om.user_id IS NOT NULL
        AND om.role IN ('owner', 'admin', 'hr', 'manager')
      ORDER BY
        CASE om.role
          WHEN 'owner' THEN 1
          WHEN 'admin' THEN 2
          WHEN 'hr' THEN 3
          WHEN 'manager' THEN 4
          ELSE 5
        END,
        om.joined_at ASC
      LIMIT 1
    ) AS elevated_member_user_id,
    (
      SELECT om.user_id
      FROM public.org_members om
      WHERE om.org_id = lr.org_id
        AND om.is_active = TRUE
        AND om.user_id IS NOT NULL
      ORDER BY om.joined_at ASC
      LIMIT 1
    ) AS fallback_member_user_id
  FROM public.leave_requests lr
  INNER JOIN public.employees e
    ON e.id = lr.employee_id
  LEFT JOIN public.approval_requests ar
    ON ar.org_id = lr.org_id
   AND ar.source_type = 'LEAVE_REQUEST'
   AND ar.source_id = lr.id
  WHERE ar.id IS NULL
)
SELECT
  leave_id,
  org_id,
  branch_id,
  employee_id,
  leave_type,
  start_date,
  end_date,
  reason,
  status,
  created_at,
  updated_at,
  approved_at,
  approved_by,
  employee_user_id,
  elevated_member_user_id,
  fallback_member_user_id,
  COALESCE(employee_user_id, elevated_member_user_id, fallback_member_user_id) AS resolved_requester_id
FROM missing_leave_approvals;

INSERT INTO public.approval_requests (
  org_id,
  branch_id,
  requester_id,
  approver_id,
  source_type,
  source_id,
  status,
  reason,
  notes,
  requested_at,
  decided_at,
  updated_at
)
SELECT
  audit.org_id,
  audit.branch_id,
  audit.resolved_requester_id,
  CASE
    WHEN audit.status::text IN ('APPROVED', 'REJECTED', 'CANCELLED') THEN audit.approved_by
    ELSE NULL
  END,
  'LEAVE_REQUEST',
  audit.leave_id,
  audit.status::text::public.approval_status,
  CONCAT(
    'Leave Request: ',
    audit.leave_type,
    ' (',
    audit.start_date,
    ' s/d ',
    audit.end_date,
    ')'
  ),
  CASE
    WHEN audit.status::text = 'CANCELLED' THEN 'Legacy leave request dibatalkan sebelum integrasi Approval Center.'
    ELSE audit.reason
  END,
  audit.created_at,
  CASE
    WHEN audit.status::text IN ('APPROVED', 'REJECTED', 'CANCELLED')
      THEN COALESCE(audit.approved_at, audit.updated_at, audit.created_at)
    ELSE NULL
  END,
  COALESCE(audit.updated_at, audit.created_at)
FROM (
  SELECT *
  FROM public.leave_approval_backfill_audit
) audit
WHERE audit.resolved_requester_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';
