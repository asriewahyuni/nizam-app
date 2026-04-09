import ExcelJS from 'exceljs'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')
const outputPath = path.join(repoRoot, 'templates', 'migrasi', 'NIZAM_Migration_Template.xlsx')
const publicOutputPath = path.join(repoRoot, 'public', 'templates', 'migrasi', 'NIZAM_Migration_Template.xlsx')

const HEADER_FILL = '0F3B74'
const HEADER_TEXT = 'FFFFFFFF'
const SHEET_TAB = 'D7E7FB'
const NOTE_FILL = 'FFF7DB'
const BORDER_COLOR = 'D9E2F2'

const templates = [
  {
    name: 'Petunjuk',
    columns: [
      { header: 'Bagian', key: 'section', width: 28 },
      { header: 'Isi', key: 'content', width: 80 }
    ],
    rows: [
      { section: 'Tujuan', content: 'Workbook ini dipakai client untuk menyiapkan data migrasi ke NIZAM.' },
      { section: 'Format tanggal', content: 'Gunakan format YYYY-MM-DD.' },
      { section: 'Format angka', content: 'Gunakan angka murni tanpa pemisah ribuan dan tanpa prefix Rp.' },
      { section: 'Kolom wajib', content: 'Jangan ubah nama header tanpa koordinasi dengan tim onboarding.' },
      { section: 'Persediaan', content: 'Opening stock sebaiknya diisi per produk per gudang.' },
      { section: 'AR/AP', content: 'Kalau memungkinkan isi per invoice outstanding, bukan total ringkas.' },
      { section: 'Produk inventory', content: 'Category yang disarankan: Bahan, Setengah Jadi, Siap Jual, Pelengkap.' },
      { section: 'Versi CSV', content: 'Versi CSV mentah tetap tersedia di folder templates/migrasi untuk kebutuhan internal.' }
    ]
  },
  {
    name: 'coa_mapping',
    columns: [
      { header: 'legacy_account_code', key: 'legacy_account_code', width: 24 },
      { header: 'legacy_account_name', key: 'legacy_account_name', width: 32 },
      { header: 'nizam_account_code', key: 'nizam_account_code', width: 22 },
      { header: 'nizam_account_name', key: 'nizam_account_name', width: 32 },
      { header: 'notes', key: 'notes', width: 32 }
    ]
  },
  {
    name: 'customers',
    columns: [
      { header: 'customer_code', key: 'customer_code', width: 18 },
      { header: 'customer_name', key: 'customer_name', width: 32 },
      { header: 'phone', key: 'phone', width: 18 },
      { header: 'email', key: 'email', width: 28 },
      { header: 'address', key: 'address', width: 36 },
      { header: 'city', key: 'city', width: 18 },
      { header: 'payment_term_days', key: 'payment_term_days', width: 18 },
      { header: 'npwp', key: 'npwp', width: 22 },
      { header: 'is_active', key: 'is_active', width: 14 },
      { header: 'notes', key: 'notes', width: 28 }
    ],
    requiredFields: ['customer_name'],
    booleanFields: ['is_active'],
    numericFields: ['payment_term_days'],
    validations: [
      { columnKey: 'is_active', values: ['TRUE', 'FALSE'] }
    ]
  },
  {
    name: 'suppliers',
    columns: [
      { header: 'supplier_code', key: 'supplier_code', width: 18 },
      { header: 'supplier_name', key: 'supplier_name', width: 32 },
      { header: 'phone', key: 'phone', width: 18 },
      { header: 'email', key: 'email', width: 28 },
      { header: 'address', key: 'address', width: 36 },
      { header: 'city', key: 'city', width: 18 },
      { header: 'payment_term_days', key: 'payment_term_days', width: 18 },
      { header: 'npwp', key: 'npwp', width: 22 },
      { header: 'is_active', key: 'is_active', width: 14 },
      { header: 'notes', key: 'notes', width: 28 }
    ],
    requiredFields: ['supplier_name'],
    booleanFields: ['is_active'],
    numericFields: ['payment_term_days'],
    validations: [
      { columnKey: 'is_active', values: ['TRUE', 'FALSE'] }
    ]
  },
  {
    name: 'products',
    columns: [
      { header: 'sku', key: 'sku', width: 18 },
      { header: 'product_name', key: 'product_name', width: 32 },
      { header: 'type', key: 'type', width: 16 },
      { header: 'category', key: 'category', width: 18 },
      { header: 'unit', key: 'unit', width: 14 },
      { header: 'purchase_price', key: 'purchase_price', width: 16 },
      { header: 'selling_price', key: 'selling_price', width: 16 },
      { header: 'warehouse_default', key: 'warehouse_default', width: 20 },
      { header: 'is_active', key: 'is_active', width: 14 },
      { header: 'notes', key: 'notes', width: 28 }
    ],
    requiredFields: ['sku', 'product_name', 'type'],
    booleanFields: ['is_active'],
    numericFields: ['purchase_price', 'selling_price'],
    enumFields: {
      type: ['INVENTORY', 'SERVICE'],
      category: ['Bahan', 'Setengah Jadi', 'Siap Jual', 'Pelengkap', 'Layanan']
    },
    validations: [
      { columnKey: 'type', values: ['INVENTORY', 'SERVICE'] },
      { columnKey: 'category', values: ['Bahan', 'Setengah Jadi', 'Siap Jual', 'Pelengkap', 'Layanan'] },
      { columnKey: 'is_active', values: ['TRUE', 'FALSE'] }
    ]
  },
  {
    name: 'warehouses',
    columns: [
      { header: 'warehouse_code', key: 'warehouse_code', width: 18 },
      { header: 'warehouse_name', key: 'warehouse_name', width: 30 },
      { header: 'branch_name', key: 'branch_name', width: 24 },
      { header: 'address', key: 'address', width: 36 },
      { header: 'is_active', key: 'is_active', width: 14 },
      { header: 'notes', key: 'notes', width: 28 }
    ],
    requiredFields: ['warehouse_name'],
    booleanFields: ['is_active'],
    validations: [
      { columnKey: 'is_active', values: ['TRUE', 'FALSE'] }
    ]
  },
  {
    name: 'opening_stock',
    columns: [
      { header: 'sku', key: 'sku', width: 18 },
      { header: 'product_name', key: 'product_name', width: 32 },
      { header: 'warehouse_name', key: 'warehouse_name', width: 24 },
      { header: 'qty', key: 'qty', width: 14 },
      { header: 'unit_cost', key: 'unit_cost', width: 16 },
      { header: 'total_value', key: 'total_value', width: 16 },
      { header: 'batch_number', key: 'batch_number', width: 18 },
      { header: 'bin_name', key: 'bin_name', width: 18 },
      { header: 'notes', key: 'notes', width: 28 }
    ],
    requiredFields: ['warehouse_name', 'qty'],
    numericFields: ['qty', 'unit_cost', 'total_value']
  },
  {
    name: 'opening_ar',
    columns: [
      { header: 'customer_name', key: 'customer_name', width: 32 },
      { header: 'invoice_number', key: 'invoice_number', width: 20 },
      { header: 'invoice_date', key: 'invoice_date', width: 16 },
      { header: 'due_date', key: 'due_date', width: 16 },
      { header: 'outstanding_amount', key: 'outstanding_amount', width: 18 },
      { header: 'branch_name', key: 'branch_name', width: 24 },
      { header: 'notes', key: 'notes', width: 28 }
    ],
    requiredFields: ['customer_name', 'outstanding_amount'],
    numericFields: ['outstanding_amount'],
    dateFields: ['invoice_date', 'due_date']
  },
  {
    name: 'opening_ap',
    columns: [
      { header: 'supplier_name', key: 'supplier_name', width: 32 },
      { header: 'bill_number', key: 'bill_number', width: 20 },
      { header: 'bill_date', key: 'bill_date', width: 16 },
      { header: 'due_date', key: 'due_date', width: 16 },
      { header: 'outstanding_amount', key: 'outstanding_amount', width: 18 },
      { header: 'branch_name', key: 'branch_name', width: 24 },
      { header: 'notes', key: 'notes', width: 28 }
    ],
    requiredFields: ['supplier_name', 'outstanding_amount'],
    numericFields: ['outstanding_amount'],
    dateFields: ['bill_date', 'due_date']
  },
  {
    name: 'opening_cash_bank',
    columns: [
      { header: 'account_code', key: 'account_code', width: 18 },
      { header: 'account_name', key: 'account_name', width: 30 },
      { header: 'account_type', key: 'account_type', width: 18 },
      { header: 'balance', key: 'balance', width: 16 },
      { header: 'branch_name', key: 'branch_name', width: 24 },
      { header: 'notes', key: 'notes', width: 28 }
    ],
    requiredFields: ['account_name', 'account_type', 'balance'],
    numericFields: ['balance'],
    enumFields: {
      account_type: ['CASH', 'BANK']
    },
    validations: [
      { columnKey: 'account_type', values: ['CASH', 'BANK'] }
    ]
  },
  {
    name: 'fixed_assets',
    columns: [
      { header: 'asset_code', key: 'asset_code', width: 18 },
      { header: 'asset_name', key: 'asset_name', width: 32 },
      { header: 'acquisition_date', key: 'acquisition_date', width: 16 },
      { header: 'acquisition_cost', key: 'acquisition_cost', width: 18 },
      { header: 'accumulated_depreciation', key: 'accumulated_depreciation', width: 24 },
      { header: 'useful_life_months', key: 'useful_life_months', width: 20 },
      { header: 'residual_value', key: 'residual_value', width: 16 },
      { header: 'branch_name', key: 'branch_name', width: 24 },
      { header: 'notes', key: 'notes', width: 28 }
    ],
    requiredFields: ['asset_name', 'acquisition_cost'],
    numericFields: ['acquisition_cost', 'accumulated_depreciation', 'useful_life_months', 'residual_value'],
    dateFields: ['acquisition_date']
  },
  {
    name: 'bom',
    columns: [
      { header: 'bom_code', key: 'bom_code', width: 18 },
      { header: 'output_sku', key: 'output_sku', width: 18 },
      { header: 'output_name', key: 'output_name', width: 28 },
      { header: 'output_qty', key: 'output_qty', width: 14 },
      { header: 'component_sku', key: 'component_sku', width: 18 },
      { header: 'component_name', key: 'component_name', width: 28 },
      { header: 'component_qty', key: 'component_qty', width: 16 },
      { header: 'component_unit', key: 'component_unit', width: 16 },
      { header: 'notes', key: 'notes', width: 28 }
    ],
    requiredFields: ['output_sku', 'component_sku', 'component_qty'],
    numericFields: ['output_qty', 'component_qty']
  },
  {
    name: 'employees',
    columns: [
      { header: 'employee_code', key: 'employee_code', width: 18 },
      { header: 'employee_name', key: 'employee_name', width: 28 },
      { header: 'email', key: 'email', width: 28 },
      { header: 'phone', key: 'phone', width: 18 },
      { header: 'department', key: 'department', width: 20 },
      { header: 'position', key: 'position', width: 22 },
      { header: 'join_date', key: 'join_date', width: 16 },
      { header: 'employment_status', key: 'employment_status', width: 20 },
      { header: 'basic_salary', key: 'basic_salary', width: 16 },
      { header: 'is_active', key: 'is_active', width: 14 },
      { header: 'notes', key: 'notes', width: 28 }
    ],
    requiredFields: ['employee_name'],
    booleanFields: ['is_active'],
    numericFields: ['basic_salary'],
    dateFields: ['join_date'],
    enumFields: {
      employment_status: ['Tetap', 'Kontrak', 'Magang', 'Freelance']
    },
    validations: [
      { columnKey: 'employment_status', values: ['Tetap', 'Kontrak', 'Magang', 'Freelance'] },
      { columnKey: 'is_active', values: ['TRUE', 'FALSE'] }
    ]
  }
]

