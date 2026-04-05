'use server'

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getMembership } from '@/lib/auth/permissions'
import { revalidatePath } from 'next/cache'
import { normalizeSaasEntitlementName } from '@/lib/saas/module-catalog'
import { OPERATOR_ADDON_OPTIONS } from '@/lib/saas/operator-pricing'
import { uploadBillingProofAsset } from '@/modules/organization/lib/billing-proof-storage.server'

const DEFAULT_BANK_INFO = {
  bank: 'BANK MANDIRI (KCP BANDUNG)',
  account: '1310022339999',
  name: 'PT NIZAM TEKNOLOGI BERKAH',
}

const DEFAULT_SUPPORT_INFO = {
  wa: '628123456789',
  label: 'Admin Nizam Support',
}

async function requireBillingMembership(orgId: string) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) {
    return { error: 'Unauthorized' as const }
  }

  const trimmedOrgId = String(orgId || '').trim()
  if (!trimmedOrgId) {
    return { error: 'Organisasi tidak valid.' as const }
  }

  const membership = await getMembership(userId, trimmedOrgId)
  if (!membership) {
    return { error: 'Akses organisasi ditolak.' as const }
  }

  return {
    userId,
    orgId: trimmedOrgId,
    membership,
  }
}

function mergePlanSetting(
  currentSettings: unknown,
  nextPlan: string
) {
  const baseSettings =
    currentSettings &&
    typeof currentSettings === 'object' &&
    !Array.isArray(currentSettings)
      ? { ...(currentSettings as Record<string, unknown>) }
      : {}

  return {
    ...baseSettings,
    plan: nextPlan,
    updated_at: new Date().toISOString(),
  }
}

function normalizeSettings(value: unknown) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return { ...(value as Record<string, unknown>) }
  }

  return {}
}

function normalizeArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
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

function normalizeConfigMap(rows: Array<{ key: string; value: unknown }>) {
  const config = rows.reduce<Record<string, unknown>>((acc, row) => {
    acc[row.key] = row.value
    return acc
  }, {})

  const bankInfo =
    config.bank_info && typeof config.bank_info === 'object' && !Array.isArray(config.bank_info)
      ? { ...DEFAULT_BANK_INFO, ...(config.bank_info as Record<string, unknown>) }
      : DEFAULT_BANK_INFO

  const supportInfo =
    config.support_info && typeof config.support_info === 'object' && !Array.isArray(config.support_info)
      ? { ...DEFAULT_SUPPORT_INFO, ...(config.support_info as Record<string, unknown>) }
      : DEFAULT_SUPPORT_INFO

  return { bankInfo, supportInfo }
}

function normalizePackageModules(value: unknown) {
  return normalizeArray(value)
    .map((entry) => String(entry || '').trim())
    .filter(Boolean)
}

