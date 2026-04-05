'use server'

import { Prisma } from '@prisma/client'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { normalizeSaasEntitlementName } from '@/lib/saas/module-catalog'
import { isPlatformAdminEmail } from '@/lib/saas/platform-admin'
import { DEFAULT_AI_TOKEN_POLICY } from '@/modules/ai/lib/ai-token'
import { generateSlug } from '@/lib/utils'
import { revalidatePath } from 'next/cache'

type JsonRecord = Record<string, unknown>
type AddonEntry = Record<string, unknown> & { name: string }

export type SaasAdminSnapshot = {
  saasSettings: Record<string, unknown>
  orgs: Array<{
    id: string
    name: string
    owner_email: string | null
    is_demo: boolean
    is_active: boolean
    settings: JsonRecord
    created_at: string
  }>
  packages: Array<{
    id: string
    name: string
    price: number
    billing: string
    active: boolean
    modules: string[]
    addons: string[]
    duration_days: number | null
    max_orgs: number | null
    max_warehouses: number | null
  }>
  invoices: Array<{
    id: string
    org_id: string | null
    package_id: string | null
    invoice_number: string
    item_name: string | null
    amount: number
    status: string
    payment_proof_url: string | null
    created_at: string | null
    organization: { name: string } | null
    package: {
      name: string
      modules: string[]
      duration_days: number | null
      max_orgs: number | null
      max_warehouses: number | null
    } | null
  }>
  aiTokenPolicyRaw: JsonRecord
  aiTokenInventory: JsonRecord
  aiTopupPackages: Array<{
    id: string
    name: string
    description: string | null
    tokens: number
    price_idr: number
    cost_idr: number
    sort_order: number
    is_active: boolean
  }>
  aiWalletSummary: {
    totalBalance: number
    totalPurchased: number
    totalUsed: number
  }
}

type SaveSaasSettingsInput = {
  bankInfo: {
    bank: string
    account: string
    name: string
  }
  supportInfo: {
    wa: string
    label: string
  }
}

type SaveAiTokenConfigInput = {
  policyValue: JsonRecord
  inventoryValue: JsonRecord
}

type SaveAiTopupPackageInput = {
  id?: string | null
  name: string
  description: string
  tokens: number
  price_idr: number
  cost_idr: number
  sort_order: number
  is_active: boolean
}

type SaveSaasPackageInput = {
  id?: string | null
  name: string
  price: number
  billing: string
  modules: string[]
  duration_days: number
  max_orgs: number
  max_warehouses: number
}

type SaveSaasOrganizationInput = {
  id?: string | null
  name: string
  owner_email: string
  is_demo: boolean
  is_active: boolean
  plan: string
  expires_at: string | null
}

function toNumber(value: unknown) {
  if (typeof value === 'number') return value
  if (typeof value === 'bigint') return Number(value)

  if (
    value
    && typeof value === 'object'
    && 'toNumber' in value
    && typeof value.toNumber === 'function'
  ) {
    return value.toNumber()
  }

  const normalized = Number(value ?? 0)
  return Number.isFinite(normalized) ? normalized : 0
}

function normalizeObject(value: unknown): JsonRecord {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return { ...(value as JsonRecord) }
  }

  return {}
}

function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((entry) => String(entry || '').trim())
      .filter(Boolean)
  }

  return []
}

function toInputJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue
}

async function requirePlatformAdmin() {
  const session = await auth()
  const user = session?.user
  const email = String(user?.email || '').trim()

  if (!user?.id || !email || !isPlatformAdminEmail(email)) {
    throw new Error('Akses ditolak. Modul ini khusus pengelola SaaS.')
  }

  return {
    userId: user.id,
    email,
  }
}

function revalidateSaasAdminPaths() {
  const paths = [
    '/admin',
    '/billing',
    '/pricing',
    '/saas/penawaran',
    '/saas/penjualan',
    '/settings/business',
    '/accounting/journal',
  ]

  paths.forEach((path) => revalidatePath(path))
  revalidatePath('/', 'layout')
}

async function buildUniqueOrganizationSlug(name: string, existingOrgId?: string | null) {
  const base = generateSlug(name) || 'tenant'

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const suffix = attempt === 0 ? '' : `-${Math.random().toString(36).slice(2, 5)}`
    const slug = `${base}${suffix}`

    const existing = await prisma.organizations.findUnique({
      where: { slug },
      select: { id: true },
    })

    if (!existing || existing.id === existingOrgId) {
      return slug
    }
  }

  return `${base}-${Date.now().toString(36)}`
}

