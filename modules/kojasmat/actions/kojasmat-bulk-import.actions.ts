'use server'

// Bulk import Kojasmat — anggota, saldo simpanan awal, dan proyek dari template Excel.
// Eksekusi memanggil createAnggota/updateAnggota/catatSimpananMutasi/createProyek yang sudah
// ada supaya validasi bisnis & integrasi jurnal ERP tetap konsisten dengan alur manual.

import ExcelJS from 'exceljs'
import { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import { queryPostgres, connectPostgresClient } from '@/lib/db/postgres'
import { getInternalAuthSession } from '@/lib/auth/internal-auth.server'
import { voidJournalEntry } from '@/modules/accounting/actions/journal.actions'
import { createAnggota, updateAnggota, catatSimpananMutasi, createProyek, isOrgAdminOrManajemen } from './kojasmat.actions'

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
  resolved_nik: string
  jenis: 'POKOK' | 'WAJIB' | 'SUKARELA' | 'PROYEK' | 'HIBAH_NAMETAG' | 'HIBAH_MEMBERCARD' | 'HIBAH_KAJIAN' | 'HIBAH_BOP' | ''
  saldo_awal: number
  tanggal: string
  keterangan: string
  errors: string[]
}

export interface ProyekPreviewRow {
  row_no: number
  nik_pengaju: string
  resolved: boolean
  resolved_nik: string
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
  import_batch_id: string
}

export interface KojasmatBulkRollbackResult {
  success: boolean
  mutasi_dihapus: number
  simpanan_disesuaikan: number
  proyek_dihapus: number
  proyek_dilewati: { kode_proyek: string; nama_proyek: string; reason: string }[]
  anggota_dihapus: number
  anggota_dilewati: { kode_anggota: string; nama: string; reason: string }[]
  jurnal_gagal_void: { journal_entry_id: string; error: string }[]
  error?: string
}

const STATUS_VALUES = new Set(['CALON', 'AKTIF', 'TIDAK_AKTIF', 'DIBEKUKAN'])
const JENIS_SIMPANAN_VALUES = new Set(['POKOK', 'WAJIB', 'SUKARELA', 'PROYEK'])
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

// Sebagian besar KTP di file migrasi punya spasi pemisah kelompok digit
// (mis. "3273 0302 0975 0003") — bukan format DB, jadi harus dirapikan dulu
// sebelum divalidasi supaya tidak salah dianggap NIK bermasalah.
function normalizeNik(v: unknown): string {
  return asString(v).replace(/\s+/g, '')
}

// NIK sementara untuk anggota yang datanya tidak punya NIK asli valid (kosong,
// bukan 16 digit, atau dipakai berulang oleh banyak orang berbeda — biasa
// terjadi di file migrasi lama yang pakai NIK placeholder generik). Prefix
// "999999" tidak pernah dipakai sebagai kode wilayah KTP asli, jadi baris ini
// mudah difilter staf untuk dilengkapi KTP aslinya belakangan.
function generateSyntheticNik(seq: number): string {
  return '999999' + String(seq).padStart(10, '0')
}

async function nextSyntheticNikSeq(): Promise<number> {
  const { rows } = await queryPostgres(
    `SELECT nik FROM kojasmat_anggota WHERE nik LIKE '999999%' AND nik ~ '^999999[0-9]{10}$' ORDER BY nik DESC LIMIT 1`
  )
  const last = rows[0]?.nik ? String(rows[0].nik).slice(6) : '0'
  const n = parseInt(last, 10)
  return (isNaN(n) ? 0 : n) + 1
}

