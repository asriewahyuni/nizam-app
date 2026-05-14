'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// ── GENERATE COA PER PROYEK ──────────────────────────────────────────────

export async function generateProjectCoa(proyekId: string) {
  const db = createAdminClient()
  
  const { data: proyek } = await db.from('koperasi_proyek').select('*').eq('id', proyekId).single()
  if (!proyek) throw new Error('Proyek tidak ditemukan')
  
  // Hapus CoA lama jika ada (reset)
  await db.from('koperasi_proyek_coa').delete().eq('proyek_id', proyekId)
  
  const coaList = [
    // ASET
    { kode: '1-1000', nama: 'Kas Proyek', tipe: 'ASET', normal_balance: 'DEBIT', is_system: true },
    { kode: '1-1100', nama: 'Piutang Proyek', tipe: 'ASET', normal_balance: 'DEBIT', is_system: true },
    { kode: '1-2000', nama: 'Perlengkapan Proyek', tipe: 'ASET', normal_balance: 'DEBIT', is_system: true },
    // LIABILITAS
    { kode: '2-1000', nama: 'Hutang Proyek', tipe: 'LIABILITAS', normal_balance: 'KREDIT', is_system: true },
    { kode: '2-2000', nama: 'Modal Mudharabah', tipe: 'LIABILITAS', normal_balance: 'KREDIT', is_system: true },
    { kode: '2-3000', nama: 'Hutang Bagi Hasil', tipe: 'LIABILITAS', normal_balance: 'KREDIT', is_system: false },
    // EKUITAS
    { kode: '3-1000', nama: 'Modal Awal Proyek', tipe: 'EKUITAS', normal_balance: 'KREDIT', is_system: true },
    { kode: '3-2000', nama: 'Laba Ditahan Proyek', tipe: 'EKUITAS', normal_balance: 'KREDIT', is_system: true },
    // PENDAPATAN
    { kode: '4-1000', nama: 'Pendapatan Proyek', tipe: 'PENDAPATAN', normal_balance: 'KREDIT', is_system: true },
    { kode: '4-2000', nama: 'Pendapatan Lain-lain', tipe: 'PENDAPATAN', normal_balance: 'KREDIT', is_system: false },
    // BEBAN
    { kode: '5-1000', nama: 'Beban Operasional', tipe: 'BEBAN', normal_balance: 'DEBIT', is_system: true },
    { kode: '5-2000', nama: 'Beban Gaji/Tenaga Kerja', tipe: 'BEBAN', normal_balance: 'DEBIT', is_system: true },
    { kode: '5-3000', nama: 'Beban Material', tipe: 'BEBAN', normal_balance: 'DEBIT', is_system: true },
    { kode: '5-4000', nama: 'Beban Administrasi', tipe: 'BEBAN', normal_balance: 'DEBIT', is_system: false },
    { kode: '5-5000', nama: 'Beban Lain-lain', tipe: 'BEBAN', normal_balance: 'DEBIT', is_system: false },
    { kode: '5-6000', nama: 'Beban Penyusutan', tipe: 'BEBAN', normal_balance: 'DEBIT', is_system: false },
  ]
  
  const { error } = await db.from('koperasi_proyek_coa').insert(
    coaList.map(coa => ({ proyek_id: proyekId, ...coa }))
  )
  if (error) throw new Error(error.message)
  
  return { success: true }
}

// ── GET COA PROYEK ───────────────────────────────────────────────────────

export async function getProjectCoa(proyekId: string) {
  const db = createAdminClient()
  const { data, error } = await db
    .from('koperasi_proyek_coa')
    .select('*')
    .eq('proyek_id', proyekId)
    .order('kode', { ascending: true })
  if (error) throw new Error(error.message)
  return data || []
}

// ── JURNAL PROYEK ────────────────────────────────────────────────────────

