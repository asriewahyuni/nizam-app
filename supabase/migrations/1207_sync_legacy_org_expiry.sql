-- Sync legacy org expiry metadata into the canonical subscription_end column.
-- This keeps older admin edits (that only touched settings.expires_at) aligned
-- with the dashboard/login expiry guard.

UPDATE public.organizations AS org
SET subscription_end = legacy.expires_at
FROM (
  SELECT
    id,
    NULLIF(settings->>'expires_at', '')::timestamptz AS expires_at
  FROM public.organizations
  WHERE settings ? 'expires_at'
    AND NULLIF(settings->>'expires_at', '') IS NOT NULL
) AS legacy
WHERE org.id = legacy.id
  AND legacy.expires_at IS NOT NULL
  AND (
    org.subscription_end IS NULL
    OR org.subscription_end < legacy.expires_at
  );
