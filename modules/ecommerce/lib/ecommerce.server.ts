import { randomBytes } from 'node:crypto'
import { cache } from 'react'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { connectPostgresClient, queryPostgres } from '@/lib/db/postgres'
import {
  buildPublicStorageObjectPath,
  buildPrivateStorageObjectPath,
  deleteObjectFromStorage,
  isObjectStorageConfigured,
  uploadObjectToStorage,
} from '@/lib/storage/object-storage.server'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import {
  buildThemeDraftFromTemplate,
  normalizeShippingMatcher,
  normalizeShippingRuleList,
  normalizeStoreCheckoutBranding,
  normalizeStorefrontThemeVersion,
  normalizeStoreSlug,
  normalizeStoreThemeLayout,
  normalizeStoreThemeTokens,
  resolveShippingRateForAddress,
  toThemeTemplateRows,
  type AdminCatalogProductView,
  type AdminOrderEventView,
  type AdminOrderPaymentView,
  type AdminShippingRateView,
  type AdminShippingZoneView,
  type AdminStoreProductView,
  type AdminThemeAssetView,
  type AdminVariantView,
  type EcommerceDashboardData,
  type PublicOrderStatusPayload,
  type ShippingAddressMatcherInput,
  type StoreAdminSummary,
  type StoreThemeTemplateSeed,
  type StoreThemeVersionView,
  type StorefrontProductView,
  type StorefrontPublicPayload,
  type StorefrontShippingRateView,
  type StorefrontStoreView,
  type StorefrontVariantView,
  STORE_THEME_TEMPLATE_SEEDS,
  type StorefrontAttributeChoice,
} from './ecommerce'

type AdminDb = Awaited<ReturnType<typeof createAdminClient>>

type PublicStoreContext = {
  storeId: string
  orgId: string
  orgSlug: string
  storeSlug: string
  branchId: string
  warehouseId: string
  bankAccountId: string
}

const ECOMMERCE_THEME_ASSET_PREFIX = 'ecommerce/theme-assets/'
const ECOMMERCE_PAYMENT_PROOF_PREFIX = 'ecommerce/payment-proofs/'
const THEME_ASSET_MAX_SIZE = 8 * 1024 * 1024
const PAYMENT_PROOF_MAX_SIZE = 5 * 1024 * 1024
const PUBLIC_ORDER_TOKEN_BYTES = 24
const PUBLIC_ORDER_TOKEN_TTL_DAYS = 14
const CHECKOUT_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000
const CHECKOUT_RATE_LIMIT_MAX = 12
const PROOF_UPLOAD_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000
const PROOF_UPLOAD_RATE_LIMIT_MAX = 10
const PAYMENT_PROOF_ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
])

function cleanText(value: unknown, max = 300): string {
  if (typeof value !== 'string') return ''
  return value.replace(/\s+/g, ' ').trim().slice(0, max)
}

function cleanLongText(value: unknown, max = 4000): string {
  if (typeof value !== 'string') return ''
  return value.replace(/\r/g, '').trim().slice(0, max)
}

function toNumber(value: unknown): number {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function toNullableNumber(value: unknown): number | null {
  const parsed = Number(value ?? '')
  return Number.isFinite(parsed) ? parsed : null
}

function toBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  const normalized = String(value || '').trim().toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'on' || normalized === 'yes'
}

function readBooleanWithFallback(formData: FormData, key: string, fallback: boolean) {
  return formData.has(key) ? toBoolean(formData.get(key)) : fallback
}

function toJsonObject(value: unknown) {
  if (typeof value === 'object' && value && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }

  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value)
      if (typeof parsed === 'object' && parsed && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>
      }
    } catch {
      return {}
    }
  }

  return {}
}

function formatPayloadPreview(value: unknown, max = 280) {
  if (value === null || value === undefined) return ''

  try {
    const raw = typeof value === 'string' ? value : JSON.stringify(value)
    return cleanLongText(raw, max)
  } catch {
    return ''
  }
}

function safeSlug(value: unknown, fallback: string) {
  const normalized = normalizeStoreSlug(String(value || ''))
  return normalized || normalizeStoreSlug(fallback) || `store-${Date.now()}`
}

async function resolveStoreCreateDefaults(
  admin: AdminDb,
  orgId: string,
  explicitBranchId?: string,
  explicitWarehouseId?: string,
  explicitBankAccountId?: string,
) {
  const [branchResult, warehouseResult, bankResult] = await Promise.all([
    admin.from('branches').select('id, name').eq('org_id', orgId).eq('is_active', true).order('name', { ascending: true }),
    admin.from('warehouses').select('id, name, branch_id').eq('org_id', orgId).eq('is_active', true).order('name', { ascending: true }),
    admin.from('bank_accounts').select('id, bank_name, account_number, branch_id').eq('org_id', orgId).eq('is_active', true).order('bank_name', { ascending: true }),
  ])

  if (branchResult.error) {
    throw new Error(`Gagal membaca daftar cabang: ${branchResult.error.message}`)
  }

  if (warehouseResult.error) {
    throw new Error(`Gagal membaca daftar gudang: ${warehouseResult.error.message}`)
  }

  if (bankResult.error) {
    throw new Error(`Gagal membaca daftar rekening penerima: ${bankResult.error.message}`)
  }

  const branchRows = branchResult.data || []
  const warehouseRows = warehouseResult.data || []
  const bankRows = bankResult.data || []

  if (!branchRows.length) {
    throw new Error('Belum ada cabang aktif. Buat satu cabang dulu sebelum membuat store.')
  }

  if (!warehouseRows.length) {
    throw new Error('Belum ada gudang aktif. Buat satu gudang dulu sebelum membuat store.')
  }

  if (!bankRows.length) {
    throw new Error('Belum ada rekening penerima aktif. Buat satu rekening dulu sebelum membuat store.')
  }

  const branchId = explicitBranchId || String(branchRows[0]?.id || '')
  const branchExists = branchRows.some((row) => String(row.id) === branchId)
  if (!branchExists) {
    throw new Error('Cabang default store tidak ditemukan. Pilih cabang lain atau cek data organisasi.')
  }

  const matchingWarehouse = warehouseRows.find((row) => String(row.branch_id || '') === branchId) || warehouseRows[0]
  const matchingBankAccount = bankRows.find((row) => String(row.branch_id || '') === branchId) || bankRows[0]

  const warehouseId = explicitWarehouseId || String(matchingWarehouse?.id || '')
  const bankAccountId = explicitBankAccountId || String(matchingBankAccount?.id || '')

  const warehouseExists = warehouseRows.some((row) => String(row.id) === warehouseId)
  if (!warehouseExists) {
    throw new Error('Gudang default store tidak ditemukan. Pilih gudang lain atau cek data organisasi.')
  }

  const bankAccountExists = bankRows.some((row) => String(row.id) === bankAccountId)
  if (!bankAccountExists) {
    throw new Error('Rekening penerima default store tidak ditemukan. Pilih rekening lain atau cek data organisasi.')
  }

  return {
    branchId,
    warehouseId,
    bankAccountId,
  }
}

function buildPaymentProofStorageKey(orgId: string, orderNumber: string, fileName: string) {
  const safeName = String(fileName || 'proof')
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    || 'proof'

  return `${ECOMMERCE_PAYMENT_PROOF_PREFIX}${orgId}/${orderNumber}/${Date.now()}-${safeName}`
}

function generatePublicOrderAccessToken() {
  return randomBytes(PUBLIC_ORDER_TOKEN_BYTES).toString('base64url')
}

function buildPublicOrderAccessUrl(orgSlug: string, storeSlug: string, orderNumber: string, accessToken: string) {
  const basePath = buildStoreCanonicalPath(orgSlug, storeSlug, `/pesanan/${orderNumber}`)
  return `${basePath}?token=${encodeURIComponent(accessToken)}`
}

function cleanClientKey(value: unknown, max = 120) {
  if (typeof value !== 'string') return ''
  return value.replace(/[^a-zA-Z0-9:_-]+/g, '').trim().slice(0, max)
}

function normalizeIpAddress(value: unknown) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  return raw.split(',')[0]?.trim().slice(0, 120) || ''
}

function canCustomerUploadPaymentProof(orderStatus: string, paymentStatus: string) {
  const normalizedOrderStatus = cleanText(orderStatus, 60).toUpperCase()
  const normalizedPaymentStatus = cleanText(paymentStatus, 60).toUpperCase()

  if (normalizedPaymentStatus === 'VALIDATED' || normalizedPaymentStatus === 'PAID') {
    return false
  }

  return ![
    'READY_TO_FULFILL',
    'FULFILLING',
    'SHIPPED',
    'COMPLETED',
    'CANCELLED',
    'REFUNDED',
  ].includes(normalizedOrderStatus)
}

function readShippingSnapshotLabel(value: unknown) {
  const snapshot = toJsonObject(value)
  const zoneName = cleanText(snapshot.zoneName, 120)
  const rateName = cleanText(snapshot.name, 120)
  const etaLabel = cleanText(snapshot.etaLabel, 120)

  return [zoneName, rateName, etaLabel].filter(Boolean).join(' • ')
}

async function enforcePublicRateLimit(args: {
  admin: AdminDb
  orgId: string
  storeId: string
  orderId?: string | null
  actionType: string
  scopeKey: string
  ipAddress?: string | null
  requestKey?: string | null
  limit: number
  windowMs: number
  message: string
}) {
  const ipAddress = normalizeIpAddress(args.ipAddress)
  const scopeKey = cleanText(args.scopeKey, 180)
  if (!scopeKey) return

  const cutoffIso = new Date(Date.now() - args.windowMs).toISOString()
  const query = args.admin
    .from('ecommerce_public_request_logs')
    .select('id', { count: 'exact', head: true })
    .eq('action_type', args.actionType)
    .eq('scope_key', scopeKey)
    .gte('created_at', cutoffIso)

  const scopedQuery = ipAddress ? query.eq('ip_address', ipAddress) : query
  const { count, error } = await scopedQuery

  if (error) {
    throw new Error(`Rate limit tidak bisa dicek: ${error.message}`)
  }

  if ((count || 0) >= args.limit) {
    throw new Error(args.message)
  }

  const { error: insertError } = await args.admin
    .from('ecommerce_public_request_logs')
    .insert({
      org_id: args.orgId,
      store_id: args.storeId,
      order_id: args.orderId || null,
      action_type: args.actionType,
      scope_key: scopeKey,
      ip_address: ipAddress || null,
      request_key: cleanClientKey(args.requestKey, 160) || null,
    })

  if (insertError) {
    throw new Error(`Log rate limit gagal disimpan: ${insertError.message}`)
  }
}

export function buildThemeAssetStorageKey(orgId: string, storeId: string, fileName: string) {
  const safeName = String(fileName || 'asset')
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    || 'asset'

  return `${ECOMMERCE_THEME_ASSET_PREFIX}${orgId}/${storeId}/${Date.now()}-${safeName}`
}

export function isPublicThemeAssetStorageKey(key: string) {
  return key.startsWith(ECOMMERCE_THEME_ASSET_PREFIX)
}

export function isPrivateEcommercePaymentProofStorageKey(key: string) {
  return key.startsWith(ECOMMERCE_PAYMENT_PROOF_PREFIX)
}

function extractOrgIdFromPrivateEcommerceStorageKey(key: string) {
  const parts = key.split('/').filter(Boolean)
  return parts.length >= 3 ? parts[2] || null : null
}

export function getPrivateEcommerceProofOrgId(key: string) {
  return extractOrgIdFromPrivateEcommerceStorageKey(key)
}

async function requireActiveOrgAdminContext() {
  const orgData = await getActiveOrg()
  if (!orgData?.org?.id) {
    throw new Error('Organisasi aktif tidak ditemukan.')
  }

  const role = String(orgData.role || '').toLowerCase()
  if (!['owner', 'admin', 'manager'].includes(role)) {
    throw new Error('Akses e-commerce membutuhkan role owner, admin, atau manager.')
  }

  const admin = (await createAdminClient()) as AdminDb
  const authed = await createClient()
  const {
    data: { user },
  } = await authed.auth.getUser()

  return {
    admin,
    orgId: orgData.org.id,
    orgSlug: String(orgData.org.slug || orgData.org.id),
    orgName: String(orgData.org.name || ''),
    userId: user?.id ? String(user.id) : null,
  }
}

function mapStoreSummary(
  row: Record<string, unknown>,
  settings: Record<string, unknown> | undefined,
  domains: string[]
): StoreAdminSummary {
  return {
    id: String(row.id || ''),
    orgId: String(row.org_id || ''),
    name: String(row.name || ''),
    slug: String(row.slug || ''),
    brandName: cleanText(row.brand_name, 160),
    lineName: cleanText(row.line_name, 160),
    branchId: String(row.branch_id || ''),
    warehouseId: String(row.warehouse_id || ''),
    bankAccountId: String(row.bank_account_id || ''),
    supportEmail: cleanText(row.support_email, 200),
    supportPhone: cleanText(row.support_phone, 80),
    whatsappPhone: cleanText(row.whatsapp_phone, 80),
    headline: cleanText(row.headline, 240),
    subheadline: cleanLongText(row.subheadline, 600),
    logoUrl: cleanText(row.logo_url, 500),
    currency: cleanText(row.currency, 16) || 'IDR',
    isActive: Boolean(row.is_active),
    isPublished: Boolean(row.is_published),
    domainList: domains,
    transferInstructions: cleanLongText(settings?.transfer_instructions, 2000),
    heroNotice: cleanText(settings?.hero_notice, 240),
    checkoutNotice: cleanText(settings?.checkout_notice, 240),
  }
}

async function ensureThemeTemplateSeeds(admin: AdminDb) {
  const { error } = await admin
    .from('store_theme_templates')
    .upsert(toThemeTemplateRows(), { onConflict: 'template_key' })

  if (error) {
    throw new Error(`Gagal menyiapkan starter template theme: ${error.message}`)
  }
}

async function getThemeTemplateRow(admin: AdminDb, templateKey: string) {
  const { data, error } = await admin
    .from('store_theme_templates')
    .select('id, template_key, name')
    .eq('template_key', templateKey)
    .maybeSingle()

  if (error) {
    throw new Error(`Gagal membaca starter template theme: ${error.message}`)
  }

  return data
}

