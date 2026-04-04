-- ============================================================
-- MIGRATION 1114: Support Ticketing for User Bug Reports
-- Adds ticket table used by /settings/ticketing with screenshot
-- evidence and context about where/when bug happened.
-- ============================================================

CREATE OR REPLACE FUNCTION public.generate_support_ticket_no()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN 'TCK-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', '') FROM 1 FOR 6));
END;
$$;

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  reporter_user_id UUID NOT NULL REFERENCES auth.users(id),
  ticket_no TEXT NOT NULL UNIQUE DEFAULT public.generate_support_ticket_no(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'MEDIUM',
  status TEXT NOT NULL DEFAULT 'OPEN',
  found_in_menu TEXT NOT NULL,
  found_during TEXT,
  found_at TIMESTAMPTZ,
  screenshot_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT support_tickets_severity_check CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  CONSTRAINT support_tickets_status_check CHECK (status IN ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'))
);

ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS ticket_no TEXT;
ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS found_in_menu TEXT;
ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS found_during TEXT;
ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS found_at TIMESTAMPTZ;
ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS screenshot_url TEXT;

ALTER TABLE public.support_tickets
  ALTER COLUMN ticket_no SET DEFAULT public.generate_support_ticket_no();

ALTER TABLE public.support_tickets
  ALTER COLUMN found_in_menu SET DEFAULT '';

UPDATE public.support_tickets
SET
  ticket_no = COALESCE(NULLIF(TRIM(ticket_no), ''), public.generate_support_ticket_no()),
  found_in_menu = COALESCE(NULLIF(TRIM(found_in_menu), ''), 'Unknown Menu')
WHERE
  ticket_no IS NULL OR TRIM(ticket_no) = '' OR found_in_menu IS NULL OR TRIM(found_in_menu) = '';

ALTER TABLE public.support_tickets
  ALTER COLUMN ticket_no SET NOT NULL;
ALTER TABLE public.support_tickets
  ALTER COLUMN found_in_menu SET NOT NULL;

ALTER TABLE public.support_tickets
  DROP CONSTRAINT IF EXISTS support_tickets_severity_check;
ALTER TABLE public.support_tickets
  ADD CONSTRAINT support_tickets_severity_check CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'));

ALTER TABLE public.support_tickets
  DROP CONSTRAINT IF EXISTS support_tickets_status_check;
ALTER TABLE public.support_tickets
  ADD CONSTRAINT support_tickets_status_check CHECK (status IN ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'));

CREATE UNIQUE INDEX IF NOT EXISTS uq_support_tickets_ticket_no ON public.support_tickets(ticket_no);
CREATE INDEX IF NOT EXISTS idx_support_tickets_org_created_at ON public.support_tickets(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_tickets_org_status ON public.support_tickets(org_id, status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_reporter ON public.support_tickets(reporter_user_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_support_tickets_updated_at ON public.support_tickets;
CREATE TRIGGER trg_support_tickets_updated_at
BEFORE UPDATE ON public.support_tickets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members_view_support_tickets" ON public.support_tickets;
CREATE POLICY "members_view_support_tickets"
ON public.support_tickets
FOR SELECT
USING (
  org_id IN (
    SELECT om.org_id
    FROM public.org_members om
    WHERE om.user_id = auth.uid() AND om.is_active = TRUE
  )
);

DROP POLICY IF EXISTS "members_create_support_tickets" ON public.support_tickets;
CREATE POLICY "members_create_support_tickets"
ON public.support_tickets
FOR INSERT
WITH CHECK (
  reporter_user_id = auth.uid()
  AND org_id IN (
    SELECT om.org_id
    FROM public.org_members om
    WHERE om.user_id = auth.uid() AND om.is_active = TRUE
  )
);

DROP POLICY IF EXISTS "owner_admin_update_support_tickets" ON public.support_tickets;
CREATE POLICY "owner_admin_update_support_tickets"
ON public.support_tickets
FOR UPDATE
USING (
  org_id IN (
    SELECT om.org_id
    FROM public.org_members om
    WHERE om.user_id = auth.uid()
      AND om.is_active = TRUE
      AND om.role IN ('owner', 'admin', 'manager')
  )
)
WITH CHECK (
  org_id IN (
    SELECT om.org_id
    FROM public.org_members om
    WHERE om.user_id = auth.uid()
      AND om.is_active = TRUE
      AND om.role IN ('owner', 'admin', 'manager')
  )
);

NOTIFY pgrst, 'reload schema';
