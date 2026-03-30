-- MIGRATION 1085: Sync official SaaS core vs add-on catalog
-- Core modules:
-- Accounting, Finance, Inventory, Purchasing, Sales, POS, CRM, Reports
-- Premium modules:
-- HRIS, Manufacturing, Audit
-- Add-on modules:
-- Fleet & Rental, Job Order (Jasa), Warehouse, Sales Page
-- Capacity add-on:
-- Multi-Entity (PT/CV)

UPDATE public.saas_packages
SET
  modules = '["Accounting", "Finance", "Inventory", "Purchasing", "Sales", "POS", "CRM", "Reports", "HRIS", "Manufacturing", "Audit", "Fleet & Rental", "Job Order (Jasa)", "Warehouse", "Sales Page"]'::jsonb,
  addons = '["Multi-Entity (PT/CV)"]'::jsonb
WHERE name = 'Demo';

UPDATE public.saas_packages
SET
  modules = '["Accounting", "Finance", "Inventory", "Purchasing", "Sales", "POS", "CRM", "Reports"]'::jsonb,
  addons = '["HRIS", "Manufacturing", "Audit", "Fleet & Rental", "Job Order (Jasa)", "Warehouse", "Sales Page", "Multi-Entity (PT/CV)"]'::jsonb
WHERE name IN ('Trial', 'Basic');

UPDATE public.saas_packages
SET
  modules = '["Accounting", "Finance", "Inventory", "Purchasing", "Sales", "POS", "CRM", "Reports", "HRIS", "Manufacturing", "Audit"]'::jsonb,
  addons = '["Fleet & Rental", "Job Order (Jasa)", "Warehouse", "Sales Page", "Multi-Entity (PT/CV)"]'::jsonb
WHERE name = 'Pro';

UPDATE public.saas_packages
SET
  modules = '["Accounting", "Finance", "Inventory", "Purchasing", "Sales", "POS", "CRM", "Reports", "HRIS", "Manufacturing", "Audit", "Fleet & Rental", "Job Order (Jasa)", "Warehouse", "Sales Page"]'::jsonb,
  addons = '["Multi-Entity (PT/CV)"]'::jsonb
WHERE name = 'Enterprise';

UPDATE public.saas_packages
SET
  modules = '["Accounting", "Finance", "Inventory", "Purchasing", "Sales", "POS", "CRM", "Reports", "HRIS", "Warehouse"]'::jsonb,
  addons = '["Manufacturing", "Audit", "Fleet & Rental", "Job Order (Jasa)", "Sales Page", "Multi-Entity (PT/CV)"]'::jsonb
WHERE name = 'ABS Special';

UPDATE public.saas_invoices
SET item_name = CASE item_name
  WHEN 'Smart Fleet Management' THEN 'Fleet & Rental'
  WHEN 'Industrial Job Order' THEN 'Job Order (Jasa)'
  WHEN 'WMS Expansion Pack' THEN 'Warehouse'
  WHEN 'Multi-Entity' THEN 'Multi-Entity (PT/CV)'
  ELSE item_name
END
WHERE item_name IN ('Smart Fleet Management', 'Industrial Job Order', 'WMS Expansion Pack', 'Multi-Entity');

UPDATE public.organizations
SET active_addons = normalized_addons.value
FROM (
  SELECT
    org.id,
    COALESCE(
      jsonb_agg(
        CASE
          WHEN jsonb_typeof(addon) = 'object' THEN
            jsonb_set(
              addon,
              '{name}',
              to_jsonb(
                CASE lower(coalesce(addon->>'name', ''))
                  WHEN 'smart fleet management' THEN 'Fleet & Rental'
                  WHEN 'industrial job order' THEN 'Job Order (Jasa)'
                  WHEN 'wms expansion pack' THEN 'Warehouse'
                  WHEN 'multi-entity' THEN 'Multi-Entity (PT/CV)'
                  ELSE coalesce(addon->>'name', '')
                END
              ),
              true
            )
          ELSE addon
        END
      ) FILTER (WHERE addon IS NOT NULL),
      '[]'::jsonb
    ) AS value
  FROM public.organizations AS org
  LEFT JOIN LATERAL jsonb_array_elements(COALESCE(org.active_addons, '[]'::jsonb)) AS addon ON TRUE
  GROUP BY org.id
) AS normalized_addons
WHERE organizations.id = normalized_addons.id;
