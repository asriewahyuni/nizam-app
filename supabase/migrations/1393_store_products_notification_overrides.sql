-- Override konten notifikasi (WhatsApp) per produk, mengikuti pola
-- "Notifikasi per produk" di Sejoli (on-hold, payment-confirm, in-progress,
-- shipping, completed, cancelled, refunded). Kalau kosong/enabled=false,
-- fallback ke template default org di notification_templates.
ALTER TABLE public.store_products
  ADD COLUMN IF NOT EXISTS notification_overrides jsonb NOT NULL DEFAULT '{}'::jsonb;
