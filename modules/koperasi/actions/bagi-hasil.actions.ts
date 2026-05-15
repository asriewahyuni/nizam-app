'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// ── BAGI HASIL ENGINE ──────────────────────────────────────────────────────

export async function hitungBagiHasil(proyekId: string) {
  const db = await createAdminClient()
  
  // 1. Get proyek info
  const { data: proyek } = await db.from('koperasi_proyek').select('*').eq('id', proyekId).single()
  if (!proyek) throw new Error('Proyek tidak ditemukan')
  if (proyek.status !== 'SELESAI' && proyek.status !== 'DISTRIBUSI') {
    throw new Error('Proyek harus SELESAI sebelum bagi hasil')
  }
  
  // 2. Get all journal entries and compute P&L
  const { data: lines } = await db
    .from('koperasi_proyek_jurnal_lines')
    .select(`
      debit, kredit, coa_id,
      jurnal!inner(proyek_id)
    `)
    .eq('jurnal.proyek_id', proyekId)
  
  const { data: coas } = await db
    .from('koperasi_proyek_coa')
    .select('*')
    .eq('proyek_id', proyekId)
  const coaMap = new Map((coas || []).map(c => [c.id, c]))
  
  let totalPendapatan = 0
  let totalBeban = 0
  for (const line of lines || []) {
    const coa = coaMap.get(line.coa_id)
    if (!coa) continue
    const selisih = Math.abs((line.debit || 0) - (line.kredit || 0))
    if (coa.tipe === 'PENDAPATAN') totalPendapatan += selisih
    if (coa.tipe === 'BEBAN') totalBeban += selisih
  }
  
  const labaBersih = totalPendapatan - totalBeban
  if (labaBersih <= 0) {
    throw new Error(`Proyek tidak menghasilkan laba (rugi Rp ${Math.abs(labaBersih).toLocaleString()}). Tidak ada yang dibagikan.`)
  }
  
  // 3. Calculate distribution
  const nisbahSM = Number(proyek.nisbah_sm) / 100
  const nisbahMudharib = Number(proyek.nisbah_mudharib) / 100
  const ujrahKoperasi = Number(proyek.ujrah_koperasi || 0)
  
  const labaSetelahUjrah = labaBersih - ujrahKoperasi
  if (labaSetelahUjrah <= 0) {
    throw new Error(`Laba setelah ujrah koperasi negatif (Rp ${labaSetelahUjrah.toLocaleString()})`)
  }
  
  const bagianSM = Math.round(labaSetelahUjrah * nisbahSM * 100) / 100
  const bagianMudharib = Math.round(labaSetelahUjrah * nisbahMudharib * 100) / 100
  
  // 4. Get SM investments for proportional distribution
  const { data: investasi } = await db
    .from('koperasi_proyek_investasi')
    .select('*, shahibul_maal:koperasi_shahibul_maal(id, anggota:koperasi_anggota(nama))')
    .eq('proyek_id', proyekId)
    .eq('status', 'AKTIF')
  
  const totalSetoran = (investasi || []).reduce((s, i) => s + Number(i.jumlah_setor), 0)
  
  // 5. Create bagi hasil record
  const { data: bh, error: bhErr } = await db
    .from('koperasi_proyek_bagi_hasil')
    .insert({
      proyek_id: proyekId,
      periode_awal: proyek.tgl_aktif || proyek.tgl_diajukan,
      periode_akhir: proyek.tgl_selesai || new Date().toISOString().split('T')[0],
      total_laba: labaBersih,
      total_distribusi_shahibul_maal: bagianSM,
      total_distribusi_mudharib: bagianMudharib,
      ujrah_koperasi: ujrahKoperasi,
      status: 'ESTIMASI',
    })
    .select()
    .single()
  if (bhErr) throw new Error(bhErr.message)
  
  // 6. Create distribution records
  const distribusi: any[] = []
  
  // Per SM
  for (const inv of investasi || []) {
    const porsi = totalSetoran > 0 ? Number(inv.jumlah_setor) / totalSetoran : 0
    const nominalSM = Math.round(bagianSM * porsi * 100) / 100
    distribusi.push({
      bagi_hasil_id: bh.id,
      pihak_type: 'SHAHIBUL_MAAL',
      pihak_id: inv.shahibul_maal_id,
      porsi_persen: Math.round(porsi * 10000) / 100,
      nominal: nominalSM,
    })
  }
  
  // Per Mudharib
  distribusi.push({
    bagi_hasil_id: bh.id,
    pihak_type: 'MUDHARIB',
    pihak_id: proyek.mudharib_id,
    porsi_persen: Math.round(nisbahMudharib * 10000) / 100,
    nominal: bagianMudharib,
  })
  
  const { error: dErr } = await db.from('koperasi_proyek_distribusi').insert(distribusi)
  if (dErr) throw new Error(dErr.message)
  
  revalidatePath('/koperasi/proyek')
  return {
    bagiHasilId: bh.id,
    totalLaba: labaBersih,
    ujrahKoperasi,
    labaSetelahUjrah,
    bagianSM,
    bagianMudharib,
    totalSetoran,
    jumlahInvestor: (investasi || []).length,
  }
}