function styleHeader(row) {
  row.height = 22
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: HEADER_TEXT } }
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: HEADER_FILL }
    }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
    cell.border = {
      top: { style: 'thin', color: { argb: BORDER_COLOR } },
      left: { style: 'thin', color: { argb: BORDER_COLOR } },
      bottom: { style: 'thin', color: { argb: BORDER_COLOR } },
      right: { style: 'thin', color: { argb: BORDER_COLOR } }
    }
  })
}

function styleNotes(sheet) {
  const noteRow = sheet.getRow(2)
  noteRow.height = 42
  noteRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: NOTE_FILL }
    }
    cell.font = { italic: true, color: { argb: '6B5B00' } }
    cell.alignment = { vertical: 'middle', wrapText: true }
    cell.border = {
      top: { style: 'thin', color: { argb: BORDER_COLOR } },
      left: { style: 'thin', color: { argb: BORDER_COLOR } },
      bottom: { style: 'thin', color: { argb: BORDER_COLOR } },
      right: { style: 'thin', color: { argb: BORDER_COLOR } }
    }
  })
}

function addValidation(sheet, columnIndex, values) {
  for (let row = 3; row <= 500; row += 1) {
    sheet.getCell(row, columnIndex).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`"${values.join(',')}"`],
      showErrorMessage: true,
      errorTitle: 'Nilai tidak valid',
      error: `Pilih salah satu: ${values.join(', ')}`
    }
  }
}