async function ensureStoreThemeShell(
  admin: AdminDb,
  input: {
    orgId: string
    storeId: string
    templateKey?: string | null
    userId?: string | null
  }
) {
  await ensureThemeTemplateSeeds(admin)
  const draftSeed = buildThemeDraftFromTemplate(input.templateKey)
  const templateRow = await getThemeTemplateRow(admin, draftSeed.templateKey)

  const { data: published } = await admin
    .from('store_theme_versions')
    .select('*')
    .eq('store_id', input.storeId)
    .eq('status', 'PUBLISHED')
    .maybeSingle()

  if (!published?.id) {
    const { error: publishedError } = await admin
      .from('store_theme_versions')
      .insert({
        org_id: input.orgId,
        store_id: input.storeId,
        template_id: templateRow?.id || null,
        version_name: `${draftSeed.versionName} Live`,
        status: 'PUBLISHED',
        tokens: draftSeed.tokens,
        layout: draftSeed.layout,
        branding: { checkout: normalizeStoreCheckoutBranding(draftSeed.layout.checkout) },
        published_at: new Date().toISOString(),
        created_by: input.userId,
      })

    if (publishedError) {
      throw new Error(`Gagal membuat theme published awal: ${publishedError.message}`)
    }
  }

  const { data: draft } = await admin
    .from('store_theme_versions')
    .select('*')
    .eq('store_id', input.storeId)
    .eq('status', 'DRAFT')
    .maybeSingle()

  if (!draft?.id) {
    const source = published?.id
      ? normalizeStorefrontThemeVersion(published as Record<string, unknown>)
      : {
          versionName: draftSeed.versionName,
          tokens: draftSeed.tokens,
          layout: draftSeed.layout,
          branding: { checkout: normalizeStoreCheckoutBranding(draftSeed.layout.checkout) },
        }

    const { error: draftError } = await admin
      .from('store_theme_versions')
      .insert({
        org_id: input.orgId,
        store_id: input.storeId,
        template_id: templateRow?.id || null,
        version_name: `${source.versionName || draftSeed.versionName} Draft`,
        status: 'DRAFT',
        tokens: source.tokens || draftSeed.tokens,
        layout: source.layout || draftSeed.layout,
        branding: source.branding || { checkout: normalizeStoreCheckoutBranding(draftSeed.layout.checkout) },
        created_by: input.userId,
      })

    if (draftError) {
      throw new Error(`Gagal membuat theme draft awal: ${draftError.message}`)
    }
  }
}

async function getPublicStoreContext(orgSlug: string, storeSlug: string): Promise<PublicStoreContext | null> {
  const result = await queryPostgres<{
    store_id: string
    org_id: string
    org_slug: string
    store_slug: string
    branch_id: string
    warehouse_id: string
    bank_account_id: string
  }>(
    `
      SELECT
        s.id AS store_id,
        s.org_id,
        o.slug AS org_slug,
        s.slug AS store_slug,
        s.branch_id,
        s.warehouse_id,
        s.bank_account_id
      FROM public.stores s
      JOIN public.organizations o ON o.id = s.org_id
      WHERE o.slug = $1
        AND s.slug = $2
        AND COALESCE(o.is_active, TRUE) = TRUE
        AND s.is_active = TRUE
        AND s.is_published = TRUE
      LIMIT 1
    `,
    [orgSlug, storeSlug]
  )

  const row = result.rows[0]
  if (!row) return null

  return {
    storeId: row.store_id,
    orgId: row.org_id,
    orgSlug: row.org_slug,
    storeSlug: row.store_slug,
    branchId: row.branch_id,
    warehouseId: row.warehouse_id,
    bankAccountId: row.bank_account_id,
  }
}

async function getStoreThemeVersion(
  admin: AdminDb,
  storeId: string,
  previewToken?: string | null
): Promise<StoreThemeVersionView> {
  let selected: Record<string, unknown> | null = null

  if (previewToken) {
    const { data: previewTheme } = await admin
      .from('store_theme_versions')
      .select('*')
      .eq('store_id', storeId)
      .eq('status', 'DRAFT')
      .eq('preview_token', previewToken)
      .maybeSingle()

    if (previewTheme?.id) {
      selected = previewTheme as Record<string, unknown>
    }
  }

  if (!selected) {
    const { data: published } = await admin
      .from('store_theme_versions')
      .select('*')
      .eq('store_id', storeId)
      .eq('status', 'PUBLISHED')
      .maybeSingle()

    selected = (published as Record<string, unknown> | null) || null
  }

  if (!selected) {
    const { data: draft } = await admin
      .from('store_theme_versions')
      .select('*')
      .eq('store_id', storeId)
      .eq('status', 'DRAFT')
      .maybeSingle()

    if (draft?.id) {
      selected = draft as Record<string, unknown>
    }
  }

  if (!selected) {
    throw new Error('Theme toko belum tersedia.')
  }

  return normalizeStorefrontThemeVersion(selected)
}

async function getStorefrontProducts(
  _admin: AdminDb,
  context: PublicStoreContext
): Promise<StorefrontProductView[]> {
  const { rows: productRows } = await queryPostgres<{
    product_id: string
    inventory_product_id: string
    public_slug: string
    public_name: string
    short_description: string | null
    public_description: string | null
    badge_text: string | null
    price: string
    compare_price: string
    is_featured: boolean
    is_published: boolean
    base_description: string | null
    unit: string | null
    product_type: string | null
  }>(
    `
      SELECT
        sp.product_id,
        sp.product_id AS inventory_product_id,
        sp.public_slug,
        sp.public_name,
        sp.short_description,
        sp.public_description,
        sp.badge_text,
        COALESCE(sp.price_override, p.selling_price, 0)::text AS price,
        COALESCE(sp.compare_price, 0)::text AS compare_price,
        sp.is_featured,
        sp.is_published,
        p.description AS base_description,
        p.unit,
        p.type AS product_type
      FROM public.store_products sp
      JOIN public.products p ON p.id = sp.product_id
      WHERE sp.store_id = $1
        AND sp.is_published = TRUE
      ORDER BY sp.is_featured DESC, sp.sort_order ASC, sp.public_name ASC
    `,
    [context.storeId]
  )

  const productIds = [...new Set(productRows.map((row) => row.product_id))]
  if (productIds.length === 0) return []

  const { rows: variantRows } = await queryPostgres<{
    id: string
    product_id: string
    inventory_product_id: string
    sku: string | null
    name: string
    is_default: boolean
    is_published: boolean | null
    price: string
    compare_price: string
    image_url: string | null
  }>(
    `
      SELECT
        pv.id,
        pv.product_id,
        pv.inventory_product_id,
        pv.sku,
        pv.name,
        pv.is_default,
        COALESCE(svo.is_published, TRUE) AS is_published,
        COALESCE(svo.price_override, sp.price_override, inventory_ref.selling_price, 0)::text AS price,
        COALESCE(svo.compare_price, sp.compare_price, 0)::text AS compare_price,
        svo.hero_image_url AS image_url
      FROM public.product_variants pv
      JOIN public.store_products sp
        ON sp.product_id = pv.product_id
       AND sp.store_id = $1
       AND sp.is_published = TRUE
      JOIN public.products inventory_ref
        ON inventory_ref.id = pv.inventory_product_id
      LEFT JOIN public.store_variant_overrides svo
        ON svo.store_id = $1
       AND svo.variant_id = pv.id
      WHERE pv.org_id = $2
        AND pv.product_id = ANY($3::uuid[])
        AND pv.is_active = TRUE
      ORDER BY pv.product_id ASC, pv.sort_order ASC, pv.name ASC
    `,
    [context.storeId, context.orgId, productIds]
  )

  const variantIds = variantRows.map((row) => row.id)
  const { rows: choiceRows } = variantIds.length
    ? await queryPostgres<{
        variant_id: string
        attribute_id: string
        attribute_name: string
        attribute_value_id: string
        attribute_value: string
        swatch_hex: string | null
      }>(
        `
          SELECT
            pvav.variant_id,
            pa.id AS attribute_id,
            pa.name AS attribute_name,
            pav.id AS attribute_value_id,
            pav.value AS attribute_value,
            pav.swatch_hex
          FROM public.product_variant_attribute_values pvav
          JOIN public.product_attributes pa ON pa.id = pvav.attribute_id
          JOIN public.product_attribute_values pav ON pav.id = pvav.attribute_value_id
          WHERE pvav.variant_id = ANY($1::uuid[])
          ORDER BY pa.sort_order ASC, pa.name ASC, pav.sort_order ASC, pav.value ASC
        `,
        [variantIds]
      )
    : { rows: [] as Array<{
      variant_id: string
      attribute_id: string
      attribute_name: string
      attribute_value_id: string
      attribute_value: string
      swatch_hex: string | null
    }> }

  const allInventoryIds = [
    ...new Set([
      ...productRows.map((row) => row.inventory_product_id),
      ...variantRows.map((row) => row.inventory_product_id),
    ]),
  ]

  const { rows: stockRows } = allInventoryIds.length
    ? await queryPostgres<{ product_id: string; qty: string }>(
        `
          SELECT product_id, COALESCE(SUM(quantity), 0)::text AS qty
          FROM public.inventory_stocks
          WHERE org_id = $1
            AND warehouse_id = $2
            AND product_id = ANY($3::uuid[])
          GROUP BY product_id
        `,
        [context.orgId, context.warehouseId, allInventoryIds]
      )
    : { rows: [] as Array<{ product_id: string; qty: string }> }

  const { rows: mediaRows } = await queryPostgres<{
    store_id: string | null
    product_id: string
    variant_id: string | null
    url: string
    is_primary: boolean
    sort_order: number
  }>(
    `
      SELECT
        store_id,
        product_id,
        variant_id,
        url,
        is_primary,
        sort_order
      FROM public.ecommerce_product_media
      WHERE org_id = $1
        AND product_id = ANY($2::uuid[])
        AND (store_id IS NULL OR store_id = $3)
      ORDER BY
        CASE WHEN store_id = $3 THEN 0 ELSE 1 END,
        CASE WHEN is_primary THEN 0 ELSE 1 END,
        sort_order ASC,
        created_at ASC
    `,
    [context.orgId, productIds, context.storeId]
  )

  const stockByProductId = new Map<string, number>(
    stockRows.map((row) => [row.product_id, toNumber(row.qty)])
  )

  const choicesByVariantId = new Map<string, StorefrontAttributeChoice[]>()
  for (const row of choiceRows) {
    const bucket = choicesByVariantId.get(row.variant_id) || []
    bucket.push({
      attributeId: row.attribute_id,
      attributeName: row.attribute_name,
      attributeValueId: row.attribute_value_id,
      attributeValue: row.attribute_value,
      swatchHex: row.swatch_hex,
    })
    choicesByVariantId.set(row.variant_id, bucket)
  }

  const mediaKeyForRow = (productId: string, variantId?: string | null) => `${productId}::${variantId || ''}`
  const mediaByKey = new Map<string, string[]>()

  for (const row of mediaRows) {
    const key = mediaKeyForRow(row.product_id, row.variant_id)
    const bucket = mediaByKey.get(key) || []
    if (!bucket.includes(row.url)) bucket.push(row.url)
    mediaByKey.set(key, bucket)
  }

  const variantsByProductId = new Map<string, StorefrontVariantView[]>()
  for (const row of variantRows) {
    const variant: StorefrontVariantView = {
      id: row.id,
      inventoryProductId: row.inventory_product_id,
      sku: cleanText(row.sku, 80),
      name: cleanText(row.name, 160),
      price: toNumber(row.price),
      comparePrice: toNumber(row.compare_price),
      imageUrl: cleanText(row.image_url, 500) || mediaByKey.get(mediaKeyForRow(row.product_id, row.id))?.[0] || '',
      isDefault: Boolean(row.is_default),
      isPublished: Boolean(row.is_published ?? true),
      stockQty: toNumber(stockByProductId.get(row.inventory_product_id)),
      choices: choicesByVariantId.get(row.id) || [],
    }

    if (!variant.isPublished) continue
    const bucket = variantsByProductId.get(row.product_id) || []
    bucket.push(variant)
    variantsByProductId.set(row.product_id, bucket)
  }

  return productRows.map((row) => {
    const productGallery = mediaByKey.get(mediaKeyForRow(row.product_id, null)) || []
    const variants = variantsByProductId.get(row.product_id) || []
    const fallbackStock = variants.length
      ? variants.reduce((total, variant) => total + variant.stockQty, 0)
      : toNumber(stockByProductId.get(row.inventory_product_id))

    return {
      id: row.product_id,
      inventoryProductId: row.inventory_product_id,
      slug: row.public_slug,
      name: row.public_name,
      shortDescription: cleanLongText(row.short_description, 300),
      description: cleanLongText(row.public_description || row.base_description, 3000),
      badgeText: cleanText(row.badge_text, 80),
      price: toNumber(row.price),
      comparePrice: toNumber(row.compare_price),
      imageUrl: productGallery[0] || variants[0]?.imageUrl || '',
      gallery: productGallery.length > 0
        ? productGallery
        : variants.map((variant) => variant.imageUrl).filter(Boolean),
      isFeatured: Boolean(row.is_featured),
      isPublished: Boolean(row.is_published),
      stockQty: fallbackStock,
      variants,
    }
  })
}

async function getStorefrontShippingRates(context: PublicStoreContext): Promise<StorefrontShippingRateView[]> {
  const { rows } = await queryPostgres<{
    id: string
    zone_id: string
    zone_name: string
    countries: unknown
    provinces: unknown
    cities: unknown
    postal_codes: unknown
    name: string
    amount: string
    eta_label: string | null
  }>(
    `
      SELECT
        sr.id,
        sr.zone_id,
        sz.name AS zone_name,
        sz.countries,
        sz.provinces,
        sz.cities,
        sz.postal_codes,
        sr.name,
        sr.flat_amount::text AS amount,
        sr.eta_label
      FROM public.store_shipping_rates sr
      JOIN public.store_shipping_zones sz
        ON sz.id = sr.zone_id
      WHERE sr.store_id = $1
        AND sr.is_active = TRUE
        AND sz.is_active = TRUE
      ORDER BY sz.name ASC, sr.name ASC
    `,
    [context.storeId]
  )

  return rows.map((row) => ({
    id: row.id,
    zoneId: row.zone_id,
    zoneName: row.zone_name,
    name: row.name,
    amount: toNumber(row.amount),
    etaLabel: cleanText(row.eta_label, 120),
    matcher: normalizeShippingMatcher({
      countries: row.countries,
      provinces: row.provinces,
      cities: row.cities,
      postalCodes: row.postal_codes,
    }),
  }))
}

