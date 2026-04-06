'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getCurrentUserId, ensureAccountingAccess, toNumber } from '@/modules/accounting/lib/reporting.server'
import { getAccountBalances } from './coa.actions'
import { createJournalEntry } from './journal.actions'

function getIslamicToday(timeZone: string = 'Asia/Jakarta'): string {
  const now = new Date()
  const options: Intl.DateTimeFormatOptions = {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }

  const parts = new Intl.DateTimeFormat('en-US', options).formatToParts(now)
  const getPart = (type: string) => parts.find((part) => part.type === type)?.value
  const year = parseInt(getPart('year') || '1970', 10)
  const month = parseInt(getPart('month') || '1', 10) - 1
  const day = parseInt(getPart('day') || '1', 10)
  let hourStr = getPart('hour') || '00'

  if (hourStr === '24') hourStr = '00'

  const hour = parseInt(hourStr, 10)
  const date = new Date(Date.UTC(year, month, day))
  if (hour >= 18) {
    date.setUTCDate(date.getUTCDate() + 1)
  }

  const currentYear = date.getUTCFullYear()
  const currentMonth = String(date.getUTCMonth() + 1).padStart(2, '0')
  const currentDay = String(date.getUTCDate()).padStart(2, '0')
  return `${currentYear}-${currentMonth}-${currentDay}`
}

const NISHAB_DINAR_COUNT = 20
const GRAMS_PER_DINAR = 4.25
const NISHAB_GOLD_GRAMS = NISHAB_DINAR_COUNT * GRAMS_PER_DINAR

const NISHAB_DIRHAM_COUNT = 200
const GRAMS_PER_DIRHAM = 2.975
const NISHAB_SILVER_GRAMS = NISHAB_DIRHAM_COUNT * GRAMS_PER_DIRHAM

const ZAKAT_RATE = 0.025
const SERVICE_BUSINESS_KEYWORDS = ['SERVICE', 'SERVICES', 'JASA', 'LAYANAN', 'LABOR', 'LABOUR', 'IJARAH']

type TradeZakatApplicability = {
  isTradeZakatApplicable: boolean
  reason: string | null
  source: 'SETTINGS' | 'PRODUCTS' | 'SERVICE_ORDERS' | 'UNKNOWN'
}

function normalizeBusinessHint(value: unknown): string {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
}

function isServiceBusinessHint(value: unknown): boolean {
  const normalized = normalizeBusinessHint(value)
  if (!normalized) return false
  return SERVICE_BUSINESS_KEYWORDS.some((keyword) => normalized.includes(keyword))
}

function formatDateOnly(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 10) : null
}

function formatRupiah(value: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(value)
}

async function getActiveHaul(orgId: string) {
  return prisma.zakat_haul.findFirst({
    where: {
      org_id: orgId,
      status: 'ACTIVE',
    },
    orderBy: {
      created_at: 'desc',
    },
  })
}

async function resolveTradeZakatApplicability(orgId: string): Promise<TradeZakatApplicability> {
  const organization = await prisma.organizations.findUnique({
    where: { id: orgId },
    select: { settings: true },
  })

  const settings = (organization?.settings as Record<string, unknown> | null) ?? null
  const businessHints = [
    settings?.business_type,
    settings?.businessType,
    settings?.business_model,
    settings?.businessModel,
    settings?.industry,
    settings?.sector,
    settings?.company_type,
    settings?.companyType,
  ]

  if (businessHints.some(isServiceBusinessHint)) {
    return {
      isTradeZakatApplicable: false,
      reason: 'Zakat tijarah tidak berlaku untuk usaha layanan/jasa (labour).',
      source: 'SETTINGS',
    }
  }

  const activeProductCount = await prisma.products.count({
    where: {
      org_id: orgId,
      is_active: true,
    },
  })

  if (activeProductCount > 0) {
    const nonServiceProductCount = await prisma.products.count({
      where: {
        org_id: orgId,
        is_active: true,
        type: { not: 'SERVICE' },
      },
    })

    if (nonServiceProductCount === 0) {
      return {
        isTradeZakatApplicable: false,
        reason: 'Zakat tijarah tidak berlaku karena katalog aktif seluruhnya bertipe layanan/jasa.',
        source: 'PRODUCTS',
      }
    }
  }

  const serviceOrderCount = await prisma.service_orders.count({
    where: {
      org_id: orgId,
    },
  })

  if (serviceOrderCount > 0 && activeProductCount === 0) {
    return {
      isTradeZakatApplicable: false,
      reason: 'Zakat tijarah tidak berlaku karena aktivitas organisasi terdeteksi sebagai layanan/jasa.',
      source: 'SERVICE_ORDERS',
    }
  }

  return {
    isTradeZakatApplicable: true,
    reason: null,
    source: 'UNKNOWN',
  }
}

