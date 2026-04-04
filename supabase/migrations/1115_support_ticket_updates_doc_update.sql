-- ============================================================
-- MIGRATION 1115: Support Ticket Progress & Doc Update Feed
-- Adds progress timeline table used by:
-- - /saas/ticketing (operator progress updates)
-- - /settings/ticketing/doc-update (user-visible doc update)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.support_ticket_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  updated_by_user_id UUID NOT NULL REFERENCES auth.users(id),
  update_title TEXT NOT NULL,
  update_body TEXT,
  status_before TEXT NOT NULL DEFAULT 'OPEN',
  status_after TEXT NOT NULL DEFAULT 'IN_PROGRESS',
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT support_ticket_updates_status_before_check CHECK (status_before IN ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED')),
  CONSTRAINT support_ticket_updates_status_after_check CHECK (status_after IN ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'))
);

CREATE INDEX IF NOT EXISTS idx_support_ticket_updates_ticket_created_at
ON public.support_ticket_updates(ticket_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_ticket_updates_org_public_created_at
ON public.support_ticket_updates(org_id, is_public, created_at DESC);

ALTER TABLE public.support_ticket_updates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members_view_public_support_ticket_updates" ON public.support_ticket_updates;
CREATE POLICY "members_view_public_support_ticket_updates"
ON public.support_ticket_updates
FOR SELECT
USING (
  is_public = TRUE
  AND org_id IN (
    SELECT om.org_id
    FROM public.org_members om
    WHERE om.user_id = auth.uid() AND om.is_active = TRUE
  )
);

NOTIFY pgrst, 'reload schema';