async function getStorefrontStoreView(admin: AdminDb, context: PublicStoreContext): Promise<StorefrontStoreView> {
  const { data: storeRow, error: storeError } = await admin
    .from('stores')
    .select('*')
    .eq('id', context.storeId)
    .maybeSingle()

  if (storeError || !storeRow?.id) {
    throw new Error(storeError?.message || 'Store tidak ditemukan.')
  }

  const { data: settingsRow } = await admin
    .from('store_settings')
    .select('*')
    .eq('store_id', context.storeId)
    .maybeSingle()

  return {
    id: String(storeRow.id),
    orgId: String(storeRow.org_id),
    orgSlug: context.orgSlug,
    name: cleanText(storeRow.name, 160),
    slug: cleanText(storeRow.slug, 120),
    brandName: cleanText(storeRow.brand_name, 160),
    lineName: cleanText(storeRow.line_name, 160),
    logoUrl: cleanText(storeRow.logo_url, 500),
    headline: cleanText(storeRow.headline, 200) || 'Belanja langsung dari toko resmi',
    subheadline: cleanLongText(storeRow.subheadline, 600) || 'Katalog, pembayaran, dan status order dirapikan langsung di dalam sistem.',
    supportEmail: cleanText(storeRow.support_email, 200),
    supportPhone: cleanText(storeRow.support_phone, 80),
    whatsappPhone: cleanText(storeRow.whatsapp_phone, 80),
    transferInstructions: cleanLongText(settingsRow?.transfer_instructions, 2000),
    seoTitle: cleanText(settingsRow?.seo_title, 200) || cleanText(storeRow.name, 160),
    seoDescription: cleanText(settingsRow?.seo_description, 260) || cleanText(storeRow.subheadline, 240),
    heroNotice: cleanText(settingsRow?.hero_notice, 200),
    checkoutNotice: cleanText(settingsRow?.checkout_notice, 200),
    currency: cleanText(storeRow.currency, 12) || 'IDR',
  }
}

export async function getPublicStorefrontPayload(
  orgSlug: string,
  storeSlug: string,
  options?: { previewToken?: string | null }
): Promise<StorefrontPublicPayload | null> {
  const context = await getPublicStoreContext(orgSlug, storeSlug)
  if (!context) return null

  const admin = (await createAdminClient()) as AdminDb
  const [store, products, shippingRates, theme] = await Promise.all([
    getStorefrontStoreView(admin, context),
    getStorefrontProducts(admin, context),
    getStorefrontShippingRates(context),
    getStoreThemeVersion(admin, context.storeId, options?.previewToken || null),
  ])

  return {
    store,
    theme,
    products,
    shippingRates,
    previewMode: Boolean(options?.previewToken) && theme.status === 'DRAFT',
  }
}

export const getCachedPublicStorefrontPayload = cache(getPublicStorefrontPayload)

export async function resolveStoreDomainHost(host: string): Promise<{ orgSlug: string; storeSlug: string } | null> {
  const normalizedHost = String(host || '')
    .trim()
    .toLowerCase()
    .split(':')[0]

  if (!normalizedHost) return null

  const result = await queryPostgres<{ org_slug: string; store_slug: string }>(
    `
      SELECT o.slug AS org_slug, s.slug AS store_slug
      FROM public.store_domains sd
      JOIN public.stores s ON s.id = sd.store_id
      JOIN public.organizations o ON o.id = s.org_id
      WHERE LOWER(sd.domain) = $1
        AND s.is_active = TRUE
        AND s.is_published = TRUE
        AND COALESCE(o.is_active, TRUE) = TRUE
      ORDER BY sd.is_primary DESC, sd.created_at ASC
      LIMIT 1
    `,
    [normalizedHost]
  )

  const row = result.rows[0]
  if (!row) return null

  return {
    orgSlug: row.org_slug,
    storeSlug: row.store_slug,
  }
}

export function buildStoreCanonicalPath(orgSlug: string, storeSlug: string, suffix = '') {
  const safeSuffix = (suffix.startsWith('/') ? suffix : `/${suffix}`).replace(/\/+$/, '')
  if (!suffix) {
    return `/toko/${orgSlug}/${storeSlug}`
  }
  return `/toko/${orgSlug}/${storeSlug}${safeSuffix}`
}

export async function getEcommerceDashboardData(): Promise<EcommerceDashboardData> {
  const { admin, orgId } = await requireActiveOrgAdminContext()
  await ensureThemeTemplateSeeds(admin)

  const [
    storesResult,
    settingsResult,
    domainsResult,
    productsResult,
    storeProductsResult,
    mediaResult,
    variantsResult,
    overridesResult,
    choiceResult,
    attributeResult,
    attributeValueResult,
    zoneResult,
    rateResult,
    themeResult,
    themeAssetResult,
    branchResult,
    warehouseResult,
    bankResult,
  ] = await Promise.all([
    admin.from('stores').select('*').eq('org_id', orgId).order('created_at', { ascending: true }),
    admin.from('store_settings').select('*').eq('org_id', orgId),
    admin.from('store_domains').select('*').eq('org_id', orgId).order('is_primary', { ascending: false }),
    admin.from('products').select('id, name, sku, type, selling_price, unit, description, is_active').eq('org_id', orgId).eq('is_active', true).order('name', { ascending: true }),
    admin.from('store_products').select('*').eq('org_id', orgId),
    admin.from('ecommerce_product_media').select('*').eq('org_id', orgId),
    admin.from('product_variants').select('*').eq('org_id', orgId).order('sort_order', { ascending: true }),
    admin.from('store_variant_overrides').select('*').eq('org_id', orgId),
    admin.from('product_variant_attribute_values').select('*').eq('org_id', orgId),
    admin.from('product_attributes').select('*').eq('org_id', orgId),
    admin.from('product_attribute_values').select('*').eq('org_id', orgId),
    admin.from('store_shipping_zones').select('*').eq('org_id', orgId).order('name', { ascending: true }),
    admin.from('store_shipping_rates').select('*').eq('org_id', orgId).order('name', { ascending: true }),
    admin.from('store_theme_versions').select('*').eq('org_id', orgId).order('updated_at', { ascending: false }),
    admin.from('store_theme_assets').select('*').eq('org_id', orgId).order('created_at', { ascending: false }),
    admin.from('branches').select('id, name, code').eq('org_id', orgId).eq('is_active', true).order('name', { ascending: true }),
    admin.from('warehouses').select('id, name, branch_id').eq('org_id', orgId).eq('is_active', true).order('name', { ascending: true }),
    admin.from('bank_accounts').select('id, bank_name, account_number, account_holder, branch_id').eq('org_id', orgId).eq('is_active', true).order('bank_name', { ascending: true }),
  ])

  const recentOrderResult = await queryPostgres<{
    payment_id: string | null
    order_id: string
    order_number: string
    store_id: string
    store_name: string
    customer_name: string
    customer_email: string | null
    customer_phone: string | null
    status: string
    payment_status: string
    reservation_status: string | null
    grand_total: string
    created_at: string
    payment_due_at: string | null
    paid_amount: string | null
    paid_at: string | null
    proof_url: string | null
    review_note: string | null
    erp_sale_id: string | null
    erp_sync_status: string | null
    erp_sync_error: string | null
  }>(
    `
      SELECT
        ep.id AS payment_id,
        eo.id AS order_id,
        eo.order_number,
        eo.store_id,
        s.name AS store_name,
        eo.customer_name,
        eo.customer_email,
        eo.customer_phone,
        eo.status,
        eo.payment_status,
        CASE
          WHEN COALESCE(rs.active_count, 0) > 0 THEN 'ACTIVE'
          WHEN COALESCE(rs.consumed_count, 0) > 0 THEN 'CONSUMED'
          WHEN COALESCE(rs.released_count, 0) > 0 THEN 'RELEASED'
          ELSE 'NONE'
        END AS reservation_status,
        eo.grand_total::text,
        eo.created_at::text,
        eo.payment_due_at::text,
        ep.paid_amount::text,
        ep.paid_at::text,
        ep.proof_url,
        ep.review_note,
        eo.erp_sale_id::text,
        eo.erp_sync_status,
        eo.erp_sync_error
      FROM public.ecommerce_orders eo
      JOIN public.stores s ON s.id = eo.store_id
      LEFT JOIN LATERAL (
        SELECT *
        FROM public.ecommerce_order_payments p
        WHERE p.order_id = eo.id
        ORDER BY p.created_at DESC
        LIMIT 1
      ) ep ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) FILTER (WHERE status = 'ACTIVE') AS active_count,
          COUNT(*) FILTER (WHERE status = 'CONSUMED') AS consumed_count,
          COUNT(*) FILTER (WHERE status = 'RELEASED') AS released_count
        FROM public.ecommerce_inventory_reservations r
        WHERE r.order_id = eo.id
      ) rs ON TRUE
      WHERE eo.org_id = $1
      ORDER BY eo.created_at DESC
      LIMIT 60
    `,
    [orgId]
  )

  const recentOrderIds = [...new Set(recentOrderResult.rows.map((row) => row.order_id).filter(Boolean))]
  const orderEventResult = recentOrderIds.length
    ? await queryPostgres<{
        id: string
        order_id: string
        order_number: string
        actor_user_id: string | null
        actor_label: string | null
        event_type: string
        message: string
        payload: unknown
        created_at: string
      }>(
        `
          SELECT
            e.id,
            e.order_id,
            eo.order_number,
            e.actor_user_id::text,
            e.actor_label,
            e.event_type,
            e.message,
            e.payload,
            e.created_at::text
          FROM public.ecommerce_order_events e
          JOIN public.ecommerce_orders eo ON eo.id = e.order_id
          WHERE e.org_id = $1
            AND e.order_id = ANY($2::uuid[])
          ORDER BY e.created_at DESC
          LIMIT 240
        `,
        [orgId, recentOrderIds]
      )
    : { rows: [] as Array<{
      id: string
      order_id: string
      order_number: string
      actor_user_id: string | null
      actor_label: string | null
      event_type: string
      message: string
      payload: unknown
      created_at: string
    }> }

  const stores = Array.isArray(storesResult.data) ? storesResult.data : []
  const storeSettings = Array.isArray(settingsResult.data) ? settingsResult.data : []
  const storeDomains = Array.isArray(domainsResult.data) ? domainsResult.data : []
  const products = Array.isArray(productsResult.data) ? productsResult.data : []
  const storeProducts = Array.isArray(storeProductsResult.data) ? storeProductsResult.data : []
  const mediaRows = Array.isArray(mediaResult.data) ? mediaResult.data : []
  const variantRows = Array.isArray(variantsResult.data) ? variantsResult.data : []
  const overrideRows = Array.isArray(overridesResult.data) ? overridesResult.data : []
  const choiceRows = Array.isArray(choiceResult.data) ? choiceResult.data : []
  const attributeRows = Array.isArray(attributeResult.data) ? attributeResult.data : []
  const attributeValueRows = Array.isArray(attributeValueResult.data) ? attributeValueResult.data : []
  const zoneRows = Array.isArray(zoneResult.data) ? zoneResult.data : []
  const rateRows = Array.isArray(rateResult.data) ? rateResult.data : []
  const themeRows = Array.isArray(themeResult.data) ? themeResult.data : []
  const themeAssetRows = Array.isArray(themeAssetResult.data) ? themeAssetResult.data : []
  const branchRows = Array.isArray(branchResult.data) ? branchResult.data : []
  const warehouseRows = Array.isArray(warehouseResult.data) ? warehouseResult.data : []
  const bankRows = Array.isArray(bankResult.data) ? bankResult.data : []

  const settingsByStoreId = new Map<string, Record<string, unknown>>(
    storeSettings.map((row) => [String(row.store_id || ''), row as Record<string, unknown>])
  )

  const domainsByStoreId = storeDomains.reduce<Map<string, string[]>>((map, row) => {
    const storeId = String(row.store_id || '')
    const bucket = map.get(storeId) || []
    const domain = cleanText(row.domain, 255)
    if (domain) bucket.push(domain)
    map.set(storeId, bucket)
    return map
  }, new Map())

  const mediaByStoreProduct = new Map<string, string>()
  for (const row of mediaRows) {
    if (String(row.variant_id || '')) continue
    const key = `${String(row.store_id || '')}:${String(row.product_id || '')}`
    if (!mediaByStoreProduct.has(key) && cleanText(row.url, 500)) {
      mediaByStoreProduct.set(key, cleanText(row.url, 500))
    }
  }

  const attributeById = new Map<string, string>(
    attributeRows.map((row) => [String(row.id || ''), cleanText(row.name, 120)])
  )
  const attributeValueById = new Map<string, string>(
    attributeValueRows.map((row) => [String(row.id || ''), cleanText(row.value, 120)])
  )

  const variantAttributeTextByVariantId = new Map<string, string[]>()
  for (const row of choiceRows) {
    const variantId = String(row.variant_id || '')
    const attributeName = attributeById.get(String(row.attribute_id || '')) || 'Atribut'
    const valueLabel = attributeValueById.get(String(row.attribute_value_id || '')) || 'Nilai'
    const bucket = variantAttributeTextByVariantId.get(variantId) || []
    bucket.push(`${attributeName}: ${valueLabel}`)
    variantAttributeTextByVariantId.set(variantId, bucket)
  }

  const overrideByVariantId = new Map<string, Record<string, unknown>>(
    overrideRows.map((row) => [String(row.variant_id || ''), row as Record<string, unknown>])
  )

  const dashboardStores = stores.map((row) =>
    mapStoreSummary(
      row as Record<string, unknown>,
      settingsByStoreId.get(String(row.id || '')),
      domainsByStoreId.get(String(row.id || '')) || []
    )
  )

  const dashboardProducts: AdminCatalogProductView[] = products.map((row) => ({
    id: String(row.id || ''),
    name: cleanText(row.name, 160),
    sku: cleanText(row.sku, 80),
    type: cleanText(row.type, 40),
    basePrice: toNumber(row.selling_price),
    unit: cleanText(row.unit, 40),
    description: cleanLongText(row.description, 300),
  }))

  const dashboardStoreProducts: AdminStoreProductView[] = storeProducts.map((row) => ({
    storeId: String(row.store_id || ''),
    productId: String(row.product_id || ''),
    publicSlug: cleanText(row.public_slug, 120),
    publicName: cleanText(row.public_name, 180),
    shortDescription: cleanLongText(row.short_description, 240),
    publicDescription: cleanLongText(row.public_description, 1200),
    priceOverride: toNullableNumber(row.price_override),
    comparePrice: toNullableNumber(row.compare_price),
    badgeText: cleanText(row.badge_text, 80),
    sortOrder: Math.trunc(toNumber(row.sort_order)),
    isFeatured: Boolean(row.is_featured),
    isPublished: Boolean(row.is_published),
    imageUrl: mediaByStoreProduct.get(`${String(row.store_id || '')}:${String(row.product_id || '')}`) || '',
  }))

  const dashboardVariants: AdminVariantView[] = variantRows.map((row) => {
    const override = overrideByVariantId.get(String(row.id || ''))
    return {
      id: String(row.id || ''),
      productId: String(row.product_id || ''),
      inventoryProductId: String(row.inventory_product_id || ''),
      name: cleanText(row.name, 160),
      sku: cleanText(row.sku, 80),
      isActive: Boolean(row.is_active),
      isDefault: Boolean(row.is_default),
      storeId: override?.store_id ? String(override.store_id) : null,
      publicName: cleanText(override?.public_name, 160),
      priceOverride: toNullableNumber(override?.price_override),
      comparePrice: toNullableNumber(override?.compare_price),
      badgeText: cleanText(override?.badge_text, 80),
      imageUrl: cleanText(override?.hero_image_url, 500),
      isPublished: override?.is_published === undefined ? true : Boolean(override.is_published),
      attributesText: (variantAttributeTextByVariantId.get(String(row.id || '')) || []).join('\n'),
    }
  })

  const zoneById = new Map<string, string>(
    zoneRows.map((row) => [String(row.id || ''), cleanText(row.name, 120)])
  )

  const dashboardShippingZones: AdminShippingZoneView[] = zoneRows.map((row) => ({
    id: String(row.id || ''),
    storeId: String(row.store_id || ''),
    code: cleanText(row.code, 64),
    name: cleanText(row.name, 160),
    countries: normalizeShippingRuleList(row.countries),
    provinces: normalizeShippingRuleList(row.provinces),
    cities: normalizeShippingRuleList(row.cities),
    postalCodes: normalizeShippingRuleList(row.postal_codes),
    isActive: Boolean(row.is_active),
  }))

  const dashboardShippingRates: AdminShippingRateView[] = rateRows.map((row) => ({
    id: String(row.id || ''),
    storeId: String(row.store_id || ''),
    zoneId: String(row.zone_id || ''),
    zoneName: zoneById.get(String(row.zone_id || '')) || '-',
    name: cleanText(row.name, 160),
    amount: toNumber(row.flat_amount),
    etaLabel: cleanText(row.eta_label, 120),
    isActive: Boolean(row.is_active),
  }))

  const dashboardThemes: StoreThemeVersionView[] = themeRows.map((row) =>
    normalizeStorefrontThemeVersion(row as Record<string, unknown>)
  )

  const dashboardThemeAssets: AdminThemeAssetView[] = themeAssetRows.map((row) => ({
    id: String(row.id || ''),
    storeId: String(row.store_id || ''),
    themeVersionId: row.theme_version_id ? String(row.theme_version_id) : null,
    assetType: cleanText(row.asset_type, 40) || 'IMAGE',
    label: cleanText(row.label, 160),
    publicUrl: cleanText(row.public_url, 500),
    mimeType: cleanText(row.mime_type, 120),
    createdAt: String(row.created_at || ''),
  }))

  const dashboardOrders: AdminOrderPaymentView[] = recentOrderResult.rows.map((row) => ({
    id: String(row.payment_id || row.order_id),
    orderId: row.order_id,
    orderNumber: row.order_number,
    storeId: row.store_id,
    storeName: row.store_name,
    customerName: row.customer_name,
    customerEmail: cleanText(row.customer_email, 160),
    customerPhone: cleanText(row.customer_phone, 80),
    status: row.status,
    paymentStatus: row.payment_status,
    reservationStatus: cleanText(row.reservation_status, 40) || 'NONE',
    grandTotal: toNumber(row.grand_total),
    createdAt: row.created_at,
    paymentDueAt: row.payment_due_at ? String(row.payment_due_at) : null,
    paidAmount: row.paid_amount === null ? null : toNumber(row.paid_amount),
    paidAt: row.paid_at,
    proofUrl: cleanText(row.proof_url, 500),
    reviewNote: cleanLongText(row.review_note, 240),
    erpSaleId: row.erp_sale_id,
    erpSyncStatus: cleanText(row.erp_sync_status, 40) || 'PENDING',
    erpSyncError: cleanLongText(row.erp_sync_error, 280),
  }))

  const dashboardOrderEvents: AdminOrderEventView[] = orderEventResult.rows.map((row) => ({
    id: row.id,
    orderId: row.order_id,
    orderNumber: row.order_number,
    actorUserId: row.actor_user_id ? String(row.actor_user_id) : null,
    actorLabel: cleanText(row.actor_label, 40) || 'SYSTEM',
    eventType: cleanText(row.event_type, 80),
    message: cleanLongText(row.message, 240),
    payloadPreview: formatPayloadPreview(row.payload, 280),
    createdAt: row.created_at,
  }))

  return {
    stores: dashboardStores,
    products: dashboardProducts,
    storeProducts: dashboardStoreProducts,
    variants: dashboardVariants,
    shippingZones: dashboardShippingZones,
    shippingRates: dashboardShippingRates,
    themes: dashboardThemes,
    themeAssets: dashboardThemeAssets,
    templates: STORE_THEME_TEMPLATE_SEEDS as StoreThemeTemplateSeed[],
    orders: dashboardOrders,
    orderEvents: dashboardOrderEvents,
    branches: branchRows.map((row) => ({
      id: String(row.id || ''),
      name: cleanText(row.name, 160),
      code: cleanText(row.code, 60),
    })),
    warehouses: warehouseRows.map((row) => ({
      id: String(row.id || ''),
      name: cleanText(row.name, 160),
      branchId: row.branch_id ? String(row.branch_id) : null,
    })),
    bankAccounts: bankRows.map((row) => ({
      id: String(row.id || ''),
      label: [cleanText(row.bank_name, 120), cleanText(row.account_number, 60), cleanText(row.account_holder, 120)]
        .filter(Boolean)
        .join(' • '),
      branchId: row.branch_id ? String(row.branch_id) : null,
    })),
  }
}

