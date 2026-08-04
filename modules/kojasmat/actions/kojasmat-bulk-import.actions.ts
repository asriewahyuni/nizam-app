'use server'

// Bulk import Kojasmat — anggota, saldo simpanan awal, dan proyek dari template Excel.
// Eksekusi memanggil createAnggota/updateAnggota/catatSimpananMutasi/createProyek yang sudah
// ada supaya validasi bisnis & integrasi jurnal ERP tetap konsisten dengan alur manual.

import ExcelJS from 'exceljs'
import { queryPostgres } from '@/lib/db/postgres'
import { getInternalAuthSession } from '@/lib/auth/internal-auth.server'
import { createAnggota, updateAnggota, catatSimpananMutasi, createProyek } from './kojasmat.actions'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AnggotaPreviewRow {
  row_no: number
  nik: string
  nama: string
  phone: string
  email: string
  alamat: string
  pekerjaan: string
  joined_at: string
  status: string
  is_verified: boolean
  notes: string
  errors: string[]
}

export interface SimpananPreviewRow {
  row_no: number
  nik_anggota: string
  resolved: boolean
  jenis: 'POKOK' | 'WAJIB' | 'SUKARELA' | ''
  saldo_awal: number
  tanggal: string
  keterangan: string
  errors: string[]
}

export interface ProyekPreviewRow {
  row_no: number
  nik_pengaju: string
  resolved: boolean
  nama_proyek: string
  jenis_akad: 'MURABAHAH' | 'MUDHARABAH' | 'INAN' | ''
  kebutuhan_modal: number
  ujrah_nominal: number
  durasi_bulan: number
  deskripsi: string
  agunan: string
  notes: string
  errors: string[]
}

export interface KojasmatBulkPreview {
  anggota: AnggotaPreviewRow[]
  simpanan: SimpananPreviewRow[]
  proyek: ProyekPreviewRow[]
  error?: string
}

export interface AnggotaCredentialRow {
  row_no: number
  kode_anggota: string
  nama: string
  login_identifier: string
  temp_password: string
}

export interface KojasmatBulkImportResult {
  success: boolean
  anggota_created: number
  simpanan_created: number
  proyek_created: number
  failed: number
  rows: { row_no: number; entity: 'ANGGOTA' | 'SIMPANAN' | 'PROYEK'; status: 'ok' | 'error'; error?: string }[]
  credentials: AnggotaCredentialRow[]
}

const STATUS_VALUES = new Set(['CALON', 'AKTIF', 'TIDAK_AKTIF', 'DIBEKUKAN'])
const JENIS_SIMPANAN_VALUES = new Set(['POKOK', 'WAJIB', 'SUKARELA'])
const JENIS_AKAD_VALUES = new Set(['MURABAHAH', 'MUDHARABAH', 'INAN'])

// ─── Helpers ────────────────────────────────────────────────────────────────

function asString(v: unknown): string {
  if (v == null) return ''
  return String(v).trim()
}

function asNumber(v: unknown, fallback = 0): number {
  const n = parseFloat(String(v ?? ''))
  return isNaN(n) ? fallback : n
}

