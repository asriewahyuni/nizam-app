'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// ── HELPERS ──────────────────────────────────────────────────────────────────

async function getDb() {
  return await createAdminClient()
}

// ── ANGGOTA ──────────────────────────────────────────────────────────────────

export async function getAnggota(orgId: string) {
  const db = await getDb()
  const { data, error } = await db
    .from('koperasi_anggota')
    .select('*, branch:branch_id(name)')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data || []
}

export async function createAnggota(orgId: string, payload: {
  branch_id?: string
  employee_id?: string
  kode_anggota: string
  nama: string
  nik?: string
  alamat?: string
  no_telepon?: string
  email?: string
}) {
  const db = await getDb()
  // Auto-generate kode if not provided
  if (!payload.kode_anggota) {
    const { data: result } = await db.rpc('koperasi_generate_kode_anggota', { p_org_id: orgId })
    payload.kode_anggota = result || `KOP-${String(Date.now()).slice(-4)}`
  }
  const { data, error } = await db
    .from('koperasi_anggota')
    .insert({ org_id: orgId, ...payload })
    .select()
    .single()
  if (error) throw new Error(error.message)
  revalidatePath('/koperasi/anggota')
  return data
}

export async function updateAnggota(id: string, payload: Partial<{
  nama: string; nik: string; alamat: string; no_telepon: string; email: string; status: string
}>) {
  const db = await getDb()
  const { data, error } = await db
    .from('koperasi_anggota')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  revalidatePath('/koperasi/anggota')
  return data
}

// ── SIMPANAN ─────────────────────────────────────────────────────────────────

export async function getSimpananPokok(orgId: string) {
  const db = await getDb()
  const { data, error } = await db
    .from('koperasi_simpanan_pokok')
    .select('*, anggota:koperasi_anggota(nama, kode_anggota)')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data || []
}

export async function bayarSimpananPokok(orgId: string, payload: {
  anggota_id: string; jumlah: number; tgl_bayar?: string; keterangan?: string
}) {
  const db = await getDb()
  const { data, error } = await db
    .from('koperasi_simpanan_pokok')
    .insert({ org_id: orgId, ...payload, tgl_bayar: payload.tgl_bayar || new Date().toISOString().split('T')[0] })
    .select()
    .single()
  if (error) throw new Error(error.message)
  // Update anggota simpanan_pokok total
  await db.from('koperasi_anggota').update({ updated_at: new Date().toISOString() }).eq('id', payload.anggota_id)
  revalidatePath('/koperasi/simpanan')
  return data
}

export async function getSimpananWajib(orgId: string) {
  const db = await getDb()
  const { data, error } = await db
    .from('koperasi_simpanan_wajib')
    .select('*, anggota:koperasi_anggota(nama, kode_anggota)')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data || []
}

export async function bayarSimpananWajib(orgId: string, payload: {
  anggota_id: string; jumlah: number; periode_bulan: string; tgl_bayar?: string; keterangan?: string
}) {
  const db = await getDb()
  const { data, error } = await db
    .from('koperasi_simpanan_wajib')
    .insert({ org_id: orgId, ...payload, tgl_bayar: payload.tgl_bayar || new Date().toISOString().split('T')[0] })
    .select()
    .single()
  if (error) throw new Error(error.message)
  revalidatePath('/koperasi/simpanan')
  return data
}

export async function getSimpananSukarela(orgId: string) {
  const db = await getDb()
  const { data, error } = await db
    .from('koperasi_simpanan_sukarela')
    .select('*, anggota:koperasi_anggota(nama, kode_anggota)')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data || []
}

export async function transaksiSimpananSukarela(orgId: string, payload: {
  anggota_id: string; jenis: 'SETOR' | 'TARIK'; jumlah: number; tgl_transaksi?: string; keterangan?: string
}) {
  const db = await getDb()
  const { data, error } = await db
    .from('koperasi_simpanan_sukarela')
    .insert({ org_id: orgId, ...payload, tgl_transaksi: payload.tgl_transaksi || new Date().toISOString().split('T')[0] })
    .select()
    .single()
  if (error) throw new Error(error.message)
  revalidatePath('/koperasi/simpanan')
  return data
}