export async function createStoreRecord(formData: FormData) {
  const { admin, orgId, userId } = await requireActiveOrgAdminContext()

  const name = cleanText(formData.get('name'), 160)
  if (!name) throw new Error('Nama store wajib diisi.')

  const slug = safeSlug(formData.get('slug'), name)
  const defaults = await resolveStoreCreateDefaults(
    admin,
    orgId,
    cleanText(formData.get('branch_id'), 80),
    cleanText(formData.get('warehouse_id'), 80),
    cleanText(formData.get('bank_account_id'), 80),
  )

  const payload = {
    org_id: orgId,
    branch_id: defaults.branchId,
    warehouse_id: defaults.warehouseId,
    bank_account_id: defaults.bankAccountId,
    name,
    slug,
    brand_name: cleanText(formData.get('brand_name'), 160),
    line_name: cleanText(formData.get('line_name'), 160),
    support_email: cleanText(formData.get('support_email'), 200),
    support_phone: cleanText(formData.get('support_phone'), 80),
    whatsapp_phone: cleanText(formData.get('whatsapp_phone'), 80),
    logo_url: cleanText(formData.get('logo_url'), 500),
    headline: cleanText(formData.get('headline'), 200),
    subheadline: cleanLongText(formData.get('subheadline'), 500),
    currency: cleanText(formData.get('currency'), 12) || 'IDR',
    created_by: userId,
  }

  const { data: store, error } = await admin
    .from('stores')
    .insert(payload)
    .select('*')
    .single()

  if (error || !store?.id) {
    throw new Error(error?.message || 'Gagal membuat store.')
  }

  const { error: settingsError } = await admin
    .from('store_settings')
    .insert({
      org_id: orgId,
      store_id: store.id,
      hero_notice: cleanText(formData.get('hero_notice'), 200),
      checkout_notice: cleanText(formData.get('checkout_notice'), 200),
      transfer_instructions: cleanLongText(formData.get('transfer_instructions'), 2000),
    })

  if (settingsError) {
    throw new Error(`Store berhasil dibuat, tetapi settings gagal dibuat: ${settingsError.message}`)
  }

  const defaultZoneCode = `${slug}-utama`.slice(0, 32)
  const { data: zone, error: zoneError } = await admin
    .from('store_shipping_zones')
    .insert({
      org_id: orgId,
      store_id: store.id,
      code: defaultZoneCode,
      name: 'Zona Utama',
    })
    .select('id')
    .single()

  if (zoneError || !zone?.id) {
    throw new Error(zoneError?.message || 'Store berhasil dibuat, tetapi zona ongkir awal gagal dibuat.')
  }

  const { error: rateError } = await admin
    .from('store_shipping_rates')
    .insert({
      org_id: orgId,
      store_id: store.id,
      zone_id: zone.id,
      name: 'Standard',
      flat_amount: 0,
      eta_label: 'Atur estimasi pengiriman',
    })

  if (rateError) {
    throw new Error(`Store berhasil dibuat, tetapi tarif ongkir awal gagal dibuat: ${rateError.message}`)
  }

  const templateKey = cleanText(formData.get('template_key'), 80) || STORE_THEME_TEMPLATE_SEEDS[0]?.key
  await ensureStoreThemeShell(admin, {
    orgId,
    storeId: String(store.id),
    templateKey,
    userId,
  })

  return {
    storeId: String(store.id),
    storeSlug: String(store.slug || slug),
  }
}

export async function saveStoreBasics(formData: FormData) {
  const { admin, orgId } = await requireActiveOrgAdminContext()

  const storeId = cleanText(formData.get('store_id'), 80)
  if (!storeId) throw new Error('Store tidak valid.')

  const storePatch = {
    name: cleanText(formData.get('name'), 160),
    slug: safeSlug(formData.get('slug'), cleanText(formData.get('name'), 160)),
    brand_name: cleanText(formData.get('brand_name'), 160),
    line_name: cleanText(formData.get('line_name'), 160),
    branch_id: cleanText(formData.get('branch_id'), 80),
    warehouse_id: cleanText(formData.get('warehouse_id'), 80),
    bank_account_id: cleanText(formData.get('bank_account_id'), 80),
    support_email: cleanText(formData.get('support_email'), 200),
    support_phone: cleanText(formData.get('support_phone'), 80),
    whatsapp_phone: cleanText(formData.get('whatsapp_phone'), 80),
    logo_url: cleanText(formData.get('logo_url'), 500),
    headline: cleanText(formData.get('headline'), 200),
    subheadline: cleanLongText(formData.get('subheadline'), 500),
    currency: cleanText(formData.get('currency'), 12) || 'IDR',
    is_active: readBooleanWithFallback(formData, 'is_active', true),
    is_published: readBooleanWithFallback(formData, 'is_published', true),
  }

  const { error: storeError } = await admin
    .from('stores')
    .update(storePatch)
    .eq('id', storeId)
    .eq('org_id', orgId)

  if (storeError) {
    throw new Error(`Gagal menyimpan store: ${storeError.message}`)
  }

  const settingsPatch = {
    seo_title: cleanText(formData.get('seo_title'), 200),
    seo_description: cleanText(formData.get('seo_description'), 260),
    hero_notice: cleanText(formData.get('hero_notice'), 200),
    checkout_notice: cleanText(formData.get('checkout_notice'), 200),
    transfer_instructions: cleanLongText(formData.get('transfer_instructions'), 2000),
  }

  const { error: settingsError } = await admin
    .from('store_settings')
    .upsert({
      org_id: orgId,
      store_id: storeId,
      ...settingsPatch,
    }, { onConflict: 'store_id' })

  if (settingsError) {
    throw new Error(`Store tersimpan, tetapi settings gagal disimpan: ${settingsError.message}`)
  }
}

export async function saveStoreDomain(formData: FormData) {
  const { admin, orgId } = await requireActiveOrgAdminContext()
  const storeId = cleanText(formData.get('store_id'), 80)
  const domain = cleanText(formData.get('domain'), 255).toLowerCase()
  if (!storeId || !domain) throw new Error('Store dan domain wajib diisi.')

  const { error } = await admin
    .from('store_domains')
    .upsert({
      org_id: orgId,
      store_id: storeId,
      domain,
      is_primary: toBoolean(formData.get('is_primary')),
      status: cleanText(formData.get('status'), 40) || 'PENDING',
    }, { onConflict: 'domain' })

  if (error) {
    throw new Error(`Gagal menyimpan domain store: ${error.message}`)
  }
}

export async function saveStoreShippingZone(formData: FormData) {
  const { admin, orgId } = await requireActiveOrgAdminContext()
  const storeId = cleanText(formData.get('store_id'), 80)
  const zoneId = cleanText(formData.get('zone_id'), 80)
  const code = cleanText(formData.get('code'), 60) || normalizeStoreSlug(cleanText(formData.get('name'), 120))
  const name = cleanText(formData.get('name'), 120)

  if (!storeId || !name) throw new Error('Store dan nama zona wajib diisi.')

  const payload = {
    org_id: orgId,
    store_id: storeId,
    code,
    name,
    countries: normalizeShippingRuleList(formData.get('countries')),
    provinces: normalizeShippingRuleList(formData.get('provinces')),
    cities: normalizeShippingRuleList(formData.get('cities')),
    postal_codes: normalizeShippingRuleList(formData.get('postal_codes')),
    is_active: readBooleanWithFallback(formData, 'is_active', true),
  }

  const query = zoneId
    ? admin.from('store_shipping_zones').update(payload).eq('id', zoneId).eq('org_id', orgId)
    : admin.from('store_shipping_zones').insert(payload)

  const { error } = await query
  if (error) {
    throw new Error(`Gagal menyimpan zona ongkir: ${error.message}`)
  }
}

export async function saveStoreShippingRate(formData: FormData) {
  const { admin, orgId } = await requireActiveOrgAdminContext()
  const storeId = cleanText(formData.get('store_id'), 80)
  const rateId = cleanText(formData.get('rate_id'), 80)
  const zoneId = cleanText(formData.get('zone_id'), 80)
  const name = cleanText(formData.get('name'), 120)

  if (!storeId || !zoneId || !name) {
    throw new Error('Store, zona, dan nama tarif wajib diisi.')
  }

  const payload = {
    org_id: orgId,
    store_id: storeId,
    zone_id: zoneId,
    name,
    rate_type: 'FLAT',
    flat_amount: Math.max(0, toNumber(formData.get('flat_amount'))),
    eta_label: cleanText(formData.get('eta_label'), 120),
    is_active: readBooleanWithFallback(formData, 'is_active', true),
  }

  const query = rateId
    ? admin.from('store_shipping_rates').update(payload).eq('id', rateId).eq('org_id', orgId)
    : admin.from('store_shipping_rates').insert(payload)

  const { error } = await query
  if (error) {
    throw new Error(`Gagal menyimpan tarif ongkir: ${error.message}`)
  }
}

