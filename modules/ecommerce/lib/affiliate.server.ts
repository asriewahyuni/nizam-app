/**
 * Module Service Afiliasi LMS Nizam App
 * Mengelola aktivasi akun afiliasi, atribusi visitor, kalkulasi komisi per kelas,
 * leaderboard ter-masking, dan pencairan komisi (terintegrasi ERP Bridge Anti-Silo).
 */
import 'server-only'

import { createHash, randomBytes } from 'node:crypto'
import type { PoolClient } from 'pg'
import { connectPostgresClient, queryPostgres } from '@/lib/db/postgres'
import { ERPBridge } from '@/lib/erp-bridge/finances'
import { enqueueNotification } from '@/modules/notifications/outbox.server'
import { getAffiliateSettings } from './affiliate-settings.server'

function formatRupiah(amount: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount)
}

export type AffiliateProfile = {
  id: string
  orgId: string
  userId: string
  referralCode: string
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'
  payoutDetails: Record<string, unknown> | null
  cookieDays: number
  createdAt: string
}

export type EligibleAffiliateCourse = {
  id: string
  title: string
  slug: string
  coverImageUrl: string | null
  price: number
  isAffiliateEnabled: boolean
  commissionType: 'PERCENTAGE' | 'FIXED'
  commissionValue: number
  estimatedCommission: number
}

export type LeaderboardEntry = {
  rank: number
  affiliateProfileId: string
  userId: string
  displayName: string
  maskedDisplayName: string
  referralCode: string
  totalConversions: number
  totalCommissionAmount: number
}

/**
 * Utility untuk menyamarkan nama affiliate demi privasi di leaderboard publik.
 * Contoh: "Indra Yuliawan" -> "Indra Y.***"
 * Contoh: "Budi" -> "Bud***"
 */
export function maskDisplayName(fullName: string | null | undefined): string {
  const name = String(fullName || 'Mitra Afiliasi').trim()
  if (!name || name === 'Mitra Afiliasi') return 'Mitra A.***'

  const parts = name.split(/\s+/)
  if (parts.length === 1) {
    const word = parts[0]
    if (word.length <= 3) return `${word}***`
    return `${word.slice(0, 3)}***`
  }

  const firstName = parts[0]
  const secondInitial = parts[1] ? `${parts[1][0]}.` : ''
  return `${firstName} ${secondInitial}***`.trim()
}

/**
 * Mengambil profil afiliasi pengguna untuk organisasi tertentu.
 */
export async function getAffiliateProfile(
  orgId: string,
  userId: string,
): Promise<AffiliateProfile | null> {
  const { rows } = await queryPostgres<{
    id: string
    org_id: string
    user_id: string
    referral_code: string
    status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'
    payout_details: Record<string, unknown> | null
    cookie_days: number
    created_at: string
  }>(
    `SELECT id::text, org_id::text, user_id::text, referral_code, status,
            payout_details, COALESCE(cookie_days, 30) AS cookie_days, created_at::text
     FROM public.commerce_affiliate_profiles
     WHERE org_id = $1::uuid AND user_id = $2::uuid
     LIMIT 1`,
    [orgId, userId],
  )

  const row = rows[0]
  if (!row) return null

  return {
    id: row.id,
    orgId: row.org_id,
    userId: row.user_id,
    referralCode: row.referral_code,
    status: row.status,
    payoutDetails: row.payout_details,
    cookieDays: Number(row.cookie_days || 30),
    createdAt: row.created_at,
  }
}

type AffiliateProfileRow = {
  id: string
  org_id: string
  user_id: string
  referral_code: string
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'
  payout_details: Record<string, unknown> | null
  cookie_days: number
  created_at: string
}

function mapAffiliateProfileRow(row: AffiliateProfileRow): AffiliateProfile {
  return {
    id: row.id,
    orgId: row.org_id,
    userId: row.user_id,
    referralCode: row.referral_code,
    status: row.status,
    payoutDetails: row.payout_details,
    cookieDays: Number(row.cookie_days || 30),
    createdAt: row.created_at,
  }
}

/**
 * Memastikan afiliasi punya kupon diskon personal (kode = kode referral mereka).
 * Idempotent — tidak membuat duplikat kalau kupon personalnya sudah ada.
 * Kupon "personal" dibedakan dari hasil clone template lewat source_coupon_id IS NULL.
 */