export async function getBillingDashboardData(orgId?: string | null) {
  const [configRows, tokenPackages] = await Promise.all([
    prisma.saas_config.findMany({
      select: {
        key: true,
        value: true,
      },
    }),
    prisma.ai_token_topup_packages.findMany({
      where: {
        is_active: true,
      },
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
        sort_order: true,
      },
    }),
  ])

  const { bankInfo, supportInfo } = normalizeConfigMap(configRows)
  const normalizedTokenPackages = tokenPackages.map((pkg) => ({
    id: pkg.id,
    name: pkg.name,
    description: pkg.description,
    tokens: toNumber(pkg.tokens),
    price_idr: toNumber(pkg.price_idr),
    sort_order: pkg.sort_order,
  }))

  const emptyResult = {
    bankInfo,
    supportInfo,
    activeOrg: null,
    packages: [] as Array<{
      id: string
      name: string
      price: number
      billing: string
      duration_days: number | null
      max_orgs: number | null
      max_warehouses: number | null
      modules: string[]
    }>,
    invoices: [] as Array<{
      id: string
      invoice_number: string
      amount: number
      status: string
      created_at: string | null
      due_date: string | null
      item_name: string | null
      payment_proof_url: string | null
    }>,
    aiTokenBalance: 0,
    aiTokenPackages: normalizedTokenPackages,
    totalMonthly: 0,
  }

  if (!orgId) {
    return emptyResult
  }

  const access = await requireBillingMembership(orgId)
  if ('error' in access) {
    return emptyResult
  }

  const [org, packages, wallet, invoices] = await Promise.all([
    prisma.organizations.findUnique({
      where: {
        id: access.orgId,
      },
      select: {
        id: true,
        name: true,
        logo_url: true,
        settings: true,
        active_addons: true,
        is_demo: true,
      },
    }),
    prisma.saas_packages.findMany({
      where: {
        is_active: true,
      },
      orderBy: {
        price: 'asc',
      },
      select: {
        id: true,
        name: true,
        price: true,
        billing: true,
        duration_days: true,
        max_orgs: true,
        max_warehouses: true,
        modules: true,
      },
    }),
    prisma.ai_token_wallets.findUnique({
      where: {
        org_id: access.orgId,
      },
      select: {
        balance_tokens: true,
      },
    }),
    prisma.saas_invoices.findMany({
      where: {
        org_id: access.orgId,
      },
      orderBy: {
        created_at: 'desc',
      },
      select: {
        id: true,
        invoice_number: true,
        amount: true,
        status: true,
        created_at: true,
        due_date: true,
        item_name: true,
        payment_proof_url: true,
      },
    }),
  ])

  const normalizedPackages = packages.map((pkg) => ({
    id: pkg.id,
    name: pkg.name,
    price: toNumber(pkg.price),
    billing: pkg.billing,
    duration_days: pkg.duration_days ?? null,
    max_orgs: pkg.max_orgs ?? null,
    max_warehouses: pkg.max_warehouses ?? null,
    modules: normalizePackageModules(pkg.modules),
  }))

  if (!org) {
    return {
      ...emptyResult,
      packages: normalizedPackages,
    }
  }

  const settings = normalizeSettings(org.settings)
  const activeAddons = normalizeArray(org.active_addons)
  const currentPlan = String(settings.plan || '')
  const currentPlanPackage = normalizedPackages.find((pkg) => pkg.name === currentPlan) ?? null
  const monthlyAddonsTotal = activeAddons.reduce((sum: number, addon) => {
    const addonName = normalizeSaasEntitlementName(String((addon as any)?.name || ''))
    const price = OPERATOR_ADDON_OPTIONS.find((entry) => entry.name === addonName)?.price ?? 0
    return sum + price
  }, 0)

  return {
    bankInfo,
    supportInfo,
    activeOrg: {
      id: org.id,
      name: org.name,
      logo_url: org.logo_url ?? null,
      settings,
      active_addons: activeAddons,
      package_limit: {
        max_orgs: currentPlanPackage?.max_orgs ?? 1,
        max_warehouses: currentPlanPackage?.max_warehouses ?? 3,
        max_users: 10,
      },
      is_demo: org.is_demo ?? false,
    },
    packages: normalizedPackages,
    invoices: invoices.map((invoice) => ({
      id: invoice.id,
      invoice_number: invoice.invoice_number,
      amount: toNumber(invoice.amount),
      status: String(invoice.status || 'UNPAID'),
      created_at: invoice.created_at?.toISOString() ?? null,
      due_date: invoice.due_date?.toISOString() ?? null,
      item_name: invoice.item_name ?? null,
      payment_proof_url: invoice.payment_proof_url ?? null,
    })),
    aiTokenBalance: toNumber(wallet?.balance_tokens ?? 0),
    aiTokenPackages: normalizedTokenPackages,
    totalMonthly: (currentPlanPackage?.price ?? 0) + monthlyAddonsTotal,
  }
}

