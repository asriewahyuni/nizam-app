/**
 * Helper pemetaan tautan dokumen operasional (End-to-End Traceability).
 * Memetakan reference_type, reference_id, atau kode dokumen di dalam deskripsi
 * menuju modul operasional sumber (Sales, Purchasing, Cash & Bank, Inventory, dll).
 */

export type SourceDocumentLinkInfo = {
  url: string
  label: string
  module: string
  documentCode?: string
}

export function extractDocumentNumber(text?: string | null): string | null {
  if (!text) return null
  const match = text.match(/\b((?:SO|PO|INV|BILL|EXP|TRF|STK|ADJ|PAY|FLT|TKT|SRV|SYR)-[A-Za-z0-9\/-]+)\b/i)
  return match ? match[1].trim() : null
}

export function resolveSourceDocumentLink(
  referenceType?: string | null,
  referenceId?: string | null,
  description?: string | null,
  notes?: string | null
): SourceDocumentLinkInfo | null {
  const type = String(referenceType || '').toUpperCase().trim()
  const desc = String(description || '').trim()
  const combinedText = `${type} ${desc} ${notes || ''}`.trim()
  const docCode = extractDocumentNumber(combinedText)

  // 1. Sales & POS
  if (
    type.includes('SALE') ||
    type.includes('POS') ||
    type.includes('ORDER') ||
    combinedText.startsWith('SO-') ||
    combinedText.includes('Penjualan') ||
    combinedText.includes('Sales Order')
  ) {
    const query = docCode ? `search=${encodeURIComponent(docCode)}` : referenceId ? `id=${referenceId}` : ''
    return {
      url: `/sales${query ? `?${query}` : ''}`,
      label: docCode || (type.replaceAll('_', ' ') || 'Penjualan'),
      module: 'Penjualan',
      documentCode: docCode || undefined,
    }
  }

  // 2. Purchasing & Bills
  if (
    type.includes('PURCHASE') ||
    type.includes('BILL') ||
    type.includes('SUPPLIER') ||
    combinedText.startsWith('PO-') ||
    combinedText.includes('Pembelian') ||
    combinedText.includes('Tagihan Supplier')
  ) {
    const query = docCode ? `search=${encodeURIComponent(docCode)}` : referenceId ? `id=${referenceId}` : ''
    return {
      url: `/purchasing${query ? `?${query}` : ''}`,
      label: docCode || (type.replaceAll('_', ' ') || 'Pembelian'),
      module: 'Pembelian',
      documentCode: docCode || undefined,
    }
  }

  // 3. Cash, Bank & Expenses
  if (
    type.includes('CASH') ||
    type.includes('EXPENSE') ||
    type.includes('BANK') ||
    type.includes('TRANSFER') ||
    combinedText.includes('Beban') ||
    combinedText.includes('Kas') ||
    combinedText.includes('Biaya')
  ) {
    return {
      url: `/cash`,
      label: docCode || (type.replaceAll('_', ' ') || 'Kas & Bank'),
      module: 'Kas & Bank',
      documentCode: docCode || undefined,
    }
  }

  // 4. Inventory & Stock
  if (
    type.includes('INVENTORY') ||
    type.includes('STOCK') ||
    type.includes('ADJUSTMENT') ||
    type.includes('OPNAME') ||
    combinedText.includes('Stok') ||
    combinedText.includes('Persediaan')
  ) {
    return {
      url: `/inventory`,
      label: docCode || (type.replaceAll('_', ' ') || 'Inventori'),
      module: 'Inventori',
      documentCode: docCode || undefined,
    }
  }

  // 5. HRIS & Payroll
  if (
    type.includes('PAYROLL') ||
    type.includes('SALARY') ||
    type.includes('EMPLOYEE') ||
    combinedText.includes('Gaji') ||
    combinedText.includes('Payroll') ||
    combinedText.includes('Honor')
  ) {
    return {
      url: `/hris`,
      label: docCode || (type.replaceAll('_', ' ') || 'HRIS / Payroll'),
      module: 'HRIS',
      documentCode: docCode || undefined,
    }
  }

  // 6. Fleet
  if (type.includes('FLEET') || combinedText.includes('Armada') || combinedText.includes('BBM')) {
    return {
      url: `/fleet`,
      label: docCode || (type.replaceAll('_', ' ') || 'Armada'),
      module: 'Fleet',
      documentCode: docCode || undefined,
    }
  }

  // 7. PO Bus / Tiket
  if (type.includes('PO_BUS') || type.includes('TICKET') || combinedText.includes('Tiket') || combinedText.includes('Bus')) {
    return {
      url: `/po-bus`,
      label: docCode || (type.replaceAll('_', ' ') || 'PO Bus'),
      module: 'PO Bus',
      documentCode: docCode || undefined,
    }
  }

  // 8. Workshop / Bengkel
  if (type.includes('WORKSHOP') || type.includes('SERVICE') || combinedText.includes('Bengkel') || combinedText.includes('Servis')) {
    return {
      url: `/workshop`,
      label: docCode || (type.replaceAll('_', ' ') || 'Bengkel'),
      module: 'Workshop',
      documentCode: docCode || undefined,
    }
  }

  // 9. Syirkah
  if (type.includes('SYIRKAH') || combinedText.includes('Bagi Hasil') || combinedText.includes('Akad')) {
    return {
      url: `/syirkah`,
      label: docCode || (type.replaceAll('_', ' ') || 'Syirkah'),
      module: 'Syirkah',
      documentCode: docCode || undefined,
    }
  }

  return null
}
