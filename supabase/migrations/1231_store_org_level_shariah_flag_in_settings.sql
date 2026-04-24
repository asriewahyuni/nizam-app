-- ============================================================
-- MIGRATION 1231: Store org-level shariah flag in organizations.settings
-- ============================================================

WITH org_shariah_flags AS (
  SELECT
    o.id,
    EXISTS (
      SELECT 1
      FROM public.accounts a
      WHERE a.org_id = o.id
        AND a.is_active = TRUE
        AND a.code IN ('3110', '3120', '2600', '2601', '2602', '2603', '1404', '1205', '6100', '6110', '6120', '6200', '6210', '6220', '6230')
    ) AS is_shariah_enabled
  FROM public.organizations o
)
UPDATE public.organizations o
SET
  settings = jsonb_set(
    COALESCE(o.settings, '{}'::jsonb),
    '{is_shariah_enabled}',
    to_jsonb(f.is_shariah_enabled),
    TRUE
  ),
  updated_at = NOW()
FROM org_shariah_flags f
WHERE f.id = o.id
  AND COALESCE(o.settings ->> 'is_shariah_enabled', '') IS DISTINCT FROM CASE
    WHEN f.is_shariah_enabled THEN 'true'
    ELSE 'false'
  END;
