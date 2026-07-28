/**
 * Module Server Pengaturan Afiliasi per-Tenant.
 * Menyimpan nilai diskon default untuk kupon personal yang otomatis
 * dibuatkan sistem saat seorang member mengaktifkan profil afiliasi.
 */
import 'server-only'

import { queryPostgres } from '@/lib/db/postgres'

export type AffiliateSettings = {
  defaultCouponDiscountType: 'FIXED' | 'PERCENT'
  defaultCouponDiscountValue: number
}

export const DEFAULT_AFFILIATE_SETTINGS: AffiliateSettings = {
  defaultCouponDiscountType: 'PERCENT',
  defaultCouponDiscountValue: 10,
}

export async function getAffiliateSettings(orgId: string): Promise<AffiliateSettings> {
  const { rows } = await queryPostgres<{ settings: Record<string, unknown> }>(
    `SELECT settings FROM public.organizations WHERE id = $1::uuid LIMIT 1`,
    [orgId],
  )

  const orgSettings = rows[0]?.settings || {}
  const rawConfig = (orgSettings.affiliate_settings && typeof orgSettings.affiliate_settings === 'object'
    ? orgSettings.affiliate_settings
    : {}) as Record<string, unknown>

  const discountType = rawConfig.defaultCouponDiscountType === 'FIXED' ? 'FIXED' : 'PERCENT'
  const discountValue = Number(rawConfig.defaultCouponDiscountValue)

  return {
    defaultCouponDiscountType: discountType,
    defaultCouponDiscountValue: Number.isFinite(discountValue) && discountValue > 0
      ? discountValue
      : DEFAULT_AFFILIATE_SETTINGS.defaultCouponDiscountValue,
  }
}

export async function saveAffiliateSettings(
  orgId: string,
  input: AffiliateSettings,
): Promise<AffiliateSettings> {
  const discountType = input.defaultCouponDiscountType === 'FIXED' ? 'FIXED' : 'PERCENT'
  const discountValue = Number(input.defaultCouponDiscountValue)
  if (!Number.isFinite(discountValue) || discountValue <= 0) {
    throw new Error('Nilai diskon default harus lebih dari nol.')
  }
  if (discountType === 'PERCENT' && discountValue > 100) {
    throw new Error('Diskon persen tidak boleh lebih dari 100%.')
  }

  const safeConfig = {
    defaultCouponDiscountType: discountType,
    defaultCouponDiscountValue: discountValue,
    updatedAt: new Date().toISOString(),
  }

  await queryPostgres(
    `UPDATE public.organizations
     SET settings = jsonb_set(
       COALESCE(settings, '{}'::jsonb),
       '{affiliate_settings}',
       $2::jsonb
     ),
     updated_at = NOW()
     WHERE id = $1::uuid`,
    [orgId, JSON.stringify(safeConfig)],
  )

  return getAffiliateSettings(orgId)
}
