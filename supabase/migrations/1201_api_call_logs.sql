-- ============================================================
-- MIGRATION 1201: API Call Logs
-- Menyimpan log setiap request ke endpoint Open API v1.
-- Berguna untuk audit, debugging, dan monitoring penggunaan.
-- ============================================================

CREATE TABLE IF NOT EXISTS api_call_logs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  api_key_id    UUID REFERENCES api_keys(id) ON DELETE SET NULL,
  -- HTTP method: GET, POST, PUT, DELETE
  method        TEXT NOT NULL,
  -- Endpoint path, e.g. /api/v1/cash
  endpoint      TEXT NOT NULL,
  -- HTTP status code dari response
  status_code   INTEGER NOT NULL,
  -- Durasi request dalam milidetik
  duration_ms   INTEGER,
  -- IP address caller (dari header x-forwarded-for atau x-real-ip)
  ip_address    TEXT,
  -- User-agent header
  user_agent    TEXT,
  -- Pesan error singkat jika status >= 400
  error_message TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_api_call_logs_org_id     ON api_call_logs(org_id);
CREATE INDEX idx_api_call_logs_key_id     ON api_call_logs(api_key_id);
CREATE INDEX idx_api_call_logs_created_at ON api_call_logs(created_at DESC);
CREATE INDEX idx_api_call_logs_status     ON api_call_logs(status_code);

-- ─────────────────────────────────────────────────────────────
-- RLS: hanya owner/admin yang bisa melihat log
-- ─────────────────────────────────────────────────────────────
ALTER TABLE api_call_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_can_view_api_call_logs"
  ON api_call_logs FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM org_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
        AND is_active = TRUE
    )
  );

-- NOTE: INSERT dilakukan oleh service role (admin client) dari server,
-- tidak memerlukan policy INSERT untuk authenticated user.
