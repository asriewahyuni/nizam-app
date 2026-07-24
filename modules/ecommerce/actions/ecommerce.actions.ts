'use server'

import { revalidatePath } from 'next/cache'
import {
  approveOrderPayment,
  createStoreRecord,
  publishStoreThemeDraft,
  rejectOrderPayment,
  retryOrderErpSync,
  resetStoreThemeDraftFromTemplate,
  saveAccessPackage,
  saveProductEntitlements,
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
  revalidatePath('/lms/admin/penjualan')

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

export async function saveProductEntitlementsAction(formData: FormData) {
  return runAction(formData, saveProductEntitlements)
}

export async function saveAccessPackageAction(formData: FormData) {
  return runAction(formData, saveAccessPackage)
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


import { createClient } from '@/lib/supabase/server'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'

export async function quickPublishStoreProductAction(formData: FormData) {
  try {
    const orgData = await getActiveOrg()
    if (!orgData) return { success: false, error: 'Anda harus masuk terlebih dahulu.' }

    const storeId = formData.get('store_id')?.toString()
    const productId = formData.get('product_id')?.toString()
    const price = Number(formData.get('price') || 0)

    if (!storeId || !productId) return { success: false, error: 'Store dan produk wajib dipilih.' }

    const supabase = await createClient()
    const orgId = orgData.org.id

    const { data: prod } = await supabase.from('products').select('name').eq('id', productId).eq('org_id', orgId).single()
    if (!prod) return { success: false, error: 'Produk tidak ditemukan di katalog.' }

    const { error: insertErr } = await supabase.from('store_products').insert({
      org_id: orgId,
      store_id: storeId,
      product_id: productId,
      public_name: prod.name,
      public_slug: 'p-' + Math.random().toString(36).substring(2, 8),
      price_override: price,
      is_published: true
    })

    if (insertErr) return { success: false, error: 'Gagal menayangkan produk: ' + insertErr.message }

    revalidatePath('/lms/admin/penjualan')
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'Unknown error' }
  }
}


export async function quickCreateLmsProductAction(formData: FormData) {
  try {
    const orgData = await getActiveOrg()
    if (!orgData) return { success: false, error: 'Anda harus masuk terlebih dahulu.' }

    const name = formData.get('name')?.toString().trim()
    if (!name) return { success: false, error: 'Nama produk wajib diisi.' }

    const supabase = await createClient()
    const orgId = orgData.org.id

    const { data: newProd, error: insertErr } = await supabase.from('products').insert({
      org_id: orgId,
      name,
      sku: 'LMS-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
      type: 'DIGITAL',
      base_price: 0,
      is_active: true
    }).select('id').single()

    if (insertErr) return { success: false, error: 'Gagal membuat produk: ' + insertErr.message }

    revalidatePath('/lms/admin/penjualan')
    return { success: true, data: { productId: newProd.id } }
  } catch (err: any) {
    return { success: false, error: err.message || 'Unknown error' }
  }
}