// ── GET BAGI HASIL ─────────────────────────────────────────────────────────

export async function getBagiHasil(proyekId: string) {
  const db = await createAdminClient()
  
  const { data: bhList, error } = await db
    .from('koperasi_proyek_bagi_hasil')
    .select(`
      *,
      distribusi:koperasi_proyek_distribusi(
        *,
        shahibul_maal:koperasi_shahibul_maal!pihak_id(
          id, anggota:koperasi_anggota(nama, kode_anggota)
        ),
        mudharib:koperasi_mudharib!pihak_id(
          id, anggota:koperasi_anggota(nama, kode_anggota)
        )
      )
    `)
    .eq('proyek_id', proyekId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return bhList || []
}

// ── KONFIRMASI BAGI HASIL ──────────────────────────────────────────────────

export async function konfirmasiBagiHasil(bagiHasilId: string) {
  const db = await createAdminClient()
  const { data, error } = await db
    .from('koperasi_proyek_bagi_hasil')
    .update({ status: 'DIKONFIRMASI', updated_at: new Date().toISOString() })
    .eq('id', bagiHasilId)
    .select()
    .single()
  if (error) throw new Error(error.message)
  revalidatePath('/koperasi/proyek')
  return data
}

// ── SETUJUI DISTRIBUSI ─────────────────────────────────────────────────────

export async function setujuiDistribusi(bagiHasilId: string, proyekId: string) {
  const db = await createAdminClient()
  
  // Update status bagi hasil
  const { data: bh } = await db
    .from('koperasi_proyek_bagi_hasil')
    .update({ status: 'DIDISTRIBUSI', updated_at: new Date().toISOString() })
    .eq('id', bagiHasilId)
    .select()
    .single()
  if (!bh) throw new Error('Bagi hasil tidak ditemukan')
  
  // Update proyek status to DISTRIBUSI
  await db.from('koperasi_proyek').update({
    status: 'DISTRIBUSI',
    tgl_distribusi: new Date().toISOString().split('T')[0],
    updated_at: new Date().toISOString(),
  }).eq('id', proyekId)
  
  revalidatePath('/koperasi/proyek')
  return bh
}

// ── SYNC LAYER 2 — Buku Besar Resmi Koperasi ──────────────────────────────

export async function syncProyekKeBukuBesar(orgId: string, proyekId: string) {
  const db = await createAdminClient()
  
  // 1. Get proyek info
  const { data: proyek } = await db.from('koperasi_proyek').select('*').eq('id', proyekId).single()
  if (!proyek) throw new Error('Proyek tidak ditemukan')
  
  // 2. Install CoA koperasi dulu jika belum
  // Check if CoA exists by looking for a known account
  const { count } = await db.from('accounts').select('*', { count: 'exact', head: true }).eq('org_id', orgId).eq('code', '4-1001')
  if (!count || count === 0) {
    await db.rpc('inject_koperasi_coa', { p_org_id: orgId })
  }
  
  // 3. Find CoA accounts for the main books
  const findAccount = async (code: string) => {
    const { data } = await db.from('accounts').select('id').eq('org_id', orgId).eq('code', code).single()
    return data?.id
  }
  
  const pendapatanUjrahId = await findAccount('4-1001') || await findAccount('4-1000')
  const kasId = await findAccount('1-1000')
  const bebanOperasionalId = await findAccount('5-1000')
  const hutangBagiHasilId = await findAccount('2-3000')
  const labaDitahanId = await findAccount('3-2000')
  const hutangUjrahId = await findAccount('2-1000')
  
  // 4. Get bagi hasil calculation
  const { data: bhList } = await db
    .from('koperasi_proyek_bagi_hasil')
    .select('*')
    .eq('proyek_id', proyekId)
    .eq('status', 'DIKONFIRMASI')
    .order('created_at', { ascending: false })
    .limit(1)
  
  const bh = bhList?.[0]
  if (!bh) throw new Error('Bagi hasil belum dikonfirmasi. Lakukan hitung dan konfirmasi dulu.')
  
  // 5. Get all project journal entries for Layer 1
  const { data: lines } = await db
    .from('koperasi_proyek_jurnal_lines')
    .select('debit, kredit, coa_id')
    .eq('jurnal.proyek_id', proyekId)
  
  const { data: coas } = await db
    .from('koperasi_proyek_coa')
    .select('*')
    .eq('proyek_id', proyekId)
  const coaMap = new Map((coas || []).map(c => [c.id, c]))
  
  // Aggregate by COA tipe
  let totalPendapatan = 0
  let totalBeban = 0
  for (const line of lines || []) {
    const coa = coaMap.get(line.coa_id)
    if (!coa) continue
    const selisih = Math.abs((line.debit || 0) - (line.kredit || 0))
    if (coa.tipe === 'PENDAPATAN') totalPendapatan += selisih
    if (coa.tipe === 'BEBAN') totalBeban += selisih
  }
  
  const labaBersih = totalPendapatan - totalBeban
  const today = new Date().toISOString().split('T')[0]
  
  // 6. Create journal entries in main books (Layer 2)
  // Summary approach: record the ujrah as revenue + profit distribution as liability
  const ujrah = Number(bh.ujrah_koperasi || 0)
  const totalBagianPihak = Number(bh.total_distribusi_shahibul_maal || 0) + Number(bh.total_distribusi_mudharib || 0)
  
  if (ujrah > 0 || totalBagianPihak > 0) {
    const { data: jurnal, error: jErr } = await db
      .from('jurnal')
      .insert({
        org_id: orgId,
        tgl_jurnal: today,
        sumber: 'KOPERASI_PROYEK',
        ref_id: proyekId,
        keterangan: `Sync L2: Proyek "${proyek.nama_proyek}" — Ujrah Rp ${ujrah.toLocaleString()}, Bagi Hasil Rp ${totalBagianPihak.toLocaleString()}`,
        approval_status: 'POSTED',
        created_at: new Date().toISOString(),
      })
      .select()
      .single()
    if (jErr) throw new Error(jErr.message)
    
    const jurnalLinesData: any[] = []
    
    // Revenue recognition (ujrah): Kas [Dr] | Pendapatan Ujrah [Cr]
    if (ujrah > 0 && kasId && pendapatanUjrahId) {
      jurnalLinesData.push({ jurnal_id: jurnal.id, account_id: kasId, debit: ujrah, keterangan: 'Pendapatan Ujrah Proyek' })
      jurnalLinesData.push({ jurnal_id: jurnal.id, account_id: pendapatanUjrahId, kredit: ujrah, keterangan: 'Pendapatan Ujrah Proyek' })
    }
    
    // Profit distribution liability: Laba Ditahan [Dr] | Hutang Bagi Hasil [Cr]
    if (totalBagianPihak > 0 && labaDitahanId && hutangBagiHasilId) {
      jurnalLinesData.push({ jurnal_id: jurnal.id, account_id: labaDitahanId, debit: totalBagianPihak, keterangan: 'Alokasi Bagi Hasil Proyek' })
      jurnalLinesData.push({ jurnal_id: jurnal.id, account_id: hutangBagiHasilId, kredit: totalBagianPihak, keterangan: 'Utang Bagi Hasil Proyek' })
    }
    
    if (jurnalLinesData.length > 0) {
      const { error: lErr } = await db.from('jurnal_lines').insert(jurnalLinesData)
      if (lErr) throw new Error(lErr.message)
    }
  }
  
  // Record distribution payments as LUNAS
  await db.from('koperasi_proyek_distribusi')
    .update({ status_bayar: 'LUNAS', tgl_bayar: today })
    .eq('bagi_hasil_id', bagiHasilId)
  
  // Update proyek status to DITUTUP
  await db.from('koperasi_proyek').update({
    status: 'DITUTUP',
    tgl_ditutup: today,
    updated_at: new Date().toISOString(),
  }).eq('id', proyekId)
  
  revalidatePath('/koperasi/proyek')
  return { success: true, message: 'Proyek berhasil disinkronkan ke buku besar dan ditutup' }
}

// ── GET PROJECT SUMMARY ────────────────────────────────────────────────────

export async function getProjectFinancialSummary(proyekId: string) {
  const db = await createAdminClient()
  
  const { data: proyek } = await db.from('koperasi_proyek').select('*').eq('id', proyekId).single()
  if (!proyek) throw new Error('Proyek tidak ditemukan')
  
  // Get journal aggregates
  const { data: lines } = await db
    .from('koperasi_proyek_jurnal_lines')
    .select('debit, kredit, coa_id')
    .eq('jurnal.proyek_id', proyekId)
  
  const { data: coas } = await db
    .from('koperasi_proyek_coa')
    .select('*')
    .eq('proyek_id', proyekId)
  const coaMap = new Map((coas || []).map(c => [c.id, c]))
  
  let totalPendapatan = 0
  let totalBeban = 0
  for (const line of lines || []) {
    const coa = coaMap.get(line.coa_id)
    if (!coa) continue
    const selisih = Math.abs((line.debit || 0) - (line.kredit || 0))
    if (coa.tipe === 'PENDAPATAN') totalPendapatan += selisih
    if (coa.tipe === 'BEBAN') totalBeban += selisih
  }
  
  const labaBersih = totalPendapatan - totalBeban
  
  // Get bagi hasil
  const { data: bhList } = await db
    .from('koperasi_proyek_bagi_hasil')
    .select('*')
    .eq('proyek_id', proyekId)
    .order('created_at', { ascending: false })
    .limit(1)
  
  // Get investasi
  const { data: investasi } = await db
    .from('koperasi_proyek_investasi')
    .select('*, shahibul_maal:koperasi_shahibul_maal(id, anggota:koperasi_anggota(nama))')
    .eq('proyek_id', proyekId)
    .eq('status', 'AKTIF')
  
  return {
    totalPendapatan,
    totalBeban,
    labaBersih,
    bagiHasil: bhList?.[0] || null,
    investasi: investasi || [],
    modalTerkumpul: Number(proyek.modal_terkumpul),
    nisbahSM: Number(proyek.nisbah_sm),
    nisbahMudharib: Number(proyek.nisbah_mudharib),
    ujrahKoperasi: Number(proyek.ujrah_koperasi),
  }
}
