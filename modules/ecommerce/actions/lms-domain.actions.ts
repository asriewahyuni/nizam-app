'use server'

/**
 * Server action pengaturan custom domain LMS. Pesan error disanitasi agar
 * token provider dan detail database tidak pernah bocor ke browser.
 */
import { revalidatePath } from 'next/cache'
import {
  disableLmsTenantDomain,
  refreshLmsTenantDomain,
  requestLmsTenantDomain,
  setPrimaryLmsTenantDomain,
} from '@/modules/ecommerce/domains/lms-domain.server'
import type { LmsDomainRootBehavior } from '@/modules/ecommerce/lib/lms-domain'

type DomainActionResult = {
  success: boolean
  data?: unknown
  error?: string
}

function revalidateDomainSettings(storeId?: string) {
  revalidatePath('/lms/admin/penjualan/toko')
  revalidatePath('/lms/admin/penjualan/ringkasan')
  revalidatePath('/ecommerce')
  if (storeId) {
    revalidatePath(`/lms/admin/penjualan/toko/${storeId}`)
  }
}

async function runDomainAction(
  runner: () => Promise<unknown>,
  storeId?: string,
): Promise<DomainActionResult> {
  try {
    const data = await runner()
    revalidateDomainSettings(storeId)
    return { success: true, data }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error
        ? error.message
        : 'Pengaturan domain gagal diproses.',
    }
  }
}

export async function requestLmsTenantDomainAction(formData: FormData) {
  const storeId = String(formData.get('store_id') || '').trim()
  return runDomainAction(
    () => requestLmsTenantDomain({
      hostname: String(formData.get('hostname') || ''),
      storeId,
      rootBehavior: String(
        formData.get('root_behavior') || 'STOREFRONT',
      ).toUpperCase() as LmsDomainRootBehavior,
      isPrimary: String(formData.get('is_primary') || '') === 'true',
    }),
    storeId,
  )
}

export async function refreshLmsTenantDomainAction(formData: FormData) {
  return runDomainAction(
    () => refreshLmsTenantDomain(String(formData.get('domain_id') || '').trim()),
    String(formData.get('store_id') || '').trim(),
  )
}

export async function setPrimaryLmsTenantDomainAction(formData: FormData) {
  return runDomainAction(
    () => setPrimaryLmsTenantDomain(String(formData.get('domain_id') || '').trim()),
    String(formData.get('store_id') || '').trim(),
  )
}

export async function disableLmsTenantDomainAction(formData: FormData) {
  return runDomainAction(
    () => disableLmsTenantDomain(String(formData.get('domain_id') || '').trim()),
    String(formData.get('store_id') || '').trim(),
  )
}
