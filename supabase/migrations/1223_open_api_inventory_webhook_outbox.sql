-- ============================================================
-- MIGRATION 1223: Open API Inventory Webhook Outbox
-- ============================================================

ALTER TABLE public.api_configurations
  ADD COLUMN IF NOT EXISTS webhook_inventory_directions TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS webhook_inventory_reference_types TEXT[] NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS public.api_webhook_outbox (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id       UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  event_type      TEXT NOT NULL,
  source_table    TEXT NOT NULL,
  source_id       UUID NOT NULL,
  payload         JSONB NOT NULL DEFAULT '{}',
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempt_count   INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_at       TIMESTAMPTZ,
  locked_by       TEXT,
  processed_at    TIMESTAMPTZ,
  last_error      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(event_type, source_table, source_id)
);

CREATE INDEX IF NOT EXISTS idx_api_webhook_outbox_status_next_attempt
  ON public.api_webhook_outbox(status, next_attempt_at, created_at);

CREATE INDEX IF NOT EXISTS idx_api_webhook_outbox_org_event
  ON public.api_webhook_outbox(org_id, event_type, created_at DESC);

DROP TRIGGER IF EXISTS trg_api_webhook_outbox_updated_at ON public.api_webhook_outbox;
CREATE TRIGGER trg_api_webhook_outbox_updated_at
  BEFORE UPDATE ON public.api_webhook_outbox
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.enqueue_inventory_webhook_outbox()
RETURNS TRIGGER AS $$
DECLARE
  v_direction TEXT;
  v_product_code TEXT;
  v_product_name TEXT;
  v_product_unit TEXT;
  v_product_category TEXT;
BEGIN
  IF COALESCE(NEW.quantity, 0) = 0 THEN
    RETURN NEW;
  END IF;

  v_direction := CASE
    WHEN NEW.quantity > 0 THEN 'in'
    WHEN NEW.quantity < 0 THEN 'out'
    ELSE 'neutral'
  END;

  SELECT
    p.sku,
    p.name,
    p.unit,
    p.category
  INTO
    v_product_code,
    v_product_name,
    v_product_unit,
    v_product_category
  FROM public.products p
  WHERE p.id = NEW.product_id
    AND p.org_id = NEW.org_id
  LIMIT 1;

  INSERT INTO public.api_webhook_outbox (
    org_id,
    branch_id,
    event_type,
    source_table,
    source_id,
    payload
  ) VALUES (
    NEW.org_id,
    NEW.branch_id,
    'inventory_movement',
    'stock_movements',
    NEW.id,
    jsonb_build_object(
      'movement_id', NEW.id,
      'product_id', NEW.product_id,
      'product_code', v_product_code,
      'product_name', v_product_name,
      'product_unit', v_product_unit,
      'product_category', v_product_category,
      'movement_date', NEW.movement_date,
      'quantity', NEW.quantity,
      'direction', v_direction,
      'unit_price', COALESCE(NEW.unit_price, 0),
      'reference_type', NULLIF(UPPER(COALESCE(NEW.reference_type, '')), ''),
      'reference_id', NEW.reference_id,
      'notes', NEW.notes,
      'branch_id', NEW.branch_id,
      'created_at', COALESCE(NEW.created_at, NOW())
    )
  )
  ON CONFLICT (event_type, source_table, source_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enqueue_inventory_webhook_outbox ON public.stock_movements;
CREATE TRIGGER trg_enqueue_inventory_webhook_outbox
  AFTER INSERT ON public.stock_movements
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_inventory_webhook_outbox();
