-- Tambah kolom phone di internal_auth_users untuk menyimpan nomor HP member,
-- termasuk hasil migrasi dari WordPress/Sejoli (usermeta _phone).
ALTER TABLE public.internal_auth_users
  ADD COLUMN IF NOT EXISTS phone text;
