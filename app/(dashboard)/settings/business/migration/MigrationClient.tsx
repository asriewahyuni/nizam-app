'use client'

import Link from 'next/link'
import { useMemo, useRef, useState, type ChangeEvent } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FolderInput,
  ListChecks,
  ShieldCheck,
  Upload,
  XCircle,
} from 'lucide-react'
import { PageHeader, SafeButton, SectionCard, SectionHeader, StatCard } from '@/components/ui/NizamUI'
import {
  importCoaMigration,
  importEmployeesMigration,
  importFixedAssetsMigration,
  importManufacturingMigration,
  importOpeningCashBankMigration,
  importMasterDataMigration,
  importOpeningApMigration,
  importOpeningArMigration,
  importOpeningStockMigration,
  type CoaImportResult,
  type EmployeesImportResult,
  type FixedAssetsImportResult,
  type OpeningCashBankImportResult,
  type ManufacturingImportResult,
  type MasterDataImportResult,
  type OpeningApImportResult,
  type OpeningArImportResult,
  type OpeningStockImportResult,
} from '@/modules/settings/actions/migration.actions'

type ValidationSeverity = 'ok' | 'warning' | 'blocked'

type SheetSchema = {
  name: string
  columns: string[]
  requiredFields?: string[]
  enumFields?: Record<string, string[]>
  booleanFields?: string[]
  numericFields?: string[]
  dateFields?: string[]
}

type SheetIssue = {
  severity: Exclude<ValidationSeverity, 'ok'>
  message: string
}

type SampleRow = {
  rowNumber: number
  values: Record<string, string>
}

type SheetReport = {
  name: string
  status: ValidationSeverity
  rowCount: number
  missingColumns: string[]
  extraColumns: string[]
  issues: SheetIssue[]
  rows: SampleRow[]
  samples: SampleRow[]
}

type WorkbookReport = {
  fileName: string
  sheetReports: SheetReport[]
  detectedSheetNames: string[]
}

type MigrationSection = {
  id: string
  title: string
  description: string
  sheets: string[]
  nextStep: string
}

type SectionReport = MigrationSection & {
  status: ValidationSeverity
  rowCount: number
  issueCount: number
  sheetReports: SheetReport[]
}

type ImportSummaryCard = {
  label: string
  summary: {
    created: number
    updated: number
    skipped: number
    errors: string[]
  }
}

type FlowStageStatus = 'upcoming' | 'active' | 'done' | 'attention'

type FlowStage = {
  id: string
  step: number
  title: string
  description: string
  status: FlowStageStatus
}

const SHEET_SCHEMAS: SheetSchema[] = [
  {
    name: 'coa',
    columns: ['kode_akun', 'nama_akun', 'kategori_utama', 'sub_kategori', 'parent_kode', 'level', 'tipe_akun', 'saldo_normal', 'arus_kas', 'aktif', 'deskripsi'],
    requiredFields: ['kode_akun', 'nama_akun', 'kategori_utama', 'level', 'tipe_akun', 'saldo_normal', 'aktif'],
    booleanFields: ['aktif'],
    numericFields: ['level'],
    enumFields: {
      kategori_utama: ['Aset', 'Liabilitas', 'Kewajiban', 'Ekuitas', 'Modal', 'Pendapatan', 'Pemasukan', 'Penjualan', 'HPP', 'Beban', 'Beban Operasional', 'Beban Lainnya', 'Biaya'],
      tipe_akun: ['HEADER', 'DETAIL'],
      saldo_normal: ['DEBIT', 'CREDIT'],
      arus_kas: ['OPERATING', 'INVESTING', 'FINANCING'],
    },
  },
  {
    name: 'coa_mapping',
    columns: ['legacy_account_code', 'legacy_account_name', 'nizam_account_code', 'nizam_account_name', 'notes'],
  },
  {
    name: 'customers',
    columns: ['customer_code', 'customer_name', 'phone', 'email', 'address', 'city', 'payment_term_days', 'npwp', 'is_active', 'notes'],
    requiredFields: ['customer_name'],
    booleanFields: ['is_active'],
    numericFields: ['payment_term_days'],
  },
  {
    name: 'suppliers',
    columns: ['supplier_code', 'supplier_name', 'phone', 'email', 'address', 'city', 'payment_term_days', 'npwp', 'is_active', 'notes'],
    requiredFields: ['supplier_name'],
    booleanFields: ['is_active'],
    numericFields: ['payment_term_days'],
  },
  {
    name: 'products',
    columns: ['sku', 'product_name', 'type', 'category', 'unit', 'purchase_price', 'selling_price', 'warehouse_default', 'is_active', 'notes'],
    requiredFields: ['sku', 'product_name', 'type'],
    booleanFields: ['is_active'],
    numericFields: ['purchase_price', 'selling_price'],
    enumFields: {
      type: ['INVENTORY', 'SERVICE'],
    },
  },
  {
    name: 'warehouses',
    columns: ['warehouse_code', 'warehouse_name', 'branch_name', 'address', 'is_active', 'notes'],
    requiredFields: ['warehouse_name'],
    booleanFields: ['is_active'],
  },
  {
    name: 'opening_stock',
    columns: ['sku', 'product_name', 'warehouse_name', 'qty', 'unit_cost', 'total_value', 'batch_number', 'bin_name', 'notes'],
    requiredFields: ['warehouse_name', 'qty'],
    numericFields: ['qty', 'unit_cost', 'total_value'],
  },
  {
    name: 'opening_ar',
    columns: ['customer_name', 'invoice_number', 'invoice_date', 'due_date', 'outstanding_amount', 'branch_name', 'notes'],
    requiredFields: ['customer_name', 'outstanding_amount'],
    numericFields: ['outstanding_amount'],
    dateFields: ['invoice_date', 'due_date'],
  },
  {
    name: 'opening_ap',
    columns: ['supplier_name', 'bill_number', 'bill_date', 'due_date', 'outstanding_amount', 'branch_name', 'notes'],
    requiredFields: ['supplier_name', 'outstanding_amount'],
    numericFields: ['outstanding_amount'],
    dateFields: ['bill_date', 'due_date'],
  },
  {
    name: 'opening_cash_bank',
    columns: ['account_code', 'account_name', 'account_type', 'balance', 'branch_name', 'notes'],
    requiredFields: ['account_name', 'account_type', 'balance'],
    numericFields: ['balance'],
    enumFields: {
      account_type: ['CASH', 'BANK'],
    },
  },
  {
    name: 'fixed_assets',
    columns: ['asset_code', 'asset_name', 'acquisition_date', 'acquisition_cost', 'accumulated_depreciation', 'useful_life_months', 'residual_value', 'branch_name', 'notes'],
    requiredFields: ['asset_name', 'acquisition_cost'],
    numericFields: ['acquisition_cost', 'accumulated_depreciation', 'useful_life_months', 'residual_value'],
    dateFields: ['acquisition_date'],
  },
  {
    name: 'bom',
    columns: ['bom_code', 'output_sku', 'output_name', 'output_qty', 'component_sku', 'component_name', 'component_qty', 'component_unit', 'notes'],
    requiredFields: ['output_sku', 'component_sku', 'component_qty'],
    numericFields: ['output_qty', 'component_qty'],
  },
  {
    name: 'employees',
    columns: ['employee_code', 'employee_name', 'email', 'phone', 'department', 'position', 'join_date', 'employment_status', 'basic_salary', 'is_active', 'notes'],
    requiredFields: ['employee_name'],
    booleanFields: ['is_active'],
    numericFields: ['basic_salary'],
    dateFields: ['join_date'],
    enumFields: {
      employment_status: ['Tetap', 'Kontrak', 'Magang', 'Freelance'],
    },
  },
]

const MIGRATION_SECTIONS: MigrationSection[] = [
  {
    id: 'coa',
    title: 'Chart of Accounts',
    description: 'Struktur rekening utama yang akan dipakai modul akuntansi, cash, stok, piutang, hutang, dan laporan keuangan.',
    sheets: ['coa'],
    nextStep: 'Pastikan hierarki parent-child, saldo normal, dan kategori akun sudah final sebelum bagian lain diproses.',
  },
  {
    id: 'master-data',
    title: 'Master Data',
    description: 'Customer, supplier, produk, gudang, dan lampiran mapping legacy. Ini fondasi utama sebelum opening balance diproses.',
    sheets: ['coa_mapping', 'customers', 'suppliers', 'products', 'warehouses'],
    nextStep: 'Pastikan master data sudah bersih sebelum lanjut ke opening stock dan opening balances.',
  },
  {
    id: 'opening-stock',
    title: 'Opening Stock',
    description: 'Stok awal per produk per gudang beserta nilai persediaannya.',
    sheets: ['opening_stock'],
    nextStep: 'Qty dan nilai stok harus cocok dengan sumber final sebelum diposting ke sistem.',
  },
  {
    id: 'opening-ar',
    title: 'Opening Piutang',
    description: 'Daftar invoice customer yang masih outstanding saat cut-off.',
    sheets: ['opening_ar'],
    nextStep: 'Cek nomor invoice, tanggal, jatuh tempo, dan outstanding amount agar aging tidak salah.',
  },
  {
    id: 'opening-ap',
    title: 'Opening Hutang',
    description: 'Daftar tagihan supplier yang masih outstanding saat pindah ke NIZAM.',
    sheets: ['opening_ap'],
    nextStep: 'Pastikan bill number dan due date rapi sebelum bagian hutang diimpor.',
  },
  {
    id: 'cash-bank',
    title: 'Kas & Bank',
    description: 'Saldo pembuka kas dan bank yang akan jadi basis rekonsiliasi harian.',
    sheets: ['opening_cash_bank'],
    nextStep: 'Saldo kas dan bank harus sama dengan angka sumber per tanggal cut-off.',
  },
  {
    id: 'fixed-assets',
    title: 'Aset Tetap',
    description: 'Aset, nilai perolehan, akumulasi penyusutan, umur manfaat, dan nilai residu.',
    sheets: ['fixed_assets'],
    nextStep: 'Aset tetap sebaiknya diproses setelah neraca pembuka utama sudah stabil.',
  },
  {
    id: 'manufacturing',
    title: 'Manufaktur',
    description: 'Struktur BoM untuk client yang langsung memakai manufacturing saat go-live.',
    sheets: ['bom'],
    nextStep: 'BoM idealnya diproses setelah master produk sudah lolos validasi penuh.',
  },
  {
    id: 'employees',
    title: 'Karyawan',
    description: 'Master karyawan untuk client yang akan mengaktifkan HRIS atau payroll.',
    sheets: ['employees'],
    nextStep: 'Data karyawan sebaiknya bersih dulu sebelum modul HRIS atau payroll dibuka ke user.',
  },
]

