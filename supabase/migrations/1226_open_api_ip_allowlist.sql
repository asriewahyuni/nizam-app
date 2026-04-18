-- ============================================================
-- MIGRATION 1226: Open API IP Allowlist per API Key
-- Menambahkan whitelist IP/CIDR opsional untuk setiap API key.
-- Jika kosong, key dapat dipakai dari semua IP.
-- ============================================================

ALTER TABLE public.api_keys
  ADD COLUMN IF NOT EXISTS ip_allowlist TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.api_keys.ip_allowlist IS
  'Daftar whitelist IP/CIDR untuk API key. Kosong berarti semua IP diizinkan.';