async function ensurePersonalCoupon(
  client: PoolClient,
  params: { orgId: string; affiliateProfileId: string; referralCode: string },
) {
  const existing = await client.query<{ id: string }>(
    `SELECT id::text FROM public.commerce_coupons
     WHERE org_id = $1::uuid AND affiliate_profile_id = $2::uuid AND source_coupon_id IS NULL
     LIMIT 1`,
    [params.orgId, params.affiliateProfileId],
  )
  if (existing.rows[0]) return

  const settings = await getAffiliateSettings(params.orgId)

  await client.query(
    `INSERT INTO public.commerce_coupons (
       org_id, code, discount_type, discount_value, affiliate_profile_id, is_active
     ) VALUES ($1::uuid, $2, $3, $4, $5::uuid, TRUE)
     ON CONFLICT (org_id, upper(code)) DO NOTHING`,
    [
      params.orgId,
      params.referralCode,
      settings.defaultCouponDiscountType,
      settings.defaultCouponDiscountValue,
      params.affiliateProfileId,
    ],
  )
}

/**
 * Get-or-create profil afiliasi (langsung ACTIVE, tanpa approval admin) berikut
 * kupon personalnya, dalam transaksi milik caller. Dipakai baik oleh aktivasi
 * eksplisit (activateAffiliateProfile) maupun alur otomatis di halaman thank-you.
 */
export async function ensureAffiliateProfileForUser(
  client: PoolClient,
  params: { orgId: string; userId: string },
): Promise<AffiliateProfile> {
  const existingRes = await client.query<AffiliateProfileRow>(
    `SELECT id::text, org_id::text, user_id::text, referral_code, status,
            payout_details, COALESCE(cookie_days, 30) AS cookie_days, created_at::text
     FROM public.commerce_affiliate_profiles
     WHERE org_id = $1::uuid AND user_id = $2::uuid
     LIMIT 1`,
    [params.orgId, params.userId],
  )

  let row = existingRes.rows[0]

  if (row && row.status !== 'ACTIVE') {
    const updated = await client.query<AffiliateProfileRow>(
      `UPDATE public.commerce_affiliate_profiles
       SET status = 'ACTIVE', approved_at = COALESCE(approved_at, NOW()), updated_at = NOW()
       WHERE id = $1::uuid
       RETURNING id::text, org_id::text, user_id::text, referral_code, status,
                 payout_details, COALESCE(cookie_days, 30) AS cookie_days, created_at::text`,
      [row.id],
    )
    row = updated.rows[0]
  }

  if (!row) {
    // Generate kode referral unik (misal: REF-A8F2)
    const randomSuffix = randomBytes(3).toString('hex').toUpperCase()
    const referralCode = `REF-${randomSuffix}`

    const inserted = await client.query<AffiliateProfileRow>(
      `INSERT INTO public.commerce_affiliate_profiles (
         org_id, user_id, referral_code, status, default_commission_type,
         default_commission_value, cookie_days, approved_at
       ) VALUES (
         $1::uuid, $2::uuid, $3, 'ACTIVE', 'PERCENTAGE', 20.00, 30, NOW()
       )
       ON CONFLICT (org_id, user_id) DO UPDATE
       SET status = 'ACTIVE', updated_at = NOW()
       RETURNING id::text, org_id::text, user_id::text, referral_code, status,
                 payout_details, COALESCE(cookie_days, 30) AS cookie_days, created_at::text`,
      [params.orgId, params.userId, referralCode],
    )
    row = inserted.rows[0]
  }

  await ensurePersonalCoupon(client, {
    orgId: params.orgId,
    affiliateProfileId: row.id,
    referralCode: row.referral_code,
  })

  return mapAffiliateProfileRow(row)
}

/**
 * Mengaktifkan profil afiliasi bagi member (Opt-In / Explicit Activation).
 */
export async function activateAffiliateProfile(
  orgId: string,
  userId: string,
): Promise<AffiliateProfile> {
  const client = await connectPostgresClient()
  try {
    await client.query('BEGIN')
    const profile = await ensureAffiliateProfileForUser(client, { orgId, userId })
    await client.query('COMMIT')
    return profile
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export type AffiliateCouponView = {
  id: string
  code: string
  discountType: 'FIXED' | 'PERCENT'
  discountValue: number
  isActive: boolean
  isPersonal: boolean
}

export type AffiliateCouponTemplateView = {
  id: string
  code: string
  discountType: 'FIXED' | 'PERCENT'
  discountValue: number
  minimumAmount: number
}

/**
 * Mengambil semua kupon milik seorang afiliasi (personal + hasil clone template).
 */
export async function getAffiliateCoupons(
  orgId: string,
  affiliateProfileId: string,
): Promise<AffiliateCouponView[]> {
  const { rows } = await queryPostgres<{
    id: string
    code: string
    discount_type: 'FIXED' | 'PERCENT'
    discount_value: number
    is_active: boolean
    source_coupon_id: string | null
  }>(
    `SELECT id::text, code, discount_type, discount_value::float8, is_active, source_coupon_id::text
     FROM public.commerce_coupons
     WHERE org_id = $1::uuid AND affiliate_profile_id = $2::uuid
     ORDER BY source_coupon_id NULLS FIRST, created_at DESC`,
    [orgId, affiliateProfileId],
  )

  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    discountType: row.discount_type,
    discountValue: Number(row.discount_value || 0),
    isActive: row.is_active,
    isPersonal: !row.source_coupon_id,
  }))
}

