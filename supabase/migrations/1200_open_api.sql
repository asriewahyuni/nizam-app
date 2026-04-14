-- ============================================================
-- MIGRATION 1200: Open API — API Keys & Configuration
-- Memungkinkan integrasi eksternal mengakses data Nizam
-- via REST endpoint menggunakan API key ber-scope.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- Table: api_keys
-- Menyimpan API key per org/branch dengan hash SHA-256.
-- Full key hanya ditampilkan sekali saat generate.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS api_keys (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- branch_id NULL = akses semua cabang; diisi = scope ke cabang tertentu
  branch_id       UUID REFERENCES branches(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  -- Format: "nzm_live_" + 24 karakter random (prefix disimpan, bukan full key)
  key_prefix      TEXT NOT NULL,
  -- SHA-256 hash dari full key (tanpa prefix), disimpan hex
  key_hash        TEXT NOT NULL UNIQUE,
  -- Scopes: 'cash:read', 'cash:write', 'sales:read', 'inventory:read', 'contacts:read'
  scopes          TEXT[] NOT NULL DEFAULT '{}',
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  -- Rate limiting: max requests per menit per key
  rate_limit_rpm  INTEGER NOT NULL DEFAULT 60,
  -- Tracking penggunaan
  last_used_at    TIMESTAMPTZ,
  request_count   BIGINT NOT NULL DEFAULT 0,
  -- Opsional: expiry (NULL = tidak ada expiry)
  expires_at      TIMESTAMPTZ,
  created_by      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_api_keys_org_id ON api_keys(org_id);
CREATE INDEX idx_api_keys_key_prefix ON api_keys(key_prefix);
CREATE INDEX idx_api_keys_is_active ON api_keys(is_active);

CREATE TRIGGER trg_api_keys_updated_at
  BEFORE UPDATE ON api_keys
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─────────────────────────────────────────────────────────────
-- Table: api_rate_limit_log
-- Tracking request per key per window (sliding window per menit)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS api_rate_limit_log (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  api_key_id  UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  window_start TIMESTAMPTZ NOT NULL DEFAULT date_trunc('minute', NOW()),
  request_count INTEGER NOT NULL DEFAULT 1,
  UNIQUE(api_key_id, window_start)
);

CREATE INDEX idx_api_rate_limit_log_key_window ON api_rate_limit_log(api_key_id, window_start);

-- ─────────────────────────────────────────────────────────────
-- Table: api_configurations
-- Mapping akun kas/bank untuk cash-in & cash-out via API,
-- serta webhook URL untuk push notification ke sistem eksternal.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS api_configurations (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id                  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- branch_id NULL = konfigurasi default untuk semua cabang
  branch_id               UUID REFERENCES branches(id) ON DELETE SET NULL,
  
  -- Cash In: uang masuk dari integrasi eksternal
  cash_in_account_id      UUID REFERENCES accounts(id) ON DELETE SET NULL,
  -- Cash Out: uang keluar ke vendor/supplier via API
  cash_out_account_id     UUID REFERENCES accounts(id) ON DELETE SET NULL,
  
  -- Parameter tambahan cash-in (JSON):
  -- { "default_description": "...", "auto_post": true, "revenue_account_id": "uuid" }
  cash_in_params          JSONB NOT NULL DEFAULT '{}',
  
  -- Parameter tambahan cash-out (JSON):
  -- { "default_description": "...", "auto_post": false, "expense_account_id": "uuid" }
  cash_out_params         JSONB NOT NULL DEFAULT '{}',
  
  -- Webhook: URL tujuan notifikasi ketika ada transaksi baru dari/ke API
  webhook_url             TEXT,
  -- Secret untuk HMAC-SHA256 signature pada webhook payload
  webhook_secret          TEXT,
  -- Events yang di-trigger webhook: ['cash_in', 'cash_out', 'sale', 'purchase']
  webhook_events          TEXT[] NOT NULL DEFAULT '{}',
  webhook_is_active       BOOLEAN NOT NULL DEFAULT FALSE,
  
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(org_id, branch_id)
);

CREATE INDEX idx_api_configurations_org_id ON api_configurations(org_id);

CREATE TRIGGER trg_api_configurations_updated_at
  BEFORE UPDATE ON api_configurations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─────────────────────────────────────────────────────────────
-- Table: api_webhook_deliveries
-- Log pengiriman webhook (untuk debugging & retry)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS api_webhook_deliveries (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  config_id       UUID NOT NULL REFERENCES api_configurations(id) ON DELETE CASCADE,
  event_type      TEXT NOT NULL,
  payload         JSONB NOT NULL DEFAULT '{}',
  target_url      TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending', -- pending, delivered, failed
  http_status     INTEGER,
  response_body   TEXT,
  attempt_count   INTEGER NOT NULL DEFAULT 0,
  delivered_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_api_webhook_deliveries_org_id ON api_webhook_deliveries(org_id);
CREATE INDEX idx_api_webhook_deliveries_status ON api_webhook_deliveries(status);

-- ─────────────────────────────────────────────────────────────
-- RLS: api_keys (hanya owner/admin yang bisa manage)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_can_manage_api_keys"
  ON api_keys FOR ALL
  USING (
    org_id IN (
      SELECT org_id FROM org_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
        AND is_active = TRUE
    )
  );

-- ─────────────────────────────────────────────────────────────
-- RLS: api_configurations
-- ─────────────────────────────────────────────────────────────
ALTER TABLE api_configurations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_can_manage_api_configurations"
  ON api_configurations FOR ALL
  USING (
    org_id IN (
      SELECT org_id FROM org_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
        AND is_active = TRUE
    )
  );

-- ─────────────────────────────────────────────────────────────
-- RLS: api_webhook_deliveries
-- ─────────────────────────────────────────────────────────────
ALTER TABLE api_webhook_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_can_view_webhook_deliveries"
  ON api_webhook_deliveries FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM org_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
        AND is_active = TRUE
    )
  );

-- NOTE: api_rate_limit_log tidak butuh RLS karena hanya diakses oleh service role
