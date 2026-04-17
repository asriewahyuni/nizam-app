'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getAccountBalances } from './coa.actions'
import { createJournalEntry } from './journal.actions'
import { SHARIAH_COA_ENABLEMENT_CODES } from '@/modules/accounting/lib/shariah-coa'

// Helper: Penentuan Hari Berdasarkan Fiqh (Pergantian hari di waktu Maghrib ~ 18:00 WIB)
function getIslamicToday(timeZone: string = 'Asia/Jakarta'): string {
  const now = new Date();
  
  const options: Intl.DateTimeFormatOptions = {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', 
    hour: '2-digit', hourCycle: 'h23' 
  };
  const parts = new Intl.DateTimeFormat('en-US', options).formatToParts(now);

  const getPart = (type: string) => parts.find((p: any) => p.type === type)?.value;
  const year = parseInt(getPart('year') || '1970', 10);
  const month = parseInt(getPart('month') || '1', 10) - 1; 
  const day = parseInt(getPart('day') || '1', 10);
  
  let hourStr = getPart('hour') || '00';
  if (hourStr === '24') hourStr = '00'; // Safari fallback
  const hour = parseInt(hourStr, 10);

  // Gunakan Date.UTC murni untuk manipulasi penambahan hari
  let d = new Date(Date.UTC(year, month, day));
  // Prinsip: Jika >= 18:00 (Maghrib), masuk ke hari Hijriah berikutnya
  if (hour >= 18) {
    d.setUTCDate(d.getUTCDate() + 1);
  }

  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const d2 = String(d.getUTCDate()).padStart(2, '0');
  
  return `${y}-${m}-${d2}`;
}

// ============================================================
// CONSTANTS - Shariah Fiqh
// ============================================================
const NISHAB_DINAR_COUNT = 20        // 20 Dinar
const GRAMS_PER_DINAR = 4.25         // 1 Dinar = 4.25 gram emas
const NISHAB_GOLD_GRAMS = NISHAB_DINAR_COUNT * GRAMS_PER_DINAR  // = 85 gram

const NISHAB_DIRHAM_COUNT = 200      // 200 Dirham
const GRAMS_PER_DIRHAM = 2.975       // 1 Dirham = 2.975 gram perak
const NISHAB_SILVER_GRAMS = NISHAB_DIRHAM_COUNT * GRAMS_PER_DIRHAM  // = 595 gram

const ZAKAT_RATE = 0.025             // 2.5%
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

function getAccountCodeStem(value: unknown): string {
  const normalized = String(value || '').trim().toUpperCase()
  const match = normalized.match(/^(\d{4})/)
  return match?.[1] || normalized
}

function isCashAccountForZakat(code: unknown): boolean {
  const stem = getAccountCodeStem(code)
  if (!stem) return false
  const numericStem = Number(stem)
  return Number.isFinite(numericStem) && numericStem >= 1100 && numericStem < 1200
}

function isReceivableAccountForZakat(code: unknown): boolean {
  const stem = getAccountCodeStem(code)
  if (!stem || stem === '1203') return false
  if (stem === '1404') return true
  const numericStem = Number(stem)
  return Number.isFinite(numericStem) && numericStem >= 1200 && numericStem < 1300
}

function isInventoryAccountForZakat(code: unknown): boolean {
  const stem = getAccountCodeStem(code)
  if (!stem) return false
  const numericStem = Number(stem)
  return Number.isFinite(numericStem) && numericStem >= 1300 && numericStem < 1400
}

function isCurrentLiabilityForZakat(code: unknown): boolean {
  const stem = getAccountCodeStem(code)
  if (!stem) return false
  if (stem === '2602' || stem === '2603') return true
  const numericStem = Number(stem)
  return Number.isFinite(numericStem) && numericStem >= 2100 && numericStem < 2200
}

