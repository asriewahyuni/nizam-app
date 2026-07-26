-- =============================================================================
-- 1389_commerce_coupon_public_checkout_hardening.sql
-- Menandai semua produk yang memberi akses LMS sebagai produk digital dan
-- mempercepat pemeriksaan batas kupon berdasarkan email pembeli.
-- =============================================================================

UPDATE public.store_products store_product
SET
  product_type = 'DIGITAL',
  quantity_enabled = FALSE,
  updated_at = NOW()
WHERE (
  EXISTS (
    SELECT 1
    FROM public.commerce_product_courses product_course
    WHERE product_course.org_id = store_product.org_id
      AND product_course.store_product_id = store_product.id
  )
  OR EXISTS (
    SELECT 1
    FROM public.commerce_product_access_packages product_package
    WHERE product_package.org_id = store_product.org_id
      AND product_package.store_product_id = store_product.id
  )
)
AND (
  store_product.product_type IS DISTINCT FROM 'DIGITAL'
  OR store_product.quantity_enabled IS DISTINCT FROM FALSE
);

CREATE INDEX IF NOT EXISTS idx_commerce_coupon_redemptions_email
  ON public.commerce_coupon_redemptions (coupon_id, email_normalized)
  WHERE email_normalized IS NOT NULL;
