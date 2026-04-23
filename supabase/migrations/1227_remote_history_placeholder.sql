-- ============================================================
-- MIGRATION 1227: Remote history placeholder
-- Railway sudah pernah mencatat versi ini di schema_migrations,
-- tetapi file sumbernya tidak ada di repository lokal saat ini.
-- File no-op ini menjaga kontinuitas histori agar sinkronisasi
-- local/remote tetap aman.
-- ============================================================

DO $$
BEGIN
  NULL;
END;
$$;