export async function uploadBillingPaymentProof(
  orgId: string,
  invoiceId: string,
  formData: FormData,
  method: string = 'BANK_TRANSFER'
) {
  const access = await requireBillingMembership(orgId)
  if ('error' in access) return { error: access.error }

  const fileEntry = formData.get('proof')
  if (!(fileEntry instanceof File) || fileEntry.size <= 0) {
    return { error: 'Silakan unggah bukti transfer terlebih dahulu.' }
  }

  const invoice = await prisma.saas_invoices.findFirst({
    where: {
      id: invoiceId,
      org_id: access.orgId,
    },
    select: {
      invoice_number: true,
    },
  })

  if (!invoice?.invoice_number) {
    return { error: 'Invoice tidak ditemukan.' }
  }

  const uploadResult = await uploadBillingProofAsset(access.orgId, invoice.invoice_number, fileEntry)
  if ('error' in uploadResult) {
    return { error: uploadResult.error }
  }

  return submitPaymentProof(access.orgId, invoiceId, uploadResult.url, method)
}

export async function getBillingInvoicePrintData(invoiceId: string) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return { error: 'Unauthorized' as const }

  const trimmedInvoiceId = String(invoiceId || '').trim()
  if (!trimmedInvoiceId) {
    return { error: 'Invoice tidak valid.' as const }
  }

  const invoice = await prisma.saas_invoices.findUnique({
    where: {
      id: trimmedInvoiceId,
    },
    include: {
      organizations: {
        select: {
          id: true,
          name: true,
          logo_url: true,
          settings: true,
          owner_email: true,
        },
      },
    },
  })

  const orgId = String(invoice?.org_id || '').trim()
  if (!invoice || !orgId) {
    return { error: 'Invoice tidak ditemukan.' as const }
  }

  const membership = await getMembership(userId, orgId)
  if (!membership) {
    return { error: 'Akses organisasi ditolak.' as const }
  }

  const configRows = await prisma.saas_config.findMany({
    select: {
      key: true,
      value: true,
    },
  })
  const { bankInfo, supportInfo } = normalizeConfigMap(configRows)
  const orgSettings = normalizeSettings(invoice.organizations?.settings)

  return {
    invoice: {
      id: invoice.id,
      invoice_number: invoice.invoice_number,
      amount: toNumber(invoice.amount),
      status: String(invoice.status || 'UNPAID'),
      created_at: invoice.created_at?.toISOString() ?? null,
      due_date: invoice.due_date?.toISOString() ?? null,
      item_name: invoice.item_name ?? null,
      organization: invoice.organizations
        ? {
            id: invoice.organizations.id,
            name: invoice.organizations.name,
            logo_url: invoice.organizations.logo_url ?? null,
            owner_email: invoice.organizations.owner_email ?? null,
            settings: orgSettings,
          }
        : null,
    },
    saasConfig: {
      bank_info: bankInfo,
      support_info: supportInfo,
    },
  }
}