export async function saveStoreCatalogProduct(formData: FormData) {
  const { admin, orgId } = await requireActiveOrgAdminContext()

  const storeId = cleanText(formData.get('store_id'), 80)
  const productId = cleanText(formData.get('product_id'), 80)
  const productName = cleanText(formData.get('product_name'), 160)
  if (!storeId || !productId) throw new Error('Store dan produk wajib dipilih.')

  const payload = {
    org_id: orgId,
    store_id: storeId,
    product_id: productId,
    public_slug: safeSlug(formData.get('public_slug'), productName || productId),
    public_name: cleanText(formData.get('public_name'), 180) || productName,
    short_description: cleanLongText(formData.get('short_description'), 240),
    public_description: cleanLongText(formData.get('public_description'), 2000),
    price_override: toNullableNumber(formData.get('price_override')),
    compare_price: toNullableNumber(formData.get('compare_price')),
    badge_text: cleanText(formData.get('badge_text'), 80),
    sort_order: Math.trunc(toNumber(formData.get('sort_order'))),
    is_featured: readBooleanWithFallback(formData, 'is_featured', false),
    is_published: readBooleanWithFallback(formData, 'is_published', false),
  }

  const { error } = await admin
    .from('store_products')
    .upsert(payload, { onConflict: 'store_id,product_id' })

  if (error) {
    throw new Error(`Gagal menyimpan katalog store: ${error.message}`)
  }

  const imageUrl = cleanText(formData.get('image_url'), 500)
  if (imageUrl) {
    const { data: existingMedia } = await admin
      .from('ecommerce_product_media')
      .select('id')
      .eq('org_id', orgId)
      .eq('store_id', storeId)
      .eq('product_id', productId)
      .is('variant_id', null)
      .maybeSingle()

    if (existingMedia?.id) {
      const { error: mediaError } = await admin
        .from('ecommerce_product_media')
        .update({
          url: imageUrl,
          is_primary: true,
        })
        .eq('id', existingMedia.id)

      if (mediaError) {
        throw new Error(`Katalog tersimpan, tetapi gambar gagal diperbarui: ${mediaError.message}`)
      }
    } else {
      const { error: mediaError } = await admin
        .from('ecommerce_product_media')
        .insert({
          org_id: orgId,
          store_id: storeId,
          product_id: productId,
          url: imageUrl,
          is_primary: true,
        })

      if (mediaError) {
        throw new Error(`Katalog tersimpan, tetapi gambar gagal ditambah: ${mediaError.message}`)
      }
    }
  }
}

async function upsertAttributeValueForVariant(
  admin: AdminDb,
  orgId: string,
  variantId: string,
  line: string
) {
  const [attributeNameRaw, valueNameRaw] = line.split(':')
  const attributeName = cleanText(attributeNameRaw, 120)
  const valueName = cleanText(valueNameRaw, 120)
  if (!attributeName || !valueName) return

  const attributeSlug = normalizeStoreSlug(attributeName)
  const valueSlug = normalizeStoreSlug(valueName)

  const { data: attribute, error: attributeError } = await admin
    .from('product_attributes')
    .upsert({
      org_id: orgId,
      name: attributeName,
      slug: attributeSlug,
    }, { onConflict: 'org_id,slug' })
    .select('id')
    .single()

  if (attributeError || !attribute?.id) {
    throw new Error(attributeError?.message || 'Gagal menyimpan atribut varian.')
  }

  const { data: attributeValue, error: attributeValueError } = await admin
    .from('product_attribute_values')
    .upsert({
      org_id: orgId,
      attribute_id: attribute.id,
      value: valueName,
      slug: valueSlug,
    }, { onConflict: 'attribute_id,slug' })
    .select('id')
    .single()

  if (attributeValueError || !attributeValue?.id) {
    throw new Error(attributeValueError?.message || 'Gagal menyimpan nilai atribut varian.')
  }

  const { error: linkError } = await admin
    .from('product_variant_attribute_values')
    .upsert({
      org_id: orgId,
      variant_id: variantId,
      attribute_id: attribute.id,
      attribute_value_id: attributeValue.id,
    }, { onConflict: 'variant_id,attribute_id' })

  if (linkError) {
    throw new Error(`Gagal menghubungkan atribut varian: ${linkError.message}`)
  }
}

export async function saveProductVariant(formData: FormData) {
  const { admin, orgId } = await requireActiveOrgAdminContext()

  const variantId = cleanText(formData.get('variant_id'), 80)
  const productId = cleanText(formData.get('product_id'), 80)
  const storeId = cleanText(formData.get('store_id'), 80)
  const inventoryProductId = cleanText(formData.get('inventory_product_id'), 80)
  const variantName = cleanText(formData.get('variant_name'), 160)

  if (!productId || !inventoryProductId || !variantName) {
    throw new Error('Produk, produk stok, dan nama varian wajib diisi.')
  }

  const variantPayload = {
    org_id: orgId,
    product_id: productId,
    inventory_product_id: inventoryProductId,
    sku: cleanText(formData.get('sku'), 80),
    name: variantName,
    sort_order: Math.trunc(toNumber(formData.get('sort_order'))),
    is_active: readBooleanWithFallback(formData, 'is_active', true),
    is_default: toBoolean(formData.get('is_default')),
  }

  const query = variantId
    ? admin.from('product_variants').update(variantPayload).eq('id', variantId).eq('org_id', orgId).select('id').single()
    : admin.from('product_variants').insert(variantPayload).select('id').single()

  const { data: variant, error } = await query
  if (error || !variant?.id) {
    throw new Error(error?.message || 'Gagal menyimpan varian.')
  }

  const savedVariantId = String(variant.id)

  if (variantId) {
    const { error: cleanupError } = await admin
      .from('product_variant_attribute_values')
      .delete()
      .eq('variant_id', savedVariantId)
      .eq('org_id', orgId)

    if (cleanupError) {
      throw new Error(`Varian tersimpan, tetapi atribut lama gagal dibersihkan: ${cleanupError.message}`)
    }
  }

  const attributeLines = cleanLongText(formData.get('attributes_text'), 1200)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  for (const line of attributeLines) {
    await upsertAttributeValueForVariant(admin, orgId, savedVariantId, line)
  }

  if (storeId) {
    const { error: overrideError } = await admin
      .from('store_variant_overrides')
      .upsert({
        org_id: orgId,
        store_id: storeId,
        product_id: productId,
        variant_id: savedVariantId,
        public_name: cleanText(formData.get('public_name'), 160),
        price_override: toNullableNumber(formData.get('price_override')),
        compare_price: toNullableNumber(formData.get('compare_price')),
        badge_text: cleanText(formData.get('badge_text'), 80),
        hero_image_url: cleanText(formData.get('image_url'), 500),
        is_published: readBooleanWithFallback(formData, 'is_published', true),
      }, { onConflict: 'store_id,variant_id' })

    if (overrideError) {
      throw new Error(`Varian tersimpan, tetapi override store gagal disimpan: ${overrideError.message}`)
    }
  }
}

export async function resetStoreThemeDraftFromTemplate(formData: FormData) {
  const { admin, orgId, userId } = await requireActiveOrgAdminContext()
  const storeId = cleanText(formData.get('store_id'), 80)
  if (!storeId) throw new Error('Store tidak valid.')

  await ensureThemeTemplateSeeds(admin)
  const draftSeed = buildThemeDraftFromTemplate(cleanText(formData.get('template_key'), 80))
  const templateRow = await getThemeTemplateRow(admin, draftSeed.templateKey)

  const { data: draft } = await admin
    .from('store_theme_versions')
    .select('*')
    .eq('store_id', storeId)
    .eq('status', 'DRAFT')
    .maybeSingle()

  const payload = {
    org_id: orgId,
    store_id: storeId,
    template_id: templateRow?.id || null,
    version_name: `${draftSeed.versionName} Draft`,
    preview_token: crypto.randomUUID(),
    tokens: draftSeed.tokens,
    layout: draftSeed.layout,
    branding: {
      checkout: normalizeStoreCheckoutBranding(draftSeed.layout.checkout),
    },
    created_by: userId,
  }

  const query = draft?.id
    ? admin.from('store_theme_versions').update(payload).eq('id', draft.id)
    : admin.from('store_theme_versions').insert({ ...payload, status: 'DRAFT' })

  const { error } = await query
  if (error) {
    throw new Error(`Gagal mereset draft theme: ${error.message}`)
  }
}

export async function saveStoreThemeDraft(formData: FormData) {
  const { admin, orgId, userId } = await requireActiveOrgAdminContext()
  const storeId = cleanText(formData.get('store_id'), 80)
  if (!storeId) throw new Error('Store tidak valid.')

  const versionName = cleanText(formData.get('version_name'), 120) || 'Draft Theme'
  const tokens = normalizeStoreThemeTokens(toJsonObject(formData.get('tokens')))
  const layout = normalizeStoreThemeLayout(toJsonObject(formData.get('layout')))
  const branding = {
    checkout: normalizeStoreCheckoutBranding(toJsonObject(formData.get('checkout_branding'))),
  }

  const { data: draft } = await admin
    .from('store_theme_versions')
    .select('id')
    .eq('store_id', storeId)
    .eq('status', 'DRAFT')
    .maybeSingle()

  const payload = {
    org_id: orgId,
    store_id: storeId,
    version_name: versionName,
    tokens,
    layout,
    branding,
    created_by: userId,
  }

  const query = draft?.id
    ? admin.from('store_theme_versions').update(payload).eq('id', draft.id)
    : admin.from('store_theme_versions').insert({ ...payload, status: 'DRAFT' })

  const { error } = await query
  if (error) {
    throw new Error(`Gagal menyimpan draft theme: ${error.message}`)
  }
}

export async function uploadStoreThemeAsset(formData: FormData) {
  const { admin, orgId, userId } = await requireActiveOrgAdminContext()
  const storeId = cleanText(formData.get('store_id'), 80)
  if (!storeId) throw new Error('Store tidak valid.')
  if (!isObjectStorageConfigured()) {
    throw new Error('Bucket file publik belum dikonfigurasi. Upload asset theme belum bisa dipakai.')
  }

  const file = formData.get('file')
  if (!(file instanceof File) || file.size <= 0) {
    throw new Error('File asset theme wajib dipilih.')
  }
  if (!String(file.type || '').startsWith('image/')) {
    throw new Error('Asset theme saat ini hanya menerima file gambar.')
  }
  if (file.size > THEME_ASSET_MAX_SIZE) {
    throw new Error('Ukuran asset theme terlalu besar. Maksimal 8MB.')
  }

  await ensureStoreThemeShell(admin, {
    orgId,
    storeId,
    userId,
  })

  const { data: draftTheme, error: draftError } = await admin
    .from('store_theme_versions')
    .select('id')
    .eq('store_id', storeId)
    .eq('status', 'DRAFT')
    .maybeSingle()

  if (draftError) {
    throw new Error(`Gagal membaca draft theme: ${draftError.message}`)
  }

  const storageKey = buildThemeAssetStorageKey(orgId, storeId, file.name)
  const publicUrl = buildPublicStorageObjectPath(storageKey)
  const label = cleanText(formData.get('label'), 160)

  try {
    await uploadObjectToStorage({
      key: storageKey,
      body: Buffer.from(await file.arrayBuffer()),
      contentType: file.type || 'application/octet-stream',
      cacheControl: 'public, max-age=31536000, immutable',
    })
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `Upload asset theme gagal: ${error.message}`
        : 'Upload asset theme ke bucket gagal.'
    )
  }

  const { data: asset, error: insertError } = await admin
    .from('store_theme_assets')
    .insert({
      org_id: orgId,
      store_id: storeId,
      theme_version_id: draftTheme?.id || null,
      asset_type: 'IMAGE',
      label: label || cleanText(file.name, 160),
      storage_key: storageKey,
      public_url: publicUrl,
      mime_type: cleanText(file.type, 120) || 'application/octet-stream',
    })
    .select('id, public_url')
    .single()

  if (insertError) {
    try {
      await deleteObjectFromStorage(storageKey)
    } catch {
      // Abaikan error cleanup agar error utama tetap jelas untuk admin.
    }

    throw new Error(`Asset sudah terunggah, tetapi metadata gagal disimpan: ${insertError.message}`)
  }

  return {
    id: String(asset.id || ''),
    publicUrl: cleanText(asset.public_url, 500),
  }
}

export async function publishStoreThemeDraft(formData: FormData) {
  const { admin, orgId, userId } = await requireActiveOrgAdminContext()
  const storeId = cleanText(formData.get('store_id'), 80)
  if (!storeId) throw new Error('Store tidak valid.')

  const { data: draft, error: draftError } = await admin
    .from('store_theme_versions')
    .select('*')
    .eq('store_id', storeId)
    .eq('status', 'DRAFT')
    .maybeSingle()

  if (draftError || !draft?.id) {
    throw new Error(draftError?.message || 'Draft theme belum ada.')
  }

  const { error: archiveError } = await admin
    .from('store_theme_versions')
    .update({ status: 'ARCHIVED' })
    .eq('store_id', storeId)
    .eq('status', 'PUBLISHED')

  if (archiveError) {
    throw new Error(`Gagal mengarsipkan theme live lama: ${archiveError.message}`)
  }

  const { error: publishError } = await admin
    .from('store_theme_versions')
    .update({
      status: 'PUBLISHED',
      published_at: new Date().toISOString(),
      version_name: cleanText(draft.version_name, 120) || 'Published Theme',
    })
    .eq('id', draft.id)

  if (publishError) {
    throw new Error(`Gagal publish draft theme: ${publishError.message}`)
  }

  const normalizedDraft = normalizeStorefrontThemeVersion(draft as Record<string, unknown>)
  const { error: newDraftError } = await admin
    .from('store_theme_versions')
    .insert({
      org_id: orgId,
      store_id: storeId,
      template_id: draft.template_id || null,
      version_name: `${normalizedDraft.versionName} Draft`,
      status: 'DRAFT',
      preview_token: crypto.randomUUID(),
      tokens: normalizedDraft.tokens,
      layout: normalizedDraft.layout,
      branding: normalizedDraft.branding,
      created_by: userId,
    })

  if (newDraftError) {
    throw new Error(`Theme live sudah terbit, tetapi draft baru gagal dibuat: ${newDraftError.message}`)
  }
}