async function resolveTradeZakatApplicability(supabase: any, orgId: string): Promise<TradeZakatApplicability> {
  const { data: orgData } = await (supabase as any)
    .from('organizations')
    .select('settings')
    .eq('id', orgId)
    .maybeSingle()

  const settings = (orgData as any)?.settings as Record<string, unknown> | undefined
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

  const { count: activeProductCount, error: activeProductError } = await (supabase as any)
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('is_active', true)

  if (!activeProductError && (activeProductCount ?? 0) > 0) {
    const { count: nonServiceProductCount, error: nonServiceProductError } = await (supabase as any)
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('is_active', true)
      .neq('type', 'SERVICE')

    if (!nonServiceProductError && (nonServiceProductCount ?? 0) === 0) {
      return {
        isTradeZakatApplicable: false,
        reason: 'Zakat tijarah tidak berlaku karena katalog aktif seluruhnya bertipe layanan/jasa.',
        source: 'PRODUCTS',
      }
    }
  }

  const { count: serviceOrderCount, error: serviceOrderError } = await (supabase as any)
    .from('service_orders')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)

  if (!serviceOrderError && (serviceOrderCount ?? 0) > 0 && (activeProductCount ?? 0) === 0) {
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

// ============================================================
// Get Zakat-able assets — correct Fiqh Zakat Tijarah formula:
//
//   Harta Zakat = Kas & Bank + Piutang Dagang (AR) + Persediaan + Laba Bersih
//
//   TIDAK termasuk: Aset Tetap (kendaraan, gedung, perabot, peralatan)
//   Dasar: Hanya harta yang "diputar/diperdagangkan" yang kena zakat
// ============================================================
async function getTotalZakatAssets(orgId: string) {
  const balances = await getAccountBalances(orgId)

  // 1. Kas & Bank
  const cashAccounts = balances
    .filter((b: any) => isCashAccountForZakat(b.code))
    .map((b: any) => ({ id: b.account_id, name: b.name, code: b.code, balance: Number(b.balance || 0), type: 'CASH' as const }))
  const totalCash = cashAccounts.reduce((s: any, a: any) => s + a.balance, 0)

  // 2. Piutang Dagang / AR — yang diharapkan kembali
  const arAccounts = balances
    .filter((b: any) => isReceivableAccountForZakat(b.code))
    .map((b: any) => ({ id: b.account_id, name: b.name, code: b.code, balance: Number(b.balance || 0), type: 'AR' as const }))
  const totalAR = arAccounts.reduce((s: any, a: any) => s + a.balance, 0)

  // 3. Persediaan / Inventory
  const inventoryAccounts = balances
    .filter((b: any) => isInventoryAccountForZakat(b.code))
    .map((b: any) => ({ id: b.account_id, name: b.name, code: b.code, balance: Number(b.balance || 0), type: 'INVENTORY' as const }))
  const totalInventory = inventoryAccounts.reduce((s: any, a: any) => s + a.balance, 0)

  // 4. Laba Bersih (Hanya sebagai info, JANGAN DITAMBAH ke Harta Zakat!)
  // Karena wujud laba sudah nyata berada di Kas, Piutang, atau Persediaan. Menambahkan laba = double counting.
  const totalRevenue = balances
    .filter((b: any) => b.code >= '4000' && b.code <= '4999')
    .reduce((s: any, b: any) => s + (b.balance || 0), 0)
  const totalExpenses = balances
    .filter((b: any) => b.code >= '5000' && b.code <= '7999')
    .reduce((s: any, b: any) => s + (b.balance || 0), 0)
  const netProfit = Math.max(0, totalRevenue - totalExpenses)

  // 5. Hutang Lancar / AP (+ liabilitas SALAM/ISTISHNA) - Mengurangi kewajiban zakat
  const apAccounts = balances
    .filter((b: any) => isCurrentLiabilityForZakat(b.code))
    .map((b: any) => ({ id: b.account_id, name: b.name, code: b.code, balance: Math.abs(Number(b.balance || 0)), type: 'AP' as const }))
  const totalAP = apAccounts.reduce((s: any, a: any) => s + a.balance, 0)

  // 6. Total Harta Zakat = (Kas + Piutang + Persediaan) - Hutang Lancar
  // Aset Tetap (1401+) TIDAK dihitung. Laba bersih TIDAK ditambahkan ulang.
  const totalAssets = Math.max(0, totalCash + totalAR + totalInventory - totalAP)

  const zakatAssets = [
    ...cashAccounts,
    ...arAccounts,
    ...inventoryAccounts,
    ...apAccounts.map((a: any) => ({ ...a, balance: -a.balance })) // minus sign for display
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
    }
  }
}

