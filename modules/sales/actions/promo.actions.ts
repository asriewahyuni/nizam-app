'use server'

/**
 * Sales promo catalog is stored in organization settings so quotation/POS can
 * share the same voucher source without requiring a new database table.
 */

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import {
  calculateSalesPromoDiscount,
  deriveSalesPromoStatus,
  getSalesPromosFromSettings,
  mergeSalesPromosIntoSettings,
  normalizeSalesPromoCode,
  normalizeSalesPromoRecord,
  type SalesPromoRecord,
  type SalesPromoType,
} from '@/modules/sales/lib/sales-promos'

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

type SalesPromoMutationInput = {
  code: string
  type: SalesPromoType | string
  value: number
  expiresAt?: string | null
}

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>

async function getOrganizationPromoState(db: ServerSupabaseClient, orgId: string) {
  const { data: org, error } = await db
    .from('organizations')
    .select('settings')
    .eq('id', orgId)
    .maybeSingle()

  if (error || !org) {
    return { error: 'Organisasi tidak ditemukan.' as const }
  }

  return {
    settings: org.settings,
    promos: getSalesPromosFromSettings(org.settings),
  }
}

async function saveOrganizationPromoState(
  db: ServerSupabaseClient,
  orgId: string,
  currentSettings: unknown,
  promos: SalesPromoRecord[]
) {
  const nextSettings = mergeSalesPromosIntoSettings(currentSettings, promos)
  const { error } = await db
    .from('organizations')
    .update({
      settings: nextSettings,
      updated_at: new Date().toISOString(),
    })
    .eq('id', orgId)

  if (error) return { error: 'Gagal menyimpan katalog promo.' as const }
  return { success: true as const }
}

function parsePromoExpiryDate(value: unknown) {
  const normalized = String(value || '').trim()
  if (!normalized) return { value: null as string | null }
  if (!DATE_ONLY_PATTERN.test(normalized)) {
    return { error: 'Format tanggal expired promo harus YYYY-MM-DD.' as const }
  }

  const expiry = new Date(`${normalized}T23:59:59+07:00`)
  if (Number.isNaN(expiry.getTime())) {
    return { error: 'Tanggal expired promo tidak valid.' as const }
  }

  return { value: expiry.toISOString() }
}

function revalidateSalesPromoSurfaces() {
  revalidatePath('/sales/promos')
  revalidatePath('/sales/quotations')
  revalidatePath('/pos')
}

export async function getSalesPromos(orgId: string) {
  const supabase = await createClient()
  const state = await getOrganizationPromoState(supabase, orgId)
  if ('error' in state) return []
  return state.promos
}

export async function createSalesPromo(orgId: string, input: SalesPromoMutationInput) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const state = await getOrganizationPromoState(supabase, orgId)
  if ('error' in state) return { error: state.error }

  const code = normalizeSalesPromoCode(input.code)
  const type = String(input.type || '').trim().toUpperCase() === 'FIXED' ? 'FIXED' : 'PERCENT'
  const value = Number(input.value || 0)
  const parsedExpiry = parsePromoExpiryDate(input.expiresAt)

  if (!code || code.length < 4) {
    return { error: 'Kode promo minimal 4 karakter.' }
  }

  if (!Number.isFinite(value) || value <= 0) {
    return { error: 'Nilai potongan promo harus lebih besar dari nol.' }
  }

  if (type === 'PERCENT' && value > 100) {
    return { error: 'Diskon persentase tidak boleh lebih dari 100%.' }
  }

  if ('error' in parsedExpiry) return { error: parsedExpiry.error }

  if (state.promos.some((promo) => promo.code === code)) {
    return { error: `Kode promo ${code} sudah dipakai. Gunakan kode lain.` }
  }

  const nowIso = new Date().toISOString()
  const promo = normalizeSalesPromoRecord({
    id: crypto.randomUUID(),
    code,
    type,
    value,
    isActive: true,
    usageCount: 0,
    expiresAt: parsedExpiry.value,
    createdAt: nowIso,
    updatedAt: nowIso,
    createdBy: user.id,
  })

  const saveResult = await saveOrganizationPromoState(
    supabase,
    orgId,
    state.settings,
    [promo, ...state.promos]
  )

  if ('error' in saveResult) return { error: saveResult.error }

  revalidateSalesPromoSurfaces()
  return { success: true, promo }
}

export async function deleteSalesPromo(orgId: string, promoId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const state = await getOrganizationPromoState(supabase, orgId)
  if ('error' in state) return { error: state.error }

  const nextPromos = state.promos.filter((promo) => promo.id !== promoId)
  if (nextPromos.length === state.promos.length) {
    return { error: 'Promo tidak ditemukan.' }
  }

  const saveResult = await saveOrganizationPromoState(
    supabase,
    orgId,
    state.settings,
    nextPromos
  )

  if ('error' in saveResult) return { error: saveResult.error }

  revalidateSalesPromoSurfaces()
  return { success: true }
}

export async function getUsableSalesPromoByCode(orgId: string, rawCode: string) {
  const supabase = await createClient()
  return getUsableSalesPromoByCodeWithDb(supabase, orgId, rawCode)
}

export async function getUsableSalesPromoByCodeWithDb(
  db: ServerSupabaseClient,
  orgId: string,
  rawCode: string
) {
  const state = await getOrganizationPromoState(db, orgId)
  if ('error' in state) return { error: state.error }

  const code = normalizeSalesPromoCode(rawCode)
  if (!code) return { error: 'Kode promo kosong.' as const }

  const promo = state.promos.find((item) => item.code === code)
  if (!promo) return { error: `Kode kupon '${code}' tidak ditemukan!` as const }

  if (deriveSalesPromoStatus(promo) !== 'ACTIVE') {
    return { error: `Maaf, kode kupon '${code}' sudah kadaluarsa/tidak aktif!` as const }
  }

  return { promo, settings: state.settings, promos: state.promos }
}

export async function incrementSalesPromoUsage(
  db: ServerSupabaseClient,
  orgId: string,
  promoId: string
) {
  const state = await getOrganizationPromoState(db, orgId)
  if ('error' in state) return { error: state.error }

  const nowIso = new Date().toISOString()
  const nextPromos = state.promos.map((promo) => (
    promo.id === promoId
      ? normalizeSalesPromoRecord({
          ...promo,
          usageCount: promo.usageCount + 1,
          updatedAt: nowIso,
        })
      : promo
  ))

  return saveOrganizationPromoState(db, orgId, state.settings, nextPromos)
}

export { calculateSalesPromoDiscount }