async function getTotalZakatAssets(orgId: string) {
  const balances = await getAccountBalances(orgId)

  const cashAccounts = balances
    .filter((balance) => balance.code >= '1101' && balance.code <= '1199')
    .map((balance) => ({ name: balance.name, code: balance.code, balance: balance.balance || 0, type: 'CASH' as const }))
  const totalCash = cashAccounts.reduce((sum, account) => sum + account.balance, 0)

  const arAccounts = balances
    .filter((balance) => balance.code >= '1201' && balance.code <= '1299')
    .map((balance) => ({ name: balance.name, code: balance.code, balance: balance.balance || 0, type: 'AR' as const }))
  const totalAR = arAccounts.reduce((sum, account) => sum + account.balance, 0)

  const inventoryAccounts = balances
    .filter((balance) => balance.code >= '1301' && balance.code <= '1399')
    .map((balance) => ({ name: balance.name, code: balance.code, balance: balance.balance || 0, type: 'INVENTORY' as const }))
  const totalInventory = inventoryAccounts.reduce((sum, account) => sum + account.balance, 0)

  const totalRevenue = balances
    .filter((balance) => balance.code >= '4000' && balance.code <= '4999')
    .reduce((sum, balance) => sum + (balance.balance || 0), 0)
  const totalExpenses = balances
    .filter((balance) => balance.code >= '5000' && balance.code <= '7999')
    .reduce((sum, balance) => sum + (balance.balance || 0), 0)
  const netProfit = Math.max(0, totalRevenue - totalExpenses)

  const apAccounts = balances
    .filter((balance) => balance.code >= '2101' && balance.code <= '2199')
    .map((balance) => ({ name: balance.name, code: balance.code, balance: Math.abs(balance.balance || 0), type: 'AP' as const }))
  const totalAP = apAccounts.reduce((sum, account) => sum + account.balance, 0)

  const totalAssets = Math.max(0, totalCash + totalAR + totalInventory - totalAP)
  const zakatAssets = [
    ...cashAccounts,
    ...arAccounts,
    ...inventoryAccounts,
    ...apAccounts.map((account) => ({ ...account, balance: -account.balance })),
  ]

  return {
    zakatAssets,
    totalAssets,
    breakdown: {
      totalCash,
      totalAR,
      totalInventory,
      totalAP,
      totalRevenue,
      totalExpenses,
      netProfit,
    },
  }
}

