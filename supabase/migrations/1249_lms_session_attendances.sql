-- Migration: 1249_lms_session_attendances.sql
CREATE TABLE public.lms_session_attendances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES public.lms_batch_sessions(id) ON DELETE CASCADE,
    registration_id UUID NOT NULL REFERENCES public.lms_registrations(id) ON DELETE CASCADE,
    scanned_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (session_id, registration_id)
);

ALTER TABLE public.lms_session_attendances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their org attendances" ON public.lms_session_attendances
    FOR SELECT USING (org_id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid()));
CREATE POLICY "Admins can manage attendances" ON public.lms_session_attendances
    FOR ALL USING (public.nizam_has_permission('learning:write', org_id));

NOTIFY pgrst, 'reload schema';