const migrationSteps = [
  {
    title: 'Tentukan cut-off',
    description: 'Sepakati kapan sistem lama berhenti dipakai dan kapan transaksi mulai dicatat di NIZAM.',
  },
  {
    title: 'Buat periode fiskal dulu',
    description: 'Periode aktif harus sudah ada sebelum input saldo awal, tetapi jangan dikunci sebelum rekonsiliasi final selesai.',
  },
  {
    title: 'Rapikan CoA & master data',
    description: 'Finalkan struktur akun, lalu bersihkan SKU, satuan, kategori produk, cabang, gudang, dan mapping legacy sebelum import.',
  },
  {
    title: 'Validasi per bagian',
    description: 'Satu workbook tetap dipakai, tetapi pengecekan dilakukan per bagian agar lebih aman.',
  },
  {
    title: 'Rekonsiliasi lalu go-live',
    description: 'Pastikan kas, persediaan, piutang, hutang, dan ekuitas pembuka sudah cocok sebelum operasional berjalan.',
  },
]

const requiredFiles = [
  'Neraca per tanggal cut-off',
  'Laba rugi tahun berjalan',
  'Daftar kas dan bank',
  'Piutang outstanding',
  'Hutang outstanding',
  'Stok per produk per gudang',
  'Master customer, supplier, dan produk',
  'CoA final + mapping legacy, jika migrasi dari aplikasi lain',
]

const supportItems = [
  'Menentukan strategi cut-off yang aman',
  'Mapping CoA lama ke CoA NIZAM dan impor sheet coa',
  'Pembersihan master data dan kategori produk',
  'Penyusunan template migrasi client',
  'Validasi neraca pembuka dan nilai persediaan',
  'Pendampingan rekonsiliasi hingga go-live',
]

function normalizeText(value: unknown) {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (typeof value === 'object' && value && 'text' in value) {
    const richText = value as { text?: unknown }
    return typeof richText.text === 'string' ? richText.text.trim() : ''
  }
  return String(value).trim()
}

function isBlank(value: string) {
  return value.trim().length === 0
}

function isNumericText(value: string) {
  if (isBlank(value)) return true
  return Number.isFinite(Number(value))
}

function isBooleanText(value: string) {
  if (isBlank(value)) return true
  return ['TRUE', 'FALSE'].includes(value.toUpperCase())
}

function isDateValue(raw: unknown, text: string) {
  if (raw instanceof Date) return true
  if (typeof raw === 'number') return true
  if (isBlank(text)) return true
  return /^\d{4}-\d{2}-\d{2}$/.test(text)
}

function resolveWorstStatus(statuses: ValidationSeverity[]): ValidationSeverity {
  if (statuses.includes('blocked')) return 'blocked'
  if (statuses.includes('warning')) return 'warning'
  return 'ok'
}

function getStatusTone(status: ValidationSeverity) {
  if (status === 'blocked') return 'rose'
  if (status === 'warning') return 'amber'
  return 'emerald'
}

function getStatusLabel(status: ValidationSeverity) {
  if (status === 'blocked') return 'Blocked'
  if (status === 'warning') return 'Warning'
  return 'Siap Dicek'
}

function getToneClasses(status: ValidationSeverity) {
  const tone = getStatusTone(status)
  if (tone === 'rose') return 'border-rose-200 bg-rose-50 text-rose-800'
  if (tone === 'amber') return 'border-amber-200 bg-amber-50 text-amber-800'
  return 'border-emerald-200 bg-emerald-50 text-emerald-800'
}

function StatusIcon({ status, size }: { status: ValidationSeverity; size: number }) {
  if (status === 'blocked') return <XCircle size={size} />
  if (status === 'warning') return <AlertTriangle size={size} />
  return <CheckCircle2 size={size} />
}

function getFlowStageClasses(status: FlowStageStatus) {
  if (status === 'attention') return 'border-amber-200 bg-amber-50 text-amber-800'
  if (status === 'active') return 'border-blue-200 bg-blue-50 text-blue-800'
  if (status === 'done') return 'border-emerald-200 bg-emerald-50 text-emerald-800'
  return 'border-slate-200 bg-white text-slate-500'
}

function FlowStageIcon({ status, step }: { status: FlowStageStatus; step: number }) {
  if (status === 'done') return <CheckCircle2 size={18} />
  if (status === 'attention') return <AlertTriangle size={18} />
  if (status === 'active') return <ShieldCheck size={18} />
  return <span className="text-sm font-black">{step}</span>
}

async function parseWorkbook(file: File): Promise<WorkbookReport> {
  const ExcelJSImport = await import('exceljs')
  const ExcelJS = ExcelJSImport.default ?? ExcelJSImport
  const workbook = new ExcelJS.Workbook()
  const buffer = await file.arrayBuffer()
  try {
    await workbook.xlsx.load(buffer)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    // ExcelJS browser parser can choke on workbook comments/legacy drawing notes.
    // The migration validator does not depend on those nodes, so we retry without them.
    if (message.includes("reading 'comments'")) {
      await workbook.xlsx.load(buffer, { ignoreNodes: ['comments', 'legacyDrawing'] })
    } else {
      throw error
    }
  }

  const detectedSheetNames = workbook.worksheets.map((worksheet) => worksheet.name)
  const sheetReports: SheetReport[] = []

  for (const schema of SHEET_SCHEMAS) {
    const worksheet = workbook.getWorksheet(schema.name)
    if (!worksheet) {
      sheetReports.push({
        name: schema.name,
        status: 'blocked',
        rowCount: 0,
        missingColumns: schema.columns,
        extraColumns: [],
        issues: [{ severity: 'blocked', message: `Sheet ${schema.name} tidak ditemukan.` }],
        rows: [],
        samples: [],
      })
      continue
    }

    const actualHeaders = schema.columns.map((_, index) => normalizeText(worksheet.getRow(1).getCell(index + 1).value))
    const missingColumns = schema.columns.filter((column, index) => actualHeaders[index] !== column)

    const extraColumns: string[] = []
    for (let index = schema.columns.length + 1; index <= worksheet.columnCount; index += 1) {
      const extraHeader = normalizeText(worksheet.getRow(1).getCell(index).value)
      if (!isBlank(extraHeader)) extraColumns.push(extraHeader)
    }

    const issues: SheetIssue[] = []
    const samples: SampleRow[] = []
    const rows: SampleRow[] = []
    const seenKeys = new Set<string>()
    let rowCount = 0

    if (missingColumns.length > 0) {
      issues.push({
        severity: 'blocked',
        message: `Header tidak cocok. Pastikan urutan kolom mengikuti template untuk sheet ${schema.name}.`,
      })
    }

    if (extraColumns.length > 0) {
      issues.push({
        severity: 'warning',
        message: `Ada kolom tambahan yang tidak dikenali: ${extraColumns.join(', ')}.`,
      })
    }

    for (let rowIndex = 3; rowIndex <= worksheet.rowCount; rowIndex += 1) {
      const row = worksheet.getRow(rowIndex)
      const rowValues: Record<string, string> = {}
      const rawValues: Record<string, unknown> = {}

      let hasData = false
      for (let columnIndex = 0; columnIndex < schema.columns.length; columnIndex += 1) {
        const key = schema.columns[columnIndex]
        const raw = row.getCell(columnIndex + 1).value
        const text = normalizeText(raw)
        rowValues[key] = text
        rawValues[key] = raw
        if (!isBlank(text)) hasData = true
      }

      if (!hasData) continue
      rowCount += 1
      rows.push({ rowNumber: rowIndex, values: rowValues })

      if (samples.length < 3) {
        samples.push({ rowNumber: rowIndex, values: rowValues })
      }

      for (const field of schema.requiredFields || []) {
        if (isBlank(rowValues[field] || '')) {
          issues.push({
            severity: 'blocked',
            message: `Baris ${rowIndex}: kolom ${field} wajib diisi.`,
          })
        }
      }

      for (const field of schema.booleanFields || []) {
        if (!isBooleanText(rowValues[field] || '')) {
          issues.push({
            severity: 'warning',
            message: `Baris ${rowIndex}: kolom ${field} sebaiknya TRUE atau FALSE.`,
          })
        }
      }

      for (const field of schema.numericFields || []) {
        if (!isNumericText(rowValues[field] || '')) {
          issues.push({
            severity: 'warning',
            message: `Baris ${rowIndex}: kolom ${field} harus berupa angka tanpa pemisah ribuan.`,
          })
        }
      }

      for (const field of schema.dateFields || []) {
        if (!isDateValue(rawValues[field], rowValues[field] || '')) {
          issues.push({
            severity: 'warning',
            message: `Baris ${rowIndex}: kolom ${field} sebaiknya menggunakan format YYYY-MM-DD.`,
          })
        }
      }

      for (const [field, allowedValues] of Object.entries(schema.enumFields || {})) {
        const currentValue = rowValues[field]
        if (!isBlank(currentValue) && !allowedValues.includes(currentValue)) {
          issues.push({
            severity: 'warning',
            message: `Baris ${rowIndex}: nilai ${field} (${currentValue}) tidak ada di daftar template.`,
          })
        }
      }

      if (schema.name === 'products' && !isBlank(rowValues.sku)) {
        const normalizedSku = rowValues.sku.toUpperCase()
        if (seenKeys.has(normalizedSku)) {
          issues.push({
            severity: 'blocked',
            message: `Baris ${rowIndex}: SKU ${rowValues.sku} duplikat di sheet products.`,
          })
        }
        seenKeys.add(normalizedSku)
      }

      if (schema.name === 'coa' && !isBlank(rowValues.kode_akun)) {
        const normalizedCode = rowValues.kode_akun.toUpperCase()
        if (seenKeys.has(normalizedCode)) {
          issues.push({
            severity: 'blocked',
            message: `Baris ${rowIndex}: kode_akun ${rowValues.kode_akun} duplikat di sheet coa.`,
          })
        }
        seenKeys.add(normalizedCode)

        const level = Number(String(rowValues.level || '').trim())
        if (Number.isFinite(level) && level === 1 && !isBlank(rowValues.parent_kode || '')) {
          issues.push({
            severity: 'blocked',
            message: `Baris ${rowIndex}: akun level 1 tidak boleh memiliki parent_kode.`,
          })
        }

        if (Number.isFinite(level) && level > 1 && isBlank(rowValues.parent_kode || '')) {
          issues.push({
            severity: 'blocked',
            message: `Baris ${rowIndex}: akun level ${level} wajib memiliki parent_kode.`,
          })
        }

        if (!isBlank(rowValues.parent_kode || '') && rowValues.parent_kode.toUpperCase() === normalizedCode) {
          issues.push({
            severity: 'blocked',
            message: `Baris ${rowIndex}: parent_kode tidak boleh sama dengan kode_akun.`,
          })
        }
      }
    }

    const status = resolveWorstStatus(issues.map((issue) => issue.severity))

    sheetReports.push({
      name: schema.name,
      status,
      rowCount,
      missingColumns,
      extraColumns,
      issues,
      rows,
      samples,
    })
  }

  return {
    fileName: file.name,
    sheetReports,
    detectedSheetNames,
  }
}