/**
 * Mengambil kupon template admin (is_affiliate_template = true) yang belum
 * di-"sub" (clone) oleh afiliasi ini.
 */
export async function getAvailableAffiliateCouponTemplates(
  orgId: string,
  affiliateProfileId: string,
): Promise<AffiliateCouponTemplateView[]> {
  const { rows } = await queryPostgres<{
    id: string
    code: string
    discount_type: 'FIXED' | 'PERCENT'
    discount_value: number
    minimum_amount: number
  }>(
    `SELECT template.id::text, template.code, template.discount_type,
            template.discount_value::float8, template.minimum_amount::float8
     FROM public.commerce_coupons template
     WHERE template.org_id = $1::uuid
       AND template.is_affiliate_template = TRUE
       AND template.affiliate_profile_id IS NULL
       AND template.is_active = TRUE
       AND NOT EXISTS (
         SELECT 1 FROM public.commerce_coupons clone
         WHERE clone.org_id = template.org_id
           AND clone.source_coupon_id = template.id
           AND clone.affiliate_profile_id = $2::uuid
       )
     ORDER BY template.created_at DESC`,
    [orgId, affiliateProfileId],
  )

  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    discountType: row.discount_type,
    discountValue: Number(row.discount_value || 0),
    minimumAmount: Number(row.minimum_amount || 0),
  }))
}

/**
 * Afiliasi "sub" (clone) kupon template admin menjadi kupon miliknya sendiri —
 * kode unik, aturan diskon disalin persis, tetap terlacak individual per afiliasi.
 */
export async function cloneAffiliateTemplateCoupon(
  orgId: string,
  userId: string,
  templateCouponId: string,
): Promise<AffiliateCouponView> {
  const profile = await getAffiliateProfile(orgId, userId)
  if (!profile || profile.status !== 'ACTIVE') {
    throw new Error('Akun afiliasi tidak aktif atau belum terdaftar.')
  }

  const templateRes = await queryPostgres<{
    id: string
    code: string
    discount_type: 'FIXED' | 'PERCENT'
    discount_value: number
    minimum_amount: number
    starts_at: string | null
    expires_at: string | null
    usage_limit: number | null
    per_user_limit: number
    allowed_store_product_ids: string[]
  }>(
    `SELECT id::text, code, discount_type, discount_value::float8, minimum_amount::float8,
            starts_at::text, expires_at::text, usage_limit, per_user_limit, allowed_store_product_ids
     FROM public.commerce_coupons
     WHERE id = $1::uuid AND org_id = $2::uuid
       AND is_affiliate_template = TRUE AND affiliate_profile_id IS NULL
     LIMIT 1`,
    [templateCouponId, orgId],
  )
  const template = templateRes.rows[0]
  if (!template) {
    throw new Error('Kupon template tidak ditemukan atau sudah tidak tersedia.')
  }

  const existingRes = await queryPostgres<{ id: string; code: string }>(
    `SELECT id::text, code FROM public.commerce_coupons
     WHERE org_id = $1::uuid AND source_coupon_id = $2::uuid AND affiliate_profile_id = $3::uuid
     LIMIT 1`,
    [orgId, template.id, profile.id],
  )
  if (existingRes.rows[0]) {
    return {
      id: existingRes.rows[0].id,
      code: existingRes.rows[0].code,
      discountType: template.discount_type,
      discountValue: Number(template.discount_value || 0),
      isActive: true,
      isPersonal: false,
    }
  }

  const suffix = profile.referralCode.replace(/^REF-/, '').slice(0, 4)
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidateCode = attempt === 0
      ? `${template.code}-${suffix}`
      : `${template.code}-${suffix}${attempt}`

    const inserted = await queryPostgres<{ id: string; code: string }>(
      `INSERT INTO public.commerce_coupons (
         org_id, code, discount_type, discount_value, minimum_amount,
         starts_at, expires_at, usage_limit, per_user_limit,
         allowed_store_product_ids, is_active, affiliate_profile_id, source_coupon_id
       ) VALUES (
         $1::uuid, $2, $3, $4, $5,
         $6::timestamptz, $7::timestamptz, $8, $9,
         $10::uuid[], TRUE, $11::uuid, $12::uuid
       )
       ON CONFLICT (org_id, upper(code)) DO NOTHING
       RETURNING id::text, code`,
      [
        orgId,
        candidateCode,
        template.discount_type,
        template.discount_value,
        template.minimum_amount,
        template.starts_at,
        template.expires_at,
        template.usage_limit,
        template.per_user_limit,
        template.allowed_store_product_ids || [],
        profile.id,
        template.id,
      ],
    )
    if (inserted.rows[0]) {
      return {
        id: inserted.rows[0].id,
        code: inserted.rows[0].code,
        discountType: template.discount_type,
        discountValue: Number(template.discount_value || 0),
        isActive: true,
        isPersonal: false,
      }
    }
  }

  throw new Error('Gagal membuat kode kupon unik, coba lagi.')
}