function buildColumnHint(template, column) {
  const hints = []
  const requiredFields = template.requiredFields || []
  const numericFields = template.numericFields || []
  const booleanFields = template.booleanFields || []
  const dateFields = template.dateFields || []
  const enumFields = template.enumFields || {}

  hints.push(requiredFields.includes(column.key) ? 'Wajib' : 'Opsional')

  if (numericFields.includes(column.key)) {
    hints.push('angka')
    hints.push('tanpa Rp/titik ribuan')
  } else if (booleanFields.includes(column.key)) {
    hints.push('TRUE/FALSE')
  } else if (dateFields.includes(column.key)) {
    hints.push('YYYY-MM-DD')
  } else if (enumFields[column.key]) {
    hints.push(`pilih: ${enumFields[column.key].join('/')}`)
  } else if (column.key === 'sku' || column.key.endsWith('_sku')) {
    hints.push('kode produk unik')
  } else if (column.key.endsWith('_number')) {
    hints.push('nomor referensi')
  } else if (column.key === 'email') {
    hints.push('format email')
  } else if (column.key === 'phone') {
    hints.push('nomor telepon')
  } else if (column.key === 'npwp') {
    hints.push('nomor NPWP')
  } else if (column.key === 'unit' || column.key.endsWith('_unit')) {
    hints.push('satuan, mis: Pcs/Kg/Ekor')
  } else if (column.key === 'notes') {
    hints.push('catatan tambahan')
  } else if (column.key.endsWith('_code')) {
    hints.push('kode unik')
  } else if (column.key.endsWith('_name')) {
    hints.push('nama sesuai sumber')
  } else {
    hints.push('isi sesuai sumber')
  }

  return hints.join(' · ')
}