function SheetPreviewTable({ sheet }: { sheet: SheetReport }) {
  const schema = SHEET_SCHEMAS.find((candidate) => candidate.name === sheet.name)
  const previewColumns = schema?.columns.slice(0, 4) || []

  if (sheet.samples.length === 0 || previewColumns.length === 0) return null

  return (
    <div className="mt-4 overflow-x-auto rounded-xl border border-slate-100">
      <table className="min-w-full divide-y divide-slate-100 text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Baris</th>
            {previewColumns.map((column) => (
              <th key={`${sheet.name}-${column}`} className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {sheet.samples.map((sample) => (
            <tr key={`${sheet.name}-sample-${sample.rowNumber}`}>
              <td className="px-4 py-3 font-black text-slate-500">{sample.rowNumber}</td>
              {previewColumns.map((column) => (
                <td key={`${sheet.name}-${sample.rowNumber}-${column}`} className="px-4 py-3 font-semibold text-slate-700">
                  {sample.values[column] || '-'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SheetDetailCard({ sheet }: { sheet: SheetReport }) {
  const toneClasses = getToneClasses(sheet.status)

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-2xl border ${toneClasses}`}>
              <StatusIcon status={sheet.status} size={18} />
            </div>
            <div>
              <h4 className="text-sm font-black uppercase tracking-[0.1em] text-slate-900">{sheet.name}</h4>
              <p className="text-sm font-medium text-slate-500">
                {sheet.rowCount} baris terbaca · {getStatusLabel(sheet.status)}
              </p>
            </div>
          </div>

          {sheet.missingColumns.length > 0 ? (
            <p className="text-sm font-semibold text-rose-600">
              Kolom bermasalah: {sheet.missingColumns.join(', ')}
            </p>
          ) : null}

          {sheet.extraColumns.length > 0 ? (
            <p className="text-sm font-semibold text-amber-600">
              Kolom tambahan: {sheet.extraColumns.join(', ')}
            </p>
          ) : null}
        </div>

        <div className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] ${toneClasses}`}>
          <StatusIcon status={sheet.status} size={14} />
          {getStatusLabel(sheet.status)}
        </div>
      </div>

      {sheet.issues.length > 0 ? (
        <div className="mt-4 space-y-2">
          {sheet.issues.slice(0, 6).map((issue, index) => (
            <div
              key={`${sheet.name}-issue-${index}`}
              className={`rounded-2xl px-4 py-3 text-sm font-semibold ${
                issue.severity === 'blocked'
                  ? 'bg-rose-50 text-rose-700'
                  : 'bg-amber-50 text-amber-700'
              }`}
            >
              {issue.message}
            </div>
          ))}
          {sheet.issues.length > 6 ? (
            <div className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
              +{sheet.issues.length - 6} isu tambahan
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          Sheet ini lolos validasi dasar.
        </div>
      )}

      <SheetPreviewTable sheet={sheet} />
    </div>
  )
}

export default function MigrationClient() {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [report, setReport] = useState<WorkbookReport | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [isParsing, setIsParsing] = useState(false)
  const [isMigratingCoa, setIsMigratingCoa] = useState(false)
  const [isMigratingMasterData, setIsMigratingMasterData] = useState(false)
  const [isMigratingOpeningStock, setIsMigratingOpeningStock] = useState(false)
  const [isMigratingOpeningAr, setIsMigratingOpeningAr] = useState(false)
  const [isMigratingOpeningAp, setIsMigratingOpeningAp] = useState(false)
  const [isMigratingOpeningCashBank, setIsMigratingOpeningCashBank] = useState(false)
  const [isMigratingFixedAssets, setIsMigratingFixedAssets] = useState(false)
  const [isMigratingManufacturing, setIsMigratingManufacturing] = useState(false)
  const [isMigratingEmployees, setIsMigratingEmployees] = useState(false)
  const [coaImportResult, setCoaImportResult] = useState<CoaImportResult | null>(null)
  const [coaImportError, setCoaImportError] = useState('')
  const [masterDataImportResult, setMasterDataImportResult] = useState<MasterDataImportResult | null>(null)
  const [masterDataImportError, setMasterDataImportError] = useState('')
  const [openingStockImportResult, setOpeningStockImportResult] = useState<OpeningStockImportResult | null>(null)
  const [openingStockImportError, setOpeningStockImportError] = useState('')
  const [openingArImportResult, setOpeningArImportResult] = useState<OpeningArImportResult | null>(null)
  const [openingArImportError, setOpeningArImportError] = useState('')
  const [openingApImportResult, setOpeningApImportResult] = useState<OpeningApImportResult | null>(null)
  const [openingApImportError, setOpeningApImportError] = useState('')
  const [openingCashBankImportResult, setOpeningCashBankImportResult] = useState<OpeningCashBankImportResult | null>(null)
  const [openingCashBankImportError, setOpeningCashBankImportError] = useState('')
  const [fixedAssetsImportResult, setFixedAssetsImportResult] = useState<FixedAssetsImportResult | null>(null)
  const [fixedAssetsImportError, setFixedAssetsImportError] = useState('')
  const [manufacturingImportResult, setManufacturingImportResult] = useState<ManufacturingImportResult | null>(null)
  const [manufacturingImportError, setManufacturingImportError] = useState('')
  const [employeesImportResult, setEmployeesImportResult] = useState<EmployeesImportResult | null>(null)
  const [employeesImportError, setEmployeesImportError] = useState('')

  const summary = useMemo(() => {
    if (!report) {
      return {
        totalRows: 0,
      }
    }

    return report.sheetReports.reduce(
      (acc, sheet) => {
        acc.totalRows += sheet.rowCount
        return acc
      },
      { totalRows: 0 }
    )
  }, [report])

  const sectionReports = useMemo<SectionReport[]>(() => {
    if (!report) {
      return MIGRATION_SECTIONS.map((section) => ({
        ...section,
        status: 'warning' as const,
        rowCount: 0,
        issueCount: 0,
        sheetReports: [],
      }))
    }

    return MIGRATION_SECTIONS.map((section) => {
      const sheetReports = section.sheets
        .map((sheetName) => report.sheetReports.find((sheet) => sheet.name === sheetName))
        .filter((sheet): sheet is SheetReport => Boolean(sheet))

      return {
        ...section,
        sheetReports,
        status: resolveWorstStatus(sheetReports.map((sheet) => sheet.status)),
        rowCount: sheetReports.reduce((total, sheet) => total + sheet.rowCount, 0),
        issueCount: sheetReports.reduce((total, sheet) => total + sheet.issues.length, 0),
      }
    })
  }, [report])

  const masterDataSummaryCards = useMemo<ImportSummaryCard[]>(() => {
    if (!masterDataImportResult?.success) return []

    return [
      { label: 'Customers', summary: masterDataImportResult.summaries.customers },
      { label: 'Suppliers', summary: masterDataImportResult.summaries.suppliers },
      { label: 'Products', summary: masterDataImportResult.summaries.products },
      { label: 'Warehouses', summary: masterDataImportResult.summaries.warehouses },
    ]
  }, [masterDataImportResult])

  const coaSummaryCards = useMemo(() => {
    if (!coaImportResult?.success) return []

    return [
      { label: 'Created', value: coaImportResult.summary.created },
      { label: 'Updated', value: coaImportResult.summary.updated },
      { label: 'Header', value: coaImportResult.summary.headerRows },
      { label: 'Detail', value: coaImportResult.summary.detailRows },
    ]
  }, [coaImportResult])

  const readySectionCount = useMemo(
    () => sectionReports.filter((section) => section.status === 'ok' && section.rowCount > 0).length,
    [sectionReports]
  )

  const migratedSectionCount = useMemo(
    () => [
      coaImportResult?.success,
      masterDataImportResult?.success,
      openingStockImportResult?.success,
      openingArImportResult?.success,
      openingApImportResult?.success,
      openingCashBankImportResult?.success,
      fixedAssetsImportResult?.success,
      manufacturingImportResult?.success,
      employeesImportResult?.success,
    ].filter(Boolean).length,
    [
      coaImportResult,
      employeesImportResult,
      fixedAssetsImportResult,
      manufacturingImportResult,
      masterDataImportResult,
      openingApImportResult,
      openingArImportResult,
      openingCashBankImportResult,
      openingStockImportResult,
    ]
  )

  const hasAnyMigrationRunning =
    isMigratingCoa ||
    isMigratingMasterData ||
    isMigratingOpeningStock ||
    isMigratingOpeningAr ||
    isMigratingOpeningAp ||
    isMigratingOpeningCashBank ||
    isMigratingFixedAssets ||
    isMigratingManufacturing ||
    isMigratingEmployees

  const hasAnySuccessfulMigration = Boolean(
    coaImportResult?.success ||
    masterDataImportResult?.success ||
    openingStockImportResult?.success ||
    openingArImportResult?.success ||
    openingApImportResult?.success ||
    openingCashBankImportResult?.success ||
    fixedAssetsImportResult?.success ||
    manufacturingImportResult?.success ||
    employeesImportResult?.success
  )

  const sectionSummary = useMemo(() => {
    if (!report) {
      return {
        okSections: 0,
        warningSections: 0,
        blockedSections: 0,
      }
    }

    return sectionReports.reduce(
      (acc, section) => {
        if (section.status === 'ok') acc.okSections += 1
        if (section.status === 'warning') acc.warningSections += 1
        if (section.status === 'blocked') acc.blockedSections += 1
        return acc
      },
      { okSections: 0, warningSections: 0, blockedSections: 0 }
    )
  }, [report, sectionReports])

  const overallStatus: ValidationSeverity = sectionSummary.blockedSections > 0
    ? 'blocked'
    : sectionSummary.warningSections > 0
      ? 'warning'
      : report
        ? 'ok'
        : 'warning'

  const flowStages = useMemo<FlowStage[]>(() => {
    const hasUploadedFile = Boolean(report)

    const uploadStatus: FlowStageStatus = hasUploadedFile ? 'done' : 'active'
    const verificationStatus: FlowStageStatus = hasUploadedFile
      ? 'done'
      : isParsing
        ? 'active'
        : 'upcoming'
    const warningStatus: FlowStageStatus = !hasUploadedFile
      ? 'upcoming'
      : overallStatus === 'blocked' || overallStatus === 'warning'
        ? 'attention'
        : 'done'
    const readyStatus: FlowStageStatus = !hasUploadedFile
      ? 'upcoming'
      : readySectionCount > 0
        ? 'done'
        : 'upcoming'
    const migrateStatus: FlowStageStatus = !hasUploadedFile
      ? 'upcoming'
      : hasAnyMigrationRunning
        ? 'active'
        : migratedSectionCount > 0
          ? overallStatus === 'blocked' || overallStatus === 'warning'
            ? 'attention'
            : 'done'
          : readySectionCount > 0
            ? 'active'
            : 'upcoming'

    return [
      {
        id: 'upload',
        step: 1,
        title: 'Upload',
        description: hasUploadedFile ? 'Workbook sudah masuk ke sistem review.' : 'Pilih workbook `.xlsx` dari client.',
        status: uploadStatus,
      },
      {
        id: 'verify',
        step: 2,
        title: 'Verifikasi',
        description: hasUploadedFile ? 'Header, kolom wajib, dan isi dasar sudah dicek.' : 'Sistem akan memeriksa semua sheet inti.',
        status: verificationStatus,
      },
      {
        id: 'warning',
        step: 3,
        title: 'Warning',
        description: hasUploadedFile
          ? overallStatus === 'blocked' || overallStatus === 'warning'
            ? 'Masih ada bagian yang warning atau blocked dan perlu dibereskan.'
            : 'Tidak ada warning penting di workbook.'
          : 'Kalau ada warning, rapikan dulu sebelum lanjut.',
        status: warningStatus,
      },
      {
        id: 'ready',
        step: 4,
        title: 'Ready',
        description: readySectionCount > 0
          ? `${readySectionCount} bagian sudah siap dimigrasikan.`
          : 'Status ini baru muncul setelah warning selesai.',
        status: readyStatus,
      },
      {
        id: 'migrate',
        step: 5,
        title: 'Migrate',
        description: migratedSectionCount > 0
          ? `${migratedSectionCount} bagian sudah berhasil dieksekusi.`
          : 'Klik `Migrate Now` pada bagian yang sudah Ready.',
        status: migrateStatus,
      },
    ]
  }, [hasAnyMigrationRunning, isParsing, migratedSectionCount, overallStatus, readySectionCount, report])

  const flowCallout = useMemo(() => {
    if (!report) {
      return 'Mulai dari upload workbook, lalu sistem akan membawa Anda ke tahap verifikasi otomatis.'
    }

    if (hasAnyMigrationRunning) {
      return 'Proses migrate sedang berjalan. Tunggu sampai ringkasan hasil muncul, lalu lanjutkan ke bagian berikutnya.'
    }

    if (overallStatus === 'blocked') {
      return 'Masih ada masalah struktural di workbook. Rapikan header atau kolom wajib dulu sebelum status Ready muncul.'
    }

    if (overallStatus === 'warning') {
      return 'Masih ada warning di beberapa bagian. Bereskan dulu supaya bagian-bagian itu bisa berubah ke Ready.'
    }

    if (migratedSectionCount > 0 && migratedSectionCount >= readySectionCount && readySectionCount > 0) {
      return 'Semua bagian yang sudah Ready telah dimigrasikan. Lanjutkan review akhir dan rekonsiliasi go-live.'
    }

    if (migratedSectionCount > 0) {
      return `Sebagian tahap sudah selesai. Masih ada ${Math.max(0, readySectionCount - migratedSectionCount)} bagian Ready yang bisa dilanjutkan.`
    }

    if (readySectionCount > 0) {
      return `${readySectionCount} bagian sudah Ready. Langkah berikutnya adalah klik Migrate Now pada bagian yang ingin dieksekusi.`
    }

    return 'Workbook sudah masuk dan sedang menunggu warning dibereskan sebelum ada bagian yang Ready.'
  }, [hasAnyMigrationRunning, migratedSectionCount, overallStatus, readySectionCount, report])

  const approvalNotice = useMemo(() => {
    if (!report) {
      return {
        toneClass: 'border-slate-200 bg-white text-slate-700',
        badgeClass: 'border-slate-200 bg-slate-100 text-slate-700',
        title: 'Approval Belum Aktif',
        message: 'Upload workbook dulu. Setelah itu sistem akan menunjukkan apakah file sudah layak dimintakan approval sebelum migrate.',
      }
    }

    if (hasAnyMigrationRunning) {
      return {
        toneClass: 'border-blue-200 bg-blue-50 text-blue-800',
        badgeClass: 'border-blue-200 bg-white text-blue-700',
        title: 'Approval Sedang Dieksekusi',
        message: 'Proses migrate sedang berjalan. Tunggu ringkasan hasil muncul, lalu gunakan hasil itu sebagai bukti approval tahap yang sudah dieksekusi.',
      }
    }

    if (overallStatus === 'blocked') {
      return {
        toneClass: 'border-rose-200 bg-rose-50 text-rose-800',
        badgeClass: 'border-rose-200 bg-white text-rose-700',
        title: 'Approval Tertahan',
        message: 'Masih ada bagian yang blocked. Approval final belum boleh diberikan sebelum struktur file dan kolom wajib dibersihkan.',
      }
    }

    if (overallStatus === 'warning') {
      return {
        toneClass: 'border-amber-200 bg-amber-50 text-amber-800',
        badgeClass: 'border-amber-200 bg-white text-amber-700',
        title: 'Approval Ditunda',
        message: 'Workbook sudah terbaca, tetapi masih ada warning. Review warning dulu, lalu minta approval saat status bagian sudah benar-benar Ready.',
      }
    }

    if (hasAnySuccessfulMigration) {
      return {
        toneClass: 'border-emerald-200 bg-emerald-50 text-emerald-800',
        badgeClass: 'border-emerald-200 bg-white text-emerald-700',
        title: 'Approval Tercatat',
        message: 'Sebagian tahap migrasi sudah dieksekusi. Simpan ringkasan hasil import sebagai bukti approval dan audit trail onboarding.',
      }
    }

    return {
      toneClass: 'border-emerald-200 bg-emerald-50 text-emerald-800',
      badgeClass: 'border-emerald-200 bg-white text-emerald-700',
      title: 'Ready Untuk Approval',
      message: 'Workbook sudah lolos validasi dasar. Minta approval PIC, finance lead, atau CFO terlebih dahulu sebelum menekan tombol Migrate Now.',
    }
  }, [report, hasAnyMigrationRunning, overallStatus, hasAnySuccessfulMigration])

  const handleChooseFile = () => {
    fileInputRef.current?.click()
  }

  const getSheetRows = (sheetName: string) => report?.sheetReports.find((sheet) => sheet.name === sheetName)?.rows || []

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsParsing(true)
    setErrorMessage('')
    setCoaImportResult(null)
    setCoaImportError('')
    setMasterDataImportResult(null)
    setMasterDataImportError('')
    setOpeningStockImportResult(null)
    setOpeningStockImportError('')
    setOpeningArImportResult(null)
    setOpeningArImportError('')
    setOpeningApImportResult(null)
    setOpeningApImportError('')
    setOpeningCashBankImportResult(null)
    setOpeningCashBankImportError('')
    setFixedAssetsImportResult(null)
    setFixedAssetsImportError('')
    setManufacturingImportResult(null)
    setManufacturingImportError('')
    setEmployeesImportResult(null)
    setEmployeesImportError('')
    try {
      const nextReport = await parseWorkbook(file)
      setReport(nextReport)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'File tidak bisa dibaca.'
      setReport(null)
      setErrorMessage(`Workbook gagal diproses: ${message}`)
    } finally {
      setIsParsing(false)
      event.target.value = ''
    }
  }

  const handleMigrateCoa = async () => {
    if (!report) return

    setIsMigratingCoa(true)
    setCoaImportError('')
    setCoaImportResult(null)

    try {
      const result = await importCoaMigration({
        coaRows: getSheetRows('coa'),
      })

      if (!result.success) {
        setCoaImportError(result.error)
        return
      }

      setCoaImportResult(result)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal menjalankan migrasi Chart of Accounts.'
      setCoaImportError(message)
    } finally {
      setIsMigratingCoa(false)
    }
  }

  const handleMigrateMasterData = async () => {
    if (!report) return

    setIsMigratingMasterData(true)
    setMasterDataImportError('')
    setMasterDataImportResult(null)

    try {
      const result = await importMasterDataMigration({
        coaMappingRows: getSheetRows('coa_mapping'),
        customers: getSheetRows('customers'),
        suppliers: getSheetRows('suppliers'),
        products: getSheetRows('products'),
        warehouses: getSheetRows('warehouses'),
      })

      if (!result.success) {
        setMasterDataImportError(result.error)
        return
      }

      setMasterDataImportResult(result)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal menjalankan migrasi master data.'
      setMasterDataImportError(message)
    } finally {
      setIsMigratingMasterData(false)
    }
  }

  const handleMigrateOpeningStock = async () => {
    if (!report) return

    setIsMigratingOpeningStock(true)
    setOpeningStockImportError('')
    setOpeningStockImportResult(null)

    try {
      const result = await importOpeningStockMigration({
        openingStockRows: getSheetRows('opening_stock'),
      })

      if (!result.success) {
        setOpeningStockImportError(result.error)
        return
      }

      setOpeningStockImportResult(result)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal menjalankan migrasi opening stock.'
      setOpeningStockImportError(message)
    } finally {
      setIsMigratingOpeningStock(false)
    }
  }

  const handleMigrateOpeningAr = async () => {
    if (!report) return

    setIsMigratingOpeningAr(true)
    setOpeningArImportError('')
    setOpeningArImportResult(null)

    try {
      const result = await importOpeningArMigration({
        openingArRows: getSheetRows('opening_ar'),
      })

      if (!result.success) {
        setOpeningArImportError(result.error)
        return
      }

      setOpeningArImportResult(result)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal menjalankan migrasi opening piutang.'
      setOpeningArImportError(message)
    } finally {
      setIsMigratingOpeningAr(false)
    }
  }

  const handleMigrateOpeningAp = async () => {
    if (!report) return

    setIsMigratingOpeningAp(true)
    setOpeningApImportError('')
    setOpeningApImportResult(null)

    try {
      const result = await importOpeningApMigration({
        openingApRows: getSheetRows('opening_ap'),
      })

      if (!result.success) {
        setOpeningApImportError(result.error)
        return
      }

      setOpeningApImportResult(result)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal menjalankan migrasi opening hutang.'
      setOpeningApImportError(message)
    } finally {
      setIsMigratingOpeningAp(false)
    }
  }

  const handleMigrateOpeningCashBank = async () => {
    if (!report) return

    setIsMigratingOpeningCashBank(true)
    setOpeningCashBankImportError('')
    setOpeningCashBankImportResult(null)

    try {
      const result = await importOpeningCashBankMigration({
        openingCashBankRows: getSheetRows('opening_cash_bank'),
      })

      if (!result.success) {
        setOpeningCashBankImportError(result.error)
        return
      }

      setOpeningCashBankImportResult(result)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal menjalankan migrasi saldo awal kas & bank.'
      setOpeningCashBankImportError(message)
    } finally {
      setIsMigratingOpeningCashBank(false)
    }
  }

  const handleMigrateFixedAssets = async () => {
    if (!report) return

    setIsMigratingFixedAssets(true)
    setFixedAssetsImportError('')
    setFixedAssetsImportResult(null)

    try {
      const result = await importFixedAssetsMigration({
        fixedAssetRows: getSheetRows('fixed_assets'),
      })

      if (!result.success) {
        setFixedAssetsImportError(result.error)
        return
      }

      setFixedAssetsImportResult(result)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal menjalankan migrasi aset tetap.'
      setFixedAssetsImportError(message)
    } finally {
      setIsMigratingFixedAssets(false)
    }
  }

  const handleMigrateManufacturing = async () => {
    if (!report) return

    setIsMigratingManufacturing(true)
    setManufacturingImportError('')
    setManufacturingImportResult(null)

    try {
      const result = await importManufacturingMigration({
        bomRows: getSheetRows('bom'),
      })

      if (!result.success) {
        setManufacturingImportError(result.error)
        return
      }

      setManufacturingImportResult(result)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal menjalankan migrasi BoM manufaktur.'
      setManufacturingImportError(message)
    } finally {
      setIsMigratingManufacturing(false)
    }
  }

  const handleMigrateEmployees = async () => {
    if (!report) return

    setIsMigratingEmployees(true)
    setEmployeesImportError('')
    setEmployeesImportResult(null)

    try {
      const result = await importEmployeesMigration({
        employeeRows: getSheetRows('employees'),
      })

      if (!result.success) {
        setEmployeesImportError(result.error)
        return
      }

      setEmployeesImportResult(result)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal menjalankan migrasi karyawan.'
      setEmployeesImportError(message)
    } finally {
      setIsMigratingEmployees(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 pb-20">
      <PageHeader
        tag="Business Settings"
        title="Pusat Migrasi Data"
        subtitle="Download workbook migrasi resmi, lalu validasi dan import tiap bagian mulai dari Chart of Accounts sampai opening balances."
        icon={<Building2 />}
        actions={(
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/settings/business"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
            >
              <ArrowLeft size={16} />
              Kembali
            </Link>
            <a
              href="/templates/migrasi/NIZAM_Migration_Template.xlsx"
              download
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-white transition hover:bg-black"
            >
              <Download size={16} />
              Download Template Migrasi
            </a>
          </div>
        )}
      />

      <SectionCard className="border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-blue-50">
        <SectionHeader
          title="Urutan Aman Migrasi"
          subtitle="Kartu ini sengaja diletakkan paling atas supaya tim dan client langsung melihat alur kerja yang benar sebelum upload atau migrate."
          icon={ListChecks}
        />
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-5">
          {migrationSteps.map((step, index) => (
            <div key={step.title} className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-600 text-sm font-black text-white">
                {index + 1}
              </div>
              <h3 className="text-sm font-black uppercase tracking-[0.08em] text-slate-900">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{step.description}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <SectionCard className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-blue-50 to-slate-50">
          <SectionHeader
            title="Upload Workbook Migrasi"
            subtitle="Workbook tetap satu file, tetapi sekarang sudah termasuk sheet CoA resmi, sample implementasi, dan referensi pengisian."
            icon={Upload}
          />

          <div className="mt-6 flex flex-col gap-5 rounded-xl border border-dashed border-blue-200 bg-white/80 p-6">
            <div className="space-y-2">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-700">Workbook Excel</div>
              <h3 className="text-xl font-semibold tracking-tight text-slate-900">Pilih file `.xlsx` hasil pengisian client</h3>
              <p className="text-sm font-medium leading-6 text-slate-600">
                Template ini sudah berisi sheet `coa`, `coa_sample`, dan `coa_referensi` agar tim finance bisa langsung mengisi struktur akun sebelum bagian lain dimigrasikan.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <SafeButton
                variant="primary"
                size="lg"
                icon={<Upload size={16} />}
                isLoading={isParsing}
                loadingText="Memproses workbook..."
                onClick={handleChooseFile}
              >
                Upload Workbook
              </SafeButton>
              <a
                href="/templates/migrasi/NIZAM_Migration_Template.xlsx"
                download
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-7 py-3.5 text-sm font-black text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
              >
                <FileSpreadsheet size={16} />
                Ambil Template Resmi
              </a>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xlsm,.xls"
              className="hidden"
              onChange={handleFileChange}
            />

            {errorMessage ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-700">
                {errorMessage}
              </div>
            ) : null}

            {report ? (
              <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-800">
                <div>
                  File aktif: <span className="font-black">{report.fileName}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {report.detectedSheetNames.map((sheetName) => (
                    <span
                      key={sheetName}
                      className="inline-flex items-center rounded-full border border-emerald-200 bg-white/80 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700"
                    >
                      {sheetName}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm font-semibold text-slate-600">
                Belum ada file yang di-upload. Gunakan workbook standar agar validasi per bagian lebih akurat.
              </div>
            )}
          </div>
        </SectionCard>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-1">
          <StatCard
            label="Bagian Siap"
            value={report ? `${sectionSummary.okSections}/${MIGRATION_SECTIONS.length}` : `0/${MIGRATION_SECTIONS.length}`}
            sub="Bagian tanpa warning atau error"
            color="emerald"
            icon={CheckCircle2}
          />
          <StatCard
            label="Butuh Perhatian"
            value={report ? `${sectionSummary.warningSections}` : '0'}
            sub="Bagian dengan warning validasi"
            color="amber"
            icon={AlertTriangle}
          />
          <StatCard
            label="Blocked"
            value={report ? `${sectionSummary.blockedSections}` : '0'}
            sub="Bagian yang belum layak dilanjutkan"
            color="rose"
            icon={XCircle}
          />
          <StatCard
            label="Baris Terbaca"
            value={report ? `${summary.totalRows}` : '0'}
            sub="Jumlah baris non-kosong dari workbook"
            color="blue"
            icon={FileSpreadsheet}
          />
        </div>
      </div>

      <SectionCard className="border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-emerald-50">
        <SectionHeader
          title="Alur Yang Harus Diikuti"
          subtitle="UI ini sengaja dibuat berurutan supaya user tidak bingung: upload dulu, cek warning, tunggu status ready, lalu migrate."
          icon={ShieldCheck}
        />

        <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-5">
          {flowStages.map((stage) => (
            <div key={stage.id} className={`rounded-xl border p-5 ${getFlowStageClasses(stage.status)}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] opacity-70">Step {stage.step}</div>
                  <h3 className="text-lg font-semibold tracking-tight">{stage.title}</h3>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-current/20 bg-white/80">
                  <FlowStageIcon status={stage.status} step={stage.step} />
                </div>
              </div>
              <p className="mt-3 text-sm font-semibold leading-6 opacity-90">{stage.description}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-xl border border-slate-200 bg-white/90 px-5 py-4 text-sm font-semibold leading-6 text-slate-700">
          <span className="font-black text-slate-900">Arah sistem sekarang:</span> {flowCallout}
        </div>
      </SectionCard>

      <SectionCard className={`border ${approvalNotice.toneClass}`}>
        <SectionHeader
          title="Notifikasi Approval"
          subtitle="Approval ini bukan formalitas. Kartu ini mengingatkan kapan tim sudah boleh menekan Migrate Now dan kapan masih harus menahan diri."
          icon={ShieldCheck}
        />
        <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className={`inline-flex items-center rounded-full border px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] ${approvalNotice.badgeClass}`}>
              Approval Gate
            </div>
            <div>
              <h3 className="text-xl font-semibold tracking-tight text-slate-900">{approvalNotice.title}</h3>
              <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-700">
                {approvalNotice.message}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-white/70 bg-white/80 px-5 py-4 text-sm font-semibold leading-6 text-slate-700 lg:max-w-sm">
            Approval ideal diberikan setelah:
            <div className="mt-2">1. File lolos validasi dasar</div>
            <div>2. Warning penting sudah direview</div>
            <div>3. Angka pembuka disetujui PIC/finance lead/CFO</div>
          </div>
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <SectionCard>
        <SectionHeader
          title="Validasi Per Bagian"
          subtitle="Satu workbook, tetapi progress review-nya dibagi per bagian agar tracing lebih rapi dan aman."
          icon={ShieldCheck}
        />

        {!report ? (
          <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-8 text-sm font-semibold text-slate-500">
            Upload workbook dulu untuk melihat status tiap bagian, mulai dari Chart of Accounts, master data, sampai opening balances.
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            <div className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-4 text-sm font-semibold text-blue-800">
              Tiap tombol upload di bawah tetap memakai satu workbook yang sama. Bedanya, sekarang review-nya diurutkan per bagian supaya tim onboarding lebih gampang mengikuti tahap kerja.
            </div>

            {sectionReports.map((section, index) => {
              const toneClasses = getToneClasses(section.status)
              const isCoaSection = section.id === 'coa'
              const isMasterDataSection = section.id === 'master-data'
              const isOpeningStockSection = section.id === 'opening-stock'
              const isOpeningArSection = section.id === 'opening-ar'
              const isOpeningApSection = section.id === 'opening-ap'
              const isOpeningCashBankSection = section.id === 'cash-bank'
              const isFixedAssetsSection = section.id === 'fixed-assets'
              const isManufacturingSection = section.id === 'manufacturing'
              const isEmployeesSection = section.id === 'employees'
              const sectionHasRows = section.rowCount > 0
              const canMigrateCoa = isCoaSection && section.status === 'ok' && sectionHasRows && !isParsing
              const canMigrateMasterData = isMasterDataSection && section.status === 'ok' && sectionHasRows && !isParsing
              const canMigrateOpeningStock = isOpeningStockSection && section.status === 'ok' && sectionHasRows && !isParsing
              const canMigrateOpeningAr = isOpeningArSection && section.status === 'ok' && sectionHasRows && !isParsing
              const canMigrateOpeningAp = isOpeningApSection && section.status === 'ok' && sectionHasRows && !isParsing
              const canMigrateOpeningCashBank = isOpeningCashBankSection && section.status === 'ok' && sectionHasRows && !isParsing
              const canMigrateFixedAssets = isFixedAssetsSection && section.status === 'ok' && sectionHasRows && !isParsing
              const canMigrateManufacturing = isManufacturingSection && section.status === 'ok' && sectionHasRows && !isParsing
              const canMigrateEmployees = isEmployeesSection && section.status === 'ok' && sectionHasRows && !isParsing
              const isMigratableSection = true
              const hasMigratedSection =
                (isCoaSection && Boolean(coaImportResult?.success)) ||
                (isMasterDataSection && Boolean(masterDataImportResult?.success)) ||
                (isOpeningStockSection && Boolean(openingStockImportResult?.success)) ||
                (isOpeningArSection && Boolean(openingArImportResult?.success)) ||
                (isOpeningApSection && Boolean(openingApImportResult?.success)) ||
                (isOpeningCashBankSection && Boolean(openingCashBankImportResult?.success)) ||
                (isFixedAssetsSection && Boolean(fixedAssetsImportResult?.success)) ||
                (isManufacturingSection && Boolean(manufacturingImportResult?.success)) ||
                (isEmployeesSection && Boolean(employeesImportResult?.success))
              const showApprovalSectionNotice = isMigratableSection && section.status === 'ok' && !hasMigratedSection

              return (
                <div key={section.id} className="rounded-xl border border-slate-200 bg-slate-50/70 p-5">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="flex gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-sm font-black text-white">
                        {index + 1}
                      </div>
                      <div className="space-y-2">
                        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-700">Bagian Migrasi</div>
                        <h3 className="text-2xl font-semibold tracking-tight text-slate-900">{section.title}</h3>
                        <p className="max-w-3xl text-sm font-medium leading-6 text-slate-600">
                          {section.description}
                        </p>
                        <div className="flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                          {section.sheets.map((sheetName) => (
                            <span key={`${section.id}-${sheetName}`} className="rounded-full bg-white px-3 py-1">
                              {sheetName}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 xl:items-end">
                      <div className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] ${toneClasses}`}>
                        <StatusIcon status={section.status} size={14} />
                        {getStatusLabel(section.status)}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <SafeButton
                          variant={report ? 'secondary' : 'primary'}
                          size="sm"
                          icon={<Upload size={14} />}
                          isLoading={isParsing}
                          loadingText="Memproses..."
                          onClick={handleChooseFile}
                        >
                          {report ? 'Ganti Workbook' : 'Upload Workbook'}
                        </SafeButton>
                        <a
                          href="/templates/migrasi/NIZAM_Migration_Template.xlsx"
                          download
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
                        >
                          <Download size={14} />
                          Template
                        </a>
                        {isCoaSection ? (
                          <SafeButton
                            variant="emerald"
                            size="sm"
                            icon={<CheckCircle2 size={14} />}
                            isLoading={isMigratingCoa}
                            loadingText="Migrating..."
                            onClick={handleMigrateCoa}
                            disabled={!canMigrateCoa}
                          >
                            Migrate Now
                          </SafeButton>
                        ) : isMasterDataSection ? (
                          <SafeButton
                            variant="emerald"
                            size="sm"
                            icon={<CheckCircle2 size={14} />}
                            isLoading={isMigratingMasterData}
                            loadingText="Migrating..."
                            onClick={handleMigrateMasterData}
                            disabled={!canMigrateMasterData}
                          >
                            Migrate Now
                          </SafeButton>
                        ) : isOpeningStockSection ? (
                          <SafeButton
                            variant="emerald"
                            size="sm"
                            icon={<CheckCircle2 size={14} />}
                            isLoading={isMigratingOpeningStock}
                            loadingText="Migrating..."
                            onClick={handleMigrateOpeningStock}
                            disabled={!canMigrateOpeningStock}
                          >
                            Migrate Now
                          </SafeButton>
                        ) : isOpeningArSection ? (
                          <SafeButton
                            variant="emerald"
                            size="sm"
                            icon={<CheckCircle2 size={14} />}
                            isLoading={isMigratingOpeningAr}
                            loadingText="Migrating..."
                            onClick={handleMigrateOpeningAr}
                            disabled={!canMigrateOpeningAr}
                          >
                            Migrate Now
                          </SafeButton>
                        ) : isOpeningApSection ? (
                          <SafeButton
                            variant="emerald"
                            size="sm"
                            icon={<CheckCircle2 size={14} />}
                            isLoading={isMigratingOpeningAp}
                            loadingText="Migrating..."
                            onClick={handleMigrateOpeningAp}
                            disabled={!canMigrateOpeningAp}
                          >
                            Migrate Now
                          </SafeButton>
                        ) : isOpeningCashBankSection ? (
                          <SafeButton
                            variant="emerald"
                            size="sm"
                            icon={<CheckCircle2 size={14} />}
                            isLoading={isMigratingOpeningCashBank}
                            loadingText="Migrating..."
                            onClick={handleMigrateOpeningCashBank}
                            disabled={!canMigrateOpeningCashBank}
                          >
                            Migrate Now
                          </SafeButton>
                        ) : isFixedAssetsSection ? (
                          <SafeButton
                            variant="emerald"
                            size="sm"
                            icon={<CheckCircle2 size={14} />}
                            isLoading={isMigratingFixedAssets}
                            loadingText="Migrating..."
                            onClick={handleMigrateFixedAssets}
                            disabled={!canMigrateFixedAssets}
                          >
                            Migrate Now
                          </SafeButton>
                        ) : isManufacturingSection ? (
                          <SafeButton
                            variant="emerald"
                            size="sm"
                            icon={<CheckCircle2 size={14} />}
                            isLoading={isMigratingManufacturing}
                            loadingText="Migrating..."
                            onClick={handleMigrateManufacturing}
                            disabled={!canMigrateManufacturing}
                          >
                            Migrate Now
                          </SafeButton>
                        ) : isEmployeesSection ? (
                          <SafeButton
                            variant="emerald"
                            size="sm"
                            icon={<CheckCircle2 size={14} />}
                            isLoading={isMigratingEmployees}
                            loadingText="Migrating..."
                            onClick={handleMigrateEmployees}
                            disabled={!canMigrateEmployees}
                          >
                            Migrate Now
                          </SafeButton>
                        ) : (
                          <SafeButton
                            variant="white"
                            size="sm"
                            icon={<CheckCircle2 size={14} />}
                            disabled
                          >
                            Migrate Soon
                          </SafeButton>
                        )}
                      </div>

                      <div className="text-right text-xs font-semibold text-slate-500">
                        {section.rowCount} baris · {section.issueCount} isu terdeteksi
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[1.1fr_0.9fr]">
                    <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800">
                      {section.nextStep}
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
                      {section.status === 'blocked'
                        ? 'Bagian ini masih blocked. Rapikan header atau isi kolom wajib dulu sebelum lanjut.'
                        : section.status === 'warning'
                          ? 'Bagian ini sudah kebaca, tapi masih ada warning. Selesaikan dulu warning ini sebelum status Ready dan tombol migrate aktif.'
                          : !sectionHasRows
                            ? 'Bagian ini lolos struktur dasar, tetapi belum ada baris data untuk dimigrasikan.'
                            : isMigratableSection
                            ? 'Bagian ini sudah lolos validasi dasar dan tombol Migrate Now sudah aktif untuk tahap ini.'
                            : 'Bagian ini sudah lolos validasi dasar. Import database untuk tahap ini masih menyusul, tetapi datanya sudah siap direview.'}
                    </div>
                  </div>

                  {showApprovalSectionNotice ? (
                    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm font-semibold leading-6 text-amber-800">
                      <span className="font-black">Notifikasi Approval:</span> bagian ini sudah `Ready`, tetapi sebaiknya tetap menunggu persetujuan PIC atau finance lead sebelum tombol `Migrate Now` ditekan karena proses ini akan menulis data pembuka langsung ke sistem.
                    </div>
                  ) : null}

                  {isCoaSection && coaImportError ? (
                    <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm font-semibold text-rose-700">
                      {coaImportError}
                    </div>
                  ) : null}

                  {isMasterDataSection && masterDataImportError ? (
                    <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm font-semibold text-rose-700">
                      {masterDataImportError}
                    </div>
                  ) : null}

                  {isOpeningStockSection && openingStockImportError ? (
                    <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm font-semibold text-rose-700">
                      {openingStockImportError}
                    </div>
                  ) : null}

                  {isOpeningArSection && openingArImportError ? (
                    <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm font-semibold text-rose-700">
                      {openingArImportError}
                    </div>
                  ) : null}

                  {isOpeningApSection && openingApImportError ? (
                    <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm font-semibold text-rose-700">
                      {openingApImportError}
                    </div>
                  ) : null}

                  {isOpeningCashBankSection && openingCashBankImportError ? (
                    <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm font-semibold text-rose-700">
                      {openingCashBankImportError}
                    </div>
                  ) : null}

                  {isFixedAssetsSection && fixedAssetsImportError ? (
                    <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm font-semibold text-rose-700">
                      {fixedAssetsImportError}
                    </div>
                  ) : null}

                  {isManufacturingSection && manufacturingImportError ? (
                    <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm font-semibold text-rose-700">
                      {manufacturingImportError}
                    </div>
                  ) : null}

                  {isEmployeesSection && employeesImportError ? (
                    <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm font-semibold text-rose-700">
                      {employeesImportError}
                    </div>
                  ) : null}

                  {isCoaSection && coaImportResult?.success ? (
                    <div className={`mt-4 rounded-xl border px-4 py-4 text-sm ${
                      coaImportResult.hasErrors
                        ? 'border-amber-200 bg-amber-50 text-amber-800'
                        : 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    }`}>
                      <div className="font-black">{coaImportResult.message}</div>
                      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                        {coaSummaryCards.map(({ label, value }) => (
                          <div key={label} className="rounded-2xl bg-white/80 px-4 py-3">
                            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</div>
                            <div className="mt-2 text-xs font-semibold text-slate-700">{value}</div>
                          </div>
                        ))}
                      </div>

                      <div className="mt-3 rounded-2xl bg-white/80 px-4 py-3 font-semibold text-slate-700">
                        Sinkron akun berhasil diproses: {coaImportResult.metadata.syncedAccounts} akun.
                      </div>

                      {coaImportResult.warnings.length > 0 ? (
                        <div className="mt-3 space-y-2">
                          {coaImportResult.warnings.map((warning) => (
                            <div key={warning} className="rounded-2xl bg-white/80 px-4 py-3 font-semibold text-slate-700">
                              {warning}
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {coaImportResult.summary.errors.length > 0 ? (
                        <div className="mt-3 space-y-2">
                          {coaImportResult.summary.errors.slice(0, 6).map((error) => (
                            <div key={error} className="rounded-2xl bg-white/80 px-4 py-3 font-semibold text-slate-700">
                              {error}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {isMasterDataSection && masterDataImportResult?.success ? (
                    <div className={`mt-4 rounded-xl border px-4 py-4 text-sm ${
                      masterDataImportResult.hasErrors
                        ? 'border-amber-200 bg-amber-50 text-amber-800'
                        : 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    }`}>
                      <div className="font-black">{masterDataImportResult.message}</div>
                      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                        {masterDataSummaryCards.map(({ label, summary }) => (
                          <div key={label} className="rounded-2xl bg-white/80 px-4 py-3">
                            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</div>
                            <div className="mt-2 text-xs font-semibold text-slate-700">
                              Created: {summary.created} · Updated: {summary.updated} · Skipped: {summary.skipped}
                            </div>
                          </div>
                        ))}
                      </div>

                      {masterDataImportResult.ignored.coaMappingRows > 0 ? (
                        <div className="mt-3 rounded-2xl bg-white/80 px-4 py-3 font-semibold text-slate-700">
                          `coa_mapping` terbaca {masterDataImportResult.ignored.coaMappingRows} baris dan tetap disimpan sebagai lampiran mapping legacy. Import akun utama dijalankan dari sheet `coa`.
                        </div>
                      ) : null}

                      {masterDataImportResult.warnings.length > 0 ? (
                        <div className="mt-3 space-y-2">
                          {masterDataImportResult.warnings.map((warning) => (
                            <div key={warning} className="rounded-2xl bg-white/80 px-4 py-3 font-semibold text-slate-700">
                              {warning}
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {masterDataSummaryCards.some(({ summary }) => summary.errors.length > 0) ? (
                        <div className="mt-3 space-y-2">
                          {masterDataSummaryCards.flatMap(({ label, summary }) =>
                            summary.errors.slice(0, 3).map((error) => (
                              <div key={`${label}-${error}`} className="rounded-2xl bg-white/80 px-4 py-3 font-semibold text-slate-700">
                                [{label}] {error}
                              </div>
                            ))
                          )}
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {isOpeningStockSection && openingStockImportResult?.success ? (
                    <div className={`mt-4 rounded-xl border px-4 py-4 text-sm ${
                      openingStockImportResult.hasErrors
                        ? 'border-amber-200 bg-amber-50 text-amber-800'
                        : 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    }`}>
                      <div className="font-black">{openingStockImportResult.message}</div>
                      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-2xl bg-white/80 px-4 py-3">
                          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Rows Imported</div>
                          <div className="mt-2 text-xs font-semibold text-slate-700">
                            Created: {openingStockImportResult.summary.created} · Skipped: {openingStockImportResult.summary.skipped}
                          </div>
                        </div>
                        <div className="rounded-2xl bg-white/80 px-4 py-3">
                          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Total Qty</div>
                          <div className="mt-2 text-xs font-semibold text-slate-700">
                            {openingStockImportResult.summary.totalQuantity}
                          </div>
                        </div>
                        <div className="rounded-2xl bg-white/80 px-4 py-3">
                          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Total Value</div>
                          <div className="mt-2 text-xs font-semibold text-slate-700">
                            Rp {openingStockImportResult.summary.totalValue.toLocaleString('id-ID')}
                          </div>
                        </div>
                        <div className="rounded-2xl bg-white/80 px-4 py-3">
                          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Journal</div>
                          <div className="mt-2 text-xs font-semibold text-slate-700">
                            {openingStockImportResult.metadata.journalEntriesCreated} entry · {openingStockImportResult.metadata.movementDate}
                          </div>
                        </div>
                      </div>

                      {openingStockImportResult.warnings.length > 0 ? (
                        <div className="mt-3 space-y-2">
                          {openingStockImportResult.warnings.map((warning) => (
                            <div key={warning} className="rounded-2xl bg-white/80 px-4 py-3 font-semibold text-slate-700">
                              {warning}
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {openingStockImportResult.summary.errors.length > 0 ? (
                        <div className="mt-3 space-y-2">
                          {openingStockImportResult.summary.errors.slice(0, 6).map((error) => (
                            <div key={error} className="rounded-2xl bg-white/80 px-4 py-3 font-semibold text-slate-700">
                              {error}
                            </div>
                          ))}
                          {openingStockImportResult.summary.errors.length > 6 ? (
                            <div className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                              +{openingStockImportResult.summary.errors.length - 6} error tambahan
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {isOpeningArSection && openingArImportResult?.success ? (
                    <div className={`mt-4 rounded-xl border px-4 py-4 text-sm ${
                      openingArImportResult.hasErrors
                        ? 'border-amber-200 bg-amber-50 text-amber-800'
                        : 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    }`}>
                      <div className="font-black">{openingArImportResult.message}</div>
                      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-2xl bg-white/80 px-4 py-3">
                          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Invoices Imported</div>
                          <div className="mt-2 text-xs font-semibold text-slate-700">
                            Created: {openingArImportResult.summary.created} · Skipped: {openingArImportResult.summary.skipped}
                          </div>
                        </div>
                        <div className="rounded-2xl bg-white/80 px-4 py-3">
                          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Outstanding</div>
                          <div className="mt-2 text-xs font-semibold text-slate-700">
                            Rp {openingArImportResult.summary.totalOutstanding.toLocaleString('id-ID')}
                          </div>
                        </div>
                        <div className="rounded-2xl bg-white/80 px-4 py-3">
                          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Journal</div>
                          <div className="mt-2 text-xs font-semibold text-slate-700">
                            {openingArImportResult.metadata.journalEntriesCreated} entry
                          </div>
                        </div>
                        <div className="rounded-2xl bg-white/80 px-4 py-3">
                          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Journal Date</div>
                          <div className="mt-2 text-xs font-semibold text-slate-700">
                            {openingArImportResult.metadata.journalDate}
                          </div>
                        </div>
                      </div>

                      {openingArImportResult.warnings.length > 0 ? (
                        <div className="mt-3 space-y-2">
                          {openingArImportResult.warnings.map((warning) => (
                            <div key={warning} className="rounded-2xl bg-white/80 px-4 py-3 font-semibold text-slate-700">
                              {warning}
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {openingArImportResult.summary.errors.length > 0 ? (
                        <div className="mt-3 space-y-2">
                          {openingArImportResult.summary.errors.slice(0, 6).map((error) => (
                            <div key={error} className="rounded-2xl bg-white/80 px-4 py-3 font-semibold text-slate-700">
                              {error}
                            </div>
                          ))}
                          {openingArImportResult.summary.errors.length > 6 ? (
                            <div className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                              +{openingArImportResult.summary.errors.length - 6} error tambahan
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {isOpeningApSection && openingApImportResult?.success ? (
                    <div className={`mt-4 rounded-xl border px-4 py-4 text-sm ${
                      openingApImportResult.hasErrors
                        ? 'border-amber-200 bg-amber-50 text-amber-800'
                        : 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    }`}>
                      <div className="font-black">{openingApImportResult.message}</div>
                      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-2xl bg-white/80 px-4 py-3">
                          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Bills Imported</div>
                          <div className="mt-2 text-xs font-semibold text-slate-700">
                            Created: {openingApImportResult.summary.created} · Skipped: {openingApImportResult.summary.skipped}
                          </div>
                        </div>
                        <div className="rounded-2xl bg-white/80 px-4 py-3">
                          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Outstanding</div>
                          <div className="mt-2 text-xs font-semibold text-slate-700">
                            Rp {openingApImportResult.summary.totalOutstanding.toLocaleString('id-ID')}
                          </div>
                        </div>
                        <div className="rounded-2xl bg-white/80 px-4 py-3">
                          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Journal</div>
                          <div className="mt-2 text-xs font-semibold text-slate-700">
                            {openingApImportResult.metadata.journalEntriesCreated} entry
                          </div>
                        </div>
                        <div className="rounded-2xl bg-white/80 px-4 py-3">
                          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Journal Date</div>
                          <div className="mt-2 text-xs font-semibold text-slate-700">
                            {openingApImportResult.metadata.journalDate}
                          </div>
                        </div>
                      </div>

                      {openingApImportResult.warnings.length > 0 ? (
                        <div className="mt-3 space-y-2">
                          {openingApImportResult.warnings.map((warning) => (
                            <div key={warning} className="rounded-2xl bg-white/80 px-4 py-3 font-semibold text-slate-700">
                              {warning}
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {openingApImportResult.summary.errors.length > 0 ? (
                        <div className="mt-3 space-y-2">
                          {openingApImportResult.summary.errors.slice(0, 6).map((error) => (
                            <div key={error} className="rounded-2xl bg-white/80 px-4 py-3 font-semibold text-slate-700">
                              {error}
                            </div>
                          ))}
                          {openingApImportResult.summary.errors.length > 6 ? (
                            <div className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                              +{openingApImportResult.summary.errors.length - 6} error tambahan
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {isOpeningCashBankSection && openingCashBankImportResult?.success ? (
                    <div className={`mt-4 rounded-xl border px-4 py-4 text-sm ${
                      openingCashBankImportResult.hasErrors
                        ? 'border-amber-200 bg-amber-50 text-amber-800'
                        : 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    }`}>
                      <div className="font-black">{openingCashBankImportResult.message}</div>
                      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-2xl bg-white/80 px-4 py-3">
                          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Accounts Imported</div>
                          <div className="mt-2 text-xs font-semibold text-slate-700">
                            Created: {openingCashBankImportResult.summary.created} · Skipped: {openingCashBankImportResult.summary.skipped}
                          </div>
                        </div>
                        <div className="rounded-2xl bg-white/80 px-4 py-3">
                          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Total Balance</div>
                          <div className="mt-2 text-xs font-semibold text-slate-700">
                            Rp {openingCashBankImportResult.summary.totalBalance.toLocaleString('id-ID')}
                          </div>
                        </div>
                        <div className="rounded-2xl bg-white/80 px-4 py-3">
                          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Bank Accounts</div>
                          <div className="mt-2 text-xs font-semibold text-slate-700">
                            Baru dibuat: {openingCashBankImportResult.summary.bankAccountsCreated}
                          </div>
                        </div>
                        <div className="rounded-2xl bg-white/80 px-4 py-3">
                          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Journal Date</div>
                          <div className="mt-2 text-xs font-semibold text-slate-700">
                            {openingCashBankImportResult.metadata.journalEntriesCreated} entry · {openingCashBankImportResult.metadata.journalDate}
                          </div>
                        </div>
                      </div>

                      {openingCashBankImportResult.warnings.length > 0 ? (
                        <div className="mt-3 space-y-2">
                          {openingCashBankImportResult.warnings.map((warning) => (
                            <div key={warning} className="rounded-2xl bg-white/80 px-4 py-3 font-semibold text-slate-700">
                              {warning}
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {openingCashBankImportResult.summary.errors.length > 0 ? (
                        <div className="mt-3 space-y-2">
                          {openingCashBankImportResult.summary.errors.slice(0, 6).map((error) => (
                            <div key={error} className="rounded-2xl bg-white/80 px-4 py-3 font-semibold text-slate-700">
                              {error}
                            </div>
                          ))}
                          {openingCashBankImportResult.summary.errors.length > 6 ? (
                            <div className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                              +{openingCashBankImportResult.summary.errors.length - 6} error tambahan
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {isFixedAssetsSection && fixedAssetsImportResult?.success ? (
                    <div className={`mt-4 rounded-xl border px-4 py-4 text-sm ${
                      fixedAssetsImportResult.hasErrors
                        ? 'border-amber-200 bg-amber-50 text-amber-800'
                        : 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    }`}>
                      <div className="font-black">{fixedAssetsImportResult.message}</div>
                      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-2xl bg-white/80 px-4 py-3">
                          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Assets Imported</div>
                          <div className="mt-2 text-xs font-semibold text-slate-700">
                            Created: {fixedAssetsImportResult.summary.created} · Skipped: {fixedAssetsImportResult.summary.skipped}
                          </div>
                        </div>
                        <div className="rounded-2xl bg-white/80 px-4 py-3">
                          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Acquisition Cost</div>
                          <div className="mt-2 text-xs font-semibold text-slate-700">
                            Rp {fixedAssetsImportResult.summary.totalAcquisitionCost.toLocaleString('id-ID')}
                          </div>
                        </div>
                        <div className="rounded-2xl bg-white/80 px-4 py-3">
                          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Book Value</div>
                          <div className="mt-2 text-xs font-semibold text-slate-700">
                            Rp {fixedAssetsImportResult.summary.totalBookValue.toLocaleString('id-ID')}
                          </div>
                        </div>
                        <div className="rounded-2xl bg-white/80 px-4 py-3">
                          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Journal</div>
                          <div className="mt-2 text-xs font-semibold text-slate-700">
                            {fixedAssetsImportResult.metadata.journalEntriesCreated} entry · {fixedAssetsImportResult.metadata.journalDate}
                          </div>
                        </div>
                      </div>

                      {fixedAssetsImportResult.warnings.length > 0 ? (
                        <div className="mt-3 space-y-2">
                          {fixedAssetsImportResult.warnings.map((warning) => (
                            <div key={warning} className="rounded-2xl bg-white/80 px-4 py-3 font-semibold text-slate-700">
                              {warning}
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {fixedAssetsImportResult.summary.errors.length > 0 ? (
                        <div className="mt-3 space-y-2">
                          {fixedAssetsImportResult.summary.errors.slice(0, 6).map((error) => (
                            <div key={error} className="rounded-2xl bg-white/80 px-4 py-3 font-semibold text-slate-700">
                              {error}
                            </div>
                          ))}
                          {fixedAssetsImportResult.summary.errors.length > 6 ? (
                            <div className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                              +{fixedAssetsImportResult.summary.errors.length - 6} error tambahan
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {isManufacturingSection && manufacturingImportResult?.success ? (
                    <div className={`mt-4 rounded-xl border px-4 py-4 text-sm ${
                      manufacturingImportResult.hasErrors
                        ? 'border-amber-200 bg-amber-50 text-amber-800'
                        : 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    }`}>
                      <div className="font-black">{manufacturingImportResult.message}</div>
                      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-2xl bg-white/80 px-4 py-3">
                          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">BoM Imported</div>
                          <div className="mt-2 text-xs font-semibold text-slate-700">
                            Created: {manufacturingImportResult.summary.created} · Skipped: {manufacturingImportResult.summary.skipped}
                          </div>
                        </div>
                        <div className="rounded-2xl bg-white/80 px-4 py-3">
                          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Component Lines</div>
                          <div className="mt-2 text-xs font-semibold text-slate-700">
                            {manufacturingImportResult.summary.componentLinesCreated}
                          </div>
                        </div>
                        <div className="rounded-2xl bg-white/80 px-4 py-3">
                          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Status</div>
                          <div className="mt-2 text-xs font-semibold text-slate-700">
                            {manufacturingImportResult.metadata.bomsCreated} header BoM dibuat
                          </div>
                        </div>
                      </div>

                      {manufacturingImportResult.warnings.length > 0 ? (
                        <div className="mt-3 space-y-2">
                          {manufacturingImportResult.warnings.map((warning) => (
                            <div key={warning} className="rounded-2xl bg-white/80 px-4 py-3 font-semibold text-slate-700">
                              {warning}
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {manufacturingImportResult.summary.errors.length > 0 ? (
                        <div className="mt-3 space-y-2">
                          {manufacturingImportResult.summary.errors.slice(0, 6).map((error) => (
                            <div key={error} className="rounded-2xl bg-white/80 px-4 py-3 font-semibold text-slate-700">
                              {error}
                            </div>
                          ))}
                          {manufacturingImportResult.summary.errors.length > 6 ? (
                            <div className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                              +{manufacturingImportResult.summary.errors.length - 6} error tambahan
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {isEmployeesSection && employeesImportResult?.success ? (
                    <div className={`mt-4 rounded-xl border px-4 py-4 text-sm ${
                      employeesImportResult.hasErrors
                        ? 'border-amber-200 bg-amber-50 text-amber-800'
                        : 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    }`}>
                      <div className="font-black">{employeesImportResult.message}</div>
                      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-2xl bg-white/80 px-4 py-3">
                          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Employees Imported</div>
                          <div className="mt-2 text-xs font-semibold text-slate-700">
                            Created: {employeesImportResult.summary.created} · Skipped: {employeesImportResult.summary.skipped}
                          </div>
                        </div>
                        <div className="rounded-2xl bg-white/80 px-4 py-3">
                          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Total Basic Salary</div>
                          <div className="mt-2 text-xs font-semibold text-slate-700">
                            Rp {employeesImportResult.summary.totalBasicSalary.toLocaleString('id-ID')}
                          </div>
                        </div>
                        <div className="rounded-2xl bg-white/80 px-4 py-3">
                          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Assigned Branch</div>
                          <div className="mt-2 text-xs font-semibold text-slate-700">
                            {employeesImportResult.metadata.assignedBranchId || 'Tidak tersedia'}
                          </div>
                        </div>
                      </div>

                      {employeesImportResult.warnings.length > 0 ? (
                        <div className="mt-3 space-y-2">
                          {employeesImportResult.warnings.map((warning) => (
                            <div key={warning} className="rounded-2xl bg-white/80 px-4 py-3 font-semibold text-slate-700">
                              {warning}
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {employeesImportResult.summary.errors.length > 0 ? (
                        <div className="mt-3 space-y-2">
                          {employeesImportResult.summary.errors.slice(0, 6).map((error) => (
                            <div key={error} className="rounded-2xl bg-white/80 px-4 py-3 font-semibold text-slate-700">
                              {error}
                            </div>
                          ))}
                          {employeesImportResult.summary.errors.length > 6 ? (
                            <div className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                              +{employeesImportResult.summary.errors.length - 6} error tambahan
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="mt-5 space-y-4">
                    {section.sheetReports.map((sheet) => (
                      <SheetDetailCard key={sheet.name} sheet={sheet} />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </SectionCard>

        <div className="space-y-6">
          <SectionCard>
            <SectionHeader
              title="File Yang Wajib Diminta"
              subtitle="Checklist minimum saat client pindahan dari Excel atau aplikasi lama."
              icon={FolderInput}
            />
            <ul className="mt-6 space-y-3">
              {requiredFiles.map((item) => (
                <li key={item} className="flex items-start gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                  <CheckCircle2 className="mt-0.5 shrink-0 text-blue-600" size={16} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </SectionCard>

          <SectionCard>
            <SectionHeader
              title="Yang Bisa Dibantu Tim NIZAM"
              subtitle="Peran onboarding bukan hanya menerima file, tetapi memastikan posisi pembuka memang sehat."
              icon={ShieldCheck}
            />
            <div className="mt-6 grid grid-cols-1 gap-3">
              {supportItems.map((item) => (
                <div key={item} className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                  {item}
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard className="border border-blue-100 bg-blue-50">
            <SectionHeader
              title="Status Tahap Ini"
              subtitle="Upload, validasi, dan import bertahap sekarang sudah aktif untuk semua bagian utama di workbook migrasi."
              icon={FileSpreadsheet}
            />
            <div className="mt-4 rounded-2xl bg-white/80 px-4 py-4 text-sm font-semibold leading-6 text-slate-700">
              {report
                ? overallStatus === 'blocked'
                  ? 'Workbook sudah terbaca, tetapi masih ada bagian yang blocked. Ikuti alur: perbaiki warning dulu, tunggu Ready, lalu migrate.'
                  : overallStatus === 'warning'
                    ? 'Workbook sudah terbaca dengan warning. Alur yang benar tetap sama: warning dibereskan dulu, baru Ready, lalu Migrate.'
                    : 'Workbook sudah lolos validasi dasar per bagian. Tombol Migrate Now sekarang tersedia untuk semua section yang punya data dan berstatus Ready.'
                : 'Begitu workbook di-upload, sistem akan menunjukkan status siap, warning, atau blocked untuk setiap bagian migrasi, lalu membuka tombol Migrate Now pada bagian yang sudah Ready.'}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  )
}