/**
 * Mencatat atribusi kunjungan referral dari cookie / URL params.
 */
export async function trackAffiliateAttribution(input: {
  orgId: string
  referralCode: string
  visitorTokenHash: string
  landingUrl?: string
  referrerUrl?: string
  utm?: Record<string, unknown>
}) {
  const profileResult = await queryPostgres<{ id: string; cookie_days: number }>(
    `SELECT id::text, COALESCE(cookie_days, 30) AS cookie_days
     FROM public.commerce_affiliate_profiles
     WHERE org_id = $1::uuid AND lower(referral_code) = lower($2) AND status = 'ACTIVE'
     LIMIT 1`,
    [input.orgId, input.referralCode],
  )

  const profile = profileResult.rows[0]
  if (!profile) return null

  const cookieDays = Number(profile.cookie_days || 30)

  await queryPostgres(
    `INSERT INTO public.commerce_affiliate_attributions (
       org_id, affiliate_profile_id, visitor_token_hash, landing_url,
       referrer_url, utm, first_seen_at, last_seen_at, expires_at
     ) VALUES (
       $1::uuid, $2::uuid, $3, $4, $5, $6::jsonb, NOW(), NOW(),
       NOW() + ($7 || ' days')::interval
     )
     ON CONFLICT (org_id, visitor_token_hash) DO UPDATE
     SET affiliate_profile_id = EXCLUDED.affiliate_profile_id,
         last_seen_at = NOW(),
         expires_at = NOW() + ($7 || ' days')::interval`,
    [
      input.orgId,
      profile.id,
      input.visitorTokenHash,
      input.landingUrl || null,
      input.referrerUrl || null,
      JSON.stringify(input.utm || {}),
      cookieDays,
    ],
  )

  return { affiliateProfileId: profile.id, cookieDays }
}

/**
 * Mengambil daftar kelas yang diizinkan untuk dipromosikan (Eligible Courses)
 * beserta simulasi/estimasi komisinya.
 */
export async function getEligibleAffiliateCourses(
  orgId: string,
): Promise<EligibleAffiliateCourse[]> {
  const { rows } = await queryPostgres<{
    id: string
    title: string
    slug: string
    cover_image_url: string | null
    is_affiliate_enabled: boolean
    affiliate_commission_type: 'PERCENTAGE' | 'FIXED'
    affiliate_commission_value: number
    price: number
  }>(
    `SELECT
       course.id::text,
       course.title,
       course.slug,
       course.cover_image_url,
       COALESCE(course.is_affiliate_enabled, TRUE) AS is_affiliate_enabled,
       COALESCE(course.affiliate_commission_type, 'PERCENTAGE') AS affiliate_commission_type,
       COALESCE(course.affiliate_commission_value, 20.00)::float8 AS affiliate_commission_value,
       COALESCE((
         SELECT product.price::float8
         FROM public.store_products product
         WHERE product.org_id = course.org_id
           AND (product.metadata->>'course_id' = course.id::text OR product.slug = course.slug)
           AND product.is_active = TRUE
         LIMIT 1
       ), 150000)::float8 AS price
     FROM public.learning_courses course
     WHERE course.org_id = $1::uuid
       AND course.deleted_at IS NULL
       AND course.status = 'PUBLISHED'
       AND COALESCE(course.is_affiliate_enabled, TRUE) = TRUE
     ORDER BY course.created_at DESC`,
    [orgId],
  )

  return rows.map((row) => {
    const isPercent = row.affiliate_commission_type === 'PERCENTAGE'
    const commissionValue = Number(row.affiliate_commission_value || 20)
    const price = Number(row.price || 0)
    const estimatedCommission = isPercent
      ? Math.round((price * commissionValue) / 100)
      : commissionValue

    return {
      id: row.id,
      title: row.title,
      slug: row.slug,
      coverImageUrl: row.cover_image_url,
      price,
      isAffiliateEnabled: row.is_affiliate_enabled,
      commissionType: row.affiliate_commission_type,
      commissionValue,
      estimatedCommission,
    }
  })
}

