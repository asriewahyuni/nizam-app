-- ============================================================
-- MIGRATION 1224: Remote history placeholder
-- Railway sudah pernah mencatat versi ini di schema_migrations,
-- tetapi file sumbernya tidak lagi ada di repository saat ini.
-- File no-op ini menjaga kontinuitas histori agar db push bisa
-- membandingkan local/remote migration versions dengan aman.
-- ============================================================

DO $$
BEGIN
  NULL;
END;
$$;