export async function getZakatSummary(orgId: string, currentPrices: { goldPerGram: number; silverPerGram: number }) {
  const membership = await ensureAccountingAccess(orgId)
  if (!membership) {
    return {
      scopeLevel: 'ORG',
      scopeLabel: 'Level Organisasi',
      isShariahEnabled: false,
      zakatAssets: [],
      totalAssets: 0,
      nishabGold: 0,
      nishabSilver: 0,
      nishabGoldGrams: NISHAB_GOLD_GRAMS,
      nishabSilverGrams: NISHAB_SILVER_GRAMS,
      isReachedGold: false,
      isReachedSilver: false,
      isZakatObligated: false,
      zakatAmount: 0,
      isTradeZakatApplicable: false,
      tradeZakatIneligibilityReason: null,
      tradeZakatIneligibilitySource: 'UNKNOWN' as const,
      hauledPrices: currentPrices,
      currentPrices,
      haulStatus: 'NO_HAUL',
      haulStartDate: null,
      haulDaysElapsed: 0,
      haulDaysRemaining: 354,
      haulBatalReason: null,
      haulHistory: [],
      dailyAssetsChart: [],
      activeHaul: null,
      breakdown: { totalCash: 0, totalAR: 0, totalInventory: 0, totalAP: 0, totalRevenue: 0, totalExpenses: 0, netProfit: 0 },
      fiqh: { dinarCount: NISHAB_DINAR_COUNT, gramsPerDinar: GRAMS_PER_DINAR, dirhamCount: NISHAB_DIRHAM_COUNT, gramsPerDirham: GRAMS_PER_DIRHAM },
    }
  }

  const tradeZakatApplicability = await resolveTradeZakatApplicability(orgId)
  const { zakatAssets, totalAssets, breakdown } = await getTotalZakatAssets(orgId)
  let activeHaul = await getActiveHaul(orgId)

  const hauledPrices = activeHaul
    ? { goldPerGram: toNumber(activeHaul.gold_price_per_gram), silverPerGram: toNumber(activeHaul.silver_price_per_gram) }
    : currentPrices

  const nishabGold = NISHAB_GOLD_GRAMS * hauledPrices.goldPerGram
  const nishabSilver = NISHAB_SILVER_GRAMS * hauledPrices.silverPerGram

  const isReachedGold = tradeZakatApplicability.isTradeZakatApplicable && totalAssets >= nishabGold
  const isReachedSilver = tradeZakatApplicability.isTradeZakatApplicable && totalAssets >= nishabSilver
  const isZakatObligated = tradeZakatApplicability.isTradeZakatApplicable && (isReachedSilver || isReachedGold)
  const zakatAmount = isZakatObligated ? totalAssets * ZAKAT_RATE : 0

  let haulStatus = 'NO_HAUL'
  let haulStartDate: string | null = null
  let haulDaysElapsed = 0
  let haulDaysRemaining = 354
  let haulBatalReason: string | null = null

  if (activeHaul) {
    if (!isZakatObligated) {
      haulBatalReason = !tradeZakatApplicability.isTradeZakatApplicable
        ? `${tradeZakatApplicability.reason} (otomatis dibatalkan pada ${new Date().toLocaleString('id-ID')})`
        : `Otomatis: Harta (${formatRupiah(totalAssets)}) turun di bawah nishab perak pada ${new Date().toLocaleString('id-ID')}`

      await prisma.zakat_haul.update({
        where: { id: activeHaul.id },
        data: {
          status: 'BATAL',
          batal_reason: haulBatalReason,
        },
      })

      haulStatus = 'BATAL'
      activeHaul = null
    } else {
      haulStartDate = formatDateOnly(activeHaul.haul_start_date)
      const start = new Date(`${haulStartDate}T00:00:00Z`)
      const todayIslamic = new Date(`${getIslamicToday()}T00:00:00Z`)
      haulDaysElapsed = Math.floor((todayIslamic.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
      haulDaysRemaining = Math.max(0, 354 - haulDaysElapsed)
      haulStatus = haulDaysElapsed >= 354 ? 'COMPLETED' : 'ACTIVE'
    }
  }

  if (!activeHaul) {
    const batalHaul = await prisma.zakat_haul.findFirst({
      where: {
        org_id: orgId,
        status: 'BATAL',
      },
      orderBy: {
        updated_at: 'desc',
      },
    })

    if (batalHaul) {
      haulStatus = 'BATAL'
      haulBatalReason = batalHaul.batal_reason
    }
  }

  const haulHistory = await prisma.zakat_haul.findMany({
    where: { org_id: orgId },
    select: {
      id: true,
      haul_start_date: true,
      status: true,
      nishab_gold: true,
      nishab_silver: true,
      gold_price_per_gram: true,
      silver_price_per_gram: true,
      batal_reason: true,
      created_at: true,
    },
    orderBy: { created_at: 'desc' },
    take: 5,
  })

  const lastTimelineEvent = await prisma.zakat_asset_timeline.findFirst({
    where: { org_id: orgId },
    select: { total_assets: true },
    orderBy: { created_at: 'desc' },
  })

  if (!lastTimelineEvent || toNumber(lastTimelineEvent.total_assets) !== totalAssets) {
    await prisma.zakat_asset_timeline.create({
      data: {
        org_id: orgId,
        total_assets: totalAssets,
        nishab_silver: nishabSilver,
        is_above_nishab: isZakatObligated,
        haul_id: activeHaul?.id || null,
      },
    })
  }

  const timelineEvents = await prisma.zakat_asset_timeline.findMany({
    where: { org_id: orgId },
    select: {
      created_at: true,
      total_assets: true,
      is_above_nishab: true,
    },
    orderBy: { created_at: 'asc' },
    take: 200,
  })

  let dailyAssetsChart = timelineEvents.map((event) => {
    const date = new Date(event.created_at)
    const day = date.getDate().toString().padStart(2, '0')
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')
    return {
      name: `${day}/${month} ${hours}:${minutes}`,
      value: toNumber(event.total_assets),
      aboveNishab: event.is_above_nishab ?? true,
    }
  })

  if (dailyAssetsChart.length === 1) {
    dailyAssetsChart = [{ ...dailyAssetsChart[0], name: 'Start' }, ...dailyAssetsChart]
  }

  const shariahCount = await prisma.accounts.count({
    where: {
      org_id: orgId,
      code: { in: ['3100', '2600', '6100', '6200'] },
      is_active: true,
    },
  })

  return {
    scopeLevel: 'ORG',
    scopeLabel: 'Level Organisasi',
    isShariahEnabled: shariahCount > 0,
    zakatAssets,
    totalAssets,
    nishabGold,
    nishabSilver,
    nishabGoldGrams: NISHAB_GOLD_GRAMS,
    nishabSilverGrams: NISHAB_SILVER_GRAMS,
    isReachedGold,
    isReachedSilver,
    isZakatObligated,
    zakatAmount,
    isTradeZakatApplicable: tradeZakatApplicability.isTradeZakatApplicable,
    tradeZakatIneligibilityReason: tradeZakatApplicability.reason,
    tradeZakatIneligibilitySource: tradeZakatApplicability.source,
    hauledPrices,
    currentPrices,
    haulStatus,
    haulStartDate,
    haulDaysElapsed,
    haulDaysRemaining,
    haulBatalReason,
    haulHistory: haulHistory.map((haul) => ({
      id: haul.id,
      haul_start_date: formatDateOnly(haul.haul_start_date),
      status: haul.status,
      nishab_gold: toNumber(haul.nishab_gold),
      nishab_silver: toNumber(haul.nishab_silver),
      gold_price_per_gram: toNumber(haul.gold_price_per_gram),
      silver_price_per_gram: toNumber(haul.silver_price_per_gram),
      batal_reason: haul.batal_reason,
      created_at: haul.created_at?.toISOString() || null,
    })),
    dailyAssetsChart,
    activeHaul: activeHaul
      ? {
          ...activeHaul,
          haul_start_date: formatDateOnly(activeHaul.haul_start_date),
          gold_price_per_gram: toNumber(activeHaul.gold_price_per_gram),
          silver_price_per_gram: toNumber(activeHaul.silver_price_per_gram),
          nishab_gold: toNumber(activeHaul.nishab_gold),
          nishab_silver: toNumber(activeHaul.nishab_silver),
          created_at: activeHaul.created_at?.toISOString() || null,
          updated_at: activeHaul.updated_at?.toISOString() || null,
          gold_price_set_at: activeHaul.gold_price_set_at?.toISOString() || null,
        }
      : null,
    breakdown,
    fiqh: {
      dinarCount: NISHAB_DINAR_COUNT,
      gramsPerDinar: GRAMS_PER_DINAR,
      dirhamCount: NISHAB_DIRHAM_COUNT,
      gramsPerDirham: GRAMS_PER_DIRHAM,
    },
  }
}

export async function startZakatHaul(
  orgId: string,
  goldPrice: number,
  silverPrice: number,
  goldPriceSource: string = 'Manual Input',
  goldPriceEvidenceUrl?: string
) {
  const membership = await ensureAccountingAccess(orgId)
  if (!membership) return { error: 'Unauthorized' }

  const tradeZakatApplicability = await resolveTradeZakatApplicability(orgId)
  if (!tradeZakatApplicability.isTradeZakatApplicable) {
    return {
      error: tradeZakatApplicability.reason || 'Zakat tijarah tidak berlaku untuk tipe usaha ini.',
    }
  }

  const userId = await getCurrentUserId()
  const nishabGold = NISHAB_GOLD_GRAMS * goldPrice
  const nishabSilver = NISHAB_SILVER_GRAMS * silverPrice
  const { totalAssets } = await getTotalZakatAssets(orgId)

  if (totalAssets < nishabSilver && totalAssets < nishabGold) {
    return { error: `Aset saat ini (${totalAssets.toLocaleString('id-ID')}) masih di bawah nishab. Haul baru belum dapat dimulai.` }
  }

  await prisma.zakat_haul.updateMany({
    where: {
      org_id: orgId,
      status: 'BATAL',
    },
    data: {
      status: 'ARCHIVED',
    },
  })

  try {
    await prisma.zakat_haul.create({
      data: {
        org_id: orgId,
        haul_start_date: new Date(`${getIslamicToday()}T00:00:00.000Z`),
        gold_price_per_gram: goldPrice,
        silver_price_per_gram: silverPrice,
        nishab_gold: nishabGold,
        nishab_silver: nishabSilver,
        status: 'ACTIVE',
        gold_price_source: goldPriceSource,
        gold_price_evidence_url: goldPriceEvidenceUrl || null,
        gold_price_set_by: userId,
        gold_price_set_at: new Date(),
      },
    })
  } catch (error) {
    return { error: error instanceof Error ? `Gagal memulai haul: ${error.message}` : 'Gagal memulai haul.' }
  }

  revalidatePath('/accounting/zakat')
  return { success: true }
}

export async function checkAndCancelHaul(orgId: string) {
  const tradeZakatApplicability = await resolveTradeZakatApplicability(orgId)
  const activeHaul = await getActiveHaul(orgId)

  if (!tradeZakatApplicability.isTradeZakatApplicable) {
    if (activeHaul) {
      const today = getIslamicToday()
      await prisma.zakat_haul.update({
        where: { id: activeHaul.id },
        data: {
          status: 'BATAL',
          batal_reason: `${tradeZakatApplicability.reason} (otomatis dibatalkan pada ${today})`,
        },
      })
      revalidatePath('/accounting/zakat')
      return { batal: true, notApplicable: true, reason: tradeZakatApplicability.reason }
    }

    return { alreadyInactive: true, notApplicable: true, reason: tradeZakatApplicability.reason }
  }

  if (!activeHaul) return { alreadyInactive: true }

  const { totalAssets } = await getTotalZakatAssets(orgId)
  const nishabGold = toNumber(activeHaul.nishab_gold)
  const nishabSilver = toNumber(activeHaul.nishab_silver)

  if (totalAssets < nishabSilver && totalAssets < nishabGold) {
    await prisma.zakat_haul.update({
      where: { id: activeHaul.id },
      data: {
        status: 'BATAL',
        batal_reason: `Aset turun di bawah nishab pada ${getIslamicToday()}. Aset: Rp ${totalAssets.toLocaleString('id-ID')}. Haul baru dimulai saat aset kembali di atas nishab.`,
      },
    })

    revalidatePath('/accounting/zakat')
    return { batal: true, totalAssets, nishabSilver, nishabGold }
  }

  return { active: true, totalAssets }
}

export async function evaluateZakatDaily(orgId: string, currentPrices: { gold: number; silver: number }) {
  const tradeZakatApplicability = await resolveTradeZakatApplicability(orgId)
  const { totalAssets } = await getTotalZakatAssets(orgId)
  const activeHaul = await getActiveHaul(orgId)

  if (!tradeZakatApplicability.isTradeZakatApplicable) {
    if (activeHaul?.id) {
      await prisma.zakat_haul.update({
        where: { id: activeHaul.id },
        data: {
          status: 'BATAL',
          batal_reason: `${tradeZakatApplicability.reason} (otomatis dibatalkan pada ${getIslamicToday()})`,
        },
      })
    }
    return { skipped: true, reason: tradeZakatApplicability.reason }
  }

  const today = getIslamicToday()
  let activeId = activeHaul?.id
  const nishabGold = activeHaul ? toNumber(activeHaul.nishab_gold) : NISHAB_GOLD_GRAMS * currentPrices.gold
  const nishabSilver = activeHaul ? toNumber(activeHaul.nishab_silver) : NISHAB_SILVER_GRAMS * currentPrices.silver
  const isUnderNishab = totalAssets < nishabSilver && totalAssets < nishabGold

  if (activeHaul) {
    if (isUnderNishab) {
      await prisma.zakat_haul.update({
        where: { id: activeHaul.id },
        data: {
          status: 'BATAL',
          batal_reason: `Aset turun di bawah nishab pada ${today}. Aset: Rp ${totalAssets.toLocaleString('id-ID')}`,
        },
      })
      activeId = undefined
    }
  } else if (!isUnderNishab) {
    const newHaul = await prisma.zakat_haul.create({
      data: {
        org_id: orgId,
        haul_start_date: new Date(`${today}T00:00:00.000Z`),
        gold_price_per_gram: currentPrices.gold,
        silver_price_per_gram: currentPrices.silver,
        nishab_gold: nishabGold,
        nishab_silver: nishabSilver,
        status: 'ACTIVE',
      },
      select: { id: true },
    })
    activeId = newHaul.id
  }

  if (activeId) {
    const count = await prisma.zakat_haul_events.count({
      where: {
        haul_id: activeId,
        event_date: new Date(`${today}T00:00:00.000Z`),
      },
    })

    if (count === 0) {
      await prisma.zakat_haul_events.create({
        data: {
          haul_id: activeId,
          org_id: orgId,
          event_date: new Date(`${today}T00:00:00.000Z`),
          total_assets: totalAssets,
          is_above_nishab: !isUnderNishab,
        },
      })
    }
  }
}

export async function payZakat(orgId: string, accountId: string, amount: number) {
  const membership = await ensureAccountingAccess(orgId)
  if (!membership) return { error: 'Unauthorized' }

  const tradeZakatApplicability = await resolveTradeZakatApplicability(orgId)
  if (!tradeZakatApplicability.isTradeZakatApplicable) {
    return { error: tradeZakatApplicability.reason || 'Zakat tijarah tidak berlaku untuk tipe usaha ini.' }
  }

  let zakatAccount = await prisma.accounts.findFirst({
    where: {
      org_id: orgId,
      OR: [
        { name: { contains: 'Beban Zakat', mode: 'insensitive' } },
        { name: { contains: 'Zakat', mode: 'insensitive' } },
      ],
      is_active: true,
    },
    select: { id: true },
  })

  if (!zakatAccount) {
    return { error: 'Akun Beban Zakat tidak ditemukan. Harap aktifkan Syariah Add-on terlebih dahulu.' }
  }

  const result = await createJournalEntry({
    org_id: orgId,
    entry_date: getIslamicToday(),
    description: 'Pembayaran Zakat Tijarah Haul',
    reference_type: 'MANUAL',
    allow_org_scope: true,
    auto_post: true,
    lines: [
      { account_id: zakatAccount.id, debit: amount, credit: 0, memo: 'Pembayaran Zakat' },
      { account_id: accountId, debit: 0, credit: amount, memo: 'Pengeluaran Kas/Bank untuk Zakat' },
    ],
  })

  if ('error' in result) return result

  await prisma.zakat_haul.updateMany({
    where: {
      org_id: orgId,
      status: 'ACTIVE',
    },
    data: {
      status: 'COMPLETED',
    },
  })

  revalidatePath('/accounting/zakat')
  revalidatePath('/accounting/journal')
  return { success: true }
}

export async function syncActiveHaulPrices(orgId: string, goldPrice: number, silverPrice: number) {
  const membership = await ensureAccountingAccess(orgId)
  if (!membership) return { error: 'Unauthorized' }

  await prisma.zakat_haul.updateMany({
    where: {
      org_id: orgId,
      status: { in: ['ACTIVE', 'BATAL'] },
    },
    data: {
      gold_price_per_gram: goldPrice,
      silver_price_per_gram: silverPrice,
      nishab_gold: NISHAB_GOLD_GRAMS * goldPrice,
      nishab_silver: NISHAB_SILVER_GRAMS * silverPrice,
    },
  })

  revalidatePath('/accounting/zakat')
  return { success: true }
}