export async function getProjectJournal(proyekId: string) {
  const db = createAdminClient()
  const { data, error } = await db
    .from('koperasi_proyek_jurnal')
    .select(`
      *,
      lines:koperasi_proyek_jurnal_lines(
        *,
        coa:koperasi_proyek_coa(kode, nama, tipe)
      )
    `)
    .eq('proyek_id', proyekId)
    .order('tgl_transaksi', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data || []
}

export async function createProjectJournalEntry(proyekId: string, payload: {
  tgl_transaksi: string
  tipe: string
  keterangan: string
  lines: { coa_id: string; debit: number; kredit: number; keterangan?: string }[]
}) {
  const db = createAdminClient()
  
  const totalDebit = payload.lines.reduce((s, l) => s + l.debit, 0)
  const totalKredit = payload.lines.reduce((s, l) => s + l.kredit, 0)
  
  if (Math.abs(totalDebit - totalKredit) > 0.01) {
    throw new Error(`Jurnal tidak balance: Debit ${totalDebit} ≠ Kredit ${totalKredit}`)
  }
  
  const { data: jurnal, error: jError } = await db
    .from('koperasi_proyek_jurnal')
    .insert({
      proyek_id: proyekId,
      tgl_transaksi: payload.tgl_transaksi,
      tipe: payload.tipe,
      keterangan: payload.keterangan,
      total_debit: totalDebit,
      total_kredit: totalKredit,
    })
    .select()
    .single()
  if (jError) throw new Error(jError.message)
  
  const lines = payload.lines.map(l => ({
    jurnal_id: jurnal.id,
    coa_id: l.coa_id,
    debit: l.debit,
    kredit: l.kredit,
    keterangan: l.keterangan,
  }))
  
  const { error: lError } = await db.from('koperasi_proyek_jurnal_lines').insert(lines)
  if (lError) throw new Error(lError.message)
  
  revalidatePath('/koperasi/proyek')
  return { success: true, id: jurnal.id }
}

// ── NERACA PROYEK ────────────────────────────────────────────────────────

export async function getProjectBalanceSheet(proyekId: string) {
  const db = createAdminClient()
  // Query journal lines joined with project COA directly
  const { data: lines, error } = await db
    .from('koperasi_proyek_jurnal_lines')
    .select(`
      debit, kredit,
      coa_id,
      jurnal!inner(proyek_id)
    `)
    .eq('jurnal.proyek_id', proyekId)
  if (error) throw new Error(error.message)
  
  // Get all project COAs
  const { data: coas } = await db
    .from('koperasi_proyek_coa')
    .select('*')
    .eq('proyek_id', proyekId)
  const coaMap = new Map((coas || []).map(c => [c.id, c]))
  
  // Compute saldo per COA
  const saldoMap = new Map<string, { kode: string; nama: string; tipe: string; saldo: number }>()
  for (const line of lines || []) {
    const coa = coaMap.get(line.coa_id)
    if (!coa) continue
    const key = coa.kode
    const existing = saldoMap.get(key) || { kode: coa.kode, nama: coa.nama, tipe: coa.tipe, saldo: 0 }
    existing.saldo += (line.debit || 0) - (line.kredit || 0)
    saldoMap.set(key, existing)
  }
  
  const all = Array.from(saldoMap.values())
  const aset = all.filter(s => s.tipe === 'ASET' && s.saldo !== 0)
  const liabilitas = all.filter(s => s.tipe === 'LIABILITAS' && s.saldo !== 0)
  const ekuitas = all.filter(s => s.tipe === 'EKUITAS' && s.saldo !== 0)
  const pendapatan = all.filter(s => s.tipe === 'PENDAPATAN' && s.saldo !== 0)
  const beban = all.filter(s => s.tipe === 'BEBAN' && s.saldo !== 0)
  
  const totalAset = aset.reduce((s, a) => s + a.saldo, 0)
  const totalPendapatan = pendapatan.reduce((s, a) => s + a.saldo, 0)
  const totalBeban = beban.reduce((s, a) => s + a.saldo, 0)
  const labaBersih = totalPendapatan - totalBeban
  const totalLiabilitas = liabilitas.reduce((s, a) => s + a.saldo, 0)
  const totalEkuitas = ekuitas.reduce((s, a) => s + a.saldo, 0)
  
  return {
    aset, totalAset,
    liabilitas, totalLiabilitas,
    ekuitas: [...ekuitas, { kode: '', nama: 'Laba Bersih', tipe: 'EKUITAS', saldo: labaBersih }],
    totalEkuitas: totalEkuitas + labaBersih,
    labaBersih,
    totalPasiva: totalLiabilitas + totalEkuitas + labaBersih,
  }
}

// ── P&L PROYEK ───────────────────────────────────────────────────────────

export async function getProjectProfitLoss(proyekId: string) {
  const db = createAdminClient()
  const { data: lines, error } = await db
    .from('koperasi_proyek_jurnal_lines')
    .select(`
      debit, kredit, coa_id,
      jurnal!inner(proyek_id)
    `)
    .eq('jurnal.proyek_id', proyekId)
  if (error) throw new Error(error.message)
  
  const { data: coas } = await db
    .from('koperasi_proyek_coa')
    .select('*')
    .eq('proyek_id', proyekId)
  const coaMap = new Map((coas || []).map(c => [c.id, c]))
  
  const saldoMap = new Map<string, { nama: string; tipe: string; saldo: number }>()
  for (const line of lines || []) {
    const coa = coaMap.get(line.coa_id)
    if (!coa || (coa.tipe !== 'PENDAPATAN' && coa.tipe !== 'BEBAN')) continue
    const existing = saldoMap.get(coa.kode) || { nama: coa.nama, tipe: coa.tipe, saldo: 0 }
    existing.saldo += Math.abs((line.debit || 0) - (line.kredit || 0))
    saldoMap.set(coa.kode, existing)
  }
  
  const all = Array.from(saldoMap.values())
  const pendapatan = all.filter(s => s.tipe === 'PENDAPATAN').map(s => ({ nama: s.nama, jumlah: s.saldo }))
  const beban = all.filter(s => s.tipe === 'BEBAN').map(s => ({ nama: s.nama, jumlah: s.saldo }))
  
  const totalPendapatan = pendapatan.reduce((s, p) => s + p.jumlah, 0)
  const totalBeban = beban.reduce((s, b) => s + b.jumlah, 0)
  
  return {
    pendapatan,
    beban,
    totalPendapatan,
    totalBeban,
    labaBersih: totalPendapatan - totalBeban,
  }
}
