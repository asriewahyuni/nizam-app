'use server'

import { revalidatePath } from 'next/cache'
import {
  approveOrderPayment,
  createStoreRecord,
  publishStoreThemeDraft,
  rejectOrderPayment,
  retryOrderErpSync,
  resetStoreThemeDraftFromTemplate,
  saveProductVariant,
  saveStoreBasics,
  saveStoreCatalogProduct,
  saveStoreDomain,
  saveStoreShippingRate,
  saveStoreShippingZone,
  saveStoreThemeDraft,
  uploadStoreThemeAsset,
} from '@/modules/ecommerce/lib/ecommerce.server'

function revalidateStorePaths(formData: FormData) {
  const orgSlug = String(formData.get('org_slug') || '').trim()
  const storeSlug = String(formData.get('store_slug') || '').trim()

  revalidatePath('/ecommerce')

  if (orgSlug && storeSlug) {
    revalidatePath(`/toko/${orgSlug}/${storeSlug}`)
    revalidatePath(`/toko/${orgSlug}/${storeSlug}/koleksi`)
  }
}

async function runAction(formData: FormData, runner: (formData: FormData) => Promise<unknown>) {
  try {
    const data = await runner(formData)
    revalidateStorePaths(formData)
    return { success: true, data }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Terjadi error yang tidak dikenal.',
    }
  }
}

export async function createStoreAction(formData: FormData) {
  return runAction(formData, createStoreRecord)
}

export async function saveStoreBasicsAction(formData: FormData) {
  return runAction(formData, saveStoreBasics)
}

export async function saveStoreDomainAction(formData: FormData) {
  return runAction(formData, saveStoreDomain)
}

export async function saveStoreShippingZoneAction(formData: FormData) {
  return runAction(formData, saveStoreShippingZone)
}

export async function saveStoreShippingRateAction(formData: FormData) {
  return runAction(formData, saveStoreShippingRate)
}

export async function saveStoreCatalogProductAction(formData: FormData) {
  return runAction(formData, saveStoreCatalogProduct)
}

export async function saveProductVariantAction(formData: FormData) {
  return runAction(formData, saveProductVariant)
}

export async function resetStoreThemeDraftAction(formData: FormData) {
  return runAction(formData, resetStoreThemeDraftFromTemplate)
}

export async function saveStoreThemeDraftAction(formData: FormData) {
  return runAction(formData, saveStoreThemeDraft)
}

export async function uploadStoreThemeAssetAction(formData: FormData) {
  return runAction(formData, uploadStoreThemeAsset)
}

export async function publishStoreThemeDraftAction(formData: FormData) {
  return runAction(formData, publishStoreThemeDraft)
}

export async function approveOrderPaymentAction(formData: FormData) {
  return runAction(formData, approveOrderPayment)
}

export async function retryOrderErpSyncAction(formData: FormData) {
  return runAction(formData, retryOrderErpSync)
}

export async function rejectOrderPaymentAction(formData: FormData) {
  return runAction(formData, rejectOrderPayment)
}