function addTemplateSheet(workbook, template) {
  const sheet = workbook.addWorksheet(template.name, {
    properties: { tabColor: { argb: SHEET_TAB } },
    views: [{ state: 'frozen', ySplit: 2 }]
  })

  sheet.columns = template.columns.map((column) => ({
    key: column.key,
    width: column.width,
  }))
  sheet.addRow(template.columns.map((column) => column.header))
  styleHeader(sheet.getRow(1))

  const noteValues = template.columns.map((column) => buildColumnHint(template, column))

  sheet.addRow(noteValues)
  styleNotes(sheet)
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: template.columns.length }
  }

  if (template.rows) {
    for (const row of template.rows) {
      sheet.addRow(row)
    }
  }

  if (template.validations) {
    for (const validation of template.validations) {
      const columnIndex = template.columns.findIndex((column) => column.key === validation.columnKey) + 1
      if (columnIndex > 0) {
        addValidation(sheet, columnIndex, validation.values)
      }
    }
  }

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= 2) return
    row.eachCell((cell) => {
      cell.border = {
        bottom: { style: 'hair', color: { argb: BORDER_COLOR } }
      }
      cell.alignment = { vertical: 'top' }
    })
  })
}

async function main() {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Codex for NIZAM'
  workbook.company = 'NIZAM'
  workbook.subject = 'Template Migrasi Client'
  workbook.title = 'NIZAM Migration Template'
  workbook.created = new Date()
  workbook.modified = new Date()

  for (const template of templates) {
    addTemplateSheet(workbook, template)
  }

  const buffer = await workbook.xlsx.writeBuffer()
  await mkdir(path.dirname(outputPath), { recursive: true })
  await mkdir(path.dirname(publicOutputPath), { recursive: true })
  await writeFile(outputPath, Buffer.from(buffer))
  await writeFile(publicOutputPath, Buffer.from(buffer))
  console.log(`Workbook created at ${outputPath}`)
  console.log(`Workbook copied to ${publicOutputPath}`)
}

await main()