/**
 * Mengambil Leaderboard Afiliasi dengan Nama Ter-masking.
 */
export async function getAffiliateLeaderboard(
  orgId: string,
  limit = 10,
): Promise<LeaderboardEntry[]> {
  const { rows } = await queryPostgres<{
    affiliate_profile_id: string
    user_id: string
    display_name: string
    referral_code: string
    total_conversions: number
    total_commission_amount: number
  }>(
    `SELECT * FROM public.get_affiliate_leaderboard($1::uuid, $2::integer)`,
    [orgId, limit],
  )

  return rows.map((row, index) => ({
    rank: index + 1,
    affiliateProfileId: row.affiliate_profile_id,
    userId: row.user_id,
    displayName: row.display_name,
    maskedDisplayName: maskDisplayName(row.display_name),
    referralCode: row.referral_code,
    totalConversions: Number(row.total_conversions || 0),
    totalCommissionAmount: Number(row.total_commission_amount || 0),
  }))
}

/**
 * Menghitung dan menyimpan komisi transaksi ketika pesanan dibayar.
 */
export async function resolveOrderAffiliateCommission(params: {
  orgId: string
  orderId: string
  referralCode?: string | null
  visitorTokenHash?: string | null
}) {
  let affiliateProfileId: string | null = null

  if (params.referralCode) {
    const profileRes = await queryPostgres<{ id: string }>(
      `SELECT id::text FROM public.commerce_affiliate_profiles
       WHERE org_id = $1::uuid AND lower(referral_code) = lower($2) AND status = 'ACTIVE' LIMIT 1`,
      [params.orgId, params.referralCode],
    )
    affiliateProfileId = profileRes.rows[0]?.id || null
  }

  if (!affiliateProfileId && params.visitorTokenHash) {
    const attrRes = await queryPostgres<{ affiliate_profile_id: string }>(
      `SELECT affiliate_profile_id::text
       FROM public.commerce_affiliate_attributions
       WHERE org_id = $1::uuid AND visitor_token_hash = $2 AND expires_at > NOW()
       LIMIT 1`,
      [params.orgId, params.visitorTokenHash],
    )
    affiliateProfileId = attrRes.rows[0]?.affiliate_profile_id || null
  }

  if (!affiliateProfileId) return null

  // Ambil detail order & total amount
  const orderRes = await queryPostgres<{
    id: string
    total_amount: number
    subtotal: number
  }>(
    `SELECT id::text, total_amount::float8, subtotal::float8
     FROM public.ecommerce_orders
     WHERE id = $1::uuid AND org_id = $2::uuid LIMIT 1`,
    [params.orderId, params.orgId],
  )
  const order = orderRes.rows[0]
  if (!order) return null

  const baseAmount = Number(order.subtotal || order.total_amount || 0)
  if (baseAmount <= 0) return null

  // Default 20% komisi jika tidak ada spesifik course rule
  const commissionRate = 0.20
  const commissionAmount = Math.round(baseAmount * commissionRate)

  const idempotencyKey = `commission:${params.orderId}`

  const { rows } = await queryPostgres<{ id: string }>(
    `INSERT INTO public.commerce_affiliate_commissions (
       org_id, affiliate_profile_id, order_id, commission_type,
       base_amount, commission_amount, status, payable_at, idempotency_key
     ) VALUES (
       $1::uuid, $2::uuid, $3::uuid, 'PERCENTAGE',
       $4, $5, 'APPROVED', NOW() + INTERVAL '7 days', $6
     )
     ON CONFLICT (org_id, idempotency_key) DO UPDATE
     SET commission_amount = EXCLUDED.commission_amount,
         updated_at = NOW()
     RETURNING id::text`,
    [
      params.orgId,
      affiliateProfileId,
      params.orderId,
      baseAmount,
      commissionAmount,
      idempotencyKey,
    ],
  )

  return rows[0] || null
}

export type AdminAffiliateView = {
  id: string
  userId: string
  name: string
  email: string
  phone: string
  referralCode: string
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'REJECTED'
  cookieDays: number
  pendingAmount: number
  payableAmount: number
  paidAmount: number
  conversionCount: number
  createdAt: string
}

/**
 * Daftar semua afiliasi dalam satu organisasi untuk kebutuhan admin
 * (referensi Sejoli wp-admin/admin.php?page=sejoli-affiliates).
 */