function normalizeAddonList(value: unknown) {
  if (!Array.isArray(value)) return []

  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null

      const raw = entry as Record<string, unknown>
      const normalizedName = normalizeSaasEntitlementName(String(raw.name || ''))
      return {
        ...raw,
        name: normalizedName || String(raw.name || '').trim(),
      }
    })
    .filter((entry): entry is AddonEntry => Boolean(entry?.name))
}

function buildConfigMap(rows: Array<{ key: string; value: unknown }>) {
  return rows.reduce<Record<string, unknown>>((acc, row) => {
    acc[row.key] = row.value
    return acc
  }, {})
}

async function getLowBalanceThreshold() {
  const config = await prisma.saas_config.findUnique({
    where: { key: 'ai_token_policy' },
    select: { value: true },
  })

  const policy = normalizeObject(config?.value)
  const threshold = Math.max(
    0,
    Math.round(toNumber(policy.low_balance_threshold ?? DEFAULT_AI_TOKEN_POLICY.lowBalanceThreshold))
  )

  return threshold
}

export async function getSaasAdminSnapshot(): Promise<SaasAdminSnapshot> {
  await requirePlatformAdmin()

  const [configRows, orgRows, packageRows, invoiceRows, aiTopupRows, walletRows] = await Promise.all([
    prisma.saas_config.findMany({
      select: {
        key: true,
        value: true,
      },
    }),
    prisma.organizations.findMany({
      orderBy: {
        created_at: 'desc',
      },
      select: {
        id: true,
        name: true,
        owner_email: true,
        is_demo: true,
        is_active: true,
        settings: true,
        created_at: true,
      },
    }),
    prisma.saas_packages.findMany({
      orderBy: {
        price: 'asc',
      },
      select: {
        id: true,
        name: true,
        price: true,
        billing: true,
        is_active: true,
        modules: true,
        addons: true,
        duration_days: true,
        max_orgs: true,
        max_warehouses: true,
      },
    }),
    prisma.saas_invoices.findMany({
      orderBy: {
        created_at: 'desc',
      },
      select: {
        id: true,
        org_id: true,
        package_id: true,
        invoice_number: true,
        item_name: true,
        amount: true,
        status: true,
        payment_proof_url: true,
        created_at: true,
        organizations: {
          select: {
            name: true,
          },
        },
        saas_packages: {
          select: {
            name: true,
            modules: true,
            duration_days: true,
            max_orgs: true,
            max_warehouses: true,
          },
        },
      },
    }),
    prisma.ai_token_topup_packages.findMany({
      orderBy: [
        { sort_order: 'asc' },
        { tokens: 'asc' },
      ],
      select: {
        id: true,
        name: true,
        description: true,
        tokens: true,
        price_idr: true,
        cost_idr: true,
        sort_order: true,
        is_active: true,
      },
    }),
    prisma.ai_token_wallets.findMany({
      select: {
        balance_tokens: true,
        total_purchased_tokens: true,
        total_used_tokens: true,
      },
    }),
  ])

  const saasSettings = buildConfigMap(configRows)

  return {
    saasSettings,
    orgs: orgRows.map((org) => ({
      id: org.id,
      name: org.name,
      owner_email: org.owner_email ?? null,
      is_demo: org.is_demo ?? false,
      is_active: org.is_active,
      settings: normalizeObject(org.settings),
      created_at: org.created_at.toISOString(),
    })),
    packages: packageRows.map((pkg) => ({
      id: pkg.id,
      name: pkg.name,
      price: toNumber(pkg.price),
      billing: pkg.billing,
      active: pkg.is_active,
      modules: normalizeStringArray(pkg.modules),
      addons: normalizeStringArray(pkg.addons),
      duration_days: pkg.duration_days ?? null,
      max_orgs: pkg.max_orgs ?? null,
      max_warehouses: pkg.max_warehouses ?? null,
    })),
    invoices: invoiceRows.map((invoice) => ({
      id: invoice.id,
      org_id: invoice.org_id ?? null,
      package_id: invoice.package_id ?? null,
      invoice_number: invoice.invoice_number,
      item_name: invoice.item_name ?? null,
      amount: toNumber(invoice.amount),
      status: String(invoice.status || 'UNPAID'),
      payment_proof_url: invoice.payment_proof_url ?? null,
      created_at: invoice.created_at?.toISOString() ?? null,
      organization: invoice.organizations
        ? {
            name: invoice.organizations.name,
          }
        : null,
      package: invoice.saas_packages
        ? {
            name: invoice.saas_packages.name,
            modules: normalizeStringArray(invoice.saas_packages.modules),
            duration_days: invoice.saas_packages.duration_days ?? null,
            max_orgs: invoice.saas_packages.max_orgs ?? null,
            max_warehouses: invoice.saas_packages.max_warehouses ?? null,
          }
        : null,
    })),
    aiTokenPolicyRaw: normalizeObject(saasSettings.ai_token_policy),
    aiTokenInventory: normalizeObject(saasSettings.ai_token_inventory),
    aiTopupPackages: aiTopupRows.map((pkg) => ({
      id: pkg.id,
      name: pkg.name,
      description: pkg.description ?? null,
      tokens: toNumber(pkg.tokens),
      price_idr: toNumber(pkg.price_idr),
      cost_idr: toNumber(pkg.cost_idr),
      sort_order: pkg.sort_order,
      is_active: pkg.is_active,
    })),
    aiWalletSummary: walletRows.reduce(
      (acc, wallet) => ({
        totalBalance: acc.totalBalance + toNumber(wallet.balance_tokens),
        totalPurchased: acc.totalPurchased + toNumber(wallet.total_purchased_tokens),
        totalUsed: acc.totalUsed + toNumber(wallet.total_used_tokens),
      }),
      { totalBalance: 0, totalPurchased: 0, totalUsed: 0 }
    ),
  }
}