// ── SHAHIBUL MAAL ────────────────────────────────────────────────────────────

export async function getShahibulMaal(orgId: string) {
  const db = await getDb()
  const { data, error } = await db
    .from('koperasi_shahibul_maal')
    .select('*, anggota:koperasi_anggota(nama, kode_anggota, email, no_telepon)')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data || []
}

export async function daftarkanShahibulMaal(orgId: string, anggota_id: string) {
  const db = await getDb()
  const { data, error } = await db
    .from('koperasi_shahibul_maal')
    .insert({ org_id: orgId, anggota_id })
    .select()
    .single()
  if (error) throw new Error(error.message)
  revalidatePath('/koperasi/shahibul-maal')
  return data
}

// ── MUDHARIB ─────────────────────────────────────────────────────────────────

export async function getMudharib(orgId: string) {
  const db = await getDb()
  const { data, error } = await db
    .from('koperasi_mudharib')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data || []
}

export async function createMudharib(orgId: string, payload: {
  anggota_id?: string; nama: string; nik?: string; alamat?: string; no_telepon?: string; email?: string
}) {
  const db = await getDb()
  const { data, error } = await db
    .from('koperasi_mudharib')
    .insert({ org_id: orgId, ...payload })
    .select()
    .single()
  if (error) throw new Error(error.message)
  revalidatePath('/koperasi/mudharib')
  return data
}

// ── SERTIFIKASI DPS ──────────────────────────────────────────────────────────

export async function getSertifikasiDps(orgId: string) {
  const db = await getDb()
  const { data, error } = await db
    .from('koperasi_sertifikasi_dps')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data || []
}

export async function terbitkanSertifikasi(orgId: string, payload: {
  entity_type: 'ANGGOTA' | 'MUDHARIB'
  entity_id: string
  no_sertifikat: string
  tgl_terbit: string
  tgl_expired: string
  level?: string
  penerbit?: string
}) {
  const db = await getDb()
  const { data, error } = await db
    .from('koperasi_sertifikasi_dps')
    .insert({ org_id: orgId, ...payload })
    .select()
    .single()
  if (error) throw new Error(error.message)
  // Update status tersertifikasi pada entity terkait
  if (payload.entity_type === 'ANGGOTA') {
    await db.from('koperasi_anggota').update({ is_tersertifikasi_dps: true, updated_at: new Date().toISOString() }).eq('id', payload.entity_id)
  }
  revalidatePath('/koperasi/sertifikasi')
  return data
}

// ── PENGURUS ─────────────────────────────────────────────────────────────────

export async function getPengurus(orgId: string) {
  const db = await getDb()
  const { data, error } = await db
    .from('koperasi_pengurus')
    .select('*, anggota:koperasi_anggota(nama, kode_anggota)')
    .eq('org_id', orgId)
    .order('jabatan', { ascending: true })
  if (error) throw new Error(error.message)
  return data || []
}

export async function tetapkanPengurus(orgId: string, payload: {
  anggota_id: string; jabatan: string; masa_bakti_awal: string; masa_bakti_akhir?: string
}) {
  const db = await getDb()
  const { data, error } = await db
    .from('koperasi_pengurus')
    .insert({ org_id: orgId, ...payload })
    .select()
    .single()
  if (error) throw new Error(error.message)
  revalidatePath('/koperasi/pengurus')
  return data
}

// ── COA ──────────────────────────────────────────────────────────────────────

export async function installCoaKoperasi(orgId: string) {
  const db = await getDb()
  const { error } = await db.rpc('inject_koperasi_coa', { p_org_id: orgId })
  if (error) throw new Error(error.message)
  revalidatePath('/koperasi')
  return { success: true }
}

// ── PROYEK ───────────────────────────────────────────────────────────────────

export async function getProyek(orgId: string) {
  const db = await getDb()
  const { data, error } = await db
    .from('koperasi_proyek')
    .select('*, mudharib:koperasi_mudharib(nama)')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data || []
}