// ============================================================
// MAIN: Get full Zakat Summary with Haul awareness
// ============================================================
export async function getZakatSummary(orgId: string, currentPrices: { goldPerGram: number, silverPerGram: number }) {
  const supabase = await createClient()
  const tradeZakatApplicability = await resolveTradeZakatApplicability(supabase, orgId)

  // 1. Get current assets
  const { zakatAssets, totalAssets, breakdown } = await getTotalZakatAssets(orgId)

  // 2. Check for active haul
  let { data: activeHaul } = await (supabase as any)
    .from('zakat_haul')
    .select('*')
    .eq('org_id', orgId)
    .eq('status', 'ACTIVE')
    .maybeSingle()

  // 3. Determine which prices to use for nishab
  const hauledPrices = activeHaul
    ? { goldPerGram: Number(activeHaul.gold_price_per_gram), silverPerGram: Number(activeHaul.silver_price_per_gram) }
    : currentPrices

  const nishabGold   = NISHAB_GOLD_GRAMS   * hauledPrices.goldPerGram
  const nishabSilver = NISHAB_SILVER_GRAMS * hauledPrices.silverPerGram

  const isReachedGold   = tradeZakatApplicability.isTradeZakatApplicable && totalAssets >= nishabGold
  const isReachedSilver = tradeZakatApplicability.isTradeZakatApplicable && totalAssets >= nishabSilver

  const isZakatObligated = tradeZakatApplicability.isTradeZakatApplicable && (isReachedSilver || isReachedGold)
  const zakatAmount = isZakatObligated ? totalAssets * ZAKAT_RATE : 0

  // 4. Haul status
  let haulStatus = 'NO_HAUL'
  let haulStartDate: string | null = null
  let haulDaysElapsed = 0
  let haulDaysRemaining = 354 // Lunar year
  let haulBatalReason: string | null = null

  if (activeHaul) {
    if (!isZakatObligated) {
      if (!tradeZakatApplicability.isTradeZakatApplicable) {
        haulBatalReason = `${tradeZakatApplicability.reason} (otomatis dibatalkan pada ${new Date().toLocaleString('id-ID')})`
      } else {
        const formatRupiah = (v: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v)
        haulBatalReason = `Otomatis: Harta (${formatRupiah(totalAssets)}) turun di bawah nishab perak pada ${new Date().toLocaleString('id-ID')}`
      }
      
      await (supabase as any).from('zakat_haul')
        .update({ status: 'BATAL', batal_reason: haulBatalReason })
        .eq('id', activeHaul.id)

      haulStatus = 'BATAL'
      activeHaul = null
    } else {
      haulStartDate = activeHaul.haul_start_date
      const start = new Date(activeHaul.haul_start_date + 'T00:00:00Z')
      const todayIslamic = new Date(getIslamicToday() + 'T00:00:00Z')
      haulDaysElapsed = Math.floor((todayIslamic.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
      haulDaysRemaining = Math.max(0, 354 - haulDaysElapsed)
      haulStatus = haulDaysElapsed >= 354 ? 'COMPLETED' : 'ACTIVE'
    }
  } 
  
  if (!activeHaul) {
    const { data: batalHaul } = await (supabase as any)
      .from('zakat_haul')
      .select('*')
      .eq('org_id', orgId)
      .eq('status', 'BATAL')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (batalHaul) {
      haulStatus = 'BATAL'
      haulBatalReason = batalHaul.batal_reason
    }
  }

  // 5. Get haul history events
  const { data: haulHistory } = await (supabase as any)
    .from('zakat_haul')
    .select('id, haul_start_date, status, nishab_gold, nishab_silver, gold_price_per_gram, silver_price_per_gram, batal_reason, created_at')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(5)

  // 6. Record to org-level timeline
  const { data: lastTimelineEvent } = await (supabase as any)
    .from('zakat_asset_timeline')
    .select('total_assets')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!lastTimelineEvent || Number(lastTimelineEvent.total_assets) !== totalAssets) {
    await (supabase as any).from('zakat_asset_timeline').insert({
      org_id: orgId,
      total_assets: totalAssets,
      nishab_silver: nishabSilver,
      is_above_nishab: isZakatObligated,
      haul_id: activeHaul?.id ?? null
    })
  }

  // 7. Fetch timeline points
  let dailyAssetsChart: { name: string; value: number; aboveNishab: boolean }[] = []
  const { data: timelineEvents } = await (supabase as any)
    .from('zakat_asset_timeline')
    .select('created_at, total_assets, is_above_nishab')
    .eq('org_id', orgId)
    .order('created_at', { ascending: true })
    .limit(200)

  if (timelineEvents && timelineEvents.length > 0) {
    dailyAssetsChart = timelineEvents.map((e: any) => {
      const d = new Date(e.created_at)
      const day = d.getDate().toString().padStart(2, '0')
      const month = (d.getMonth() + 1).toString().padStart(2, '0')
      const hours = d.getHours().toString().padStart(2, '0')
      const mins = d.getMinutes().toString().padStart(2, '0')
      return {
        name: `${day}/${month} ${hours}:${mins}`,
        value: Number(e.total_assets),
        aboveNishab: e.is_above_nishab ?? true
      }
    })

    if (dailyAssetsChart.length === 1) {
      dailyAssetsChart.unshift({ ...dailyAssetsChart[0], name: 'Start' })
    }
  }

  // 8. Check if Shariah Accounts are active
  const { count: shariahCount } = await (supabase as any)
    .from('accounts')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .in('code', SHARIAH_COA_ENABLEMENT_CODES)
    .eq('is_active', true)

  return {
    scopeLevel: 'ORG',
    scopeLabel: 'Level Organisasi',
    isShariahEnabled: (shariahCount || 0) > 0,
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
    haulHistory: haulHistory || [],
    dailyAssetsChart,
    activeHaul,
    breakdown,
    fiqh: {
      dinarCount: NISHAB_DINAR_COUNT,
      gramsPerDinar: GRAMS_PER_DINAR,
      dirhamCount: NISHAB_DIRHAM_COUNT,
      gramsPerDirham: GRAMS_PER_DIRHAM,
    }
  }
}

export async function startZakatHaul(
  orgId: string, 
  goldPrice: number, 
  silverPrice: number,
  goldPriceSource: string = 'Manual Input',
  goldPriceEvidenceUrl?: string
) {
  const supabase = await createClient()
  const tradeZakatApplicability = await resolveTradeZakatApplicability(supabase, orgId)
  if (!tradeZakatApplicability.isTradeZakatApplicable) {
    return {
      error: tradeZakatApplicability.reason || 'Zakat tijarah tidak berlaku untuk tipe usaha ini.',
    }
  }

  const { data: { user } } = await supabase.auth.getUser()

  const nishabGold   = NISHAB_GOLD_GRAMS   * goldPrice
  const nishabSilver = NISHAB_SILVER_GRAMS * silverPrice

  const { totalAssets } = await getTotalZakatAssets(orgId)

  if (totalAssets < nishabSilver && totalAssets < nishabGold) {
    return { error: `Aset saat ini (${totalAssets.toLocaleString('id-ID')}) masih di bawah nishab. Haul baru belum dapat dimulai.` }
  }

  await (supabase as any).from('zakat_haul').update({ status: 'ARCHIVED' }).eq('org_id', orgId).eq('status', 'BATAL')

  const { error } = await (supabase as any).from('zakat_haul').insert({
    org_id: orgId,
    haul_start_date: getIslamicToday(),
    gold_price_per_gram: goldPrice,
    silver_price_per_gram: silverPrice,
    nishab_gold: nishabGold,
    nishab_silver: nishabSilver,
    status: 'ACTIVE',
    gold_price_source: goldPriceSource,
    gold_price_evidence_url: goldPriceEvidenceUrl || null,
    gold_price_set_by: user?.id || null,
    gold_price_set_at: new Date().toISOString(),
  })

  if (error) return { error: 'Gagal memulai haul: ' + error.message }

  revalidatePath('/accounting/zakat')
  return { success: true }
}

export async function checkAndCancelHaul(orgId: string) {
  const supabase = await createClient()
  const tradeZakatApplicability = await resolveTradeZakatApplicability(supabase, orgId)

  const { data: activeHaul } = await (supabase as any)
    .from('zakat_haul')
    .select('*')
    .eq('org_id', orgId)
    .eq('status', 'ACTIVE')
    .maybeSingle()

  if (!tradeZakatApplicability.isTradeZakatApplicable) {
    if (activeHaul) {
      const today = getIslamicToday()
      await (supabase as any).from('zakat_haul').update({
        status: 'BATAL',
        batal_reason: `${tradeZakatApplicability.reason} (otomatis dibatalkan pada ${today})`
      }).eq('id', activeHaul.id)
      revalidatePath('/accounting/zakat')
      return { batal: true, notApplicable: true, reason: tradeZakatApplicability.reason }
    }

    return { alreadyInactive: true, notApplicable: true, reason: tradeZakatApplicability.reason }
  }

  if (!activeHaul) return { alreadyInactive: true }

  const { totalAssets } = await getTotalZakatAssets(orgId)
  const nishabGold   = Number(activeHaul.nishab_gold)
  const nishabSilver = Number(activeHaul.nishab_silver)

  if (totalAssets < nishabSilver && totalAssets < nishabGold) {
    const today = getIslamicToday()
    await (supabase as any).from('zakat_haul').update({
      status: 'BATAL',
      batal_reason: `Aset turun di bawah nishab pada ${today}. Aset: Rp ${totalAssets.toLocaleString('id-ID')}. Haul baru dimulai saat aset kembali di atas nishab.`
    }).eq('id', activeHaul.id)

    revalidatePath('/accounting/zakat')
    return { batal: true, totalAssets, nishabSilver, nishabGold }
  }

  return { active: true, totalAssets }
}

export async function evaluateZakatDaily(orgId: string, currentPrices: { gold: number, silver: number }) {
  const supabase = await createClient()
  const tradeZakatApplicability = await resolveTradeZakatApplicability(supabase, orgId)

  const { totalAssets } = await getTotalZakatAssets(orgId)

  const { data: activeHaul } = await (supabase as any)
    .from('zakat_haul')
    .select('*')
    .eq('org_id', orgId)
    .eq('status', 'ACTIVE')
    .maybeSingle()

  if (!tradeZakatApplicability.isTradeZakatApplicable) {
    if (activeHaul?.id) {
      await (supabase as any).from('zakat_haul').update({
        status: 'BATAL',
        batal_reason: `${tradeZakatApplicability.reason} (otomatis dibatalkan pada ${getIslamicToday()})`
      }).eq('id', activeHaul.id)
    }
    return { skipped: true, reason: tradeZakatApplicability.reason }
  }

  const today = getIslamicToday()
  let activeId = activeHaul?.id
  const nishabGold = activeHaul ? Number(activeHaul.nishab_gold) : NISHAB_GOLD_GRAMS * currentPrices.gold
  const nishabSilver = activeHaul ? Number(activeHaul.nishab_silver) : NISHAB_SILVER_GRAMS * currentPrices.silver
  const isUnderNishab = totalAssets < nishabSilver && totalAssets < nishabGold
  
  if (activeHaul) {
    if (isUnderNishab) {
      await (supabase as any).from('zakat_haul').update({
        status: 'BATAL',
        batal_reason: `Aset turun di bawah nishab pada ${today}. Aset: Rp ${totalAssets.toLocaleString('id-ID')}`
      }).eq('id', activeHaul.id)
      activeId = undefined
    }
  } else {
    if (!isUnderNishab) {
      const { data: newHaul } = await (supabase as any).from('zakat_haul').insert({
        org_id: orgId,
        haul_start_date: today,
        gold_price_per_gram: currentPrices.gold,
        silver_price_per_gram: currentPrices.silver,
        nishab_gold: nishabGold,
        nishab_silver: nishabSilver,
        status: 'ACTIVE'
      }).select('id').single()
      if (newHaul) activeId = newHaul.id
    }
  }

  if (activeId) {
    const { count } = await (supabase as any).from('zakat_haul_events')
      .select('*', { count: 'exact', head: true })
      .eq('haul_id', activeId)
      .eq('event_date', today)
    
    if (!count || count === 0) {
      await (supabase as any).from('zakat_haul_events').insert({
        haul_id: activeId,
        org_id: orgId,
        event_date: today,
        total_assets: totalAssets,
        is_above_nishab: !isUnderNishab
      })
    }
  }
}

export async function payZakat(orgId: string, accountId: string, amount: number) {
  const supabase = await createClient()
  const tradeZakatApplicability = await resolveTradeZakatApplicability(supabase, orgId)
  if (!tradeZakatApplicability.isTradeZakatApplicable) {
    return { error: tradeZakatApplicability.reason || 'Zakat tijarah tidak berlaku untuk tipe usaha ini.' }
  }

  if (!String(accountId || '').trim()) {
    return { error: 'Pilih rekening Kas & Bank terlebih dahulu.' }
  }

  let { data: zakatAcc } = await (supabase as any)
    .from('accounts')
    .select('id')
    .eq('org_id', orgId)
    .eq('code', '6220')
    .maybeSingle()

  if (!zakatAcc) {
     const { data: alt } = await (supabase as any)
       .from('accounts')
       .select('id')
       .eq('org_id', orgId)
       .ilike('name', '%Zakat Tijarah%')
       .limit(1)
       .maybeSingle()
     zakatAcc = alt
  }

  if (!zakatAcc) {
     const { data: alt } = await (supabase as any)
       .from('accounts')
       .select('id')
       .eq('org_id', orgId)
       .ilike('name', '%Zakat%')
       .limit(1)
       .maybeSingle()
     zakatAcc = alt
  }
  
  if (!zakatAcc) {
    return { error: 'Akun Beban Zakat tidak ditemukan. Harap aktifkan Syariah Add-on terlebih dahulu.' }
  }

  const res = await createJournalEntry({
    org_id: orgId,
    entry_date: getIslamicToday(),
    description: 'Pembayaran Zakat Tijarah Haul',
    reference_type: 'MANUAL',
    allow_org_scope: true,
    auto_post: true,
    lines: [
      { account_id: zakatAcc.id, debit: amount, credit: 0, memo: 'Pembayaran Zakat' },
      { account_id: accountId, debit: 0, credit: amount, memo: 'Pengeluaran Kas/Bank untuk Zakat' },
    ]
  })

  if ('error' in res) return res

  await (supabase as any).from('zakat_haul').update({ status: 'COMPLETED' }).eq('org_id', orgId).eq('status', 'ACTIVE')

  revalidatePath('/accounting/zakat')
  revalidatePath('/accounting/journal')
  return { success: true }
}

export async function syncActiveHaulPrices(orgId: string, goldPrice: number, silverPrice: number) {
  const supabase = await createClient()

  const nishabGold = 85 * goldPrice
  const nishabSilver = 595 * silverPrice

  const { data, error } = await (supabase as any).from('zakat_haul')
    .update({
      gold_price_per_gram: goldPrice,
      silver_price_per_gram: silverPrice,
      nishab_gold: nishabGold,
      nishab_silver: nishabSilver
    })
    .eq('org_id', orgId)
    .in('status', ['ACTIVE', 'BATAL'])
    .select('id')

    if (error) throw new Error(`Failed to sync prices: ${error.message}`)
    
  revalidatePath('/accounting/zakat')
  return { success: true }
}