export async function saveSaasSettings(input: SaveSaasSettingsInput) {
  await requirePlatformAdmin()

  const bankInfo = {
    bank: String(input.bankInfo.bank || '').trim(),
    account: String(input.bankInfo.account || '').trim(),
    name: String(input.bankInfo.name || '').trim(),
  }
  const supportInfo = {
    wa: String(input.supportInfo.wa || '').trim(),
    label: String(input.supportInfo.label || '').trim(),
  }

  await prisma.$transaction([
    prisma.saas_config.upsert({
      where: { key: 'bank_info' },
      update: { value: toInputJson(bankInfo), updated_at: new Date() },
      create: { key: 'bank_info', value: toInputJson(bankInfo) },
    }),
    prisma.saas_config.upsert({
      where: { key: 'support_info' },
      update: { value: toInputJson(supportInfo), updated_at: new Date() },
      create: { key: 'support_info', value: toInputJson(supportInfo) },
    }),
  ])

  revalidateSaasAdminPaths()
  return { success: true }
}

export async function saveAiTokenConfig(input: SaveAiTokenConfigInput) {
  await requirePlatformAdmin()

  const policyValue = normalizeObject(input.policyValue)
  const inventoryValue = normalizeObject(input.inventoryValue)

  await prisma.$transaction([
    prisma.saas_config.upsert({
      where: { key: 'ai_token_policy' },
      update: { value: toInputJson(policyValue), updated_at: new Date() },
      create: { key: 'ai_token_policy', value: toInputJson(policyValue) },
    }),
    prisma.saas_config.upsert({
      where: { key: 'ai_token_inventory' },
      update: { value: toInputJson(inventoryValue), updated_at: new Date() },
      create: { key: 'ai_token_inventory', value: toInputJson(inventoryValue) },
    }),
  ])

  revalidateSaasAdminPaths()
  return { success: true }
}

export async function saveAiTopupPackage(input: SaveAiTopupPackageInput) {
  await requirePlatformAdmin()

  const payload = {
    name: String(input.name || '').trim(),
    description: String(input.description || '').trim() || null,
    tokens: BigInt(Math.max(1, Math.floor(toNumber(input.tokens)))),
    price_idr: Math.max(0, toNumber(input.price_idr)),
    cost_idr: Math.max(0, toNumber(input.cost_idr)),
    sort_order: Math.max(0, Math.floor(toNumber(input.sort_order))),
    is_active: Boolean(input.is_active),
    updated_at: new Date(),
  }

  if (!payload.name) {
    return { error: 'Nama paket wajib diisi.' }
  }

  if (input.id) {
    await prisma.ai_token_topup_packages.update({
      where: { id: input.id },
      data: payload,
    })
  } else {
    await prisma.ai_token_topup_packages.create({
      data: payload,
    })
  }

  revalidateSaasAdminPaths()
  return { success: true }
}

