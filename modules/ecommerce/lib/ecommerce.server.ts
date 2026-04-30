import { cache } from 'react'
import { createAdminClient } from '@/lib/supabase/server'
import type { LooseDb } from '@/lib/supabase/loose'
import {
  buildEcommerceStorefrontView,
  type EcommerceStorefrontView,
} from '@/modules/ecommerce/lib/ecommerce'
import {
  calculateSalesPromoDiscount,
  getSalesPromosFromSettings,
  normalizeSalesPromoCode,
} from '@/modules/sales/lib/sales-promos'
import { getDateInTimeZone } from '@/lib/utils'

type PublicOrgRecord = {
  id: string
  name: string
  slug: string
  logo_url: string | null
  settings: unknown
}

type OrderRequestInput = {
  orgSlug: string
  fullName: string
  phone: string
  email?: string
  address?: string
  notes?: string
  promoCode?: string
  items: Array<{
    productId: string
    quantity: number
  }>
}

function normalizePublicOrgIdentifier(value: string) {
  return value.trim().toLowerCase()
}

function looksLikeUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value)
}

async function resolvePublicOrg(admin: LooseDb, orgIdentifier: string): Promise<PublicOrgRecord | null> {
  const normalizedIdentifier = normalizePublicOrgIdentifier(orgIdentifier)
  if (!normalizedIdentifier) return null

  const { data: slugOrg, error: slugError } = await admin
    .from('organizations')
    .select('id, name, slug, logo_url, settings, is_active')
    .eq('slug', normalizedIdentifier)
    .eq('is_active', true)
    .maybeSingle()

  if (!slugError && slugOrg?.id) {
    return {
      id: String(slugOrg.id),
      name: String((slugOrg as { name?: unknown }).name || ''),
      slug: String((slugOrg as { slug?: unknown }).slug || slugOrg.id),
      logo_url: ((slugOrg as { logo_url?: unknown }).logo_url as string | null) ?? null,
      settings: (slugOrg as { settings?: unknown }).settings ?? {},
    }
  }

  if (!looksLikeUuid(normalizedIdentifier)) return null

  const { data: idOrg, error: idError } = await admin
    .from('organizations')
    .select('id, name, slug, logo_url, settings, is_active')
    .eq('id', normalizedIdentifier)
    .eq('is_active', true)
    .maybeSingle()

  if (idError || !idOrg?.id) return null

  return {
    id: String(idOrg.id),
    name: String((idOrg as { name?: unknown }).name || ''),
    slug: String((idOrg as { slug?: unknown }).slug || idOrg.id),
    logo_url: ((idOrg as { logo_url?: unknown }).logo_url as string | null) ?? null,
    settings: (idOrg as { settings?: unknown }).settings ?? {},
  }
}

async function getStockByProduct(admin: LooseDb, orgId: string) {
  const [warehouseResult, stockResult] = await Promise.all([
    admin
      .from('warehouses')
      .select('id, is_active')
      .eq('org_id', orgId),
    admin
      .from('inventory_stocks')
      .select('product_id, warehouse_id, quantity')
      .eq('org_id', orgId),
  ])

  const activeWarehouseIds = new Set(
    ((warehouseResult.data as Array<{ id?: unknown; is_active?: unknown }> | null) || [])
      .filter((warehouse) => warehouse?.is_active !== false)
      .map((warehouse) => String(warehouse.id || ''))
      .filter(Boolean),
  )

  return (((stockResult.data as Array<{ product_id?: unknown; warehouse_id?: unknown; quantity?: unknown }> | null) || [])
    .filter((row) => activeWarehouseIds.size === 0 || activeWarehouseIds.has(String(row.warehouse_id || '')))
    .reduce<Record<string, number>>((acc, row) => {
      const productId = String(row.product_id || '').trim()
      if (!productId) return acc
      acc[productId] = (acc[productId] || 0) + Number(row.quantity || 0)
      return acc
    }, {}))
}

