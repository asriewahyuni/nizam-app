-- Kojasmat — tingkat keanggotaan dua level: TEMAN (default, akses terbatas —
-- hanya bisa menabung/tarik simpanan + lihat konten dasar) dan SAHABAT (akses
-- penuh — bisa eksekusi proyek, transfer, dan fitur lain), naik level lewat
-- test kedua + approval staf. Anggota AKTIF yang sudah ada sebelum fitur ini
-- di-backfill ke SAHABAT supaya tidak tiba-tiba kehilangan akses yang sudah
-- mereka pakai.
ALTER TABLE kojasmat_anggota
  ADD COLUMN tingkat TEXT NOT NULL DEFAULT 'TEMAN' CHECK (tingkat IN ('TEMAN', 'SAHABAT'));

UPDATE kojasmat_anggota SET tingkat = 'SAHABAT' WHERE status = 'AKTIF';
