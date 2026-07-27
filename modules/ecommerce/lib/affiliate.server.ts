/**
 * Module Service Afiliasi LMS Nizam App
 * Mengelola aktivasi akun afiliasi, atribusi visitor, kalkulasi komisi per kelas,
 * leaderboard ter-masking, dan pencairan komisi (terintegrasi ERP Bridge Anti-Silo).
 */
import 'server-only'

import { createHash, randomBytes } from 'node:crypto'
import { queryPostgres } from '@/lib/db/postgres'
import { ERPBridge } from '@/lib/erp-bridge/finances'

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

/**
 * Mengaktifkan profil afiliasi bagi member (Opt-In / Explicit Activation).
 */
export async function activateAffiliateProfile(
  orgId: string,
  userId: string,
): Promise<AffiliateProfile> {
  const existing = await getAffiliateProfile(orgId, userId)
  if (existing) {
    if (existing.status !== 'ACTIVE') {
      await queryPostgres(
        `UPDATE public.commerce_affiliate_profiles
         SET status = 'ACTIVE', updated_at = NOW()
         WHERE id = $1::uuid`,
        [existing.id],
      )
      existing.status = 'ACTIVE'
    }
    return existing
  }

  // Generate kode referral unik (misal: REF-A8F2)
  const randomSuffix = randomBytes(3).toString('hex').toUpperCase()
  const referralCode = `REF-${randomSuffix}`

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
    `INSERT INTO public.commerce_affiliate_profiles (
       org_id, user_id, referral_code, status, default_commission_type,
       default_commission_value, cookie_days, approved_at
     ) VALUES (
       $1::uuid, $2::uuid, $3, 'ACTIVE', 'PERCENTAGE', 20.00, 30, NOW()
     )
     ON CONFLICT (org_id, user_id) DO UPDATE
     SET status = 'ACTIVE', updated_at = NOW()
     RETURNING id::text, org_id::text, user_id::text, referral_code, status,
               payout_details, cookie_days, created_at::text`,
    [orgId, userId, referralCode],
  )

  const row = rows[0]
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

/**
 * Mengajukan pencairan komisi (Payout Request) & menghubungkannya dengan Akuntansi/Kas ERP Bridge.
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

  const payoutRes = await queryPostgres<{ id: string }>(
    `INSERT INTO public.commerce_affiliate_payouts (
       org_id, affiliate_profile_id, payout_number, amount, status, paid_at
     ) VALUES (
       $1::uuid, $2::uuid, $3, $4, 'PAID', NOW()
     )
     RETURNING id::text`,
    [params.orgId, profile.id, payoutNumber, params.amount],
  )

  const payoutId = payoutRes.rows[0].id

  // Tandai komisi sebagai PAID
  await queryPostgres(
    `UPDATE public.commerce_affiliate_commissions
     SET status = 'PAID', payout_id = $1::uuid, updated_at = NOW()
     WHERE org_id = $2::uuid
       AND affiliate_profile_id = $3::uuid
       AND status = 'APPROVED'
       AND (payable_at IS NULL OR payable_at <= NOW())`,
    [payoutId, params.orgId, profile.id],
  )

  // Integrasi ERP Bridge: Catat Beban Komisi Afiliasi ke General Ledger (Anti-Silo compliance)
  try {
    const expenseAccount = await ERPBridge.getDefaultAccount(params.orgId, '6001') || await ERPBridge.getDefaultAccount(params.orgId, '5001')
    const cashAccount = await ERPBridge.getDefaultAccount(params.orgId, '1101') || await ERPBridge.getDefaultAccount(params.orgId, '1001')

    if (expenseAccount && cashAccount) {
      await ERPBridge.recordExpense({
        orgId: params.orgId,
        amount: params.amount,
        date: new Date().toISOString().slice(0, 10),
        description: `Pencairan Komisi Afiliasi ${payoutNumber} — ${profile.referralCode}`,
        referenceType: 'AFFILIATE_PAYOUT',
        referenceId: payoutId,
        debitAccountId: expenseAccount,
        creditAccountId: cashAccount,
      })
    }
  } catch (erpErr) {
    console.warn('ERP Bridge payout recording skipped:', erpErr)
  }

  return { payoutId, payoutNumber, amount: params.amount }
}