type CheckoutItemInput = {
  productId: string
  variantId?: string | null
  quantity: number
}

type CheckoutInput = {
  orgSlug: string
  storeSlug: string
  idempotencyKey?: string
  clientIp?: string
  customerName: string
  customerEmail?: string
  customerPhone: string
  customerNote?: string
  shippingRateId?: string
  address: {
    recipientName: string
    phone: string
    line1: string
    line2?: string
    district?: string
    city: string
    province: string
    postalCode?: string
    country?: string
    notes?: string
  }
  items: CheckoutItemInput[]
}

function parseCheckoutPayload(input: unknown): CheckoutInput {
  const source = (typeof input === 'object' && input && !Array.isArray(input) ? input : {}) as Record<string, unknown>
  const address = (source.address && typeof source.address === 'object' && !Array.isArray(source.address)
    ? source.address
    : {}) as Record<string, unknown>

  return {
    orgSlug: cleanText(source.orgSlug, 120),
    storeSlug: cleanText(source.storeSlug, 120),
    idempotencyKey: cleanClientKey(source.idempotencyKey),
    clientIp: normalizeIpAddress(source.clientIp),
    customerName: cleanText(source.customerName, 160),
    customerEmail: cleanText(source.customerEmail, 160),
    customerPhone: cleanText(source.customerPhone, 80),
    customerNote: cleanLongText(source.customerNote, 500),
    shippingRateId: cleanText(source.shippingRateId, 80),
    address: {
      recipientName: cleanText(address.recipientName, 160),
      phone: cleanText(address.phone, 80),
      line1: cleanLongText(address.line1, 240),
      line2: cleanLongText(address.line2, 240),
      district: cleanText(address.district, 120),
      city: cleanText(address.city, 120),
      province: cleanText(address.province, 120),
      postalCode: cleanText(address.postalCode, 32),
      country: cleanText(address.country, 40),
      notes: cleanLongText(address.notes, 240),
    },
    items: Array.isArray(source.items)
      ? source.items
          .map((item) => {
            const row = (item || {}) as Record<string, unknown>
            return {
              productId: cleanText(row.productId, 80),
              variantId: cleanText(row.variantId, 80) || null,
              quantity: Math.max(1, Math.min(999, Math.trunc(toNumber(row.quantity) || 1))),
            }
          })
          .filter((item) => item.productId)
      : [],
  }
}

async function resolveCheckoutCatalogSnapshot(
  context: PublicStoreContext,
  items: CheckoutItemInput[],
  shippingRateId: string | undefined,
  address: ShippingAddressMatcherInput
) {
  const storePayload = await getPublicStorefrontPayload(context.orgSlug, context.storeSlug)
  if (!storePayload) {
    throw new Error('Store tidak ditemukan.')
  }

  const shippingRate = resolveShippingRateForAddress(
    storePayload.shippingRates,
    address,
    shippingRateId || null
  )

  if (!shippingRate) {
    throw new Error('Alamat belum cocok dengan zona ongkir aktif di store ini.')
  }

  const resolvedItems = items.map((item) => {
    const product = storePayload.products.find((entry) => entry.id === item.productId)
    if (!product) {
      throw new Error('Ada produk yang sudah tidak tayang.')
    }

    const variant = item.variantId
      ? product.variants.find((entry) => entry.id === item.variantId)
      : null

    if (item.variantId && !variant) {
      throw new Error(`Varian untuk produk "${product.name}" tidak ditemukan.`)
    }

    if (!item.variantId && product.variants.length > 0) {
      const defaultVariant = product.variants.find((entry) => entry.isDefault) || product.variants[0]
      return {
        product,
        variant: defaultVariant,
        quantity: item.quantity,
      }
    }

    return {
      product,
      variant,
      quantity: item.quantity,
    }
  })

  return {
    storePayload,
    shippingRate,
    items: resolvedItems,
  }
}

async function findCheckoutOrderByIdempotencyKey(
  admin: AdminDb,
  storeId: string,
  idempotencyKey: string
) {
  const { data, error } = await admin
    .from('ecommerce_orders')
    .select('id, order_number, payment_due_at, grand_total, public_access_token')
    .eq('store_id', storeId)
    .eq('checkout_idempotency_key', idempotencyKey)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(`Order idempotent gagal dicek: ${error.message}`)
  }

  return data
}

function formatCheckoutOrderResponse(args: {
  orderId: string
  orderNumber: string
  paymentDueAt: string | null
  grandTotal: number
  transferInstructions: string
  orgSlug: string
  storeSlug: string
  accessToken: string
}) {
  return {
    orderId: args.orderId,
    orderNumber: args.orderNumber,
    paymentDueAt: args.paymentDueAt,
    transferInstructions: args.transferInstructions,
    grandTotal: args.grandTotal,
    orderAccessUrl: buildPublicOrderAccessUrl(
      args.orgSlug,
      args.storeSlug,
      args.orderNumber,
      args.accessToken
    ),
  }
}

export async function createCheckoutOrder(input: unknown) {
  const payload = parseCheckoutPayload(input)
  if (!payload.orgSlug || !payload.storeSlug) throw new Error('Store tidak valid.')
  if (!payload.customerName || !payload.customerPhone) throw new Error('Nama dan nomor pelanggan wajib diisi.')
  if (!payload.address.line1 || !payload.address.city || !payload.address.province) {
    throw new Error('Alamat pengiriman belum lengkap.')
  }
  if (payload.items.length === 0) throw new Error('Keranjang masih kosong.')

  const context = await getPublicStoreContext(payload.orgSlug, payload.storeSlug)
  if (!context) throw new Error('Store tidak ditemukan.')

  const admin = (await createAdminClient()) as AdminDb
  const idempotencyKey = cleanClientKey(payload.idempotencyKey)

  if (idempotencyKey) {
    const existingOrder = await findCheckoutOrderByIdempotencyKey(admin, context.storeId, idempotencyKey)
    if (existingOrder?.id && existingOrder.order_number && existingOrder.public_access_token) {
      const storeView = await getStorefrontStoreView(admin, context)
      return formatCheckoutOrderResponse({
        orderId: String(existingOrder.id),
        orderNumber: String(existingOrder.order_number),
        paymentDueAt: existingOrder.payment_due_at ? String(existingOrder.payment_due_at) : null,
        grandTotal: toNumber(existingOrder.grand_total),
        transferInstructions: storeView.transferInstructions,
        orgSlug: context.orgSlug,
        storeSlug: context.storeSlug,
        accessToken: String(existingOrder.public_access_token),
      })
    }
  }

  const { storePayload, shippingRate, items } = await resolveCheckoutCatalogSnapshot(
    context,
    payload.items,
    payload.shippingRateId,
    {
      country: payload.address.country || 'ID',
      province: payload.address.province,
      city: payload.address.city,
      postalCode: payload.address.postalCode,
    }
  )

  await enforcePublicRateLimit({
    admin,
    orgId: context.orgId,
    storeId: context.storeId,
    actionType: 'CHECKOUT_CREATE',
    scopeKey: `${context.storeId}:${payload.clientIp || 'anon'}`,
    ipAddress: payload.clientIp || null,
    requestKey: idempotencyKey || null,
    limit: CHECKOUT_RATE_LIMIT_MAX,
    windowMs: CHECKOUT_RATE_LIMIT_WINDOW_MS,
    message: 'Terlalu banyak percobaan checkout dalam waktu singkat. Coba lagi beberapa menit lagi.',
  })

  const theme = await getStoreThemeVersion(admin, context.storeId, null)
  const publicAccessToken = generatePublicOrderAccessToken()
  const publicAccessTokenExpiresAt = new Date(
    Date.now() + PUBLIC_ORDER_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000
  ).toISOString()

  const subtotal = items.reduce((total, item) => {
    const unitPrice = item.variant?.price ?? item.product.price
    return total + unitPrice * item.quantity
  }, 0)
  const grandTotal = subtotal + shippingRate.amount

  const { data: order, error: orderError } = await admin
    .from('ecommerce_orders')
    .insert({
      org_id: context.orgId,
      store_id: context.storeId,
      branch_id: context.branchId,
      warehouse_id: context.warehouseId,
      customer_name: payload.customerName,
      customer_email: payload.customerEmail || null,
      customer_phone: payload.customerPhone,
      customer_note: payload.customerNote || null,
      checkout_idempotency_key: idempotencyKey || null,
      public_access_token: publicAccessToken,
      public_access_token_expires_at: publicAccessTokenExpiresAt,
      status: 'AWAITING_PAYMENT',
      payment_status: 'PENDING_UPLOAD',
      subtotal_amount: subtotal,
      shipping_amount: shippingRate.amount,
      grand_total: grandTotal,
      shipping_zone_id: shippingRate.zoneId,
      shipping_rate_id: shippingRate.id,
      shipping_snapshot: shippingRate,
      pricing_snapshot: {
        subtotal,
        shipping: shippingRate.amount,
        grandTotal,
      },
      theme_snapshot: {
        tokens: theme.tokens,
        checkout: theme.layout.checkout,
      },
      cart_snapshot: {
        itemCount: items.length,
        items: items.map((item) => ({
          productId: item.product.id,
          productName: item.product.name,
          variantId: item.variant?.id || null,
          variantName: item.variant?.name || null,
          quantity: item.quantity,
          unitPrice: item.variant?.price ?? item.product.price,
        })),
      },
      payment_due_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    })
    .select('*')
    .single()

  if (orderError || !order?.id) {
    if (idempotencyKey && cleanText(orderError?.message, 240).toLowerCase().includes('duplicate')) {
      const existingOrder = await findCheckoutOrderByIdempotencyKey(admin, context.storeId, idempotencyKey)
      if (existingOrder?.id && existingOrder.order_number && existingOrder.public_access_token) {
        return formatCheckoutOrderResponse({
          orderId: String(existingOrder.id),
          orderNumber: String(existingOrder.order_number),
          paymentDueAt: existingOrder.payment_due_at ? String(existingOrder.payment_due_at) : null,
          grandTotal: toNumber(existingOrder.grand_total),
          transferInstructions: storePayload.transferInstructions,
          orgSlug: context.orgSlug,
          storeSlug: context.storeSlug,
          accessToken: String(existingOrder.public_access_token),
        })
      }
    }

    throw new Error(orderError?.message || 'Gagal membuat order.')
  }

  const orderItems = items.map((item) => {
    const variant = item.variant
    const price = variant?.price ?? item.product.price
    const comparePrice = variant?.comparePrice ?? item.product.comparePrice
    const attributes = variant?.choices?.map((choice) => ({
      attributeId: choice.attributeId,
      attributeName: choice.attributeName,
      attributeValueId: choice.attributeValueId,
      attributeValue: choice.attributeValue,
    })) || []

    return {
      org_id: context.orgId,
      order_id: order.id,
      store_id: context.storeId,
      product_id: item.product.id,
      inventory_product_id: variant?.inventoryProductId || item.product.inventoryProductId,
      variant_id: variant?.id || null,
      product_name: item.product.name,
      variant_name: variant?.name || null,
      sku: variant?.sku || null,
      slug: item.product.slug,
      image_url: variant?.imageUrl || item.product.imageUrl || null,
      unit_label: 'Pcs',
      quantity: item.quantity,
      unit_price: price,
      compare_price: comparePrice,
      line_subtotal: price * item.quantity,
      line_total: price * item.quantity,
      attributes,
    }
  })

  const { error: itemError } = await admin
    .from('ecommerce_order_items')
    .insert(orderItems)

  if (itemError) {
    throw new Error(`Order dibuat, tetapi item gagal disimpan: ${itemError.message}`)
  }

  const { error: addressError } = await admin
    .from('ecommerce_order_addresses')
    .insert({
      org_id: context.orgId,
      order_id: order.id,
      address_type: 'SHIPPING',
      recipient_name: payload.address.recipientName || payload.customerName,
      phone: payload.address.phone || payload.customerPhone,
      line1: payload.address.line1,
      line2: payload.address.line2 || null,
      district: payload.address.district || null,
      city: payload.address.city,
      province: payload.address.province,
      postal_code: payload.address.postalCode || null,
      country: payload.address.country || 'ID',
      notes: payload.address.notes || null,
    })

  if (addressError) {
    throw new Error(`Order dibuat, tetapi alamat gagal disimpan: ${addressError.message}`)
  }

  const { error: paymentShellError } = await admin
    .from('ecommerce_order_payments')
    .insert({
      org_id: context.orgId,
      order_id: order.id,
      status: 'PENDING_UPLOAD',
      method: 'BANK_TRANSFER',
    })

  if (paymentShellError) {
    throw new Error(`Order dibuat, tetapi shell pembayaran gagal disimpan: ${paymentShellError.message}`)
  }

  await admin.from('ecommerce_order_events').insert({
    org_id: context.orgId,
    order_id: order.id,
    actor_label: 'STOREFRONT',
    event_type: 'ORDER_CREATED',
    message: 'Order e-commerce dibuat dari checkout publik.',
    payload: {
      shippingRate,
      itemCount: items.length,
    },
  })

  return {
    ...formatCheckoutOrderResponse({
      orderId: String(order.id),
      orderNumber: String(order.order_number || ''),
      paymentDueAt: order.payment_due_at ? String(order.payment_due_at) : null,
      transferInstructions: storePayload.transferInstructions,
      grandTotal,
      orgSlug: context.orgSlug,
      storeSlug: context.storeSlug,
      accessToken: publicAccessToken,
    }),
    transferInstructions: storePayload.transferInstructions,
    grandTotal,
  }
}

async function getPublicOrderRow(input: {
  storeId: string
  orderNumber: string
  accessToken: string
}) {
  const result = await queryPostgres<{
    id: string
    org_id: string
    store_id: string
    branch_id: string
    warehouse_id: string
    order_number: string
    customer_name: string
    customer_email: string | null
    customer_phone: string | null
    customer_note: string | null
    status: string
    payment_status: string
    subtotal_amount: string
    shipping_amount: string
    grand_total: string
    created_at: string
    shipping_snapshot: unknown
    payment_due_at: string | null
    public_access_token: string | null
    public_access_token_expires_at: string | null
    erp_sale_id: string | null
  }>(
    `
      SELECT *
      FROM public.ecommerce_orders
      WHERE store_id = $1
        AND order_number = $2
        AND public_access_token = $3
      LIMIT 1
    `,
    [input.storeId, input.orderNumber, input.accessToken]
  )

  const row = result.rows[0] || null
  if (!row) return null

  if (
    row.public_access_token_expires_at
    && new Date(row.public_access_token_expires_at).getTime() < Date.now()
  ) {
    return null
  }

  return row
}