export async function createBillingInvoice(
  orgId: string,
  item: {
    id: string
    name: string
    price: number
    type: 'PACKAGE' | 'ADDON' | 'AI_TOKEN_TOPUP'
    topupPackageId?: string
    tokens?: number
  },
) {
  const access = await requireBillingMembership(orgId)
  if ('error' in access) return { error: access.error }

  const invoiceKey = `${item.type}-${item.id}`
  const isPackage = item.type === 'PACKAGE'
  const isTopup = item.type === 'AI_TOKEN_TOPUP'

  // 1. Cek apakah sudah ada invoice UNPAID untuk item ini di org ini (agar tidak double)
  const existing = await prisma.saas_invoices.findFirst({
    where: {
      org_id: access.orgId,
      package_id: isPackage ? item.id : null,
      status: 'UNPAID',
      invoice_number: {
        contains: invoiceKey,
      },
    },
    select: {
      id: true,
      invoice_number: true,
      amount: true,
    },
  })

  if (existing) {
    return {
      success: true,
      id: existing.id,
      invoiceNumber: existing.invoice_number,
      amount: Number(existing.amount),
      message: 'Harap selesaikan pembayaran invoice sebelumnya.',
    }
  }

  // 2. Generate Concise Invoice Number
  const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase()
  const prefix = isPackage ? 'PKG' : isTopup ? 'TOK' : 'ADD'
  const invoiceNumber = `INV-${prefix}-${invoiceKey}-${randomStr}`
  const itemName = isTopup && item.tokens
    ? `AI Token Topup: ${item.name} (${Number(item.tokens).toLocaleString('id-ID')} token)`
    : item.name

  // 3. Insert Invoice
  try {
    const data = await prisma.saas_invoices.create({
      data: {
        org_id: access.orgId,
        package_id: isPackage ? item.id : null,
        item_name: itemName,
        invoice_number: invoiceNumber,
        amount: item.price,
        status: 'UNPAID',
        due_date: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
      select: {
        id: true,
        invoice_number: true,
        amount: true,
      },
    })

    if (isTopup) {
      if (!item.topupPackageId || !item.tokens) {
        return { error: 'Konfigurasi paket token tidak lengkap.' }
      }

      await prisma.ai_token_topup_orders.create({
        data: {
          org_id: access.orgId,
          package_id: item.topupPackageId,
          invoice_id: data.id,
          status: 'PENDING',
          tokens: BigInt(Math.max(1, Number(item.tokens))),
          price_idr: item.price,
        },
      })
    }

    revalidatePath('/billing')
    revalidatePath('/', 'layout')
    return { success: true, id: data.id, invoiceNumber: data.invoice_number, amount: Number(data.amount) }
  } catch (error: any) {
    console.error('Gagal membuat invoice SaaS:', error)
    return { error: 'Gagal membuat tagihan: ' + (error?.message || 'Unknown error') }
  }
}

export async function submitPaymentProof(orgId: string, invoiceId: string, proofUrl: string, method: string) {
  const access = await requireBillingMembership(orgId)
  if ('error' in access) return { error: access.error }

  // 1. Fetch invoice info for activation
  const [inv, topupOrder] = await Promise.all([
    prisma.saas_invoices.findFirst({
      where: {
        id: invoiceId,
        org_id: access.orgId,
      },
      include: {
        saas_packages: {
          select: {
            name: true,
          },
        },
        organizations: {
          select: {
            settings: true,
          },
        },
      },
    }),
    prisma.ai_token_topup_orders.findUnique({
      where: {
        invoice_id: invoiceId,
      },
    }),
  ])

  if (!inv) {
    return { error: 'Invoice tidak ditemukan.' }
  }

  // 2. Update Invoice to PAID
  await prisma.saas_invoices.update({
    where: { id: invoiceId },
    data: {
      status: 'PAID',
      payment_method: method,
      payment_proof_url: proofUrl,
      updated_at: new Date(),
    },
  })

  // 2.1 Apply token topup if invoice linked to ai_token_topup_orders
  if (topupOrder) {
    if (topupOrder.status === 'PAID') {
      revalidatePath('/billing')
      revalidatePath('/', 'layout')
      return { success: true }
    }

    const tokenAmount = BigInt(topupOrder.tokens || 0)
    const wallet = await prisma.ai_token_wallets.findUnique({
      where: {
        org_id: access.orgId,
      },
    })

    if (wallet) {
      await prisma.ai_token_wallets.update({
        where: {
          org_id: access.orgId,
        },
        data: {
          balance_tokens: wallet.balance_tokens + tokenAmount,
          total_purchased_tokens: wallet.total_purchased_tokens + tokenAmount,
          updated_at: new Date(),
        },
      })
    } else {
      await prisma.ai_token_wallets.create({
        data: {
          org_id: access.orgId,
          balance_tokens: tokenAmount,
          total_purchased_tokens: tokenAmount,
          total_used_tokens: BigInt(0),
        },
      })
    }

    await prisma.ai_token_usage_logs.create({
      data: {
        org_id: access.orgId,
        source: 'topup',
        direction: 'CREDIT',
        tokens: tokenAmount,
        related_invoice_id: invoiceId,
        note: `Topup token AI dari invoice ${invoiceId}`,
        meta: { topup_order_id: topupOrder.id, package_id: topupOrder.package_id } as any,
      },
    })

    await prisma.ai_token_topup_orders.update({
      where: {
        id: topupOrder.id,
      },
      data: {
        status: 'PAID',
        paid_at: new Date(),
        updated_at: new Date(),
      },
    })

    revalidatePath('/billing')
    revalidatePath('/', 'layout')
    return { success: true }
  }

  // 3. Update Org Settings (Instant Upgrade for Demo)
  if (inv.saas_packages?.name) {
    await prisma.organizations.update({
      where: {
        id: access.orgId,
      },
      data: {
        settings: mergePlanSetting(inv.organizations?.settings, inv.saas_packages.name) as any,
      },
    })
  }

  revalidatePath('/billing')
  revalidatePath('/', 'layout') 
  return { success: true }
}

export async function applyVoucher(orgId: string, voucherCode: string) {
  const access = await requireBillingMembership(orgId)
  if ('error' in access) return { error: access.error }

  // 1. Validasi Voucher
  const voucher = await prisma.saas_vouchers.findFirst({
    where: {
      code: voucherCode,
      is_active: true,
    },
    include: {
      saas_packages: true,
    },
  })

  if (!voucher) {
    return { error: 'Voucher tidak ditemukan atau sudah tidak aktif.' }
  }

  // 2. Cek kuota dan masa berlaku
  if (Number(voucher.uses_count || 0) >= Number(voucher.max_uses || 0)) {
    return { error: 'Kuota voucher sudah habis.' }
  }

  if (voucher.expires_at && new Date(voucher.expires_at) < new Date()) {
    return { error: 'Voucher sudah kedaluwarsa.' }
  }

  // 3. Ambil paket ABS (Default if not specified in voucher)
  let targetPackage = voucher.saas_packages
  if (!targetPackage) {
    targetPackage = await prisma.saas_packages.findFirst({
      where: {
        name: 'ABS Special',
      },
    })
  }

  if (!targetPackage) {
    return { error: 'Paket ABS Special belum tersedia di sistem.' }
  }

  // 4. Buat Invoice PAID Langsung (100% discount)
  const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase()
  const invoiceNumber = `ABS-${randomStr}`

  try {
    const organization = await prisma.organizations.findUnique({
      where: {
        id: access.orgId,
      },
      select: {
        settings: true,
      },
    })

    await prisma.$transaction([
      prisma.saas_invoices.create({
        data: {
          org_id: access.orgId,
          package_id: targetPackage.id,
          item_name: `Voucher: ${targetPackage.name}`,
          invoice_number: invoiceNumber,
          amount: 0,
          status: 'PAID',
          payment_method: 'VOUCHER',
          due_date: new Date(),
        },
      }),
      prisma.organizations.update({
        where: {
          id: access.orgId,
        },
        data: {
          settings: mergePlanSetting(organization?.settings, targetPackage.name) as any,
        },
      }),
      prisma.saas_vouchers.update({
        where: {
          id: voucher.id,
        },
        data: {
          uses_count: Number(voucher.uses_count || 0) + 1,
        },
      }),
    ])
  } catch (error: any) {
    return { error: 'Gagal aktivasi: ' + (error?.message || 'Unknown error') }
  }

  revalidatePath('/billing')
  revalidatePath('/', 'layout')
  return { success: true, message: `Berhasil! Paket ${targetPackage.name} telah aktif.` }
}