export async function createProyek(orgId: string, payload: {
  mudharib_id: string
  nama_proyek: string
  deskripsi?: string
  modal_dibutuhkan: number
  nisbah_sm?: number
  nisbah_mudharib?: number
  ujrah_koperasi?: number
}) {
  const db = await getDb()
  const { data, error } = await db
    .from('koperasi_proyek')
    .insert({ org_id: orgId, ...payload, status: 'DIAJUKAN' })
    .select()
    .single()
  if (error) throw new Error(error.message)
  revalidatePath('/koperasi/proyek')
  return data
}

export async function updateStatusProyek(id: string, status: string, alasan?: string) {
  const db = await getDb()
  const update: any = { status, updated_at: new Date().toISOString() }
  const now = new Date().toISOString().split('T')[0]
  if (status === 'DIVERIFIKASI') update.tgl_diverifikasi = now
  if (status === 'DIPUBLIKASI') update.tgl_dipublikasi = now
  if (status === 'AKTIF') update.tgl_aktif = now
  if (status === 'SELESAI') update.tgl_selesai = now
  if (status === 'DITUTUP') update.tgl_ditutup = now
  if (status === 'DISTRIBUSI') update.tgl_distribusi = now
  if (status === 'DITOLAK') update.alasan_ditolak = alasan
  if (status === 'GAGAL') update.alasan_gagal = alasan
  if (status === 'DIKEMBALIKAN') update.status = 'DIAJUKAN' // revert
  const { error } = await db.from('koperasi_proyek').update(update).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/koperasi/proyek')
  return { success: true }
}

export async function getInvestasiProyek(proyek_id: string) {
  const db = await getDb()
  const { data, error } = await db
    .from('koperasi_proyek_investasi')
    .select('*, shahibul_maal:koperasi_shahibul_maal!inner(anggota:koperasi_anggota!inner(nama))')
    .eq('proyek_id', proyek_id)
  if (error) throw new Error(error.message)
  return data || []
}

export async function tambahInvestasi(proyek_id: string, shahibul_maal_id: string, jumlah: number) {
  const db = await getDb()
  // Get current proyek modal
  const { data: proyek } = await db.from('koperasi_proyek').select('modal_dibutuhkan, modal_terkumpul').eq('id', proyek_id).single()
  if (!proyek) throw new Error('Proyek tidak ditemukan')
  
  const modal_baru = Number(proyek.modal_terkumpul) + jumlah
  const porsi = modal_baru > 0 ? (jumlah / modal_baru) * 100 : 0
  
  const { data, error } = await db
    .from('koperasi_proyek_investasi')
    .insert({ proyek_id, shahibul_maal_id, jumlah_setor: jumlah, porsi_persen: Math.round(porsi * 100) / 100 })
    .select()
    .single()
  if (error) throw new Error(error.message)
  
  // Update proyek modal_terkumpul
  await db.from('koperasi_proyek').update({ modal_terkumpul: modal_baru, updated_at: new Date().toISOString() }).eq('id', proyek_id)
  
  revalidatePath('/koperasi/proyek')
  return data
}

// ── MURABAHAH ────────────────────────────────────────────────────────────────

export async function getMurabahahTransaksi(orgId: string) {
  const db = await getDb()
  const { data, error } = await db
    .from('koperasi_murabahah_transaksi')
    .select('*, pembeli:koperasi_anggota!inner(nama, kode_anggota), akad:koperasi_akad_wakalah(nomor_akad)')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data || []
}

export async function getAkadWakalah(orgId: string) {
  const db = await getDb()
  const { data, error } = await db
    .from('koperasi_akad_wakalah')
    .select('*, shahibul_maal:koperasi_shahibul_maal(id, anggota:koperasi_anggota(id, nama))')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data || []
}