export async function getAdminAffiliateList(orgId: string): Promise<AdminAffiliateView[]> {
  const { rows } = await queryPostgres<{
    id: string
    user_id: string
    name: string | null
    email: string | null
    phone: string | null
    referral_code: string
    status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'REJECTED'
    cookie_days: number
    pending_amount: number
    payable_amount: number
    paid_amount: number
    conversion_count: number
    created_at: string
  }>(
    `SELECT
       profile.id::text,
       profile.user_id::text,
       contact.display_name AS name,
       contact.login_email AS email,
       contact.phone AS phone,
       profile.referral_code,
       profile.status,
       COALESCE(profile.cookie_days, 30) AS cookie_days,
       COALESCE(SUM(commission.commission_amount) FILTER (WHERE commission.status IN ('PENDING', 'APPROVED')), 0)::float8 AS pending_amount,
       COALESCE(SUM(commission.commission_amount) FILTER (WHERE commission.status = 'PAYABLE'), 0)::float8 AS payable_amount,
       COALESCE(SUM(commission.commission_amount) FILTER (WHERE commission.status = 'PAID'), 0)::float8 AS paid_amount,
       COUNT(commission.id) FILTER (WHERE commission.status != 'CANCELLED')::int AS conversion_count,
       profile.created_at::text
     FROM public.commerce_affiliate_profiles profile
     LEFT JOIN LATERAL (
       SELECT display_name, login_email, phone
       FROM public.internal_auth_users u
       WHERE u.id = profile.user_id OR u.legacy_user_id = profile.user_id
       ORDER BY (u.id = profile.user_id) DESC
       LIMIT 1
     ) contact ON TRUE
     LEFT JOIN public.commerce_affiliate_commissions commission
       ON commission.org_id = profile.org_id AND commission.affiliate_profile_id = profile.id
     WHERE profile.org_id = $1::uuid
     GROUP BY profile.id, contact.display_name, contact.login_email, contact.phone
     ORDER BY profile.created_at DESC`,
    [orgId],
  )

  return rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    name: row.name || 'Mitra Afiliasi',
    email: row.email || '',
    phone: row.phone || '',
    referralCode: row.referral_code,
    status: row.status,
    cookieDays: Number(row.cookie_days || 30),
    pendingAmount: Number(row.pending_amount || 0),
    payableAmount: Number(row.payable_amount || 0),
    paidAmount: Number(row.paid_amount || 0),
    conversionCount: Number(row.conversion_count || 0),
    createdAt: row.created_at,
  }))
}

/**
 * Admin mengubah status afiliasi (suspend / aktifkan kembali / tolak).
 * Aktivasi awal tetap otomatis (self opt-in) — ini khusus untuk moderasi
 * setelahnya, misal ada indikasi penyalahgunaan kode/kupon.
 */
export async function setAffiliateProfileStatus(
  orgId: string,
  affiliateProfileId: string,
  status: 'ACTIVE' | 'SUSPENDED' | 'REJECTED',
): Promise<void> {
  const result = await queryPostgres(
    `UPDATE public.commerce_affiliate_profiles
     SET status = $3, updated_at = NOW()
     WHERE id = $1::uuid AND org_id = $2::uuid`,
    [affiliateProfileId, orgId, status],
  )
  if (result.rowCount === 0) {
    throw new Error('Afiliasi tidak ditemukan.')
  }
}

export type AdminAffiliatePayoutView = {
  id: string
  payoutNumber: string
  affiliateProfileId: string
  affiliateName: string
  referralCode: string
  amount: number
  status: 'DRAFT' | 'APPROVED' | 'PAID' | 'CANCELLED'
  bankName: string
  accountNumber: string
  accountName: string
  createdAt: string
  paidAt: string | null
}

/**
 * Daftar pengajuan pencairan lintas afiliasi untuk satu organisasi.
 */
export async function getAdminAffiliatePayouts(orgId: string): Promise<AdminAffiliatePayoutView[]> {
  const { rows } = await queryPostgres<{
    id: string
    payout_number: string
    affiliate_profile_id: string
    affiliate_name: string | null
    referral_code: string
    amount: number
    status: 'DRAFT' | 'APPROVED' | 'PAID' | 'CANCELLED'
    payout_details: Record<string, unknown> | null
    created_at: string
    paid_at: string | null
  }>(
    `SELECT
       payout.id::text,
       payout.payout_number,
       payout.affiliate_profile_id::text,
       contact.display_name AS affiliate_name,
       profile.referral_code,
       payout.amount::float8,
       payout.status,
       profile.payout_details,
       payout.created_at::text,
       payout.paid_at::text
     FROM public.commerce_affiliate_payouts payout
     JOIN public.commerce_affiliate_profiles profile ON profile.id = payout.affiliate_profile_id
     LEFT JOIN LATERAL (
       SELECT display_name, login_email, phone
       FROM public.internal_auth_users u
       WHERE u.id = profile.user_id OR u.legacy_user_id = profile.user_id
       ORDER BY (u.id = profile.user_id) DESC
       LIMIT 1
     ) contact ON TRUE
     WHERE payout.org_id = $1::uuid
     ORDER BY (payout.status = 'DRAFT') DESC, payout.created_at DESC`,
    [orgId],
  )

  return rows.map((row) => {
    const details = (row.payout_details && typeof row.payout_details === 'object'
      ? row.payout_details
      : {}) as Record<string, unknown>
    return {
      id: row.id,
      payoutNumber: row.payout_number,
      affiliateProfileId: row.affiliate_profile_id,
      affiliateName: row.affiliate_name || 'Mitra Afiliasi',
      referralCode: row.referral_code,
      amount: Number(row.amount || 0),
      status: row.status,
      bankName: String(details.bankName || ''),
      accountNumber: String(details.accountNumber || ''),
      accountName: String(details.accountName || ''),
      createdAt: row.created_at,
      paidAt: row.paid_at,
    }
  })
}