function asDate(v: unknown): string | null {
  if (!v) return null
  if (v instanceof Date) {
    const y = v.getFullYear()
    const m = String(v.getMonth() + 1).padStart(2, '0')
    const d = String(v.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  const s = String(v).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const parsed = new Date(s)
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear()
    const m = String(parsed.getMonth() + 1).padStart(2, '0')
    const d = String(parsed.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  return null
}

function today(): string {
  return new Date().toISOString().split('T')[0]
}

function readSheetRows(sheet: ExcelJS.Worksheet | undefined): Record<string, unknown>[] {
  if (!sheet) return []
  let colNames: string[] = []
  const rows: Record<string, unknown>[] = []
  sheet.eachRow((row, rowIndex) => {
    if (rowIndex === 1) return // title
    if (rowIndex === 2) {
      row.eachCell((cell, colIndex) => {
        colNames[colIndex] = asString(cell.value).replace('*', '').trim()
      })
      return
    }
    const obj: Record<string, unknown> = {}
    row.eachCell({ includeEmpty: false }, (cell, colIndex) => {
      const key = colNames[colIndex]
      if (key) obj[key] = cell.value
    })
    if (Object.keys(obj).length > 0) rows.push(obj)
  })
  return rows
}

function isValidNik(nik: string): boolean {
  return /^\d{16}$/.test(nik)
}

// ─── Parse & validate ───────────────────────────────────────────────────────

export async function parseKojasmatBulkImportFile(
  orgId: string,
  fileBase64: string
): Promise<KojasmatBulkPreview> {
  try {
    const buffer = Buffer.from(fileBase64, 'base64').buffer as ArrayBuffer
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buffer)

    const anggotaSheet = wb.getWorksheet('ANGGOTA')
    const simpananSheet = wb.getWorksheet('SIMPANAN_AWAL')
    const proyekSheet = wb.getWorksheet('PROYEK')

    if (!anggotaSheet && !simpananSheet && !proyekSheet) {
      return { anggota: [], simpanan: [], proyek: [], error: 'Sheet tidak ditemukan. Pastikan menggunakan template resmi bulk import Kojasmat.' }
    }

    // NIK anggota yang sudah ada di database org ini (untuk resolusi & cek duplikat)
    const { rows: existing } = await queryPostgres(
      `SELECT nik FROM kojasmat_anggota WHERE org_id=$1 AND nik IS NOT NULL`,
      [orgId]
    )
    const existingNiks = new Set(existing.map(r => asString(r.nik)))

    // ── ANGGOTA ────────────────────────────────────────────────────────────
    const rawAnggota = readSheetRows(anggotaSheet)
    const seenNiks = new Set<string>()
    const anggota: AnggotaPreviewRow[] = rawAnggota.map((raw, idx) => {
      const row_no = idx + 1
      const errors: string[] = []
      const nik = asString(raw['nik'])
      const nama = asString(raw['nama'])
      const statusRaw = asString(raw['status']).toUpperCase() || 'CALON'
      const isVerifiedRaw = asString(raw['is_verified']).toUpperCase()

      if (!nik) errors.push(`Baris ${row_no}: NIK wajib diisi.`)
      else if (!isValidNik(nik)) errors.push(`Baris ${row_no}: NIK harus 16 digit angka.`)
      else if (existingNiks.has(nik)) errors.push(`Baris ${row_no}: NIK ${nik} sudah terdaftar sebagai anggota.`)
      else if (seenNiks.has(nik)) errors.push(`Baris ${row_no}: NIK ${nik} duplikat di dalam file.`)
      else seenNiks.add(nik)

      if (!nama) errors.push(`Baris ${row_no}: Nama wajib diisi.`)
      if (!STATUS_VALUES.has(statusRaw)) errors.push(`Baris ${row_no}: status "${statusRaw}" tidak valid (CALON/AKTIF/TIDAK_AKTIF/DIBEKUKAN).`)

      const joinedAtRaw = raw['joined_at']
      const joined_at = joinedAtRaw ? asDate(joinedAtRaw) : today()
      if (joinedAtRaw && !joined_at) errors.push(`Baris ${row_no}: Format joined_at tidak valid.`)

      return {
        row_no, nik, nama,
        phone: asString(raw['phone']),
        email: asString(raw['email']),
        alamat: asString(raw['alamat']),
        pekerjaan: asString(raw['pekerjaan']),
        joined_at: joined_at || today(),
        status: STATUS_VALUES.has(statusRaw) ? statusRaw : 'CALON',
        is_verified: isVerifiedRaw === 'YA',
        notes: asString(raw['notes']),
        errors,
      }
    })

    // Kumpulan NIK yang bisa dirujuk sheet lain: sudah ada di DB, atau valid & baru di file ini
    const resolvableNiks = new Set<string>(existingNiks)
    anggota.filter(a => a.errors.length === 0).forEach(a => resolvableNiks.add(a.nik))

    // ── SIMPANAN_AWAL ──────────────────────────────────────────────────────
    const rawSimpanan = readSheetRows(simpananSheet)
    const simpanan: SimpananPreviewRow[] = rawSimpanan.map((raw, idx) => {
      const row_no = idx + 1
      const errors: string[] = []
      const nik_anggota = asString(raw['nik_anggota'])
      const jenisRaw = asString(raw['jenis']).toUpperCase()
      const saldo_awal = asNumber(raw['saldo_awal'])
      const resolved = resolvableNiks.has(nik_anggota)

      if (!nik_anggota) errors.push(`Baris ${row_no}: nik_anggota wajib diisi.`)
      else if (!resolved) errors.push(`Baris ${row_no}: NIK ${nik_anggota} tidak ditemukan di sheet ANGGOTA maupun data yang sudah ada.`)

      if (!JENIS_SIMPANAN_VALUES.has(jenisRaw)) errors.push(`Baris ${row_no}: jenis "${jenisRaw}" tidak valid (POKOK/WAJIB/SUKARELA).`)
      if (saldo_awal <= 0) errors.push(`Baris ${row_no}: saldo_awal harus > 0.`)

      const tanggalRaw = raw['tanggal']
      const tanggal = tanggalRaw ? asDate(tanggalRaw) : today()
      if (tanggalRaw && !tanggal) errors.push(`Baris ${row_no}: Format tanggal tidak valid.`)

      return {
        row_no, nik_anggota, resolved,
        jenis: JENIS_SIMPANAN_VALUES.has(jenisRaw) ? (jenisRaw as SimpananPreviewRow['jenis']) : '',
        saldo_awal,
        tanggal: tanggal || today(),
        keterangan: asString(raw['keterangan']),
        errors,
      }
    })

    // ── PROYEK ─────────────────────────────────────────────────────────────
    const rawProyek = readSheetRows(proyekSheet)
    const proyek: ProyekPreviewRow[] = rawProyek.map((raw, idx) => {
      const row_no = idx + 1
      const errors: string[] = []
      const nik_pengaju = asString(raw['nik_pengaju'])
      const nama_proyek = asString(raw['nama_proyek'])
      const jenisAkadRaw = asString(raw['jenis_akad']).toUpperCase()
      const kebutuhan_modal = asNumber(raw['kebutuhan_modal'])
      const resolved = resolvableNiks.has(nik_pengaju)

      if (!nik_pengaju) errors.push(`Baris ${row_no}: nik_pengaju wajib diisi.`)
      else if (!resolved) errors.push(`Baris ${row_no}: NIK ${nik_pengaju} tidak ditemukan di sheet ANGGOTA maupun data yang sudah ada.`)

      if (!nama_proyek) errors.push(`Baris ${row_no}: nama_proyek wajib diisi.`)
      if (!JENIS_AKAD_VALUES.has(jenisAkadRaw)) errors.push(`Baris ${row_no}: jenis_akad "${jenisAkadRaw}" tidak valid (MURABAHAH/MUDHARABAH/INAN).`)
      if (kebutuhan_modal <= 0) errors.push(`Baris ${row_no}: kebutuhan_modal harus > 0.`)

      return {
        row_no, nik_pengaju, resolved, nama_proyek,
        jenis_akad: JENIS_AKAD_VALUES.has(jenisAkadRaw) ? (jenisAkadRaw as ProyekPreviewRow['jenis_akad']) : '',
        kebutuhan_modal,
        ujrah_nominal: asNumber(raw['ujrah_nominal']),
        durasi_bulan: asNumber(raw['durasi_bulan']) || 6,
        deskripsi: asString(raw['deskripsi']),
        agunan: asString(raw['agunan']),
        notes: asString(raw['notes']),
        errors,
      }
    })

    if (anggota.length === 0 && simpanan.length === 0 && proyek.length === 0) {
      return { anggota: [], simpanan: [], proyek: [], error: 'Tidak ada data ditemukan. Pastikan template sudah diisi.' }
    }

    return { anggota, simpanan, proyek }
  } catch (e: any) {
    return { anggota: [], simpanan: [], proyek: [], error: e?.message || 'Gagal memproses file.' }
  }
}

// ─── Execute ────────────────────────────────────────────────────────────────

export async function executeKojasmatBulkImport(
  orgId: string,
  preview: KojasmatBulkPreview
): Promise<KojasmatBulkImportResult> {
  const session = await getInternalAuthSession()
  if (!session) {
    return { success: false, anggota_created: 0, simpanan_created: 0, proyek_created: 0, failed: 1, rows: [{ row_no: 0, entity: 'ANGGOTA', status: 'error', error: 'Tidak terautentikasi' }], credentials: [] }
  }

  const rows: KojasmatBulkImportResult['rows'] = []
  const credentials: AnggotaCredentialRow[] = []
  let anggotaCreated = 0, simpananCreated = 0, proyekCreated = 0, failed = 0

  // nik → anggota_id, mulai dari yang sudah ada di database
  const { rows: existing } = await queryPostgres(
    `SELECT id, nik FROM kojasmat_anggota WHERE org_id=$1 AND nik IS NOT NULL`,
    [orgId]
  )
  const nikToId = new Map<string, string>(existing.map(r => [asString(r.nik), r.id as string]))

  // 1. Anggota dulu — entitas lain merujuk ke sini
  for (const a of preview.anggota) {
    if (a.errors.length > 0) {
      rows.push({ row_no: a.row_no, entity: 'ANGGOTA', status: 'error', error: a.errors[0] })
      failed++
      continue
    }
    const res = await createAnggota({
      org_id: orgId,
      nama: a.nama,
      nik: a.nik,
      email: a.email || undefined,
      phone: a.phone || undefined,
      alamat: a.alamat || undefined,
      pekerjaan: a.pekerjaan || undefined,
      joined_at: a.joined_at || undefined,
      notes: a.notes || undefined,
    })
    if (res.error || !res.data) {
      rows.push({ row_no: a.row_no, entity: 'ANGGOTA', status: 'error', error: res.error || 'Gagal membuat anggota' })
      failed++
      continue
    }
    nikToId.set(a.nik, res.data.id)
    anggotaCreated++
    if (res.tempPassword && res.loginIdentifier) {
      credentials.push({
        row_no: a.row_no,
        kode_anggota: res.data.kode_anggota,
        nama: a.nama,
        login_identifier: res.loginIdentifier,
        temp_password: res.tempPassword,
      })
    }

    // Set status/verifikasi kalau bukan default (CALON/belum terverifikasi)
    if (a.status !== 'CALON' || a.is_verified) {
      await updateAnggota(res.data.id, {
        nama: a.nama,
        nik: a.nik,
        email: a.email || undefined,
        phone: a.phone || undefined,
        alamat: a.alamat || undefined,
        pekerjaan: a.pekerjaan || undefined,
        status: a.status as any,
        is_verified: a.is_verified,
        joined_at: a.joined_at || undefined,
        notes: a.notes || undefined,
      })
    }
    rows.push({ row_no: a.row_no, entity: 'ANGGOTA', status: 'ok' })
  }

  // 2. Saldo simpanan awal
  for (const s of preview.simpanan) {
    if (s.errors.length > 0) {
      rows.push({ row_no: s.row_no, entity: 'SIMPANAN', status: 'error', error: s.errors[0] })
      failed++
      continue
    }
    const anggotaId = nikToId.get(s.nik_anggota)
    if (!anggotaId) {
      rows.push({ row_no: s.row_no, entity: 'SIMPANAN', status: 'error', error: `NIK ${s.nik_anggota} gagal diresolusi` })
      failed++
      continue
    }
    const res = await catatSimpananMutasi({
      org_id: orgId,
      anggota_id: anggotaId,
      jenis_simpanan: s.jenis as 'POKOK' | 'WAJIB' | 'SUKARELA',
      jenis_mutasi: 'SETOR',
      jumlah: s.saldo_awal,
      keterangan: s.keterangan || 'Saldo awal (bulk import)',
      tanggal: s.tanggal,
    })
    if (res.error) {
      rows.push({ row_no: s.row_no, entity: 'SIMPANAN', status: 'error', error: res.error })
      failed++
      continue
    }
    simpananCreated++
    rows.push({ row_no: s.row_no, entity: 'SIMPANAN', status: 'ok' })
  }

  // 3. Proyek
  for (const p of preview.proyek) {
    if (p.errors.length > 0) {
      rows.push({ row_no: p.row_no, entity: 'PROYEK', status: 'error', error: p.errors[0] })
      failed++
      continue
    }
    const pengajuId = nikToId.get(p.nik_pengaju)
    if (!pengajuId) {
      rows.push({ row_no: p.row_no, entity: 'PROYEK', status: 'error', error: `NIK ${p.nik_pengaju} gagal diresolusi` })
      failed++
      continue
    }
    const res = await createProyek({
      org_id: orgId,
      pengaju_id: pengajuId,
      nama_proyek: p.nama_proyek,
      deskripsi: p.deskripsi || undefined,
      jenis_akad: p.jenis_akad as 'MURABAHAH' | 'MUDHARABAH' | 'INAN',
      kebutuhan_modal: p.kebutuhan_modal,
      ujrah_nominal: p.ujrah_nominal || undefined,
      durasi_bulan: p.durasi_bulan || undefined,
      agunan: p.agunan || undefined,
      notes: p.notes || undefined,
    })
    if (res.error) {
      rows.push({ row_no: p.row_no, entity: 'PROYEK', status: 'error', error: res.error })
      failed++
      continue
    }
    proyekCreated++
    rows.push({ row_no: p.row_no, entity: 'PROYEK', status: 'ok' })
  }

  return {
    success: failed === 0,
    anggota_created: anggotaCreated,
    simpanan_created: simpananCreated,
    proyek_created: proyekCreated,
    failed,
    rows,
    credentials,
  }
}