export async function createAkadWakalah(orgId: string, payload: {
  shahibul_maal_id: string
  jenis_barang: string
  ujrah_flat: number
  tgl_akad?: string
}) {
  const db = await getDb()
  const { data: noAkad } = await db.rpc('koperasi_generate_nomor_akad', { p_org_id: orgId })
  const { data, error } = await db.from('koperasi_akad_wakalah').insert({
    org_id: orgId,
    nomor_akad: noAkad || `W-${orgId.slice(0,4)}-${Date.now()}`,
    shahibul_maal_id: payload.shahibul_maal_id,
    jenis_barang: payload.jenis_barang,
    ujrah_flat: payload.ujrah_flat,
    tgl_akad: payload.tgl_akad || new Date().toISOString().split('T')[0],
  }).select().single()
  if (error) throw new Error(error.message)
  revalidatePath('/koperasi/akad-wakalah')
  return data
}

export async function createMurabahahTransaksi(orgId: string, payload: {
  akad_wakalah_id: string
  pembeli_id: string
  nama_barang: string
  harga_pokok: number
  margin: number
  tenor_bulan: number
}) {
  const db = await getDb()
  const hargaJual = payload.harga_pokok + payload.margin
  const noTrans = `MB-${orgId.slice(0,4)}-${Date.now()}`
  
  const { data, error } = await db.from('koperasi_murabahah_transaksi').insert({
    org_id: orgId,
    akad_wakalah_id: payload.akad_wakalah_id,
    nomor_transaksi: noTrans,
    pembeli_id: payload.pembeli_id,
    nama_barang: payload.nama_barang,
    harga_pokok: payload.harga_pokok,
    margin: payload.margin,
    harga_jual: hargaJual,
    tenor_bulan: payload.tenor_bulan,
  }).select().single()
  if (error) throw new Error(error.message)
  
  // Generate auto angsuran
  const angsuranPerBulan = Math.ceil(hargaJual / payload.tenor_bulan)
  const angsuran: any[] = []
  const today = new Date()
  for (let i = 1; i <= payload.tenor_bulan; i++) {
    const jt = new Date(today.getFullYear(), today.getMonth() + i, today.getDate())
    angsuran.push({
      transaksi_id: data.id,
      angsuran_ke: i,
      jatuh_tempo: jt.toISOString().split('T')[0],
      jumlah: i === payload.tenor_bulan ? hargaJual - (angsuranPerBulan * (payload.tenor_bulan - 1)) : angsuranPerBulan,
    })
  }
  const { error: aError } = await db.from('koperasi_murabahah_angsuran').insert(angsuran)
  if (aError) throw new Error(aError.message)
  
  revalidatePath('/koperasi/murabahah')
  return data
}

// ── DASHBOARD ────────────────────────────────────────────────────────────────

export async function getDashboardStats(orgId: string) {
  const db = await getDb()
  const [anggota, proyek, simpananPokok, shahibulMaal, murabahah] = await Promise.all([
    db.from('koperasi_anggota').select('id, status').eq('org_id', orgId),
    db.from('koperasi_proyek').select('id, status, modal_terkumpul, modal_dibutuhkan').eq('org_id', orgId),
    db.from('koperasi_simpanan_pokok').select('jumlah').eq('org_id', orgId),
    db.from('koperasi_shahibul_maal').select('id').eq('org_id', orgId),
    db.from('koperasi_murabahah_transaksi').select('id, status, sisa:angsuran!left()').eq('org_id', orgId),
  ])
  
  const totalAnggota = anggota.data?.length || 0
  const anggotaAktif = anggota.data?.filter(a => a.status === 'AKTIF').length || 0
  const totalProyek = proyek.data?.length || 0
  const proyekAktif = proyek.data?.filter(p => p.status === 'AKTIF' || p.status === 'PENDANAAN').length || 0
  const totalModal = proyek.data?.reduce((sum, p) => sum + Number(p.modal_terkumpul || 0), 0) || 0
  const totalSimpananPokok = simpananPokok.data?.reduce((sum, s) => sum + Number(s.jumlah || 0), 0) || 0
  const totalShahibulMaal = shahibulMaal.data?.length || 0
  
  return {
    totalAnggota, anggotaAktif,
    totalProyek, proyekAktif,
    totalModal, totalSimpananPokok, totalShahibulMaal,
  }
}
