-- ============================================================
-- MIGRATION 1222: Open API Idempotency Keys
-- Menyimpan request POST Open API yang harus bersifat idempotent
-- agar retry integrasi eksternal tidak membuat transaksi duplikat.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.api_idempotency_keys (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id           UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  api_key_id       UUID NOT NULL REFERENCES public.api_keys(id) ON DELETE CASCADE,
  endpoint         TEXT NOT NULL,
  idempotency_key  TEXT NOT NULL,
  request_hash     TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'processing',
  response_status  INTEGER,
  response_body    JSONB,
  resource_type    TEXT,
  resource_id      UUID,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT api_idempotency_keys_status_check
    CHECK (status IN ('processing', 'completed')),
  CONSTRAINT api_idempotency_keys_unique_key
    UNIQUE (api_key_id, endpoint, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_api_idempotency_keys_org_id
  ON public.api_idempotency_keys(org_id);

CREATE INDEX IF NOT EXISTS idx_api_idempotency_keys_status
  ON public.api_idempotency_keys(status);

CREATE TRIGGER trg_api_idempotency_keys_updated_at
  BEFORE UPDATE ON public.api_idempotency_keys
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Table ini hanya dipakai server-side via service role / PostgreSQL connection.
-- Tidak perlu RLS untuk akses publik.