/**
 * Admin menyetujui pengajuan pencairan (status DRAFT -> PAID): tandai komisi
 * terkait PAID, catat ke jurnal akuntansi (Anti-Silo), lalu kirim notifikasi.
 */
export async function approveAffiliatePayout(orgId: string, payoutId: string): Promise<void> {
  const payoutRes = await queryPostgres<{
    id: string
    affiliate_profile_id: string
    amount: number
    payout_number: string
    status: string
  }>(
    `SELECT id::text, affiliate_profile_id::text, amount::float8, payout_number, status
     FROM public.commerce_affiliate_payouts
     WHERE id = $1::uuid AND org_id = $2::uuid
     LIMIT 1`,
    [payoutId, orgId],
  )
  const payout = payoutRes.rows[0]
  if (!payout) throw new Error('Pengajuan pencairan tidak ditemukan.')
  if (payout.status !== 'DRAFT') throw new Error('Pengajuan ini sudah diproses sebelumnya.')

  await queryPostgres(
    `UPDATE public.commerce_affiliate_payouts
     SET status = 'PAID', paid_at = NOW(), updated_at = NOW()
     WHERE id = $1::uuid`,
    [payoutId],
  )
  await queryPostgres(
    `UPDATE public.commerce_affiliate_commissions
     SET status = 'PAID', updated_at = NOW()
     WHERE payout_id = $1::uuid AND org_id = $2::uuid`,
    [payoutId, orgId],
  )

  try {
    const expenseAccount = await ERPBridge.getDefaultAccount(orgId, '6001') || await ERPBridge.getDefaultAccount(orgId, '5001')
    const cashAccount = await ERPBridge.getDefaultAccount(orgId, '1101') || await ERPBridge.getDefaultAccount(orgId, '1001')

    if (expenseAccount && cashAccount) {
      await ERPBridge.recordExpense({
        orgId,
        amount: payout.amount,
        date: new Date().toISOString().slice(0, 10),
        description: `Pencairan Komisi Afiliasi ${payout.payout_number}`,
        referenceType: 'AFFILIATE_PAYOUT',
        referenceId: payoutId,
        debitAccountId: expenseAccount,
        creditAccountId: cashAccount,
      })
    }
  } catch (erpErr) {
    console.warn('ERP Bridge payout recording skipped:', erpErr)
  }

  const contactResult = await queryPostgres<{
    user_id: string
    name: string | null
    email: string | null
    phone: string | null
  }>(
    `SELECT profile.user_id::text, contact.display_name AS name, contact.login_email AS email, contact.phone
     FROM public.commerce_affiliate_profiles profile
     LEFT JOIN LATERAL (
       SELECT display_name, login_email, phone
       FROM public.internal_auth_users u
       WHERE u.id = profile.user_id OR u.legacy_user_id = profile.user_id
       ORDER BY (u.id = profile.user_id) DESC
       LIMIT 1
     ) contact ON TRUE
     WHERE profile.id = $1::uuid
     LIMIT 1`,
    [payout.affiliate_profile_id],
  )
  const contact = contactResult.rows[0]
  const variables: Record<string, string | number | null> = {
    affiliate_name: contact?.name || 'Mitra Afiliasi',
    commission_amount: formatRupiah(payout.amount),
  }
  const recipients: Array<{ channel: 'EMAIL' | 'WHATSAPP'; value: string }> = []
  if (contact?.email) recipients.push({ channel: 'EMAIL', value: contact.email })
  if (contact?.phone) recipients.push({ channel: 'WHATSAPP', value: contact.phone })
  for (const recipient of recipients) {
    await enqueueNotification({
      orgId,
      userId: contact?.user_id || null,
      eventType: 'AFFILIATE_COMMISSION_PAID',
      channel: recipient.channel,
      recipient: recipient.value,
      templateKey: 'AFFILIATE_COMMISSION_PAID',
      variables,
      idempotencyKey: `affiliate-commission-paid:${payoutId}:${recipient.channel}`,
      payload: { payoutId, payoutNumber: payout.payout_number, amount: payout.amount },
    })
  }
}