export async function toggleAiTopupPackageStatus(id: string, currentStatus: boolean) {
  await requirePlatformAdmin()

  await prisma.ai_token_topup_packages.update({
    where: { id },
    data: {
      is_active: !currentStatus,
      updated_at: new Date(),
    },
  })

  revalidateSaasAdminPaths()
  return { success: true }
}

export async function deleteAiTopupPackage(id: string) {
  await requirePlatformAdmin()

  await prisma.ai_token_topup_packages.delete({
    where: { id },
  })

  revalidateSaasAdminPaths()
  return { success: true }
}

export async function approveSaasInvoice(invoiceId: string) {
  await requirePlatformAdmin()

  const now = new Date()
  const invoice = await prisma.saas_invoices.findUnique({
    where: { id: invoiceId },
    include: {
      organizations: {
        select: {
          settings: true,
          active_addons: true,
        },
      },
      saas_packages: {
        select: {
          id: true,
          name: true,
          duration_days: true,
        },
      },
      ai_token_topup_orders: true,
    },
  })

  if (!invoice) {
    return { error: 'Invoice tidak ditemukan.' }
  }

  if (String(invoice.status || 'UNPAID') === 'PAID') {
    return { success: true }
  }

  if (invoice.ai_token_topup_orders) {
    const topupOrder = invoice.ai_token_topup_orders
    const lowBalanceThreshold = await getLowBalanceThreshold()

    await prisma.$transaction(async (tx) => {
      await tx.saas_invoices.update({
        where: { id: invoice.id },
        data: {
          status: 'PAID',
          updated_at: now,
        },
      })

      const existingWallet = await tx.ai_token_wallets.findUnique({
        where: { org_id: invoice.org_id || '' },
      })

      const tokenAmount = topupOrder.tokens

      if (existingWallet) {
        await tx.ai_token_wallets.update({
          where: { org_id: existingWallet.org_id },
          data: {
            balance_tokens: existingWallet.balance_tokens + tokenAmount,
            total_purchased_tokens: existingWallet.total_purchased_tokens + tokenAmount,
            updated_at: now,
          },
        })
      } else if (invoice.org_id) {
        await tx.ai_token_wallets.create({
          data: {
            org_id: invoice.org_id,
            balance_tokens: tokenAmount,
            total_purchased_tokens: tokenAmount,
            total_used_tokens: BigInt(0),
            low_balance_threshold: BigInt(lowBalanceThreshold),
            updated_at: now,
          },
        })
      }

      await tx.ai_token_usage_logs.create({
        data: {
          org_id: invoice.org_id || '',
          source: 'topup',
          direction: 'CREDIT',
          tokens: tokenAmount,
          related_invoice_id: invoice.id,
          note: `Topup token AI dari paket ${topupOrder.package_id}`,
          meta: toInputJson({
            topup_order_id: topupOrder.id,
            package_id: topupOrder.package_id,
          }),
        },
      })

      await tx.ai_token_topup_orders.update({
        where: { id: topupOrder.id },
        data: {
          status: 'PAID',
          paid_at: now,
          updated_at: now,
        },
      })
    })

    revalidateSaasAdminPaths()
    return { success: true }
  }

  if (invoice.package_id && invoice.org_id && invoice.saas_packages?.name) {
    const currentSettings = normalizeObject(invoice.organizations?.settings)
    const expiresAt = new Date(now)
    expiresAt.setDate(expiresAt.getDate() + (invoice.saas_packages.duration_days || 30))

    await prisma.$transaction([
      prisma.saas_invoices.update({
        where: { id: invoice.id },
        data: {
          status: 'PAID',
          updated_at: now,
        },
      }),
      prisma.organizations.update({
        where: { id: invoice.org_id },
        data: {
          settings: toInputJson({
            ...currentSettings,
            plan: invoice.saas_packages.name,
            expires_at: expiresAt.toISOString(),
            updated_at: now.toISOString(),
          }),
          updated_at: now,
        },
      }),
    ])

    revalidateSaasAdminPaths()
    return { success: true }
  }

  if (invoice.org_id) {
    const currentAddons = normalizeAddonList(invoice.organizations?.active_addons)
    const addonName = normalizeSaasEntitlementName(String(invoice.item_name || '').trim()) || String(invoice.item_name || '').trim()
    const dedupedAddons: AddonEntry[] = currentAddons.filter((entry) => {
      return normalizeSaasEntitlementName(String(entry.name || '')) !== addonName
    })

    if (addonName) {
      dedupedAddons.push({
        id: invoice.id,
        name: addonName,
        activated_at: now.toISOString(),
      })
    }

    await prisma.$transaction([
      prisma.saas_invoices.update({
        where: { id: invoice.id },
        data: {
          status: 'PAID',
          updated_at: now,
        },
      }),
      prisma.organizations.update({
        where: { id: invoice.org_id },
        data: {
          active_addons: toInputJson(dedupedAddons),
          updated_at: now,
        },
      }),
    ])
  }

  revalidateSaasAdminPaths()
  return { success: true }
}

