-- Migration: Add subscription_end to organizations and enforce it on new sign-ups
-- This column holds the exact timestamp when the org's current plan expires.
-- NULL means unlimited / not yet set (legacy orgs retain access).

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS subscription_end TIMESTAMP WITH TIME ZONE;

-- Back-fill: any existing Trial org that has no subscription_end yet
-- is treated as a legacy org (we give them null = unlimited access).
-- New orgs will get subscription_end stamped at creation time by the app.

-- Update saas_packages to ensure Trial default duration is 1 day
UPDATE public.saas_packages
  SET duration_days = 1
  WHERE name = 'Trial' AND (duration_days IS NULL OR duration_days = 30);
