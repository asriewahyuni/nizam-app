'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getAccountBalances } from './coa.actions'
import { createJournalEntry } from './journal.actions'

// Helper: Penentuan Hari Berdasarkan Fiqh (Pergantian hari di waktu Maghrib ~ 18:00 WIB)
function getIslamicToday(timeZone: string = 'Asia/Jakarta'): string {
  const now = new Date();
  
  const options: Intl.DateTimeFormatOptions = {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', 
    hour: '2-digit', hourCycle: 'h23' 
  };
  const parts = new Intl.DateTimeFormat('en-US', options).formatToParts(now);

  const getPart = (type: string) => parts.find(p => p.type === type)?.value;
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

  // 1. Kas & Bank (1101–1199)
  const cashAccounts = balances
    .filter(b => b.code >= '1101' && b.code <= '1199')
    .map(b => ({ name: b.name, code: b.code, balance: b.balance || 0, type: 'CASH' as const }))
  const totalCash = cashAccounts.reduce((s, a) => s + a.balance, 0)

  // 2. Piutang Dagang / AR (1201–1299) — yang diharapkan kembali
  const arAccounts = balances
    .filter(b => b.code >= '1201' && b.code <= '1299')
    .map(b => ({ name: b.name, code: b.code, balance: b.balance || 0, type: 'AR' as const }))
  const totalAR = arAccounts.reduce((s, a) => s + a.balance, 0)

  // 3. Persediaan / Inventory (1301–1399)
  const inventoryAccounts = balances
    .filter(b => b.code >= '1301' && b.code <= '1399')
    .map(b => ({ name: b.name, code: b.code, balance: b.balance || 0, type: 'INVENTORY' as const }))
  const totalInventory = inventoryAccounts.reduce((s, a) => s + a.balance, 0)

  // 4. Laba Bersih (Hanya sebagai info, JANGAN DITAMBAH ke Harta Zakat!)
  // Karena wujud laba sudah nyata berada di Kas, Piutang, atau Persediaan. Menambahkan laba = double counting.
  const totalRevenue = balances
    .filter(b => b.code >= '4000' && b.code <= '4999')
    .reduce((s, b) => s + (b.balance || 0), 0)
  const totalExpenses = balances
    .filter(b => b.code >= '5000' && b.code <= '7999')
    .reduce((s, b) => s + (b.balance || 0), 0)
  const netProfit = Math.max(0, totalRevenue - totalExpenses)

  // 5. Hutang Lancar / AP (2101-2199) - Mengurangi kewajiban zakat
  const apAccounts = balances
    .filter(b => b.code >= '2101' && b.code <= '2199')
    .map(b => ({ name: b.name, code: b.code, balance: Math.abs(b.balance || 0), type: 'AP' as const }))
  const totalAP = apAccounts.reduce((s, a) => s + a.balance, 0)

  // 6. Total Harta Zakat = (Kas + Piutang + Persediaan) - Hutang Lancar
  // Aset Tetap (1401+) TIDAK dihitung. Laba bersih TIDAK ditambahkan ulang.
  const totalAssets = Math.max(0, totalCash + totalAR + totalInventory - totalAP)

  const zakatAssets = [
    ...cashAccounts,
    ...arAccounts,
    ...inventoryAccounts,
    ...apAccounts.map(a => ({ ...a, balance: -a.balance })) // minus sign for display
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

  // 1. Get current assets
  const { zakatAssets, totalAssets, breakdown } = await getTotalZakatAssets(orgId)

  // 2. Check for active haul
  let { data: activeHaul } = await supabase
    .from('zakat_haul' as any)
    .select('*')
    .eq('org_id', orgId)
    .eq('status', 'ACTIVE')
    .maybeSingle()

  // 3. Determine which prices to use for nishab
  // Fiqh: Nishab dievaluasi berdasarkan harga emas/perak pada AWAL HAUL
  // Jika belum ada haul aktif, gunakan harga sekarang sebagai referensi
  const hauledPrices = activeHaul
    ? { goldPerGram: Number(activeHaul.gold_price_per_gram), silverPerGram: Number(activeHaul.silver_price_per_gram) }
    : currentPrices

  const nishabGold   = NISHAB_GOLD_GRAMS   * hauledPrices.goldPerGram    // 85g × harga emas awal haul
  const nishabSilver = NISHAB_SILVER_GRAMS * hauledPrices.silverPerGram   // 595g × harga perak awal haul

  const isReachedGold   = totalAssets >= nishabGold
  const isReachedSilver = totalAssets >= nishabSilver

  // Zakat wajib minimum jika mencapai SALAH SATU nishab (Nishab perak lebih rendah = lebih konservatif)
  const isZakatObligated = isReachedSilver || isReachedGold
  const zakatAmount = isZakatObligated ? totalAssets * ZAKAT_RATE : 0

  // 4. Haul status
  let haulStatus = 'NO_HAUL'
  let haulStartDate: string | null = null
  let haulDaysElapsed = 0
  let haulDaysRemaining = 354 // Lunar year
  let haulBatalReason: string | null = null

  if (activeHaul) {
    // REAL-TIME FIQH CHECK:
    // Jika Harta Kena Zakat aktual saat ini anjlok di bawah Nishab (Perak), haul otomatis batal
    if (!isZakatObligated) {
      const formatRupiah = (v: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v)
      haulBatalReason = `Otomatis: Harta (${formatRupiah(totalAssets)}) turun di bawah nishab perak pada ${new Date().toLocaleString('id-ID')}`
      
      await supabase.from('zakat_haul' as any)
        .update({ status: 'BATAL', batal_reason: haulBatalReason })
        .eq('id', activeHaul.id)

      haulStatus = 'BATAL'
      activeHaul = null // Stop tracking as active
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
    // Check for cancelled (BATAL) haul
    const { data: batalHaul } = await supabase
      .from('zakat_haul' as any)
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
  const { data: haulHistory } = await supabase
    .from('zakat_haul' as any)
    .select('id, haul_start_date, status, nishab_gold, nishab_silver, gold_price_per_gram, silver_price_per_gram, batal_reason, created_at')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(5)

  // 6. Record to org-level timeline (SELALU direkam, termasuk saat di bawah nishab)
  // Ini memungkinkan grafik menampilkan SELURUH perjalanan harta, lintas haul.
  const { data: lastTimelineEvent } = await supabase
    .from('zakat_asset_timeline' as any)
    .select('total_assets')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Hanya rekam jika nilainya berubah dari snapshot terakhir
  if (!lastTimelineEvent || Number(lastTimelineEvent.total_assets) !== totalAssets) {
    await supabase.from('zakat_asset_timeline' as any).insert({
      org_id: orgId,
      total_assets: totalAssets,
      nishab_silver: nishabSilver,
      is_above_nishab: isZakatObligated,
      haul_id: activeHaul?.id ?? null
    })
  }

  // 7. Fetch ALL timeline points for the graph (org-level, not filtered by haul)
  let dailyAssetsChart: { name: string; value: number; aboveNishab: boolean }[] = []
  const { data: timelineEvents } = await supabase
    .from('zakat_asset_timeline' as any)
    .select('created_at, total_assets, is_above_nishab')
    .eq('org_id', orgId)
    .order('created_at', { ascending: true })
    .limit(200) // Ambil max 200 titik terakhir

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

    // Jika hanya ada 1 titik, duplikasi agar grafik terbentuk
    if (dailyAssetsChart.length === 1) {
      dailyAssetsChart.unshift({ ...dailyAssetsChart[0], name: 'Start' })
    }
  }

  // 8. Check if Shariah Accounts are enabled/active (at least one root account)
  const { count: shariahCount } = await supabase
    .from('accounts' as any)
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .in('code', ['3100', '2600', '6100', '6200'])
    .eq('is_active', true)

  return {
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
    hauledPrices,        // Prices used for nishab (from haul start)
    currentPrices,       // Current real-time prices (for display)
    haulStatus,          // 'NO_HAUL' | 'ACTIVE' | 'COMPLETED' | 'BATAL'
    haulStartDate,
    haulDaysElapsed,
    haulDaysRemaining,
    haulBatalReason,
    haulHistory: haulHistory || [],
    dailyAssetsChart,    // Daily tracking chart!
    activeHaul,
    breakdown,           // { totalInventory, totalRevenue, totalExpenses, netProfit }
    // Fiqh constants
    fiqh: {
      dinarCount: NISHAB_DINAR_COUNT,
      gramsPerDinar: GRAMS_PER_DINAR,
      dirhamCount: NISHAB_DIRHAM_COUNT,
      gramsPerDirham: GRAMS_PER_DIRHAM,
    }
  }
}

// ============================================================
// ACTION: Start a new Haul
// Fiqh: Haul dimulai saat aset PERTAMA KALI mencapai nishab
// Harga emas/perak dikunci pada hari ini sebagai referensi sepanjang haul
// ============================================================
export async function startZakatHaul(
  orgId: string, 
  goldPrice: number, 
  silverPrice: number,
  goldPriceSource: string = 'Manual Input',      // CFO audit: sumber harga
  goldPriceEvidenceUrl?: string                   // CFO audit: URL bukti harga
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const nishabGold   = NISHAB_GOLD_GRAMS   * goldPrice
  const nishabSilver = NISHAB_SILVER_GRAMS * silverPrice

  const { totalAssets } = await getTotalZakatAssets(orgId)

  if (totalAssets < nishabSilver && totalAssets < nishabGold) {
    return { error: `Aset saat ini (${totalAssets.toLocaleString('id-ID')}) masih di bawah nishab. Haul baru belum dapat dimulai.` }
  }

  // Cancel existing BATAL ones (cleanup)
  await supabase.from('zakat_haul' as any).update({ status: 'ARCHIVED' }).eq('org_id', orgId).eq('status', 'BATAL')

  const { error } = await supabase.from('zakat_haul' as any).insert({
    org_id: orgId,
    haul_start_date: getIslamicToday(),
    gold_price_per_gram: goldPrice,
    silver_price_per_gram: silverPrice,
    nishab_gold: nishabGold,
    nishab_silver: nishabSilver,
    status: 'ACTIVE',
    // CFO Audit Trail — "Anda dapat angka ini dari mana?"
    gold_price_source: goldPriceSource,
    gold_price_evidence_url: goldPriceEvidenceUrl || null,
    gold_price_set_by: user?.id || null,
    gold_price_set_at: new Date().toISOString(),
  })

  if (error) return { error: 'Gagal memulai haul: ' + error.message }

  revalidatePath('/accounting/zakat')
  return { success: true }
}

// ============================================================
// ACTION: Check + Cancel haul if assets fell below nishab
// Fiqh: Jika sempat under-nishab, haul batal.
// Haul baru dimulai saat aset menyentuh nishab lagi.
// ============================================================
export async function checkAndCancelHaul(orgId: string) {
  const supabase = await createClient()

  const { data: activeHaul } = await supabase
    .from('zakat_haul' as any)
    .select('*')
    .eq('org_id', orgId)
    .eq('status', 'ACTIVE')
    .maybeSingle()

  if (!activeHaul) return { alreadyInactive: true }

  const { totalAssets } = await getTotalZakatAssets(orgId)
  const nishabGold   = Number(activeHaul.nishab_gold)
  const nishabSilver = Number(activeHaul.nishab_silver)

  if (totalAssets < nishabSilver && totalAssets < nishabGold) {
    // BATAL — assets under nishab
    const today = getIslamicToday()
    await supabase.from('zakat_haul' as any).update({
      status: 'BATAL',
      batal_reason: `Aset turun di bawah nishab pada ${today}. Aset: Rp ${totalAssets.toLocaleString('id-ID')}. Haul baru dimulai saat aset kembali di atas nishab.`
    }).eq('id', activeHaul.id)

    revalidatePath('/accounting/zakat')
    return { batal: true, totalAssets, nishabSilver, nishabGold }
  }

  return { active: true, totalAssets }
}

// ============================================================
// ACTION: Evaluate Zakat Daily
// ============================================================
export async function evaluateZakatDaily(orgId: string, currentPrices: { gold: number, silver: number }) {
  const supabase = await createClient()

  const { totalAssets } = await getTotalZakatAssets(orgId)

  // 2. Check active haul
  const { data: activeHaul } = await supabase
    .from('zakat_haul' as any)
    .select('*')
    .eq('org_id', orgId)
    .eq('status', 'ACTIVE')
    .maybeSingle()

  const today = getIslamicToday()
  let activeId = activeHaul?.id
  const nishabGold = activeHaul ? Number(activeHaul.nishab_gold) : NISHAB_GOLD_GRAMS * currentPrices.gold
  const nishabSilver = activeHaul ? Number(activeHaul.nishab_silver) : NISHAB_SILVER_GRAMS * currentPrices.silver
  const isUnderNishab = totalAssets < nishabSilver && totalAssets < nishabGold
  
  if (activeHaul) {
    if (isUnderNishab) {
      await supabase.from('zakat_haul' as any).update({
        status: 'BATAL',
        batal_reason: `Aset turun di bawah nishab pada ${today}. Aset: Rp ${totalAssets.toLocaleString('id-ID')}`
      }).eq('id', activeHaul.id)
      activeId = undefined // Haul is cancelled
    }
  } else {
    if (!isUnderNishab) {
      // AUTO START NEW HAUL
      const { data: newHaul } = await supabase.from('zakat_haul' as any).insert({
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

  // 3. Log to historical events if activeId exists (to track graph visually)
  if (activeId) {
    // avoid duplicates for the same day
    const { count } = await supabase.from('zakat_haul_events' as any)
      .select('*', { count: 'exact', head: true })
      .eq('haul_id', activeId)
      .eq('event_date', today)
    
    if (!count || count === 0) {
      await supabase.from('zakat_haul_events' as any).insert({
        haul_id: activeId,
        org_id: orgId,
        event_date: today,
        total_assets: totalAssets,
        is_above_nishab: !isUnderNishab
      })
    }
  }
}

// ============================================================
// ACTION: Pay Zakat
// ============================================================
export async function payZakat(orgId: string, accountId: string, amount: number) {
  const supabase = await createClient()

  // Find Zakat Expense account
  let { data: zakatAcc } = await supabase.from('accounts' as any).select('id').eq('org_id', orgId).ilike('name', '%Zakat Tijarah%').single()
  if (!zakatAcc) {
     const { data: alt } = await supabase.from('accounts' as any).select('id').eq('org_id', orgId).ilike('name', '%Zakat%').limit(1).single()
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
    auto_post: true,
    lines: [
      { account_id: zakatAcc.id, debit: amount, credit: 0, memo: 'Pembayaran Zakat' },
      { account_id: accountId, debit: 0, credit: amount, memo: 'Pengeluaran Kas/Bank untuk Zakat' },
    ]
  })

  if (res.error) return res

  // Mark haul as COMPLETE/PAID
  await supabase.from('zakat_haul' as any).update({ status: 'COMPLETED' }).eq('org_id', orgId).eq('status', 'ACTIVE')

  revalidatePath('/accounting/zakat')
  revalidatePath('/accounting/journal')
  return { success: true }
}

// ============================================================
// ACTION: Temporary Fix / Force Sync Haul to Global Price
// Digunakan khusus untuk memperbaiki data saat fase testing / setup.
// Mengupdate semua riwayat haul (Active & Batal) agar menggunakan nishab baru.
// ============================================================
export async function syncActiveHaulPrices(orgId: string, goldPrice: number, silverPrice: number) {
  const supabase = await createClient()

  const nishabGold = 85 * goldPrice
  const nishabSilver = 595 * silverPrice

  const { error } = await supabase.from('zakat_haul' as any)
    .update({
      gold_price_per_gram: goldPrice,
      silver_price_per_gram: silverPrice,
      nishab_gold: nishabGold,
      nishab_silver: nishabSilver
    })
    .eq('org_id', orgId)
    .in('status', ['ACTIVE', 'BATAL'])

  if (error) return { error: error.message }
  
  revalidatePath('/accounting/zakat')
  return { success: true }
}