/**
 * Admin menolak pengajuan pencairan (status DRAFT -> CANCELLED): komisi
 * terkait dikembalikan ke APPROVED supaya afiliasi bisa mengajukan ulang.
 */
export async function rejectAffiliatePayout(orgId: string, payoutId: string): Promise<void> {
  const payoutRes = await queryPostgres<{ status: string }>(
    `SELECT status FROM public.commerce_affiliate_payouts
     WHERE id = $1::uuid AND org_id = $2::uuid
     LIMIT 1`,
    [payoutId, orgId],
  )
  const payout = payoutRes.rows[0]
  if (!payout) throw new Error('Pengajuan pencairan tidak ditemukan.')
  if (payout.status !== 'DRAFT') throw new Error('Pengajuan ini sudah diproses sebelumnya.')

  await queryPostgres(
    `UPDATE public.commerce_affiliate_commissions
     SET status = 'APPROVED', payout_id = NULL, updated_at = NOW()
     WHERE payout_id = $1::uuid AND org_id = $2::uuid`,
    [payoutId, orgId],
  )
  await queryPostgres(
    `UPDATE public.commerce_affiliate_payouts
     SET status = 'CANCELLED', updated_at = NOW()
     WHERE id = $1::uuid`,
    [payoutId],
  )
}

/**
 * Mengajukan pencairan komisi (Payout Request) oleh afiliasi sendiri.
 * Masuk status DRAFT dan menunggu approval admin (lihat approveAffiliatePayout)
 * sebelum benar-benar dicatat ke jurnal akuntansi / ditandai PAID.
 */
export async function requestAffiliatePayout(params: {
  orgId: string
  userId: string
  amount: number
  bankInfo: Record<string, unknown>
}) {
  const profile = await getAffiliateProfile(params.orgId, params.userId)
  if (!profile || profile.status !== 'ACTIVE') {
    throw new Error('Akun afiliasi tidak aktif atau belum terdaftar.')
  }

  // Hitung saldo PAYABLE
  const payableRes = await queryPostgres<{ total_payable: number }>(
    `SELECT COALESCE(SUM(commission_amount), 0)::float8 AS total_payable
     FROM public.commerce_affiliate_commissions
     WHERE org_id = $1::uuid
       AND affiliate_profile_id = $2::uuid
       AND status = 'APPROVED'
       AND (payable_at IS NULL OR payable_at <= NOW())`,
    [params.orgId, profile.id],
  )

  const totalPayable = Number(payableRes.rows[0]?.total_payable || 0)
  if (params.amount < 50000) {
    throw new Error('Minimal penarikan komisi adalah Rp 50.000.')
  }
  if (params.amount > totalPayable) {
    throw new Error(`Saldo komisi siap ditarik hanya Rp ${totalPayable.toLocaleString('id-ID')}.`)
  }

  const payoutNumber = `PO-${Date.now().toString(36).toUpperCase()}`

  // Simpan info rekening tujuan pencairan di profil (dipakai admin saat approval).
  await queryPostgres(
    `UPDATE public.commerce_affiliate_profiles
     SET payout_details = $2::jsonb, updated_at = NOW()
     WHERE id = $1::uuid`,
    [profile.id, JSON.stringify(params.bankInfo || {})],
  )

  const payoutRes = await queryPostgres<{ id: string }>(
    `INSERT INTO public.commerce_affiliate_payouts (
       org_id, affiliate_profile_id, payout_number, amount, status
     ) VALUES (
       $1::uuid, $2::uuid, $3, $4, 'DRAFT'
     )
     RETURNING id::text`,
    [params.orgId, profile.id, payoutNumber, params.amount],
  )

  const payoutId = payoutRes.rows[0].id

  // Tandai komisi sebagai PAYABLE (dikunci ke pengajuan ini), menunggu approval admin.
  await queryPostgres(
    `UPDATE public.commerce_affiliate_commissions
     SET status = 'PAYABLE', payout_id = $1::uuid, updated_at = NOW()
     WHERE org_id = $2::uuid
       AND affiliate_profile_id = $3::uuid
       AND status = 'APPROVED'
       AND (payable_at IS NULL OR payable_at <= NOW())`,
    [payoutId, params.orgId, profile.id],
  )

  return { payoutId, payoutNumber, amount: params.amount }
}
