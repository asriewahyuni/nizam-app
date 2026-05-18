-- Perbaikan: fungsi set_construction_child_org_context() gagal saat
-- dijalankan pada tabel yang tidak punya kolom stage_id
-- (construction_project_stages, construction_billing_terms).
-- Gunakan IF/ELSIF eksplisit per nama tabel agar NEW.stage_id
-- hanya diakses pada tabel yang benar-benar memiliki kolom tersebut.

CREATE OR REPLACE FUNCTION public.set_construction_child_org_context()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_project_org_id UUID;
  v_stage_project_id UUID;
BEGIN
  SELECT org_id INTO v_project_org_id
  FROM public.construction_projects
  WHERE id = NEW.project_id;

  IF v_project_org_id IS NULL THEN
    RAISE EXCEPTION 'Project konstruksi tidak ditemukan.';
  END IF;

  NEW.org_id := v_project_org_id;

  IF TG_TABLE_NAME = 'construction_budget_items' THEN
    IF NEW.stage_id IS NOT NULL THEN
      SELECT project_id INTO v_stage_project_id
      FROM public.construction_project_stages
      WHERE id = NEW.stage_id;
      IF v_stage_project_id IS DISTINCT FROM NEW.project_id THEN
        RAISE EXCEPTION 'Tahap proyek tidak valid untuk project ini.';
      END IF;
    END IF;

  ELSIF TG_TABLE_NAME = 'construction_progress_logs' THEN
    IF NEW.stage_id IS NOT NULL THEN
      SELECT project_id INTO v_stage_project_id
      FROM public.construction_project_stages
      WHERE id = NEW.stage_id;
      IF v_stage_project_id IS DISTINCT FROM NEW.project_id THEN
        RAISE EXCEPTION 'Tahap proyek tidak valid untuk project ini.';
      END IF;
    END IF;

  ELSIF TG_TABLE_NAME = 'construction_change_orders' THEN
    IF NEW.stage_id IS NOT NULL THEN
      SELECT project_id INTO v_stage_project_id
      FROM public.construction_project_stages
      WHERE id = NEW.stage_id;
      IF v_stage_project_id IS DISTINCT FROM NEW.project_id THEN
        RAISE EXCEPTION 'Tahap proyek tidak valid untuk project ini.';
      END IF;
    END IF;

  END IF;
  -- construction_project_stages dan construction_billing_terms
  -- tidak punya stage_id — tidak perlu validasi tambahan.

  RETURN NEW;
END;
$$;