// Resolusi referensi NIK dari sheet SIMPANAN_AWAL/PROYEK ke anggota. Prioritas:
// 1) Cocok langsung ke NIK final (anggota baru yang NIK-nya valid apa adanya,
//    atau anggota yang sudah ada di database).
// 2) NIK di file ini cocok dengan NIK ASLI (sebelum diganti sementara) salah
//    satu baris ANGGOTA — kalau cuma satu kandidat, langsung dipakai.
// 3) Kalau NIK asli itu dipakai >1 anggota (placeholder bersama), disambiguasi
//    lewat kolom nama (kalau sheet menyediakannya) — HARUS cocok persis satu.
//    Kalau tetap ambigu, jangan menebak — kembalikan sebagai tidak terselesaikan.
function resolveNikReference(
  rawNik: unknown,
  rawNama: unknown,
  resolvableNiks: Set<string>,
  byOriginalNik: Map<string, { finalNik: string; nama: string }[]>
): { resolved: boolean; finalNik: string; error?: string } {
  const nik = normalizeNik(rawNik)
  if (resolvableNiks.has(nik)) return { resolved: true, finalNik: nik }

  const candidates = byOriginalNik.get(nik)
  if (!candidates || candidates.length === 0) {
    return { resolved: false, finalNik: nik }
  }
  if (candidates.length === 1) {
    return { resolved: true, finalNik: candidates[0].finalNik }
  }
  const namaNorm = asString(rawNama).toLowerCase()
  if (namaNorm) {
    const match = candidates.filter(c => c.nama.toLowerCase() === namaNorm)
    if (match.length === 1) return { resolved: true, finalNik: match[0].finalNik }
  }
  return {
    resolved: false,
    finalNik: nik,
    error: `NIK ${nik || '(kosong)'} dipakai oleh ${candidates.length} anggota berbeda di sheet ANGGOTA — tidak bisa ditentukan otomatis, lengkapi NIK/nama secara manual.`,
  }
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

    // Hitung kemunculan tiap NIK (setelah normalisasi spasi) di dalam file —
    // dipakai untuk mendeteksi NIK placeholder yang dipakai berulang untuk
    // banyak anggota berbeda (mis. migrasi data lama tanpa KTP asli per orang).
    const nikOccurrences = new Map<string, number>()
    rawAnggota.forEach(raw => {
      const nik = normalizeNik(raw['nik'])
      if (nik) nikOccurrences.set(nik, (nikOccurrences.get(nik) || 0) + 1)
    })

    const seenNiks = new Set<string>()
    const byOriginalNik = new Map<string, { finalNik: string; nama: string }[]>()
    let syntheticSeq = await nextSyntheticNikSeq()
    const usedSyntheticNiks = new Set<string>()

    const anggota: AnggotaPreviewRow[] = rawAnggota.map((raw, idx) => {
      const row_no = idx + 1
      const errors: string[] = []
      const originalNik = normalizeNik(raw['nik'])
      const nama = asString(raw['nama'])
      const statusRaw = asString(raw['status']).toUpperCase() || 'CALON'
      const isVerifiedRaw = asString(raw['is_verified']).toUpperCase()
      let notes = asString(raw['notes'])

      let nik = originalNik
      const nikBermasalah =
        !originalNik
        || !isValidNik(originalNik)
        || existingNiks.has(originalNik)
        || (nikOccurrences.get(originalNik) || 0) > 1

      if (nikBermasalah && nama) {
        // NIK kosong/format salah/dipakai berulang — generate NIK sementara
        // yang unik supaya anggota tetap bisa masuk, alih-alih menolak
        // seluruh baris. NIK asli (kalau ada) disimpan di notes untuk
        // verifikasi KTP manual belakangan.
        do {
          nik = generateSyntheticNik(syntheticSeq++)
        } while (usedSyntheticNiks.has(nik) || existingNiks.has(nik))
        usedSyntheticNiks.add(nik)
        const originalLabel = originalNik || '(kosong)'
        notes = notes
          ? `${notes} | NIK sementara — NIK asli di file: ${originalLabel}, perlu verifikasi KTP.`
          : `NIK sementara — NIK asli di file: ${originalLabel}, perlu verifikasi KTP.`
      } else if (nikBermasalah && !nama) {
        errors.push(`Baris ${row_no}: NIK bermasalah dan nama kosong — tidak bisa diproses.`)
      } else if (seenNiks.has(nik)) {
        errors.push(`Baris ${row_no}: NIK ${nik} duplikat di dalam file.`)
      }
      if (nik && errors.length === 0) seenNiks.add(nik)

      if (!nama) errors.push(`Baris ${row_no}: Nama wajib diisi.`)
      if (!STATUS_VALUES.has(statusRaw)) errors.push(`Baris ${row_no}: status "${statusRaw}" tidak valid (CALON/AKTIF/TIDAK_AKTIF/DIBEKUKAN).`)

      const joinedAtRaw = raw['joined_at']
      const joined_at = joinedAtRaw ? asDate(joinedAtRaw) : today()
      if (joinedAtRaw && !joined_at) errors.push(`Baris ${row_no}: Format joined_at tidak valid.`)

      const result: AnggotaPreviewRow = {
        row_no, nik, nama,
        phone: asString(raw['phone']),
        email: asString(raw['email']),
        alamat: asString(raw['alamat']),
        pekerjaan: asString(raw['pekerjaan']),
        joined_at: joined_at || today(),
        status: STATUS_VALUES.has(statusRaw) ? statusRaw : 'CALON',
        is_verified: isVerifiedRaw === 'YA',
        notes,
        errors,
      }

      if (errors.length === 0) {
        const list = byOriginalNik.get(originalNik) || []
        list.push({ finalNik: nik, nama })
        byOriginalNik.set(originalNik, list)
      }

      return result
    })

    // Kumpulan NIK yang bisa dirujuk sheet lain: sudah ada di DB, atau valid & baru di file ini
    const resolvableNiks = new Set<string>(existingNiks)
    anggota.filter(a => a.errors.length === 0).forEach(a => resolvableNiks.add(a.nik))

    // ── SIMPANAN_AWAL ──────────────────────────────────────────────────────
    const rawSimpanan = readSheetRows(simpananSheet)
    const simpanan: SimpananPreviewRow[] = rawSimpanan.map((raw, idx) => {
      const row_no = idx + 1
      const errors: string[] = []
      const nik_anggota = normalizeNik(raw['nik_anggota'])
      const jenisRaw = asString(raw['jenis']).toUpperCase()
      const saldo_awal = asNumber(raw['saldo_awal'])
      const ref = resolveNikReference(nik_anggota, raw['nama'], resolvableNiks, byOriginalNik)
      const resolved = ref.resolved

      if (!nik_anggota) errors.push(`Baris ${row_no}: nik_anggota wajib diisi.`)
      else if (!resolved) errors.push(ref.error || `Baris ${row_no}: NIK ${nik_anggota} tidak ditemukan di sheet ANGGOTA maupun data yang sudah ada.`)

      if (!JENIS_SIMPANAN_VALUES.has(jenisRaw)) errors.push(`Baris ${row_no}: jenis "${jenisRaw}" tidak valid (POKOK/WAJIB/SUKARELA/PROYEK).`)
      if (saldo_awal <= 0) errors.push(`Baris ${row_no}: saldo_awal harus > 0.`)

      const tanggalRaw = raw['tanggal']
      const tanggal = tanggalRaw ? asDate(tanggalRaw) : today()
      if (tanggalRaw && !tanggal) errors.push(`Baris ${row_no}: Format tanggal tidak valid.`)

      return {
        row_no, nik_anggota, resolved, resolved_nik: ref.finalNik,
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
      const nik_pengaju = normalizeNik(raw['nik_pengaju'])
      const nama_proyek = asString(raw['nama_proyek'])
      const jenisAkadRaw = asString(raw['jenis_akad']).toUpperCase()
      const kebutuhan_modal = asNumber(raw['kebutuhan_modal'])
      // Sheet PROYEK tidak punya kolom nama pengaju (cuma nama_proyek), jadi
      // kalau NIK ambigu (dipakai >1 anggota placeholder) tidak bisa
      // didisambiguasi otomatis — akan dilaporkan sebagai error, bukan ditebak.
      const ref = resolveNikReference(nik_pengaju, undefined, resolvableNiks, byOriginalNik)
      const resolved = ref.resolved

      if (!nik_pengaju) errors.push(`Baris ${row_no}: nik_pengaju wajib diisi.`)
      else if (!resolved) errors.push(ref.error || `Baris ${row_no}: NIK ${nik_pengaju} tidak ditemukan di sheet ANGGOTA maupun data yang sudah ada.`)

      if (!nama_proyek) errors.push(`Baris ${row_no}: nama_proyek wajib diisi.`)
      if (!JENIS_AKAD_VALUES.has(jenisAkadRaw)) errors.push(`Baris ${row_no}: jenis_akad "${jenisAkadRaw}" tidak valid (MURABAHAH/MUDHARABAH/INAN).`)
      if (kebutuhan_modal <= 0) errors.push(`Baris ${row_no}: kebutuhan_modal harus > 0.`)

      return {
        row_no, nik_pengaju, resolved, resolved_nik: ref.finalNik, nama_proyek,
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
    return { success: false, anggota_created: 0, simpanan_created: 0, proyek_created: 0, failed: 1, rows: [{ row_no: 0, entity: 'ANGGOTA', status: 'error', error: 'Tidak terautentikasi' }], credentials: [], import_batch_id: '' }
  }

  // Semua record yang berhasil dibuat di eksekusi ini ditandai dengan batch id
  // yang sama, supaya kalau ada kesalahan (mis. salah upload file / salah
  // pemetaan NIK) bisa dibatalkan secara presisi lewat rollbackKojasmatBulkImport
  // tanpa menyentuh data lain di luar batch ini.
  const importBatchId = randomUUID()

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
    await queryPostgres(`UPDATE kojasmat_anggota SET import_batch_id=$2 WHERE id=$1`, [res.data.id, importBatchId])
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
    const anggotaId = nikToId.get(s.resolved_nik || s.nik_anggota)
    if (!anggotaId) {
      rows.push({ row_no: s.row_no, entity: 'SIMPANAN', status: 'error', error: `NIK ${s.nik_anggota} gagal diresolusi` })
      failed++
      continue
    }
    const res = await catatSimpananMutasi({
      org_id: orgId,
      anggota_id: anggotaId,
      jenis_simpanan: s.jenis as 'POKOK' | 'WAJIB' | 'SUKARELA' | 'PROYEK' | 'HIBAH_NAMETAG' | 'HIBAH_MEMBERCARD' | 'HIBAH_KAJIAN' | 'HIBAH_BOP',
      jenis_mutasi: 'SETOR',
      jumlah: s.saldo_awal,
      keterangan: s.keterangan || 'Saldo awal (bulk import)',
      tanggal: s.tanggal,
    })
    if (!('data' in res) || !res.data) {
      rows.push({ row_no: s.row_no, entity: 'SIMPANAN', status: 'error', error: 'error' in res ? res.error : 'Gagal mencatat setoran' })
      failed++
      continue
    }
    if (res.data.mutasi_id) {
      await queryPostgres(`UPDATE kojasmat_simpanan_mutasi SET import_batch_id=$2 WHERE id=$1`, [res.data.mutasi_id, importBatchId])
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
    const pengajuId = nikToId.get(p.resolved_nik || p.nik_pengaju)
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
    if (!('data' in res) || !res.data) {
      rows.push({ row_no: p.row_no, entity: 'PROYEK', status: 'error', error: 'error' in res ? res.error : 'Gagal membuat proyek' })
      failed++
      continue
    }
    await queryPostgres(`UPDATE kojasmat_proyek SET import_batch_id=$2 WHERE id=$1`, [res.data.id, importBatchId])
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
    import_batch_id: importBatchId,
  }
}

// ─── Rollback ───────────────────────────────────────────────────────────────

// Membatalkan satu eksekusi bulk import secara presisi lewat import_batch_id
// yang ditandai di setiap record yang dibuat (lihat executeKojasmatBulkImport).
// Urutan aman:
//   1. Void jurnal akuntansi dari tiap setoran simpanan lewat voidJournalEntry
//      resmi (bukan raw delete) — supaya lolos cek periode tutup buku & tetap
//      tercatat di audit trail (voided_by/voided_at/reason).
//   2. Kurangi saldo kojasmat_simpanan sebesar TOTAL yang ditambahkan batch ini
//      (delta murni, bukan restore ke nilai lama) — aman walau ada aktivitas
//      lain sebelum/sesudah batch pada rekening yang sama.
//   3. Hapus proyek dari batch ini yang MASIH DRAFT & belum ada dana masuk.
//      Proyek yang sudah diproses (status lain / modal_terkumpul > 0) TIDAK
//      disentuh — dianggap sudah jadi transaksi nyata, bukan cuma data import.
//   4. Hapus anggota baru dari batch ini — HANYA kalau belum ada aktivitas
//      keuangan lain di luar batch (guard yang sama dengan deleteAnggota).
//      Anggota yang sudah beraktivitas lebih lanjut TIDAK dihapus otomatis.
export async function rollbackKojasmatBulkImport(
  orgId: string,
  importBatchId: string
): Promise<KojasmatBulkRollbackResult> {
  const empty = (): KojasmatBulkRollbackResult => ({
    success: false,
    mutasi_dihapus: 0,
    simpanan_disesuaikan: 0,
    proyek_dihapus: 0,
    proyek_dilewati: [],
    anggota_dihapus: 0,
    anggota_dilewati: [],
    jurnal_gagal_void: [],
  })

  const session = await getInternalAuthSession()
  if (!session) return { ...empty(), error: 'Tidak terautentikasi' }
  if (!(await isOrgAdminOrManajemen(session.user.id, orgId))) {
    return { ...empty(), error: 'Hanya owner/admin/manager yang dapat membatalkan bulk import.' }
  }
  if (!importBatchId) return { ...empty(), error: 'import_batch_id tidak valid.' }

  const { rows: mutasiRows } = await queryPostgres(
    `SELECT id, journal_entry_id FROM kojasmat_simpanan_mutasi WHERE org_id=$1 AND import_batch_id=$2`,
    [orgId, importBatchId]
  )
  const jurnalGagalVoid: KojasmatBulkRollbackResult['jurnal_gagal_void'] = []
  for (const m of mutasiRows) {
    if (!m.journal_entry_id) continue
    const res = await voidJournalEntry(
      m.journal_entry_id as string,
      orgId,
      `Rollback bulk import Kojasmat (batch ${importBatchId})`
    )
    if ('error' in res) {
      jurnalGagalVoid.push({ journal_entry_id: m.journal_entry_id as string, error: res.error })
    }
  }

  const client = await connectPostgresClient()
  let simpananDisesuaikan = 0
  let proyekDihapus = 0
  const proyekDilewati: KojasmatBulkRollbackResult['proyek_dilewati'] = []
  let anggotaDihapus = 0
  const anggotaDilewati: KojasmatBulkRollbackResult['anggota_dilewati'] = []

  try {
    await client.query('BEGIN')

    const { rowCount } = await client.query(
      `UPDATE kojasmat_simpanan s
       SET saldo = s.saldo - batch.total, updated_at = NOW()
       FROM (
         SELECT simpanan_id, SUM(jumlah) AS total
         FROM kojasmat_simpanan_mutasi
         WHERE org_id=$1 AND import_batch_id=$2
         GROUP BY simpanan_id
       ) batch
       WHERE s.id = batch.simpanan_id`,
      [orgId, importBatchId]
    )
    simpananDisesuaikan = rowCount || 0

    await client.query(
      `DELETE FROM kojasmat_simpanan_mutasi WHERE org_id=$1 AND import_batch_id=$2`,
      [orgId, importBatchId]
    )

    const { rows: proyekRows } = await client.query(
      `SELECT id, kode_proyek, nama_proyek, status, modal_terkumpul
       FROM kojasmat_proyek WHERE org_id=$1 AND import_batch_id=$2`,
      [orgId, importBatchId]
    )
    for (const p of proyekRows) {
      if (p.status === 'DRAFT' && Number(p.modal_terkumpul) === 0) {
        await client.query(`DELETE FROM kojasmat_proyek WHERE id=$1`, [p.id])
        proyekDihapus++
      } else {
        proyekDilewati.push({
          kode_proyek: p.kode_proyek,
          nama_proyek: p.nama_proyek,
          reason: `Status sudah "${p.status}" / dana terkumpul Rp${Number(p.modal_terkumpul).toLocaleString('id-ID')} — tidak dihapus otomatis.`,
        })
      }
    }

    const { rows: anggotaRows } = await client.query(
      `SELECT id, kode_anggota, nama FROM kojasmat_anggota WHERE org_id=$1 AND import_batch_id=$2`,
      [orgId, importBatchId]
    )
    for (const a of anggotaRows) {
      const { rows: [counts] } = await client.query(
        `SELECT
           (SELECT COUNT(*) FROM kojasmat_simpanan_mutasi WHERE anggota_id=$1)::int AS mutasi,
           (SELECT COUNT(*) FROM kojasmat_proyek WHERE pengaju_id=$1)::int AS proyek,
           (SELECT COUNT(*) FROM kojasmat_pembiayaan WHERE pemodal_id=$1)::int AS pembiayaan,
           (SELECT COUNT(*) FROM kojasmat_penawaran WHERE anggota_id=$1)::int AS penawaran,
           (SELECT COUNT(*) FROM kojasmat_bagi_hasil WHERE pemodal_id=$1)::int AS bagi_hasil`,
        [a.id]
      )
      const hasActivity = counts.mutasi > 0 || counts.proyek > 0 || counts.pembiayaan > 0 || counts.penawaran > 0 || counts.bagi_hasil > 0
      if (hasActivity) {
        anggotaDilewati.push({
          kode_anggota: a.kode_anggota,
          nama: a.nama,
          reason: 'Sudah ada aktivitas lain (proyek/simpanan/pembiayaan) sejak diimport — hapus manual lewat halaman Anggota kalau memang perlu.',
        })
        continue
      }
      await client.query(`DELETE FROM kojasmat_anggota WHERE id=$1`, [a.id])
      anggotaDihapus++
    }

    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    client.release()
    return { ...empty(), error: error instanceof Error ? error.message : 'Gagal rollback bulk import' }
  }
  client.release()

  revalidatePath('/kojasmat')
  return {
    success: true,
    mutasi_dihapus: mutasiRows.length,
    simpanan_disesuaikan: simpananDisesuaikan,
    proyek_dihapus: proyekDihapus,
    proyek_dilewati: proyekDilewati,
    anggota_dihapus: anggotaDihapus,
    anggota_dilewati: anggotaDilewati,
    jurnal_gagal_void: jurnalGagalVoid,
  }
}