export async function getPublicStorefrontByOrgSlug(orgSlug: string): Promise<EcommerceStorefrontView | null> {
  const admin = (await createAdminClient()) as unknown as LooseDb
  const org = await resolvePublicOrg(admin, orgSlug)
  if (!org?.id) return null

  const [{ data: productsData, error: productsError }, stockByProduct] = await Promise.all([
    admin
      .from('products')
      .select('id, name, sku, description, category, unit, selling_price, type, is_active')
      .eq('org_id', org.id)
      .eq('is_active', true)
      .order('name', { ascending: true }),
    getStockByProduct(admin, org.id),
  ])

  if (productsError) throw new Error(productsError.message)

  const promos = getSalesPromosFromSettings(org.settings)
  const products = (((productsData as Array<Record<string, unknown>> | null) || []).map((product) => ({
    ...product,
    stock_available: stockByProduct[String(product.id || '')] || 0,
  })))

  return buildEcommerceStorefrontView({
    org,
    products,
    promos,
  })
}

export const getCachedPublicStorefrontByOrgSlug = cache(getPublicStorefrontByOrgSlug)

function sanitizeText(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, maxLength)
}

function buildDiscountAllocation(subtotals: number[], totalDiscount: number) {
  if (totalDiscount <= 0 || subtotals.length === 0) {
    return subtotals.map(() => 0)
  }

  const subtotal = subtotals.reduce((sum, value) => sum + value, 0)
  if (subtotal <= 0) return subtotals.map(() => 0)

  const allocations = subtotals.map((lineSubtotal) => Math.floor((lineSubtotal / subtotal) * totalDiscount))
  let remainder = totalDiscount - allocations.reduce((sum, value) => sum + value, 0)

  for (let index = 0; index < allocations.length && remainder > 0; index += 1) {
    allocations[index] += 1
    remainder -= 1
  }

  return allocations
}

function buildOrderNotes(input: OrderRequestInput, lineSummary: string, promoCode: string | null) {
  const parts = [
    '[E-Commerce Draft Quotation]',
    `Sumber: /toko/${input.orgSlug}`,
    `Pelanggan: ${input.fullName}`,
    `WhatsApp: ${input.phone}`,
    input.email ? `Email: ${input.email}` : '',
    input.address ? `Alamat: ${input.address}` : '',
    promoCode ? `Promo: ${promoCode}` : '',
    `Item:\n${lineSummary}`,
    input.notes ? `Catatan pelanggan: ${input.notes}` : '',
  ]

  return parts.filter(Boolean).join('\n')
}

