-- Menghubungkan kupon diskon dengan afiliasi: kupon personal otomatis saat
-- aktivasi afiliasi, dan kupon "template" yang dibuat admin lalu di-clone
-- (di-"sub") oleh afiliasi menjadi kupon milik mereka sendiri.
ALTER TABLE public.commerce_coupons
  ADD COLUMN IF NOT EXISTS is_affiliate_template BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS source_coupon_id UUID REFERENCES public.commerce_coupons(id);