export async function cancelSaasInvoice(id: string) {
  await requirePlatformAdmin()

  await prisma.saas_invoices.update({
    where: { id },
    data: {
      status: 'CANCELLED',
      updated_at: new Date(),
    },
  })

  revalidateSaasAdminPaths()
  return { success: true }
}

export async function deleteSaasInvoice(id: string) {
  await requirePlatformAdmin()

  await prisma.saas_invoices.delete({
    where: { id },
  })

  revalidateSaasAdminPaths()
  return { success: true }
}

export async function toggleSaasPackageStatus(id: string, currentStatus: boolean) {
  await requirePlatformAdmin()

  await prisma.saas_packages.update({
    where: { id },
    data: {
      is_active: !currentStatus,
      updated_at: new Date(),
    },
  })

  revalidateSaasAdminPaths()
  return { success: true }
}

export async function saveSaasPackage(input: SaveSaasPackageInput) {
  await requirePlatformAdmin()

  const payload = {
    name: String(input.name || '').trim(),
    price: Math.max(0, toNumber(input.price)),
    billing: String(input.billing || 'Bulan').trim() || 'Bulan',
    modules: input.modules.map((entry) => String(entry || '').trim()).filter(Boolean),
    duration_days: Math.max(1, Math.floor(toNumber(input.duration_days))),
    max_orgs: Math.max(1, Math.floor(toNumber(input.max_orgs))),
    max_warehouses: Math.max(1, Math.floor(toNumber(input.max_warehouses))),
    updated_at: new Date(),
  }

  if (!payload.name) {
    return { error: 'Nama paket wajib diisi.' }
  }

  if (input.id) {
    await prisma.saas_packages.update({
      where: { id: input.id },
      data: payload,
    })
  } else {
    await prisma.saas_packages.upsert({
      where: { name: payload.name },
      update: payload,
      create: {
        ...payload,
        is_active: true,
      },
    })
  }

  revalidateSaasAdminPaths()
  return { success: true }
}

export async function deleteSaasPackage(id: string) {
  await requirePlatformAdmin()

  await prisma.saas_packages.delete({
    where: { id },
  })

  revalidateSaasAdminPaths()
  return { success: true }
}

export async function saveSaasOrganization(input: SaveSaasOrganizationInput) {
  await requirePlatformAdmin()

  const name = String(input.name || '').trim()
  const ownerEmail = String(input.owner_email || '').trim()
  const plan = String(input.plan || 'Demo').trim() || 'Demo'
  const expiresAt = String(input.expires_at || '').trim()
  const baseSettings = input.id
    ? normalizeObject((await prisma.organizations.findUnique({
        where: { id: input.id },
        select: { settings: true },
      }))?.settings)
    : {}

  if (!name) {
    return { error: 'Nama organisasi wajib diisi.' }
  }

  if (!ownerEmail) {
    return { error: 'Email pemilik wajib diisi.' }
  }

  const nextSettings = {
    ...baseSettings,
    plan,
    expires_at: expiresAt || null,
  }

  if (input.id) {
    const slug = await buildUniqueOrganizationSlug(name, input.id)

    await prisma.organizations.update({
      where: { id: input.id },
      data: {
        name,
        slug,
        owner_email: ownerEmail,
        is_demo: Boolean(input.is_demo),
        is_active: Boolean(input.is_active),
        settings: toInputJson(nextSettings),
        updated_at: new Date(),
      },
    })
  } else {
    const slug = await buildUniqueOrganizationSlug(name)

    await prisma.organizations.create({
      data: {
        name,
        slug,
        owner_email: ownerEmail,
        is_demo: Boolean(input.is_demo),
        is_active: Boolean(input.is_active),
        settings: toInputJson(nextSettings),
      },
    })
  }

  revalidateSaasAdminPaths()
  return { success: true }
}

export async function deleteSaasOrganization(id: string) {
  await requirePlatformAdmin()

  await prisma.organizations.delete({
    where: { id },
  })

  revalidateSaasAdminPaths()
  return { success: true }
}