export async function createPublicEcommerceOrderRequest(input: OrderRequestInput) {
  const admin = (await createAdminClient()) as unknown as LooseDb
  const org = await resolvePublicOrg(admin, input.orgSlug)
  if (!org?.id) {
    throw new Error('Toko tidak ditemukan.')
  }

  const normalizedName = sanitizeText(input.fullName, 120)
  const normalizedPhone = sanitizeText(input.phone, 80)
  const normalizedEmail = sanitizeText(input.email, 180)
  const normalizedAddress = sanitizeText(input.address, 500)
  const normalizedNotes = sanitizeText(input.notes, 1000)

  if (!normalizedName || !normalizedPhone) {
    throw new Error('Nama dan nomor WhatsApp wajib diisi.')
  }

  const normalizedItems = input.items
    .map((item) => ({
      productId: sanitizeText(item.productId, 80),
      quantity: Math.max(0, Math.min(999, Math.trunc(Number(item.quantity || 0)))),
    }))
    .filter((item) => item.productId && item.quantity > 0)

  if (normalizedItems.length === 0) {
    throw new Error('Keranjang masih kosong.')
  }

  const [{ data: productsData, error: productsError }, { data: branchData }] = await Promise.all([
    admin
      .from('products')
      .select('id, name, sku, selling_price, type, is_active')
      .eq('org_id', org.id)
      .eq('is_active', true),
    admin
      .from('branches')
      .select('id, name, is_active, created_at')
      .eq('org_id', org.id)
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ])

  if (productsError) throw new Error(productsError.message)

  const productMap = new Map(
    (((productsData as Array<Record<string, unknown>> | null) || []).map((product) => [
      String(product.id || ''),
      {
        id: String(product.id || ''),
        name: String(product.name || 'Produk'),
        sku: product.sku ? String(product.sku) : null,
        price: Math.max(0, Number(product.selling_price || 0)),
        type: String(product.type || 'INVENTORY'),
      },
    ]))
  )

  const lines = normalizedItems.map((item) => {
    const product = productMap.get(item.productId)
    if (!product) {
      throw new Error('Ada produk yang sudah tidak aktif. Muat ulang halaman toko lalu coba lagi.')
    }

    return {
      product,
      quantity: item.quantity,
      subtotal: item.quantity * product.price,
    }
  })

  const subtotal = lines.reduce((sum, line) => sum + line.subtotal, 0)
  if (subtotal <= 0) {
    throw new Error('Total order tidak valid.')
  }

  const normalizedPromoCode = normalizeSalesPromoCode(input.promoCode)
  const activePromos = getSalesPromosFromSettings(org.settings).filter((promo) => promo.status === 'ACTIVE')
  const activePromo = normalizedPromoCode
    ? activePromos.find((promo) => promo.code === normalizedPromoCode) || null
    : null

  if (normalizedPromoCode && !activePromo) {
    throw new Error(`Kode promo ${normalizedPromoCode} tidak aktif atau tidak ditemukan.`)
  }

  const discount = activePromo ? calculateSalesPromoDiscount(activePromo, subtotal) : 0
  const discountAllocations = buildDiscountAllocation(lines.map((line) => line.subtotal), discount)
  const grandTotal = Math.max(0, subtotal - discount)
  const branchId = branchData?.id ? String(branchData.id) : null
  const today = getDateInTimeZone('Asia/Jakarta')

  let contactId: string | null = null

  const { data: phoneContact } = await admin
    .from('contacts')
    .select('id')
    .eq('org_id', org.id)
    .eq('phone', normalizedPhone)
    .maybeSingle()

  if (phoneContact?.id) {
    contactId = String(phoneContact.id)
  } else if (normalizedEmail) {
    const { data: emailContact } = await admin
      .from('contacts')
      .select('id')
      .eq('org_id', org.id)
      .eq('email', normalizedEmail)
      .maybeSingle()

    if (emailContact?.id) {
      contactId = String(emailContact.id)
    }
  }

  if (!contactId) {
    const { data: contactData, error: contactError } = await admin
      .from('contacts')
      .insert({
        org_id: org.id,
        name: normalizedName,
        type: 'CUSTOMER',
        phone: normalizedPhone,
        email: normalizedEmail || null,
        address: normalizedAddress || null,
      })
      .select('id')
      .maybeSingle()

    if (contactError || !contactData?.id) {
      throw new Error(contactError?.message || 'Gagal membuat kontak pelanggan.')
    }

    contactId = String(contactData.id)
  } else {
    await admin
      .from('contacts')
      .update({
        name: normalizedName,
        phone: normalizedPhone,
        email: normalizedEmail || null,
        address: normalizedAddress || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', contactId)
  }

  const lineSummary = lines
    .map((line) => {
      const skuText = line.product.sku ? ` [${line.product.sku}]` : ''
      return `- ${line.product.name}${skuText} x ${line.quantity} = ${line.subtotal}`
    })
    .join('\n')

  const { data: saleData, error: saleError } = await admin
    .from('sales')
    .insert({
      org_id: org.id,
      branch_id: branchId,
      sale_date: today,
      customer_id: contactId,
      total_amount: subtotal,
      tax_amount: 0,
      discount_amount: discount,
      grand_total: grandTotal,
      status: 'QUOTATION',
      payment_status: 'UNPAID',
      notes: buildOrderNotes(
        {
          ...input,
          fullName: normalizedName,
          phone: normalizedPhone,
          email: normalizedEmail,
          address: normalizedAddress,
          notes: normalizedNotes,
        },
        lineSummary,
        activePromo?.code || null,
      ),
      created_by: null,
    })
    .select('id, sale_number, grand_total')
    .single()

  if (saleError || !saleData?.id) {
    throw new Error(saleError?.message || 'Gagal membuat draft quotation.')
  }

  const { error: itemError } = await admin
    .from('sales_items')
    .insert(
      lines.map((line, index) => ({
        org_id: org.id,
        sale_id: saleData.id,
        product_id: line.product.id,
        description: line.product.sku
          ? `${line.product.name} (${line.product.sku})`
          : line.product.name,
        quantity: line.quantity,
        unit_price: line.product.price,
        discount_amount: discountAllocations[index] || 0,
        tax_amount: 0,
        branch_id: branchId,
      })),
    )

  if (itemError) {
    throw new Error(itemError.message)
  }

  return {
    saleId: String(saleData.id),
    saleNumber: String((saleData as { sale_number?: unknown }).sale_number || ''),
    grandTotal: Number((saleData as { grand_total?: unknown }).grand_total || grandTotal),
  }
}
