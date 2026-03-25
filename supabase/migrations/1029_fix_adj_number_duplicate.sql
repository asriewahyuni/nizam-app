-- ============================================================
-- MIGRATION 1029: Fix adj_number duplicate constraint
-- Mengganti logika trigger agar selalu menghasilkan nomor unik
-- menggunakan kombinasi timestamp presisi tinggi + random hash
-- ============================================================

CREATE OR REPLACE FUNCTION set_adj_number()
RETURNS TRIGGER AS $$
DECLARE
  v_suffix TEXT;
BEGIN
  -- Selalu generate nomor baru yang unik, abaikan nilai yang dikirim dari client
  -- Format: ADJ-YYMMDD-HHMMSS-XXXX (hampir mustahil duplikat)
  v_suffix := UPPER(SUBSTRING(MD5(gen_random_uuid()::TEXT), 1, 6));
  NEW.adj_number := 'ADJ-' || TO_CHAR(NOW(), 'YYMMDD-HH24MISS') || '-' || v_suffix;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
