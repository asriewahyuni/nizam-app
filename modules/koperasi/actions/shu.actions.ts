'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// ── SHU ENGINE ────────────────────────────────────────────────────────────

export async function hitungSHU(orgId: string, periodeTahun: number) {
  const db = createAdminClient()
  
  // 1. Get all organization-level accounting data
  const periodAwal = `${periodeTahun}-01-01`
  const periodAkhir = `${periodeTahun}-12-31`
  
  // 2. Get koperasi CoA accounts
  const { data: coaList } = await db
    .from('accounts')
    .select('id, code, name, type')
    .eq('org_id', orgId)
    .or('code.ilike.4-1%,code.ilike.4-2%,code.ilike.5-1%,code.ilike.5-2%')
  
  // 3. Get all journal entries for the period
  const { data: jurnalLines } = await db
    .from('jurnal_lines')
    .select('debit, kredit, account_id')
    .in('account_id', (coaList || []).map(c => c.id))
    .gte('jurnal.tgl_jurnal', periodAwal)
    .lte('jurnal.tgl_jurnal', periodAkhir)
    .eq('jurnal.approval_status', 'POSTED')
  
  // 4. Calculate revenue and expenses
  const coaMap = new Map((coaList || []).map(c => [c.id, c]))
  
  let totalPendapatan = 0  // 4-1xxx: Pendapatan
  let totalPendapatanLain = 0  // 4-2xxx: Pendapatan Lain
  let totalBebanOperasional = 0  // 5-1xxx: Beban
  let totalBebanLain = 0  // 5-2xxx: Beban Lain
  
  for (const line of jurnalLines || []) {
    const coa = coaMap.get(line.account_id)
    if (!coa) continue
    const amount = (line.kredit || 0) - (line.debit || 0)
    
    if (coa.code.startsWith('4-1')) totalPendapatan += Math.abs(amount)
    else if (coa.code.startsWith('4-2')) totalPendapatanLain += Math.abs(amount)
    else if (coa.code.startsWith('5-1')) totalBebanOperasional += Math.abs(amount)
    else if (coa.code.startsWith('5-2')) totalBebanLain += Math.abs(amount)
  }
  
  // 5. Get project-related income (from bagi hasil)
  const { data: proyekSelesai } = await db
    .from('koperasi_proyek')
    .select('ujrah_koperasi')
    .eq('org_id', orgId)
    .in('status', ['DISTRIBUSI', 'DITUTUP'])
    .gte('tgl_distribusi', `${periodeTahun}-01-01`)
    .lte('tgl_distribusi', `${periodeTahun}-12-31`)
  
  const totalUjrahProyek = (proyekSelesai || []).reduce((s, p) => s + Number(p.ujrah_koperasi || 0), 0)
  
  // 6. Simpanan income (admin fee etc)
  const totalPendapatanSimpanan = 0 // Placeholder
  
  // 7. Calculate SHU
  const totalRevenue = totalPendapatan + totalPendapatanLain + totalUjrahProyek + totalPendapatanSimpanan
  const totalExpenses = totalBebanOperasional + totalBebanLain
  const labaKotor = totalRevenue - totalExpenses
  
  // 8. Alokasi SHU (standar koperasi Indonesia)
  // 40% Anggota (dibagi proporsional)
  // 20% Cadangan Koperasi
  // 10% Pengurus
  // 10% DPS (Dewan Pengawas Syariah)
  // 10% Dana Sosial
  // 5% Pendidikan
  // 5% Dana Pembangunan
  
  const alokasiAnggota = Math.round(labaKotor * 0.4 * 100) / 100
  const alokasiCadangan = Math.round(labaKotor * 0.2 * 100) / 100
  const alokasiPengurus = Math.round(labaKotor * 0.1 * 100) / 100
  const alokasiDps = Math.round(labaKotor * 0.1 * 100) / 100
  const alokasiSosial = Math.round(labaKotor * 0.1 * 100) / 100
  const alokasiPendidikan = Math.round(labaKotor * 0.05 * 100) / 100
  const alokasiPembangunan = Math.round(labaKotor * 0.05 * 100) / 100
  
  // 9. Get active members for SHU distribution calculation
  const { data: anggota } = await db
    .from('koperasi_anggota')
    .select('id, nama, simpanan_pokok, simpanan_wajib_setoran')
    .eq('org_id', orgId)
    .eq('status', 'AKTIF')
  
  const totalSimpanan = (anggota || []).reduce((s, a) => s + Number(a.simpanan_pokok || 0) + Number(a.simpanan_wajib_setoran || 0), 0)
  
  // SHU per anggota (proporsional simpanan)
  const shuPerAnggota = (anggota || []).map(a => {
    const simpananTotal = Number(a.simpanan_pokok || 0) + Number(a.simpanan_wajib_setoran || 0)
    const porsi = totalSimpanan > 0 ? simpananTotal / totalSimpanan : 0
    return {
      anggotaId: a.id,
      nama: a.nama,
      simpananTotal,
      porsiPersen: Math.round(porsi * 10000) / 100,
      shuDiterima: Math.round(alokasiAnggota * porsi * 100) / 100,
    }
  }).filter(a => a.shuDiterima > 0)
  
  return {
    periode: periodeTahun,
    labaKotor,
    totalRevenue,
    totalExpenses,
    revenueDetail: {
      pendapatanOperasional: totalPendapatan,
      pendapatanLain: totalPendapatanLain,
      ujrahProyek: totalUjrahProyek,
    },
    expenseDetail: {
      bebanOperasional: totalBebanOperasional,
      bebanLain: totalBebanLain,
    },
    alokasi: {
      anggota: alokasiAnggota,
      cadangan: alokasiCadangan,
      pengurus: alokasiPengurus,
      dps: alokasiDps,
      sosial: alokasiSosial,
      pendidikan: alokasiPendidikan,
      pembangunan: alokasiPembangunan,
    },
    shuPerAnggota,
    totalAnggotaPenerima: shuPerAnggota.length,
    totalSimpananAnggota: totalSimpanan,
  }
}

