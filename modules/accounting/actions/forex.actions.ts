'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { isInternalAuthProvider } from '@/lib/auth/provider'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'

/**
 * Catat realized FX gain/loss saat pembayaran dilakukan
 * untuk transaksi yang menggunakan mata uang asing.
 */
export async function recordFxGainLoss(
  referenceType: 'SALE' | 'PURCHASE',
  referenceId: string,
  settlementRate?: number
) {
  const activeOrg = await getActiveOrg()
  if (!activeOrg) return { error: 'Not authenticated' }

  const orgId = activeOrg.org.id
  const supabase = isInternalAuthProvider()
    ? ((await createAdminClient()) as any)
    : ((await createClient()) as any)

  // 1. Dapatkan transaksi asli
  const table = referenceType === 'SALE' ? 'sales' : 'purchases'
  const { data: transaction, error: txError } = await (supabase as any)
    .from(table)
    .select('id, currency_code, exchange_rate, grand_total, total_amount')
    .eq('id', referenceId)
    .eq('org_id', orgId)
    .single()

  if (txError || !transaction) return { error: 'Transaksi tidak ditemukan.' }
  if (!transaction.currency_code || transaction.currency_code === 'IDR') {
    return { error: 'Bukan transaksi mata uang asing.' }
  }

  const currencyCode = transaction.currency_code
  const rateAtTransaction = transaction.exchange_rate
  if (!rateAtTransaction) return { error: 'Nilai kurs tidak ditemukan pada transaksi.' }

  // 2. Dapatkan kurs saat settlement (payment)
  const rateAtSettlement = settlementRate || await getLatestRate(orgId, currencyCode, supabase)
  if (!rateAtSettlement) return { error: 'Gagal mendapatkan kurs terkini.' }

  // 3. Hitung FX gain/loss
  // Jumlah dalam valas = grand_total (dalam IDR) / rate_at_transaction
  const amountInForeign = transaction.grand_total / rateAtTransaction
  const amountInIdrAtSettlement = amountInForeign * rateAtSettlement
  const fxDifference = amountInIdrAtSettlement - transaction.grand_total

  // Toleransi < Rp 1 dianggap nol
  if (Math.abs(fxDifference) < 1) return { success: true, fxGainLoss: 0 }

  const isGain = fxDifference > 0
  const fxGainLoss = Math.abs(fxDifference)

  // 4. Cari akun FX Gain / FX Loss di CoA
  const gainAccountId = await findOrCreateFxAccount(orgId, supabase, 'GAIN')
  const lossAccountId = await findOrCreateFxAccount(orgId, supabase, 'LOSS')

  if (!gainAccountId || !lossAccountId) return { error: 'Gagal menyiapkan akun selisih kurs.' }

  // 5. Buat journal entry
  const description = `Selisih Kurs - ${referenceType === 'SALE' ? 'Penjualan' : 'Pembelian'} #${referenceId.slice(0, 8)} (${currencyCode}: ${rateAtTransaction} → ${rateAtSettlement})`

  // Dapatkan akun piutang/hutang
  const counterpartAccountId = await getCounterpartAccount(orgId, supabase, referenceType, referenceId)
  if (!counterpartAccountId) return { error: 'Gagal mendapatkan akun piutang/hutang.' }

  const lines = isGain
    ? [
        { account_id: counterpartAccountId, debit: fxGainLoss, credit: 0 },
        { account_id: gainAccountId, debit: 0, credit: fxGainLoss },
      ]
    : [
        { account_id: lossAccountId, debit: fxGainLoss, credit: 0 },
        { account_id: counterpartAccountId, debit: 0, credit: fxGainLoss },
      ]

  const { data: je, error: jeError } = await (supabase as any)
    .from('journal_entries')
    .insert({
      org_id: orgId,
      entry_date: new Date().toISOString().split('T')[0],
      description,
      reference_type: 'JOURNAL',
      reference_id: `FX-${referenceType}-${referenceId.slice(0, 8)}`,
      is_approved: true,
      lines: lines.map((l: any) => ({
        org_id: orgId,
        account_id: l.account_id,
        debit: l.debit,
        credit: l.credit,
      })),
    })
    .select('id')
    .single()

  if (jeError || !je?.id) {
    return { error: 'Gagal membuat jurnal selisih kurs: ' + (jeError?.message || 'unknown') }
  }

  // 6. Catat di forex_realized_gl
  const { error: glError } = await (supabase as any)
    .from('forex_realized_gl')
    .insert({
      org_id: orgId,
      entry_id: je.id,
      currency_code: currencyCode,
      amount_foreign: amountInForeign,
      rate_at_transaction: rateAtTransaction,
      rate_at_settlement: rateAtSettlement,
      fx_gain_loss: fxGainLoss,
      is_gain: isGain,
      realized_at: new Date().toISOString().split('T')[0],
      reference_type: referenceType,
      reference_id: referenceId,
    })

  if (glError) {
    // Hapus journal entry jika gagal mencatat GL
    await (supabase as any).from('journal_entries').delete().eq('id', je.id)
    return { error: 'Gagal mencatat realisasi FX: ' + glError.message }
  }

  revalidatePath('/accounting/forex')
  return { success: true, fxGainLoss, isGain, jeId: je.id }
}

