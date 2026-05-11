import { createClient } from '@/lib/supabase/server'

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function normalizeDateOnlyValue(value: unknown): string | null {
  if (!value) return null

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null
    if (DATE_ONLY_PATTERN.test(trimmed)) return trimmed

    const parsed = new Date(trimmed)
    if (Number.isNaN(parsed.getTime())) return null
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
  }

  const normalized = String(value).trim()
  if (!normalized) return null
  if (DATE_ONLY_PATTERN.test(normalized)) return normalized

  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) return null
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`
}

export async function getTaxSummary(orgId: string, startDate?: string, endDate?: string, branchId?: string | null) {
  const supabase = await createClient()
  const db = supabase as any

  const now = new Date()
  const sDate = startDate || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const eDate = endDate || new Date().toISOString().split('T')[0]

  // ── STEP 1: Resolve account IDs for tax codes ─────────────────────────────
  // Cannot filter journal_lines by accounts.code directly via PostgREST .or()
  // so we first fetch the account IDs for org, then filter lines by those IDs.
  const TAX_CODES = ['1401', '2201', '2202', '2203']
  const { data: taxAccounts, error: accErr } = await db
    .from('accounts')
    .select('id, code')
    .eq('org_id', orgId)
    .in('code', TAX_CODES)

  if (accErr || !taxAccounts || taxAccounts.length === 0) {
    return {
      vatIn: { total: 0, items: [] },
      vatOut: { total: 0, items: [] },
      pph21: { total: 0, items: [] },
      pph23: { total: 0, items: [] },
      netVat: 0,
      startDate: sDate,
      endDate: eDate
    }
  }

  const accIdMap: Record<string, string> = {} // code → account_id
  taxAccounts.forEach((a: any) => { accIdMap[a.code] = a.id })
  const taxAccountIds = taxAccounts.map((a: any) => a.id)

  // ── STEP 2: Get relevant journal entry IDs in date range ─────────────────
  let entriesQuery = db
    .from('journal_entries')
    .select('id')
    .eq('org_id', orgId)
    .eq('status', 'POSTED')
    .gte('entry_date', sDate)
    .lte('entry_date', eDate)

  if (branchId) {
    entriesQuery = entriesQuery.eq('branch_id', branchId)
  }

  const { data: entries, error: entErr } = await entriesQuery

  if (entErr || !entries || entries.length === 0) {
    return {
      vatIn: { total: 0, items: [] },
      vatOut: { total: 0, items: [] },
      pph21: { total: 0, items: [] },
      pph23: { total: 0, items: [] },
      netVat: 0,
      startDate: sDate,
      endDate: eDate
    }
  }

  const entryIds = entries.map((e: any) => e.id)

  // ── STEP 3: Fetch journal lines filtered by tax account IDs ───────────────
  const { data: lines, error: lineErr } = await db
    .from('journal_lines')
    .select(`
      debit, credit, memo, entry_id, account_id,
      accounts!inner(id, code, name, type, normal_balance),
      journal_entries!inner(entry_number, entry_date, description)
    `)
    .in('entry_id', entryIds)
    .in('account_id', taxAccountIds) as any

  if (lineErr || !lines) {
    return {
      vatIn: { total: 0, items: [] },
      vatOut: { total: 0, items: [] },
      pph21: { total: 0, items: [] },
      pph23: { total: 0, items: [] },
      netVat: 0,
      startDate: sDate,
      endDate: eDate
    }
  }

  const vatInItems: any[] = []
  const vatOutItems: any[] = []
  const pph21Items: any[] = []
  const pph23Items: any[] = []

  let totalVatIn = 0
  let totalVatOut = 0
  let totalPph21 = 0
  let totalPph23 = 0

  lines.forEach((l: any) => {
    const code = l.accounts.code
    const item = {
      date: normalizeDateOnlyValue(l.journal_entries.entry_date),
      ref: l.journal_entries.entry_number,
      description: l.journal_entries.description,
      memo: l.memo
    }

    if (code === '1401') {
      // VAT In: Normal balance DEBIT. Net = debit - credit
      const net = Number(l.debit) - Number(l.credit)
      if (net !== 0) { totalVatIn += net; vatInItems.push({ ...item, amount: net }) }
    } else if (code === '2201') {
      // VAT Out: Normal balance CREDIT. Net = credit - debit
      const net = Number(l.credit) - Number(l.debit)
      if (net !== 0) { totalVatOut += net; vatOutItems.push({ ...item, amount: net }) }
    } else if (code === '2202') {
      const net = Number(l.credit) - Number(l.debit)
      if (net !== 0) { totalPph21 += net; pph21Items.push({ ...item, amount: net }) }
    } else if (code === '2203') {
      const net = Number(l.credit) - Number(l.debit)
      if (net !== 0) { totalPph23 += net; pph23Items.push({ ...item, amount: net }) }
    }
  })

  return {
    vatIn: { total: totalVatIn, items: vatInItems },
    vatOut: { total: totalVatOut, items: vatOutItems },
    pph21: { total: totalPph21, items: pph21Items },
    pph23: { total: totalPph23, items: pph23Items },
    netVat: totalVatOut - totalVatIn,
    startDate: sDate,
    endDate: eDate
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  PPN ENGINE — Org Settings
// ═══════════════════════════════════════════════════════════════════════════

export async function getOrgTaxSettings(orgId: string) {
  const supabase = await createClient()
  const { data: existing } = await (supabase as any)
    .from('org_tax_settings')
    .select('*')
    .eq('org_id', orgId)
    .maybeSingle()

  if (existing) return existing

  // Auto-create default settings
  const { data: ppnIn } = await (supabase as any)
    .from('accounts')
    .select('id').eq('org_id', orgId).eq('code', '1401').maybeSingle()

  const { data: ppnOut } = await (supabase as any)
    .from('accounts')
    .select('id').eq('org_id', orgId).eq('code', '2201').maybeSingle()

  const defaults = {
    org_id: orgId,
    is_pkp: false,
    npwp: null,
    pkp_since: null,
    ppn_rate: 11.00,
    pph_21_rate: 0,
    pph_23_rate: 2.00,
    ppn_masukan_account_id: ppnIn?.id || null,
    ppn_keluaran_account_id: ppnOut?.id || null,
    pph_21_account_id: null,
    pph_23_account_id: null,
    auto_post_tax_journal: true,
  }

  const { data: inserted } = await (supabase as any)
    .from('org_tax_settings')
    .insert(defaults)
    .select()
    .maybeSingle()

  return inserted || defaults
}

export async function upsertOrgTaxSettings(orgId: string, input: Record<string, any>) {
  const supabase = await createClient()
  const { error } = await (supabase as any)
    .from('org_tax_settings')
    .upsert({ org_id: orgId, ...input, updated_at: new Date().toISOString() })
    .select()

  if (error) return { error: error.message }
  const { revalidatePath } = await import('next/cache')
  revalidatePath('/accounting/tax')
  return { success: true }
}

// ═══════════════════════════════════════════════════════════════════════════
//  PPN ENGINE — SPT Masa PPN 1111
// ═══════════════════════════════════════════════════════════════════════════

export async function getSptPpn1111(orgId: string, taxPeriod: string) {
  const supabase = await createClient()
  
  const { data, error } = await supabase.rpc('get_spt_ppn_1111', {
    p_org_id: orgId,
    p_tax_period: taxPeriod + '-01'
  })

  if (error) {
    console.error('getSptPpn1111 error:', error)
    return null
  }

  return data
}

export async function downloadSptCsv(orgId: string, taxPeriod: string) {
  const spt = await getSptPpn1111(orgId, taxPeriod)
  if (!spt) return null

  const rows = [
    ['SPT MASA PPN 1111'],
    [`Masa Pajak: ${spt.tax_period}`],
    [''],
    ['A. PENYERAHAN & PPN KELUARAN'],
    ['Total DPP', String(spt.section_a.total_dpp)],
    ['Total PPN', String(spt.section_a.total_ppn)],
    ['Jumlah Faktur', String(spt.section_a.jumlah_faktur)],
    [''],
    ['B. PEROLEHAN & PPN MASUKAN'],
    ['Total DPP', String(spt.section_b.total_dpp)],
    ['Total PPN', String(spt.section_b.total_ppn)],
    ['Jumlah Faktur', String(spt.section_b.jumlah_faktur)],
    [''],
    ['C. PPN KURANG/LEBIH BAYAR'],
    ['PPN Keluaran', String(spt.section_c.ppn_keluaran)],
    ['PPN Masukan', String(spt.section_c.ppn_masukan)],
    ['PPN Kurang Bayar', String(spt.section_c.ppn_kurang_bayar)],
    ['PPN Lebih Bayar', String(spt.section_c.ppn_lebih_bayar)],
  ]

  const csv = rows.map(r => r.join(',')).join('\n')
  return { csv, filename: `SPT-PPN-1111-${spt.tax_period}.csv`, spt }
}

// ═══════════════════════════════════════════════════════════════════════════
//  PPN ENGINE — Bayar Pajak
// ═══════════════════════════════════════════════════════════════════════════

export async function payTax(orgId: string, taxPeriod: string, paidAt: string, fromAccountId: string, notes?: string) {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('create_tax_payment_journal', {
    p_org_id: orgId,
    p_tax_period: taxPeriod + '-01',
    p_paid_at: paidAt,
    p_paid_from_account_id: fromAccountId,
    p_notes: notes || null
  })

  if (error) {
    console.error('payTax error:', error)
    return { error: error.message }
  }

  if (!data?.success) {
    return { error: data?.error || 'Gagal membuat jurnal pembayaran pajak.' }
  }

  const { revalidatePath } = await import('next/cache')
  revalidatePath('/accounting/tax')
  return {
    success: true,
    entry_id: data.entry_id,
    entry_number: data.entry_number,
    amount: data.amount,
    spt_data: data.spt_data,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  PPN ENGINE — Generate Faktur Pajak
// ═══════════════════════════════════════════════════════════════════════════

export async function generateTaxInvoice(orgId: string, referenceType: 'SALE' | 'PURCHASE', referenceId: string) {
  const supabase = await createClient()
  const db = supabase as any

  // Get reference transaction
  let reference: any = null
  if (referenceType === 'SALE') {
    const { data } = await db.from('sales').select('*, customer:customer_id(*)').eq('id', referenceId).single()
    reference = data
  } else {
    const { data } = await db.from('purchases').select('*, vendor:vendor_id(*)').eq('id', referenceId).single()
    reference = data
  }

  if (!reference) return { error: `Transaksi ${referenceType} tidak ditemukan.` }

  // Get tax settings
  const settings = await getOrgTaxSettings(orgId)
  if (!settings.is_pkp) return { error: 'Organisasi belum terdaftar sebagai PKP. Aktifkan PKP di Setting Pajak.' }

  // Check if already exists
  const { data: existing } = await db
    .from('tax_invoices')
    .select('id')
    .eq('reference_type', referenceType)
    .eq('reference_id', referenceId)
    .maybeSingle()

  if (existing) return { error: 'Faktur Pajak sudah pernah dibuat untuk transaksi ini.' }

  // Auto number from next available
  // For now, use timestamp-based number
  const facturNumber = `${reference.sale_number || reference.purchase_number || 'FAK'}-${Date.now().toString(36).toUpperCase()}`

  const { error } = await db.from('tax_invoices').insert({
    org_id: orgId,
    factur_number: facturNumber,
    reference_type: referenceType,
    reference_id: referenceId,
    faktur_date: reference.sale_date || reference.purchase_date || new Date().toISOString().split('T')[0],
    customer_name: reference.customer?.name || reference.vendor?.name || '-',
    customer_npwp: reference.customer?.npwp || reference.vendor?.npwp || null,
    total_dpp: (reference.grand_total || 0) - (reference.tax_amount || 0),
    total_ppn: reference.tax_amount || 0,
    status: 'APPROVED',
    created_by: (await supabase.auth.getUser()).data.user?.id,
  })

  if (error) return { error: `Gagal membuat Faktur Pajak: ${error.message}` }
  const { revalidatePath } = await import('next/cache')
  revalidatePath('/accounting/tax')
  return { success: true, factur_number: facturNumber }
}

export async function getTaxInvoices(orgId: string, period?: string) {
  const supabase = await createClient()
  let query = (supabase as any)
    .from('tax_invoices')
    .select('*')
    .eq('org_id', orgId)
    .order('faktur_date', { ascending: false })

  if (period) {
    query = query.gte('faktur_date', period + '-01')
      .lte('faktur_date', period + '-31')
  }
  
  const { data } = await query
  return data || []
}
