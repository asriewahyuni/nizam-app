'use server'

import ExcelJS from 'exceljs'
import { createSaleEntry } from '@/modules/sales/actions/sales.actions'
import { createPurchaseEntry } from '@/modules/purchasing/actions/purchasing.actions'
import { getContacts } from '@/modules/contacts/actions/contact.actions'
import { createJournalEntry } from '@/modules/accounting/actions/journal.actions'
import { getChartOfAccounts } from '@/modules/accounting/actions/coa.actions'
import { createClient } from '@/lib/supabase/server'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface BulkImportRow {
  row_no: number
  header: Record<string, string | number | null>
  items: Record<string, string | number | null>[]
}

export interface BulkPreviewRow {
  row_no: number
  contact_name: string
  contact_id: string | null
  tanggal: string
  termin: string
  jatuh_tempo: string | null
  diskon_global: number
  pajak_persen: number
  biaya_lain_label?: string
  biaya_lain_nominal?: number
  biaya_kirim?: number
  asuransi?: number
  catatan: string
  items: BulkPreviewItem[]
  errors: string[]
  warnings: string[]
}

export interface BulkPreviewItem {
  nama_produk: string
  jumlah: number
  satuan: string
  harga_satuan: number
  diskon_item: number
}

export interface BulkImportResult {
  success: boolean
  created: number
  failed: number
  rows: { row_no: number; status: 'ok' | 'error'; ref?: string; error?: string }[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

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
  // ExcelJS may return a Date object for date cells
  if (v instanceof Date) {
    const y = v.getFullYear()
    const m = String(v.getMonth() + 1).padStart(2, '0')
    const d = String(v.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  const s = String(v).trim()
  // Accept YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  // Try to parse loose formats
  const parsed = new Date(s)
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear()
    const m = String(parsed.getMonth() + 1).padStart(2, '0')
    const d = String(parsed.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  return null
}

function normalizeTermin(v: unknown): 'LUNAS' | 'TEMPO' {
  const s = asString(v).toUpperCase()
  return s === 'LUNAS' ? 'LUNAS' : 'TEMPO'
}

// ─────────────────────────────────────────────────────────────────────────────
// Parse XLSX buffer → raw rows
// ─────────────────────────────────────────────────────────────────────────────

async function parseXlsx(buffer: ArrayBuffer, type: 'sales' | 'purchase'): Promise<BulkImportRow[]> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer)

  const headerSheet = type === 'sales'
    ? wb.getWorksheet('HEADER_PENJUALAN')
    : wb.getWorksheet('HEADER_PEMBELIAN')

  const itemSheet = type === 'sales'
    ? wb.getWorksheet('ITEM_PENJUALAN')
    : wb.getWorksheet('ITEM_PEMBELIAN')

  if (!headerSheet || !itemSheet) {
    throw new Error('Sheet tidak ditemukan. Pastikan menggunakan template resmi Nizam.')
  }

  // Parse header rows (skip title row 1 + column header row 2, start data from row 3)
  const headersByRowNo: Map<number, Record<string, unknown>> = new Map()
  let headerColNames: string[] = []

  headerSheet.eachRow((row, rowIndex) => {
    if (rowIndex === 1) return // title
    if (rowIndex === 2) {
      // column headers
      row.eachCell((cell, colIndex) => {
        headerColNames[colIndex] = asString(cell.value).replace('*', '').trim()
      })
      return
    }
    const obj: Record<string, unknown> = {}
    row.eachCell({ includeEmpty: false }, (cell, colIndex) => {
      const key = headerColNames[colIndex]
      if (key) obj[key] = cell.value
    })
    const rowNo = asNumber(obj['row_no'])
    if (rowNo > 0) headersByRowNo.set(rowNo, obj)
  })

  // Parse item rows
  const itemsByRowNo: Map<number, Record<string, unknown>[]> = new Map()
  let itemColNames: string[] = []

  itemSheet.eachRow((row, rowIndex) => {
    if (rowIndex === 1) return
    if (rowIndex === 2) {
      row.eachCell((cell, colIndex) => {
        itemColNames[colIndex] = asString(cell.value).replace('*', '').trim()
      })
      return
    }
    const obj: Record<string, unknown> = {}
    row.eachCell({ includeEmpty: false }, (cell, colIndex) => {
      const key = itemColNames[colIndex]
      if (key) obj[key] = cell.value
    })
    const rowNo = asNumber(obj['row_no'])
    if (rowNo > 0) {
      if (!itemsByRowNo.has(rowNo)) itemsByRowNo.set(rowNo, [])
      itemsByRowNo.get(rowNo)!.push(obj)
    }
  })

  const result: BulkImportRow[] = []
  for (const [rowNo, header] of headersByRowNo) {
    result.push({
      row_no: rowNo,
      header: header as Record<string, string | number | null>,
      items: (itemsByRowNo.get(rowNo) || []) as Record<string, string | number | null>[],
    })
  }

  return result.sort((a, b) => a.row_no - b.row_no)
}

// ─────────────────────────────────────────────────────────────────────────────
// Server Action: Parse & validate (returns preview for review)
// ─────────────────────────────────────────────────────────────────────────────

export async function parseBulkImportFile(
  orgId: string,
  fileBase64: string,
  type: 'sales' | 'purchase'
): Promise<{ rows: BulkPreviewRow[]; error?: string }> {
  try {
    const buffer = Buffer.from(fileBase64, 'base64').buffer as ArrayBuffer
    const rawRows = await parseXlsx(buffer, type)

    if (rawRows.length === 0) {
      return { rows: [], error: 'Tidak ada data ditemukan. Pastikan file sesuai template.' }
    }

    // Load contacts for name → ID resolution
    const contacts = await getContacts(orgId, type === 'sales' ? 'CUSTOMER' : 'SUPPLIER')
    const contactMap = new Map<string, string>(
      (contacts as any[]).map((c: any) => [String(c.name || '').toLowerCase().trim(), c.id])
    )

    const previewRows: BulkPreviewRow[] = rawRows.map(raw => {
      const h = raw.header
      const errors: string[] = []
      const warnings: string[] = []

      // Resolve contact
      const contactName = asString(h['nama_customer'] ?? h['nama_vendor'])
      const contactId = contactMap.get(contactName.toLowerCase()) ?? null
      if (!contactName) {
        errors.push(`row_no ${raw.row_no}: Nama ${type === 'sales' ? 'customer' : 'vendor'} kosong.`)
      } else if (!contactId) {
        errors.push(`row_no ${raw.row_no}: "${contactName}" tidak ditemukan di database kontak.`)
      }

      // Date validation
      const tanggal = asDate(h['tanggal'])
      if (!tanggal) errors.push(`row_no ${raw.row_no}: Format tanggal tidak valid.`)

      const termin = normalizeTermin(h['termin'])
      const jatuh_tempo = asDate(h['jatuh_tempo'])
      if (termin === 'TEMPO' && !jatuh_tempo) {
        warnings.push(`row_no ${raw.row_no}: Termin TEMPO tapi jatuh_tempo kosong.`)
      }

      // Items validation
      const items: BulkPreviewItem[] = raw.items.map((it, idx) => {
        const nama = asString(it['nama_produk'])
        const jumlah = asNumber(it['jumlah'])
        const harga = asNumber(it[type === 'sales' ? 'harga_satuan' : 'harga_beli'])

        if (!nama) errors.push(`row_no ${raw.row_no} item ${idx + 1}: Nama produk kosong.`)
        if (jumlah <= 0) errors.push(`row_no ${raw.row_no} item ${idx + 1}: Jumlah harus > 0.`)
        if (harga <= 0) errors.push(`row_no ${raw.row_no} item ${idx + 1}: Harga harus > 0.`)

        return {
          nama_produk: nama,
          jumlah,
          satuan: asString(it['satuan']) || 'Pcs',
          harga_satuan: harga,
          diskon_item: asNumber(it['diskon_item']),
        }
      })

      if (items.length === 0) {
        errors.push(`row_no ${raw.row_no}: Tidak ada item produk.`)
      }

      const previewRow: BulkPreviewRow = {
        row_no: raw.row_no,
        contact_name: contactName,
        contact_id: contactId,
        tanggal: tanggal || '',
        termin,
        jatuh_tempo,
        diskon_global: asNumber(h['diskon_global']),
        pajak_persen: asNumber(h['pajak_persen']),
        catatan: asString(h['catatan']),
        items,
        errors,
        warnings,
      }

      if (type === 'sales') {
        previewRow.biaya_lain_label = asString(h['biaya_lain_label']) || undefined
        previewRow.biaya_lain_nominal = asNumber(h['biaya_lain_nominal']) || undefined
      } else {
        previewRow.biaya_kirim = asNumber(h['biaya_kirim']) || undefined
        previewRow.asuransi = asNumber(h['asuransi']) || undefined
      }

      return previewRow
    })

    return { rows: previewRows }
  } catch (e: any) {
    return { rows: [], error: e?.message || 'Gagal memproses file.' }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Server Action: Execute bulk import (create drafts)
// ─────────────────────────────────────────────────────────────────────────────

export async function executeBulkImport(
  orgId: string,
  rows: BulkPreviewRow[],
  type: 'sales' | 'purchase'
): Promise<BulkImportResult> {
  const results: BulkImportResult['rows'] = []
  let created = 0
  let failed = 0

  const validRows = rows.filter(r => r.errors.length === 0 && r.contact_id)

  for (const row of validRows) {
    try {
      const subtotal = row.items.reduce((s, i) => s + i.jumlah * i.harga_satuan, 0)
      const taxableBase = Math.max(0, subtotal - row.diskon_global)
      const taxAmount = row.pajak_persen > 0 ? Math.round(taxableBase * row.pajak_persen / 100) : 0

      if (type === 'sales') {
        const payload = {
          customer_id: row.contact_id!,
          sale_date: row.tanggal,
          due_date: row.jatuh_tempo || null,
          payment_term: row.termin as 'LUNAS' | 'TEMPO',
          notes: row.catatan || '',
          discount_amount: row.diskon_global,
          tax_amount: taxAmount,
          tax_breakdown: row.pajak_persen > 0
            ? { PPN: { mode: 'PERCENT', value: row.pajak_persen, amount: taxAmount } }
            : {},
          other_charge_breakdown: row.biaya_lain_label && (row.biaya_lain_nominal ?? 0) > 0
            ? [{ label: row.biaya_lain_label, mode: 'FIXED', value: row.biaya_lain_nominal, amount: row.biaya_lain_nominal }]
            : [],
          other_charge_amount: row.biaya_lain_nominal ?? 0,
          shariah_mode: 'CASH',
          mode: 'DRAFT',
          lines: row.items.map(it => ({
            product_name: it.nama_produk,
            quantity: it.jumlah,
            unit_price: it.harga_satuan,
            discount_amount: it.diskon_item,
          })),
        }
        const res = await createSaleEntry(orgId, payload)
        if ('error' in res && res.error) {
          results.push({ row_no: row.row_no, status: 'error', error: res.error })
          failed++
        } else {
          results.push({ row_no: row.row_no, status: 'ok', ref: (res as any).saleId })
          created++
        }
      } else {
        const payload = {
          vendor_id: row.contact_id!,
          purchase_date: row.tanggal,
          due_date: row.jatuh_tempo || undefined,
          payment_term: row.termin as 'LUNAS' | 'TEMPO',
          notes: row.catatan || '',
          discount_amount: row.diskon_global,
          tax_amount: taxAmount,
          shipping_amount: row.biaya_kirim ?? 0,
          insurance_amount: row.asuransi ?? 0,
          shariah_mode: 'CASH' as const,
          mode: 'DRAFT' as const,
          lines: row.items.map(it => ({
            product_name: it.nama_produk,
            quantity: it.jumlah,
            unit: it.satuan || 'Pcs',
            unit_price: it.harga_satuan,
            discount_amount: it.diskon_item,
          })),
        }
        const res = await createPurchaseEntry(orgId, payload)
        if ('error' in res && res.error) {
          results.push({ row_no: row.row_no, status: 'error', error: res.error })
          failed++
        } else {
          results.push({ row_no: row.row_no, status: 'ok', ref: (res as any).purchaseId })
          created++
        }
      }
    } catch (e: any) {
      results.push({ row_no: row.row_no, status: 'error', error: e?.message || 'Error tidak diketahui' })
      failed++
    }
  }

  // Mark rows with pre-existing errors as failed
  rows.filter(r => r.errors.length > 0 || !r.contact_id).forEach(r => {
    results.push({ row_no: r.row_no, status: 'error', error: r.errors[0] || 'Validasi gagal' })
    failed++
  })

  return {
    success: failed === 0,
    created,
    failed,
    rows: results.sort((a, b) => a.row_no - b.row_no),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// JURNAL MANUAL — Types
// ─────────────────────────────────────────────────────────────────────────────

export interface JournalPreviewLine {
  kode_akun: string
  account_id: string | null
  account_name: string
  debit: number
  kredit: number
  memo_baris: string
}

export interface JournalPreviewEntry {
  no_jurnal: number
  tanggal: string
  deskripsi: string
  catatan: string
  lines: JournalPreviewLine[]
  total_debit: number
  total_kredit: number
  is_balanced: boolean
  errors: string[]
}

export interface JournalImportResult {
  success: boolean
  created: number
  failed: number
  rows: { no_jurnal: number; status: 'ok' | 'error'; entry_id?: string; error?: string }[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Parse file Excel jurnal
// ─────────────────────────────────────────────────────────────────────────────

export async function parseBulkJournalFile(
  orgId: string,
  fileBase64: string
): Promise<{ entries: JournalPreviewEntry[]; error?: string }> {
  try {
    const buffer = Buffer.from(fileBase64, 'base64').buffer as ArrayBuffer
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buffer)

    const sheet = wb.getWorksheet('JURNAL_MANUAL')
    if (!sheet) {
      return { entries: [], error: 'Sheet "JURNAL_MANUAL" tidak ditemukan. Pastikan menggunakan template resmi Nizam.' }
    }

    // Parse column headers from row 2
    let colNames: string[] = []
    sheet.getRow(2).eachCell((cell, colIndex) => {
      colNames[colIndex] = asString(cell.value).replace('*', '').trim()
    })

    // Collect raw rows (skip title row 1 + header row 2)
    const rawRows: Record<string, unknown>[] = []
    sheet.eachRow((row, rowIndex) => {
      if (rowIndex <= 2) return
      const obj: Record<string, unknown> = {}
      row.eachCell({ includeEmpty: false }, (cell, colIndex) => {
        const key = colNames[colIndex]
        if (key) obj[key] = cell.value
      })
      const noJurnal = asNumber(obj['no_jurnal'])
      if (noJurnal > 0) rawRows.push(obj)
    })

    if (rawRows.length === 0) {
      return { entries: [], error: 'Tidak ada data ditemukan. Pastikan template sudah diisi.' }
    }

    // Load CoA for code → UUID resolution
    const accounts = await getChartOfAccounts(orgId) as any[]
    const codeMap = new Map<string, { id: string; name: string }>(
      accounts.map((a: any) => [String(a.code || '').trim(), { id: a.id, name: a.name }])
    )

    // Group by no_jurnal
    const grouped = new Map<number, Record<string, unknown>[]>()
    for (const row of rawRows) {
      const key = asNumber(row['no_jurnal'])
      if (!grouped.has(key)) grouped.set(key, [])
      grouped.get(key)!.push(row)
    }

    // Build preview entries
    const entries: JournalPreviewEntry[] = []
    for (const [noJurnal, rows] of Array.from(grouped.entries()).sort(([a], [b]) => a - b)) {
      const errors: string[] = []

      // Take tanggal/deskripsi/catatan from first non-empty row
      const firstWithDate = rows.find(r => r['tanggal']) || rows[0]
      const tanggal = asDate(firstWithDate['tanggal']) || ''
      const deskripsi = asString(firstWithDate['deskripsi'] || rows[0]['deskripsi'])
      const catatan = asString(rows.find(r => r['catatan'])?.['catatan'] || '')

      if (!tanggal) errors.push(`no_jurnal ${noJurnal}: Format tanggal tidak valid.`)
      if (!deskripsi) errors.push(`no_jurnal ${noJurnal}: Deskripsi wajib diisi.`)

      const lines: JournalPreviewLine[] = rows.map((row, idx) => {
        const kode = asString(row['kode_akun'])
        const acc = codeMap.get(kode)
        if (!kode) errors.push(`no_jurnal ${noJurnal} baris ${idx + 1}: kode_akun kosong.`)
        else if (!acc) errors.push(`no_jurnal ${noJurnal}: Kode akun "${kode}" tidak ditemukan di CoA.`)

        const debit = asNumber(row['debit'])
        const kredit = asNumber(row['kredit'])
        if (debit === 0 && kredit === 0) {
          errors.push(`no_jurnal ${noJurnal} baris ${idx + 1}: debit dan kredit keduanya 0.`)
        }
        if (debit > 0 && kredit > 0) {
          errors.push(`no_jurnal ${noJurnal} baris ${idx + 1}: satu baris tidak boleh mengisi debit DAN kredit sekaligus.`)
        }

        return {
          kode_akun: kode,
          account_id: acc?.id || null,
          account_name: acc?.name || '—',
          debit,
          kredit,
          memo_baris: asString(row['memo_baris']),
        }
      })

      const total_debit  = lines.reduce((s, l) => s + l.debit,  0)
      const total_kredit = lines.reduce((s, l) => s + l.kredit, 0)
      const is_balanced  = Math.abs(total_debit - total_kredit) < 0.01

      if (!is_balanced) {
        errors.push(`no_jurnal ${noJurnal}: Tidak balance — Debit ${total_debit.toLocaleString('id-ID')} ≠ Kredit ${total_kredit.toLocaleString('id-ID')}`)
      }
      if (lines.length < 2) {
        errors.push(`no_jurnal ${noJurnal}: Minimal 2 baris jurnal.`)
      }

      entries.push({ no_jurnal: noJurnal, tanggal, deskripsi, catatan, lines, total_debit, total_kredit, is_balanced, errors })
    }

    return { entries }
  } catch (e: any) {
    return { entries: [], error: e?.message || 'Gagal memproses file.' }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Execute bulk journal import (create drafts)
// ─────────────────────────────────────────────────────────────────────────────

export async function executeBulkJournalImport(
  orgId: string,
  entries: JournalPreviewEntry[]
): Promise<JournalImportResult> {
  const results: JournalImportResult['rows'] = []
  let created = 0
  let failed = 0

  const validEntries = entries.filter(e => e.errors.length === 0 && e.is_balanced)

  for (const entry of validEntries) {
    try {
      const res = await createJournalEntry({
        org_id: orgId,
        entry_date: entry.tanggal,
        description: entry.deskripsi,
        notes: entry.catatan || undefined,
        auto_post: false,
        lines: entry.lines.map(l => ({
          account_id: l.account_id!,
          debit: l.debit,
          credit: l.kredit,
          memo: l.memo_baris || undefined,
        })),
      })

      if ((res as any).error) {
        results.push({ no_jurnal: entry.no_jurnal, status: 'error', error: (res as any).error })
        failed++
      } else {
        results.push({ no_jurnal: entry.no_jurnal, status: 'ok', entry_id: (res as any).id })
        created++
      }
    } catch (e: any) {
      results.push({ no_jurnal: entry.no_jurnal, status: 'error', error: e?.message || 'Error tidak diketahui' })
      failed++
    }
  }

  // Mark pre-invalid entries as failed
  entries.filter(e => e.errors.length > 0 || !e.is_balanced).forEach(e => {
    results.push({ no_jurnal: e.no_jurnal, status: 'error', error: e.errors[0] || 'Validasi gagal' })
    failed++
  })

  return {
    success: failed === 0,
    created,
    failed,
    rows: results.sort((a, b) => a.no_jurnal - b.no_jurnal),
  }
}
