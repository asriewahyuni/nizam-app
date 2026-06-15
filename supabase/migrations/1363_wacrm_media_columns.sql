-- supabase/migrations/1363_wacrm_media_columns.sql
-- Tambah kolom media ke wacrm_messages untuk mendukung pesan non-text dari Fonnte.

ALTER TABLE public.wacrm_messages
  ALTER COLUMN body DROP NOT NULL,
  ALTER COLUMN body SET DEFAULT '',
  ADD COLUMN IF NOT EXISTS media_url  TEXT,
  ADD COLUMN IF NOT EXISTS media_type TEXT; -- 'image' | 'video' | 'audio' | 'document' | 'sticker'

-- Update constraint: body boleh kosong jika ada media_url
-- (pesan gambar tanpa caption: body='', media_url=<url>)