export async function getPublicOrderStatusPayload(input: {
  orgSlug: string
  storeSlug: string
  orderNumber: string
  accessToken: string
}): Promise<PublicOrderStatusPayload | null> {
  const context = await getPublicStoreContext(input.orgSlug, input.storeSlug)
  if (!context) return null

  const orderNumber = cleanText(input.orderNumber, 80)
  const accessToken = cleanText(input.accessToken, 240)
  if (!orderNumber || !accessToken) return null

  const order = await getPublicOrderRow({
    storeId: context.storeId,
    orderNumber,
    accessToken,
  })
  if (!order) return null

  const admin = (await createAdminClient()) as AdminDb
  const [store, theme] = await Promise.all([
    getStorefrontStoreView(admin, context),
    getStoreThemeVersion(admin, context.storeId, null),
  ])

  const [addressResult, itemResult, paymentResult] = await Promise.all([
    queryPostgres<{
      recipient_name: string
      phone: string | null
      line1: string
      line2: string | null
      district: string | null
      city: string | null
      province: string | null
      postal_code: string | null
      country: string | null
      notes: string | null
    }>(
      `
        SELECT *
        FROM public.ecommerce_order_addresses
        WHERE order_id = $1
          AND address_type = 'SHIPPING'
        ORDER BY created_at ASC
        LIMIT 1
      `,
      [order.id]
    ),
    queryPostgres<{
      id: string
      product_name: string
      variant_name: string | null
      image_url: string | null
      quantity: string
      unit_price: string
      line_total: string
    }>(
      `
        SELECT id, product_name, variant_name, image_url, quantity::text, unit_price::text, line_total::text
        FROM public.ecommerce_order_items
        WHERE order_id = $1
        ORDER BY created_at ASC
      `,
      [order.id]
    ),
    queryPostgres<{
      id: string
      status: string
      paid_amount: string | null
      paid_at: string | null
      payer_name: string | null
      payer_bank_name: string | null
      review_note: string | null
      created_at: string
    }>(
      `
        SELECT id, status, paid_amount::text, paid_at::text, payer_name, payer_bank_name, review_note, created_at::text
        FROM public.ecommerce_order_payments
        WHERE order_id = $1
        ORDER BY created_at DESC
      `,
      [order.id]
    ),
  ])

  const addressRow = addressResult.rows[0]
  const accessUrl = buildPublicOrderAccessUrl(
    input.orgSlug,
    input.storeSlug,
    order.order_number,
    accessToken
  )

  return {
    store,
    theme,
    order: {
      orderId: order.id,
      orderNumber: order.order_number,
      status: order.status,
      paymentStatus: order.payment_status,
      subtotalAmount: toNumber(order.subtotal_amount),
      shippingAmount: toNumber(order.shipping_amount),
      grandTotal: toNumber(order.grand_total),
      customerName: cleanText(order.customer_name, 160),
      customerEmail: cleanText(order.customer_email, 160),
      customerPhone: cleanText(order.customer_phone, 80),
      customerNote: cleanLongText(order.customer_note, 500),
      createdAt: String(order.created_at || ''),
      paymentDueAt: order.payment_due_at ? String(order.payment_due_at) : null,
      shippingLabel: readShippingSnapshotLabel(order.shipping_snapshot),
      transferInstructions: store.transferInstructions,
      canUploadProof: canCustomerUploadPaymentProof(order.status, order.payment_status),
      proofMaxSizeMb: PAYMENT_PROOF_MAX_SIZE / (1024 * 1024),
      accessUrl,
      address: addressRow
        ? {
            recipientName: cleanText(addressRow.recipient_name, 160),
            phone: cleanText(addressRow.phone, 80),
            line1: cleanLongText(addressRow.line1, 240),
            line2: cleanLongText(addressRow.line2, 240),
            district: cleanText(addressRow.district, 120),
            city: cleanText(addressRow.city, 120),
            province: cleanText(addressRow.province, 120),
            postalCode: cleanText(addressRow.postal_code, 32),
            country: cleanText(addressRow.country, 40),
            notes: cleanLongText(addressRow.notes, 240),
          }
        : null,
      items: itemResult.rows.map((item) => ({
        id: item.id,
        productName: cleanText(item.product_name, 180),
        variantName: cleanText(item.variant_name, 180),
        imageUrl: cleanText(item.image_url, 500),
        quantity: toNumber(item.quantity),
        unitPrice: toNumber(item.unit_price),
        lineTotal: toNumber(item.line_total),
      })),
      payments: paymentResult.rows.map((payment) => ({
        id: payment.id,
        status: cleanText(payment.status, 40),
        paidAmount: payment.paid_amount === null ? null : toNumber(payment.paid_amount),
        paidAt: payment.paid_at ? String(payment.paid_at) : null,
        payerName: cleanText(payment.payer_name, 160),
        payerBankName: cleanText(payment.payer_bank_name, 160),
        reviewNote: cleanLongText(payment.review_note, 240),
        createdAt: String(payment.created_at || ''),
      })),
    },
  }
}

export async function uploadOrderPaymentProof(input: {
  orgSlug: string
  storeSlug: string
  orderNumber: string
  accessToken: string
  file: File
  payerName?: string
  payerBankName?: string
  paidAmount?: number | null
  paidAt?: string | null
  clientUploadKey?: string
  clientIp?: string | null
}) {
  const orderNumber = cleanText(input.orderNumber, 80)
  const accessToken = cleanText(input.accessToken, 240)
  const clientUploadKey = cleanClientKey(input.clientUploadKey)
  if (!orderNumber) throw new Error('Nomor order tidak valid.')
  if (!accessToken) throw new Error('Token akses order tidak valid.')
  if (!(input.file instanceof File) || input.file.size <= 0) {
    throw new Error('File bukti pembayaran wajib diunggah.')
  }
  if (input.file.size > PAYMENT_PROOF_MAX_SIZE) {
    throw new Error('Ukuran file terlalu besar. Maksimal 5MB.')
  }
  if (!PAYMENT_PROOF_ALLOWED_TYPES.has(input.file.type)) {
    throw new Error('Format file belum didukung. Gunakan JPG, PNG, WEBP, atau PDF.')
  }

  const context = await getPublicStoreContext(
    cleanText(input.orgSlug, 120),
    cleanText(input.storeSlug, 120)
  )
  if (!context) throw new Error('Store tidak ditemukan.')

  const order = await getPublicOrderRow({
    storeId: context.storeId,
    orderNumber,
    accessToken,
  })
  if (!order) throw new Error('Akses order tidak valid atau sudah kedaluwarsa.')
  if (!canCustomerUploadPaymentProof(order.status, order.payment_status)) {
    throw new Error('Order ini sudah tidak menerima upload bukti pembayaran baru.')
  }

  const admin = (await createAdminClient()) as AdminDb
  const latestPayment = await findLatestPaymentRow(order.id)

  if (latestPayment?.status === 'VALIDATED') {
    throw new Error('Pembayaran order ini sudah divalidasi, jadi upload baru tidak dibutuhkan.')
  }

  if (clientUploadKey) {
    const { data: existingUpload, error: existingUploadError } = await admin
      .from('ecommerce_order_payments')
      .select('id, proof_url')
      .eq('order_id', order.id)
      .eq('client_upload_key', clientUploadKey)
      .maybeSingle()

    if (existingUploadError) {
      throw new Error(`Upload idempotent gagal dicek: ${existingUploadError.message}`)
    }

    if (existingUpload?.id) {
      return {
        orderId: order.id,
        proofUrl: cleanText(existingUpload.proof_url, 500),
      }
    }
  }

  await enforcePublicRateLimit({
    admin,
    orgId: order.org_id,
    storeId: order.store_id,
    orderId: order.id,
    actionType: 'PAYMENT_PROOF_UPLOAD',
    scopeKey: `${order.id}:${input.clientIp || 'anon'}`,
    ipAddress: input.clientIp || null,
    requestKey: clientUploadKey || null,
    limit: PROOF_UPLOAD_RATE_LIMIT_MAX,
    windowMs: PROOF_UPLOAD_RATE_LIMIT_WINDOW_MS,
    message: 'Terlalu banyak upload bukti pembayaran dalam waktu singkat. Coba lagi beberapa menit lagi.',
  })

  const fileBuffer = Buffer.from(await input.file.arrayBuffer())
  const storageKey = buildPaymentProofStorageKey(order.org_id, order.order_number, input.file.name)

  await uploadObjectToStorage({
    key: storageKey,
    body: fileBuffer,
    contentType: input.file.type || 'application/octet-stream',
  })

  const proofUrl = buildPrivateStorageObjectPath(storageKey)

  const { error: paymentError } = await admin
    .from('ecommerce_order_payments')
    .insert({
      org_id: order.org_id,
      order_id: order.id,
      client_upload_key: clientUploadKey || null,
      status: 'UNDER_REVIEW',
      method: 'BANK_TRANSFER',
      proof_storage_key: storageKey,
      proof_url: proofUrl,
      payer_name: cleanText(input.payerName, 160) || null,
      payer_bank_name: cleanText(input.payerBankName, 160) || null,
      paid_amount: input.paidAmount === null || input.paidAmount === undefined ? toNumber(order.grand_total) : Math.max(0, toNumber(input.paidAmount)),
      paid_at: input.paidAt || new Date().toISOString(),
    })

  if (paymentError) {
    throw new Error(`Bukti sudah terunggah, tetapi data pembayaran gagal disimpan: ${paymentError.message}`)
  }

  const { error: orderError } = await admin
    .from('ecommerce_orders')
    .update({
      status: 'PAYMENT_UNDER_REVIEW',
      payment_status: 'UNDER_REVIEW',
    })
    .eq('id', order.id)

  if (orderError) {
    throw new Error(`Bukti sudah tersimpan, tetapi status order gagal diperbarui: ${orderError.message}`)
  }

  await admin.from('ecommerce_order_events').insert({
    org_id: order.org_id,
    order_id: order.id,
    actor_label: 'CUSTOMER',
    event_type: latestPayment?.proof_url ? 'PAYMENT_PROOF_REUPLOADED' : 'PAYMENT_PROOF_UPLOADED',
    message: latestPayment?.proof_url
      ? 'Pelanggan mengunggah ulang bukti pembayaran untuk direview.'
      : 'Pelanggan mengunggah bukti pembayaran untuk direview.',
    payload: {
      proofUrl,
      paidAmount: input.paidAmount ?? toNumber(order.grand_total),
    },
  })

  return {
    orderId: order.id,
    proofUrl,
  }
}

