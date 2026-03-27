-- ============================================================
-- MIGRATION 1008: Support Skip CoA Seed via Settings
-- This allows creating "Blank" organizations for demo/test purposes
-- where users want to see the "Manual Seed" recovery button.
-- ============================================================

CREATE OR REPLACE FUNCTION public.trigger_seed_coa()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if skip flag is set in settings JSONB
  IF (NEW.settings->>'skip_coa_seed') = 'true' THEN
    RETURN NEW;
  END IF;

  PERFORM public.seed_default_coa(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