/**
 * Ambil daftar realisasi FX gain/loss
 */
export async function getFxGainLossHistory(orgId: string, limit = 50) {
  const supabase = isInternalAuthProvider()
    ? ((await createAdminClient()) as any)
    : ((await createClient()) as any)

  const { data, error } = await (supabase as any)
    .from('forex_realized_gl')
    .select('*, journal_entries!left(description, id)')
    .eq('org_id', orgId)
    .order('realized_at', { ascending: false })
    .limit(limit)

  if (error) return { error: error.message, data: [] }
  return { data: data || [] }
}

/**
 * Hapus catatan FX gain/loss (untuk rollback jika payment dibatalkan)
 */
export async function deleteFxGainLoss(entryId: string) {
  const activeOrg = await getActiveOrg()
  if (!activeOrg) return { error: 'Not authenticated' }

  const supabase = isInternalAuthProvider()
    ? ((await createAdminClient()) as any)
    : ((await createClient()) as any)

  // Hapus GL record dan journal entry terkait
  const { data: gl } = await (supabase as any)
    .from('forex_realized_gl')
    .select('entry_id')
    .eq('id', entryId)
    .single()

  if (gl?.entry_id) {
    await (supabase as any).from('journal_entries').delete().eq('id', gl.entry_id)
  }

  const { error } = await (supabase as any)
    .from('forex_realized_gl')
    .delete()
    .eq('id', entryId)

  if (error) return { error: error.message }
  revalidatePath('/accounting/forex')
  return { success: true }
}

// ── HELPERS ────────────────────────────────────────────────────────────────

async function getLatestRate(orgId: string, currencyCode: string, supabase: any) {
  const { data } = await (supabase as any)
    .from('exchange_rates')
    .select('rate')
    .eq('org_id', orgId)
    .eq('currency_code', currencyCode)
    .order('date', { ascending: false })
    .limit(1)
    .single()

  return data?.rate || null
}

async function findOrCreateFxAccount(orgId: string, supabase: any, type: 'GAIN' | 'LOSS') {
  const name = type === 'GAIN' ? 'Laba Selisih Kurs' : 'Rugi Selisih Kurs'
  const code = type === 'GAIN' ? '4-8010' : '6-8010'

  // Cari akun yang sudah ada
  const { data: existing } = await (supabase as any)
    .from('accounts')
    .select('id')
    .eq('org_id', orgId)
    .eq('code', code)
    .single()

  if (existing?.id) return existing.id

  // Buat baru
  const { data: newAcc, error } = await (supabase as any)
    .from('accounts')
    .insert({
      org_id: orgId,
      code,
      name,
      type: type === 'GAIN' ? 'INCOME' : 'EXPENSE',
      category: type === 'GAIN' ? 'Pendapatan Lain-lain' : 'Biaya Lain-lain',
      is_active: true,
      cash_flow_category: type === 'GAIN' ? 'operating' : 'operating',
    })
    .select('id')
    .single()

  if (error || !newAcc?.id) return null
  return newAcc.id
}

async function getCounterpartAccount(orgId: string, supabase: any, referenceType: string, referenceId: string) {
  if (referenceType === 'SALE') {
    // Cari akun piutang dari sale
    const { data: sale } = await (supabase as any)
      .from('sales')
      .select('payment_account_id, branch_id')
      .eq('id', referenceId)
      .single()

    if (sale?.payment_account_id) return sale.payment_account_id

    // Fallback: cari akun piutang dagang
    const { data: arAccount } = await (supabase as any)
      .from('accounts')
      .select('id')
      .eq('org_id', orgId)
      .eq('code', '1-1010')
      .single()

    return arAccount?.id || null
  } else {
    // Cari akun hutang dari purchase
    const { data: purchase } = await (supabase as any)
      .from('purchases')
      .select('payment_account_id, branch_id')
      .eq('id', referenceId)
      .single()

    if (purchase?.payment_account_id) return purchase.payment_account_id

    // Fallback: cari akun hutang dagang
    const { data: apAccount } = await (supabase as any)
      .from('accounts')
      .select('id')
      .eq('org_id', orgId)
      .eq('code', '2-1010')
      .single()

    return apAccount?.id || null
  }
}
