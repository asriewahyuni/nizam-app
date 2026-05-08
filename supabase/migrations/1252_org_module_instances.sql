-- Migration: 1252_org_module_instances.sql
-- Description: Track onboarding lifecycle per module per organization.
-- status: PENDING → ONBOARDING → READY

CREATE TABLE public.org_module_instances (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  module_key    TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'PENDING'
                CHECK (status IN ('PENDING', 'ONBOARDING', 'READY')),
  coa_installed BOOLEAN NOT NULL DEFAULT false,
  settings      JSONB NOT NULL DEFAULT '{}',
  activated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ready_at      TIMESTAMPTZ,
  UNIQUE (org_id, module_key)
);

ALTER TABLE public.org_module_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their org module instances"
  ON public.org_module_instances FOR SELECT
  USING (org_id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid() AND is_active = TRUE));

CREATE POLICY "Admins can manage module instances"
  ON public.org_module_instances FOR ALL
  USING (public.nizam_has_permission('config:write', org_id));

CREATE INDEX idx_org_module_instances_org ON public.org_module_instances(org_id);
CREATE INDEX idx_org_module_instances_key ON public.org_module_instances(org_id, module_key);

NOTIFY pgrst, 'reload schema';

-- Helper RPC: append a module to enabled_modules array (no duplicate)
CREATE OR REPLACE FUNCTION public.append_enabled_module(p_org_id UUID, p_module_key TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE public.organizations
  SET enabled_modules = array_append(
    COALESCE(enabled_modules, '{}'),
    p_module_key
  )
  WHERE id = p_org_id
    AND NOT (p_module_key = ANY(COALESCE(enabled_modules, '{}')));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper RPC: remove a module from enabled_modules array
CREATE OR REPLACE FUNCTION public.remove_enabled_module(p_org_id UUID, p_module_key TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE public.organizations
  SET enabled_modules = array_remove(COALESCE(enabled_modules, '{}'), p_module_key)
  WHERE id = p_org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Extend status CHECK to allow DISABLED
ALTER TABLE public.org_module_instances
  DROP CONSTRAINT IF EXISTS org_module_instances_status_check;

ALTER TABLE public.org_module_instances
  ADD CONSTRAINT org_module_instances_status_check
  CHECK (status IN ('PENDING', 'ONBOARDING', 'READY', 'DISABLED'));