// ── GET SHU HISTORY ────────────────────────────────────────────────────────

export async function getSHUHistory(orgId: string) {
  const db = createAdminClient()
  const { data } = await db
    .from('koperasi_proyek_bagi_hasil')
    .select('*')
    .eq('proyek.org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(10)
  return data || []
}

// ── GET MEMBER DATA ────────────────────────────────────────────────────────

export async function getMemberData(anggotaId: string) {
  const db = createAdminClient()
  
  const { data: anggota } = await db
    .from('koperasi_anggota')
    .select('*')
    .eq('id', anggotaId)
    .single()
  if (!anggota) throw new Error('Anggota tidak ditemukan')
  
  const [simpananPokok, simpananWajib, simpananSukarela, murabahah, bagiHasilDistribusi] = await Promise.all([
    db.from('koperasi_simpanan_pokok').select('*').eq('anggota_id', anggotaId),
    db.from('koperasi_simpanan_wajib').select('*').eq('anggota_id', anggotaId),
    db.from('koperasi_simpanan_sukarela').select('*').eq('anggota_id', anggotaId).order('created_at', { ascending: false }),
    db.from('koperasi_murabahah_transaksi')
      .select('*, angsuran:koperasi_murabahah_angsuran(*)')
      .eq('pembeli_id', anggotaId)
      .order('created_at', { ascending: false }),
    // Get SHU distributions for this member
    db.from('koperasi_proyek_distribusi')
      .select('*, bagi_hasil:koperasi_proyek_bagi_hasil(proyek:koperasi_proyek(nama_proyek))')
      .eq('pihak_id', anggotaId)
      .eq('pihak_type', 'SHAHIBUL_MAAL'),
  ])
  
  const totalPokok = /*simpananPokok?.data?.reduce((s,r) => s + Number(r.jumlah), 0)*/ 0
  const totalWajib = /*simpananWajib?.data?.reduce((s,r) => s + Number(r.jumlah), 0)*/ 0
  const totalSukarela = simpananSukarela?.data?.reduce((s, r) => s + Number(r.jumlah || 0), 0) || 0
  
  return {
    anggota,
    simpanan: {
      pokok: simpananPokok?.data || [],
      wajib: simpananWajib?.data || [],
      sukarela: simpananSukarela?.data || [],
      totalPokok: Number(anggota.simpanan_pokok || 0),
      totalWajib: Number(anggota.simpanan_wajib_setoran || 0),
      totalSukarela,
    },
    murabahah: murabahah?.data || [],
    bagiHasil: bagiHasilDistribusi?.data || [],
  }
}
