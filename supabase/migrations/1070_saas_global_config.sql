-- ==========================================
-- SAAS GLOBAL SETTINGS (BANK & SUPPORT)
-- ==========================================

CREATE TABLE IF NOT EXISTS saas_config (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed Initial Data
INSERT INTO saas_config (key, value) VALUES 
('bank_info', '{"bank": "BANK MANDIRI (KCP BANDUNG)", "account": "1310022339999", "name": "PT NIZAM TEKNOLOGI BERKAH"}'),
('support_info', '{"wa": "628123456789", "label": "Admin Nizam Support"}')
ON CONFLICT (key) DO NOTHING;

-- RLS
ALTER TABLE saas_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read for saas_config" ON saas_config FOR SELECT USING (true);
CREATE POLICY "Admin write for saas_config" ON saas_config FOR ALL USING (auth.jwt() ->> 'email' LIKE '%@nizam.id'); -- Placeholder for admin check
