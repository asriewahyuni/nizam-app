-- Migration: 1387_lms_affiliate_enhancements.sql
-- Description: Add affiliate eligibility & commission settings to learning_courses and leaderboard query function

-- 1. Add affiliate configuration columns to learning_courses
ALTER TABLE public.learning_courses
  ADD COLUMN IF NOT EXISTS is_affiliate_enabled boolean DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS affiliate_commission_type text DEFAULT 'PERCENTAGE',
  ADD COLUMN IF NOT EXISTS affiliate_commission_value numeric(12, 2) DEFAULT 20.00;

COMMENT ON COLUMN public.learning_courses.is_affiliate_enabled IS 'Indikator apakah kelas ini diizinkan untuk dipromosikan oleh affiliate';
COMMENT ON COLUMN public.learning_courses.affiliate_commission_type IS 'Tipe komisi afiliasi: PERCENTAGE atau FIXED';
COMMENT ON COLUMN public.learning_courses.affiliate_commission_value IS 'Nilai komisi afiliasi (persentase misal 20.00 atau nominal tetap misal 50000)';

-- 2. Index for fast lookup of affiliate-enabled courses
CREATE INDEX IF NOT EXISTS idx_learning_courses_affiliate
  ON public.learning_courses (org_id, is_affiliate_enabled, status)
  WHERE deleted_at IS NULL;

-- 3. SQL function for Affiliate Leaderboard (Top Affiliates per Organization)
CREATE OR REPLACE FUNCTION public.get_affiliate_leaderboard(
  p_org_id uuid,
  p_limit integer DEFAULT 10
)
RETURNS TABLE (
  affiliate_profile_id uuid,
  user_id uuid,
  display_name text,
  referral_code text,
  total_conversions bigint,
  total_commission_amount numeric
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    profile.id AS affiliate_profile_id,
    profile.user_id,
    COALESCE(auth_user.display_name, auth_user.login_email, 'Mitra Afiliasi') AS display_name,
    profile.referral_code,
    COUNT(commission.id) AS total_conversions,
    COALESCE(SUM(commission.commission_amount), 0)::numeric AS total_commission_amount
  FROM public.commerce_affiliate_profiles profile
  JOIN public.internal_auth_users auth_user
    ON auth_user.legacy_user_id = profile.user_id OR auth_user.id = profile.user_id
  LEFT JOIN public.commerce_affiliate_commissions commission
    ON commission.affiliate_profile_id = profile.id
   AND commission.org_id = profile.org_id
   AND commission.status IN ('APPROVED', 'PAYABLE', 'PAID')
  WHERE profile.org_id = p_org_id
    AND profile.status = 'ACTIVE'
  GROUP BY profile.id, profile.user_id, auth_user.display_name, auth_user.login_email, profile.referral_code
  HAVING COALESCE(SUM(commission.commission_amount), 0) > 0 OR COUNT(commission.id) > 0
  ORDER BY total_commission_amount DESC, total_conversions DESC
  LIMIT p_limit;
END;
$$;