async function findLatestPaymentRow(orderId: string) {
  const result = await queryPostgres<{
    id: string
    order_id: string
    paid_amount: string | null
    paid_at: string | null
    status: string
    proof_url: string | null
    review_note: string | null
  }>(
    `
      SELECT *
      FROM public.ecommerce_order_payments
      WHERE order_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [orderId]
  )

  return result.rows[0] || null
}

async function markOrderEvent(
  admin: AdminDb,
  orgId: string,
  orderId: string,
  eventType: string,
  message: string,
  payload: Record<string, unknown>,
  actorUserId?: string | null
) {
  await admin.from('ecommerce_order_events').insert({
    org_id: orgId,
    order_id: orderId,
    actor_user_id: actorUserId || null,
    actor_label: actorUserId ? 'INTERNAL' : 'SYSTEM',
    event_type: eventType,
    message,
    payload,
  })
}

async function markOrderErpSyncFailure(
  admin: AdminDb,
  orderId: string,
  orgId: string,
  userId: string | null,
  error: unknown
) {
  const message = error instanceof Error ? error.message : 'Unknown error'

  await admin
    .from('ecommerce_orders')
    .update({
      status: 'PAYMENT_EXCEPTION',
      payment_status: 'UNDER_REVIEW',
      erp_sync_status: 'FAILED',
      erp_sync_error: message,
    })
    .eq('id', orderId)

  await markOrderEvent(
    admin,
    orgId,
    orderId,
    'ERP_SYNC_FAILED',
    'Validasi pembayaran gagal diselesaikan karena ada exception saat sinkron ke ERP.',
    { error: message },
    userId
  )
}

async function approveOrderPaymentAtomic(orderId: string, actorUserId: string | null, reviewNote: string) {
  const client = await connectPostgresClient()

  try {
    await client.query('BEGIN')

    const orderResult = await client.query<{
      id: string
      org_id: string
      store_id: string
      branch_id: string
      warehouse_id: string
      customer_name: string
      customer_email: string | null
      customer_phone: string | null
      customer_note: string | null
      grand_total: string
      subtotal_amount: string
      discount_amount: string
      shipping_amount: string
      order_number: string
      payment_status: string
      status: string
      bank_account_id: string
      shipping_fee_product_id: string | null
      store_name: string
    }>(
      `
        SELECT
          eo.*,
          s.bank_account_id,
          s.shipping_fee_product_id,
          s.name AS store_name
        FROM public.ecommerce_orders eo
        JOIN public.stores s ON s.id = eo.store_id
        WHERE eo.id = $1
        FOR UPDATE
      `,
      [orderId]
    )

    const order = orderResult.rows[0]
    if (!order) throw new Error('Order tidak ditemukan.')

    const paymentResult = await client.query<{
      id: string
      paid_amount: string | null
      paid_at: string | null
      status: string
    }>(
      `
        SELECT *
        FROM public.ecommerce_order_payments
        WHERE order_id = $1
        ORDER BY created_at DESC
        LIMIT 1
        FOR UPDATE
      `,
      [orderId]
    )

    const payment = paymentResult.rows[0]
    if (!payment) throw new Error('Data pembayaran order belum ada.')
    if (payment.status === 'VALIDATED') throw new Error('Pembayaran ini sudah pernah divalidasi.')
    if (payment.status !== 'UNDER_REVIEW') {
      throw new Error('Pembayaran belum berada di tahap review, jadi belum bisa divalidasi.')
    }

    const itemResult = await client.query<{
      id: string
      product_id: string
      inventory_product_id: string
      variant_id: string | null
      product_name: string
      variant_name: string | null
      quantity: string
      unit_price: string
      line_total: string
    }>(
      `
        SELECT *
        FROM public.ecommerce_order_items
        WHERE order_id = $1
        ORDER BY created_at ASC
        FOR UPDATE
      `,
      [orderId]
    )

    const items = itemResult.rows
    if (items.length === 0) throw new Error('Order tidak punya item.')

    const inventoryIds = [...new Set(items.map((item) => item.inventory_product_id))]
    const onHandResult = await client.query<{ product_id: string; qty: string }>(
      `
        SELECT product_id, COALESCE(SUM(quantity), 0)::text AS qty
        FROM public.inventory_stocks
        WHERE org_id = $1
          AND warehouse_id = $2
          AND product_id = ANY($3::uuid[])
        GROUP BY product_id
      `,
      [order.org_id, order.warehouse_id, inventoryIds]
    )

    const reservedSalesResult = await client.query<{ product_id: string; qty: string }>(
      `
        SELECT si.product_id, COALESCE(SUM(si.quantity), 0)::text AS qty
        FROM public.sales_items si
        JOIN public.sales s ON s.id = si.sale_id
        WHERE s.org_id = $1
          AND s.branch_id = $2
          AND s.status = 'ORDERED'
          AND si.product_id = ANY($3::uuid[])
        GROUP BY si.product_id
      `,
      [order.org_id, order.branch_id, inventoryIds]
    )

    const reservedEcommerceResult = await client.query<{ product_id: string; qty: string }>(
      `
        SELECT product_id, COALESCE(SUM(quantity), 0)::text AS qty
        FROM public.ecommerce_inventory_reservations
        WHERE org_id = $1
          AND warehouse_id = $2
          AND status = 'ACTIVE'
          AND product_id = ANY($3::uuid[])
        GROUP BY product_id
      `,
      [order.org_id, order.warehouse_id, inventoryIds]
    )

    const onHandByProduct = new Map(onHandResult.rows.map((row) => [row.product_id, toNumber(row.qty)]))
    const reservedSalesByProduct = new Map(reservedSalesResult.rows.map((row) => [row.product_id, toNumber(row.qty)]))
    const reservedEcommerceByProduct = new Map(reservedEcommerceResult.rows.map((row) => [row.product_id, toNumber(row.qty)]))

    for (const item of items) {
      const requiredQty = toNumber(item.quantity)
      const onHandQty = toNumber(onHandByProduct.get(item.inventory_product_id))
      const reservedSalesQty = toNumber(reservedSalesByProduct.get(item.inventory_product_id))
      const reservedEcommerceQty = toNumber(reservedEcommerceByProduct.get(item.inventory_product_id))
      const availableQty = onHandQty - reservedSalesQty - reservedEcommerceQty

      if (availableQty + 0.000001 < requiredQty) {
        throw new Error(`Stok tidak cukup untuk "${item.variant_name || item.product_name}".`)
      }
    }

    let contactId: string | null = null

    if (order.customer_email) {
      const contactByEmail = await client.query<{ id: string }>(
        `
          SELECT id
          FROM public.contacts
          WHERE org_id = $1
            AND LOWER(COALESCE(email, '')) = LOWER($2)
          ORDER BY created_at ASC
          LIMIT 1
        `,
        [order.org_id, order.customer_email]
      )
      contactId = contactByEmail.rows[0]?.id || null
    }

    if (!contactId && order.customer_phone) {
      const contactByPhone = await client.query<{ id: string }>(
        `
          SELECT id
          FROM public.contacts
          WHERE org_id = $1
            AND COALESCE(phone, '') = $2
          ORDER BY created_at ASC
          LIMIT 1
        `,
        [order.org_id, order.customer_phone]
      )
      contactId = contactByPhone.rows[0]?.id || null
    }

    if (!contactId) {
      const insertedContact = await client.query<{ id: string }>(
        `
          INSERT INTO public.contacts (
            org_id,
            name,
            type,
            email,
            phone,
            address
          )
          VALUES ($1, $2, 'CUSTOMER', $3, $4, $5)
          RETURNING id
        `,
        [
          order.org_id,
          order.customer_name,
          order.customer_email,
          order.customer_phone,
          order.customer_note,
        ]
      )
      contactId = insertedContact.rows[0]?.id || null
    }

    if (!contactId) throw new Error('Kontak pelanggan gagal dibuat.')

    const saleInsert = await client.query<{ id: string; sale_number: string }>(
      `
        INSERT INTO public.sales (
          org_id,
          branch_id,
          warehouse_id,
          sale_date,
          customer_id,
          total_amount,
          tax_amount,
          discount_amount,
          grand_total,
          status,
          payment_status,
          due_date,
          notes,
          created_by
        )
        VALUES (
          $1,
          $2,
          $3,
          CURRENT_DATE,
          $4,
          $5,
          0,
          0,
          $6,
          'ORDERED',
          'UNPAID',
          CURRENT_DATE,
          $7,
          $8
        )
        RETURNING id, sale_number
      `,
      [
        order.org_id,
        order.branch_id,
        order.warehouse_id,
        contactId,
        toNumber(order.subtotal_amount) + toNumber(order.shipping_amount),
        toNumber(order.grand_total),
        `Pesanan e-commerce ${order.order_number} dari store ${order.store_name}.`,
        actorUserId,
      ]
    )

    const sale = saleInsert.rows[0]
    if (!sale?.id) throw new Error('Sales order ERP gagal dibuat.')

    for (const item of items) {
      await client.query(
        `
          INSERT INTO public.sales_items (
            org_id,
            sale_id,
            product_id,
            description,
            quantity,
            unit_price,
            discount_amount,
            tax_amount,
            branch_id
          )
          VALUES ($1, $2, $3, $4, $5, $6, 0, 0, $7)
        `,
        [
          order.org_id,
          sale.id,
          item.inventory_product_id,
          item.variant_name ? `${item.product_name} - ${item.variant_name}` : item.product_name,
          toNumber(item.quantity),
          toNumber(item.unit_price),
          order.branch_id,
        ]
      )
    }

    if (toNumber(order.shipping_amount) > 0) {
      if (!order.shipping_fee_product_id) {
        throw new Error('Produk ongkir internal untuk store ini belum diatur.')
      }

      await client.query(
        `
          INSERT INTO public.sales_items (
            org_id,
            sale_id,
            product_id,
            description,
            quantity,
            unit_price,
            discount_amount,
            tax_amount,
            branch_id
          )
          VALUES ($1, $2, $3, 'Ongkir E-Commerce', 1, $4, 0, 0, $5)
        `,
        [
          order.org_id,
          sale.id,
          order.shipping_fee_product_id,
          toNumber(order.shipping_amount),
          order.branch_id,
        ]
      )
    }

    for (const item of items) {
      await client.query(
        `
          INSERT INTO public.ecommerce_inventory_reservations (
            org_id,
            store_id,
            order_id,
            order_item_id,
            sale_id,
            warehouse_id,
            product_id,
            variant_id,
            quantity,
            status,
            note
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'ACTIVE', $10)
        `,
        [
          order.org_id,
          order.store_id,
          order.id,
          item.id,
          sale.id,
          order.warehouse_id,
          item.inventory_product_id,
          item.variant_id,
          toNumber(item.quantity),
          `Reservasi stok setelah validasi pembayaran ${order.order_number}`,
        ]
      )
    }

    const bankAccountResult = await client.query<{ account_id: string }>(
      `
        SELECT account_id
        FROM public.bank_accounts
        WHERE id = $1
        LIMIT 1
      `,
      [order.bank_account_id]
    )

    const accountId = bankAccountResult.rows[0]?.account_id
    if (!accountId) throw new Error('Akun GL rekening penerima tidak ditemukan.')

    const paymentRpc = await client.query<{ result: { success?: boolean; payment_id?: string; error?: string } }>(
      `
        SELECT public.process_sales_payment_atomic($1, $2, $3, $4, 0, $5, $6, $7) AS result
      `,
      [
        order.org_id,
        sale.id,
        accountId,
        toNumber(payment.paid_amount || order.grand_total),
        payment.paid_at || new Date().toISOString(),
        `Validasi pembayaran e-commerce ${order.order_number}`,
        actorUserId,
      ]
    )

    const paymentRpcResult = paymentRpc.rows[0]?.result || {}
    if (!paymentRpcResult.success || !paymentRpcResult.payment_id) {
      throw new Error(paymentRpcResult.error || 'Pencatatan pembayaran ERP gagal.')
    }

    await client.query(
      `
        UPDATE public.ecommerce_order_payments
        SET
          status = 'VALIDATED',
          reviewer_user_id = $2,
          reviewed_at = NOW(),
          review_note = $3,
          erp_payment_id = $4
        WHERE id = $1
      `,
      [payment.id, actorUserId, reviewNote || null, paymentRpcResult.payment_id]
    )

    await client.query(
      `
        UPDATE public.ecommerce_orders
        SET
          payment_status = 'VALIDATED',
          status = 'READY_TO_FULFILL',
          erp_sale_id = $2,
          erp_sync_status = 'SYNCED',
          erp_sync_error = NULL
        WHERE id = $1
      `,
      [order.id, sale.id]
    )

    await client.query(
      `
        INSERT INTO public.ecommerce_order_events (
          org_id,
          order_id,
          actor_user_id,
          actor_label,
          event_type,
          message,
          payload
        )
        VALUES
          ($1, $2, $3, 'INTERNAL', 'PAYMENT_VALIDATED', 'Pembayaran order divalidasi.', $4::jsonb),
          ($1, $2, $3, 'SYSTEM', 'ERP_SYNCED', 'Sales order ERP berhasil dibuat setelah pembayaran valid.', $5::jsonb)
      `,
      [
        order.org_id,
        order.id,
        actorUserId,
        JSON.stringify({ note: reviewNote }),
        JSON.stringify({ saleId: sale.id, saleNumber: sale.sale_number, erpPaymentId: paymentRpcResult.payment_id }),
      ]
    )

    await client.query('COMMIT')

    return {
      saleId: sale.id,
      saleNumber: sale.sale_number,
    }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function approveOrderPayment(formData: FormData) {
  const { admin, userId } = await requireActiveOrgAdminContext()
  const orderId = cleanText(formData.get('order_id'), 80)
  if (!orderId) throw new Error('Order tidak valid.')

  const reviewNote = cleanLongText(formData.get('review_note'), 240)
  const { data: orderState, error: orderStateError } = await admin
    .from('ecommerce_orders')
    .select('id, org_id, status, payment_status, erp_sale_id')
    .eq('id', orderId)
    .maybeSingle()

  if (orderStateError || !orderState?.id) {
    throw new Error(orderStateError?.message || 'Order tidak ditemukan.')
  }

  if (orderState.erp_sale_id) {
    throw new Error('Order ini sudah tersambung ke sales order ERP.')
  }

  const orderStatus = cleanText(orderState.status, 40).toUpperCase()
  const paymentStatus = cleanText(orderState.payment_status, 40).toUpperCase()
  if (!['PAYMENT_UNDER_REVIEW', 'PAYMENT_EXCEPTION'].includes(orderStatus) || paymentStatus !== 'UNDER_REVIEW') {
    throw new Error('Order ini belum siap di-approve karena status review pembayarannya belum sesuai.')
  }

  try {
    return await approveOrderPaymentAtomic(orderId, userId, reviewNote)
  } catch (error) {
    await markOrderErpSyncFailure(admin, String(orderState.id), String(orderState.org_id), userId, error)

    throw error
  }
}

export async function retryOrderErpSync(formData: FormData) {
  const { admin, userId } = await requireActiveOrgAdminContext()
  const orderId = cleanText(formData.get('order_id'), 80)
  if (!orderId) throw new Error('Order tidak valid.')

  const reviewNote =
    cleanLongText(formData.get('review_note'), 240)
    || 'Sinkron ERP dicoba ulang dari dashboard admin.'

  const { data: order, error: orderError } = await admin
    .from('ecommerce_orders')
    .select('id, org_id, status, payment_status, erp_sale_id, erp_sync_status')
    .eq('id', orderId)
    .maybeSingle()

  if (orderError || !order?.id) {
    throw new Error(orderError?.message || 'Order tidak ditemukan.')
  }

  if (order.erp_sale_id) {
    throw new Error('Order ini sudah terhubung ke sales order ERP.')
  }

  const orderStatus = cleanText(order.status, 40).toUpperCase()
  const paymentStatus = cleanText(order.payment_status, 40).toUpperCase()
  if (!['PAYMENT_EXCEPTION', 'PAYMENT_UNDER_REVIEW'].includes(orderStatus) || paymentStatus !== 'UNDER_REVIEW') {
    throw new Error('Retry ERP hanya bisa dilakukan untuk order yang sedang review atau masuk exception.')
  }

  await markOrderEvent(
    admin,
    String(order.org_id),
    String(order.id),
    'ERP_SYNC_RETRY_REQUESTED',
    'Admin mencoba ulang sinkron order ke ERP.',
    {
      reviewNote,
      previousStatus: order.status,
      previousSyncStatus: order.erp_sync_status,
    },
    userId
  )

  try {
    return await approveOrderPaymentAtomic(orderId, userId, reviewNote)
  } catch (error) {
    await markOrderErpSyncFailure(admin, String(order.id), String(order.org_id), userId, error)
    throw error
  }
}

export async function rejectOrderPayment(formData: FormData) {
  const { admin, userId, orgId } = await requireActiveOrgAdminContext()
  const orderId = cleanText(formData.get('order_id'), 80)
  if (!orderId) throw new Error('Order tidak valid.')

  const reviewNote = cleanLongText(formData.get('review_note'), 240) || 'Bukti pembayaran ditolak.'
  const payment = await findLatestPaymentRow(orderId)
  if (!payment?.id) throw new Error('Data pembayaran order tidak ditemukan.')

  const { error: paymentError } = await admin
    .from('ecommerce_order_payments')
    .update({
      status: 'REJECTED',
      reviewer_user_id: userId,
      reviewed_at: new Date().toISOString(),
      review_note: reviewNote,
    })
    .eq('id', payment.id)

  if (paymentError) {
    throw new Error(`Gagal menolak pembayaran: ${paymentError.message}`)
  }

  const { error: orderError } = await admin
    .from('ecommerce_orders')
    .update({
      status: 'PAYMENT_REJECTED',
      payment_status: 'REJECTED',
      erp_sync_status: 'PENDING',
      erp_sync_error: null,
    })
    .eq('id', orderId)

  if (orderError) {
    throw new Error(`Pembayaran ditolak, tetapi status order gagal diperbarui: ${orderError.message}`)
  }

  await markOrderEvent(
    admin,
    orgId,
    orderId,
    'PAYMENT_REJECTED',
    'Bukti pembayaran ditolak oleh tim internal.',
    {
      note: reviewNote,
    },
    userId
  )
}
