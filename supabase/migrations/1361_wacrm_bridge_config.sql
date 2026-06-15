-- supabase/migrations/1361_wacrm_bridge_config.sql
-- Tambah kolom bridge config ke wacrm_connections untuk integrasi Fonnte / Wablas / Baileys

ALTER TABLE public.wacrm_connections
  ADD COLUMN IF NOT EXISTS bridge_type  TEXT DEFAULT 'fonnte',
  ADD COLUMN IF NOT EXISTS bridge_url   TEXT,
  ADD COLUMN IF NOT EXISTS bridge_token TEXT;

COMMENT ON COLUMN public.wacrm_connections.bridge_type  IS 'fonnte | wablas | baileys | custom';
COMMENT ON COLUMN public.wacrm_connections.bridge_url   IS 'Base URL bridge (cth: https://fonnte.com atau http://server:3001)';
COMMENT ON COLUMN public.wacrm_connections.bridge_token IS 'API token / secret key untuk autentikasi ke bridge';
