'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { resolveAccessibleBranchSelection } from '@/modules/organization/lib/branch-access.server'

import { createJournalEntry } from './journal.actions'

type ActiveBranchResult =
  | { branchId: string }
  | { error: string }

type FixedAssetAccessRecord = {
  id: string
  org_id: string
  branch_id: string | null
  accumulated_depreciation: number | null
  current_book_value: number | null
  purchase_price: number | null
  salvage_value: number | null
  useful_life_months: number | null
  last_depreciation_date: string | null
  purchase_date: string
  name: string
  code: string
  status: string
  asset_account_id: string | null
  accum_dep_account_id: string | null
  dep_expense_account_id: string | null
}

async function resolveAssetsBranchId(orgId: string, branchId?: string | null) {
  const branchSelection = await resolveAccessibleBranchSelection(orgId, branchId)
  if ('error' in branchSelection) {
    return branchSelection
  }

  return { branchId: branchSelection.branchId }
}

async function requireActiveBranchId(orgId: string, errorMessage: string): Promise<ActiveBranchResult> {
  const branchSelection = await resolveAccessibleBranchSelection(orgId)
  if ('error' in branchSelection || !branchSelection.branchId) {
    return { error: errorMessage }
  }

  return { branchId: branchSelection.branchId }
}

async function getAccessibleAsset(
  supabase: any,
  orgId: string,
  assetId: string,
  branchId: string
): Promise<FixedAssetAccessRecord | null> {
  const { data, error } = await (supabase as any)
    .from('fixed_assets')
    .select(`
      id,
      org_id,
      branch_id,
      accumulated_depreciation,
      current_book_value,
      purchase_price,
      salvage_value,
      useful_life_months,
      last_depreciation_date,
      purchase_date,
      name,
      code,
      status,
      asset_account_id,
      accum_dep_account_id,
      dep_expense_account_id
    `)
    .eq('id', assetId)
    .eq('org_id', orgId)
    .eq('branch_id', branchId)
    .maybeSingle()

  if (error) return null
  return (data as FixedAssetAccessRecord | null) ?? null
}

export async function getFixedAssets(orgId: string, branchId?: string | null) {
  const supabase = await createClient()
  const branchSelection = await resolveAssetsBranchId(orgId, branchId)
  if ('error' in branchSelection) return []

  let query = ((supabase as any).from('fixed_assets') as any)
    .select('*, branch:branches(id, name, code)')
    .eq('org_id', orgId)

  if (branchSelection.branchId) {
    query = query.eq('branch_id', branchSelection.branchId)
  }

  const { data, error } = await query.order('purchase_date', { ascending: false })

  if (error) {
    (console as any).error('Error fetching fixed assets:', error)
    return []
  }

  return data
}

export async function createFixedAsset(orgId: string, assetData: any) {
  const supabase = await createClient()
  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk mendaftarkan aset tetap.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }

  // 1. Persiapan Data (Split Payment Support)
  const { 
    source_account_id, 
    source_lines, 
    payment_method: acquisition_method, // Mapping UI to DB
    cash_amount, 
    liability_amount, 
    cash_account_id, 
    liability_account_id,
    tax_percent,
    tax_account_id,
    tax_amount,
    ...finalAssetData 
  } = assetData

  const { data: asset, error: assetError } = await ((supabase as any).from('fixed_assets') as any)
    .insert({
       ...finalAssetData,
       org_id: orgId,
       branch_id: activeBranchResult.branchId,
       acquisition_method,
       source_account_id: (acquisition_method !== 'SPLIT' && source_account_id) ? source_account_id : null,
       asset_account_id: finalAssetData.asset_account_id || null,
       accum_dep_account_id: finalAssetData.accum_dep_account_id || null,
       dep_expense_account_id: finalAssetData.dep_expense_account_id || null
    })
    .select('*, branch:branches(id, name, code)')
    .single()

  if (assetError) {
    (console as any).error('Error creating fixed asset:', assetError)
    if (assetError.message?.includes('fixed_assets_org_id_code_key')) {
      return { error: `Kode aset "${finalAssetData.code}" sudah digunakan oleh aset lain. Silakan ganti kode aset.` }
    }
    return { error: assetError.message }
  }

  // 2. VALIDASI PAJAK (Audit Guardrail)
  const taxAmount = assetData.tax_amount || 0
  if (assetData.tax_percent > 0 && !assetData.tax_account_id && taxAmount > 0) {
      return { error: 'Akun PPN Masukan harus dipilih jika ada pajak!' }
  }

  // 3. OTOMATIS JURNAL KAPITALISASI (Enterprise Engine)
  const description = `Kapitalisasi Aset: ${asset.name} (${asset.code})`

  const journalLines: any[] = [
    {
      account_id: asset.asset_account_id,
      debit: Number(asset.purchase_price),
      credit: 0,
      memo: `Perolehan Aset Tetap (Base) - ${asset.name}`
    }
  ]

  if (taxAmount > 0 && assetData.tax_account_id) {
    journalLines.push({
      account_id: assetData.tax_account_id,
      debit: taxAmount,
      credit: 0,
      memo: `PPN Masukan Perolehan Aset - ${asset.code}`
    })
  }

  // Hitung total debit dari semua baris — dipakai sebagai kredit sumber dana
  // agar jurnal selalu balance (pajak terpisah: kredit = base + pajak; kapitalisasi: kredit = base+pajak yg sudah masuk ke purchase_price)
  const totalDebit = journalLines.reduce((sum: number, l: any) => sum + (Number(l.debit) || 0), 0)

  if (source_lines && source_lines.length > 0) {
    source_lines.forEach((sl: any) => {
      journalLines.push({
        account_id: sl.account_id,
        debit: 0,
        credit: parseFloat(sl.amount),
        memo: `Pembiayaan Aset - ${asset.code}`
      })
    })
  } else if (source_account_id) {
    journalLines.push({
      account_id: source_account_id,
      debit: 0,
      credit: totalDebit,
      memo: `Pembiayaan Aset - ${asset.code}`
    })
  }

  // Final Balance Guardrail
  if (journalLines.length > 1) {
    const resJournal = await createJournalEntry({
      org_id: orgId,
      branch_id: activeBranchResult.branchId,
      entry_date: asset.purchase_date,
      description: description,
      reference_type: 'ADJUSTMENT',
      reference_id: asset.id,
      auto_post: true,
      lines: journalLines
    })

    if ((resJournal as any).error) {
       // Jika jurnal gagal, kita tampilkan error spesifik (misal: tidak balance)
       return { error: `Aset terdaftar, tapi Jurnal GAGAL: ${(resJournal as any).error}` }
    }
  }

  revalidatePath('/accounting/assets')
  return { data: asset }
}

// ─────────────────────────────────────────────────────────────
// previewOrganizationDepreciation — Idiot-Proof Preview (UX MASTER)
// ─────────────────────────────────────────────────────────────
export async function previewOrganizationDepreciation(orgId: string, branchId?: string | null) {
  const supabase = await createClient()
  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk melihat preview penyusutan aset.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }

  const { data: assets, error: fetchError } = await ((supabase as any).from('fixed_assets') as any)
    .select('*')
    .eq('org_id', orgId)
    .eq('branch_id', activeBranchResult.branchId)
    .eq('status', 'ACTIVE')

  if (fetchError || !assets) return { error: 'Gagal mengambil data aset.' }

  const today = new Date()
  const projections: any[] = []

  for (const asset of assets) {
    let lastDate = asset.last_depreciation_date 
      ? new Date(asset.last_depreciation_date) 
      : new Date(asset.purchase_date)
    
    const currentMonthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    let nextRunDate = asset.last_depreciation_date 
      ? new Date(lastDate.getFullYear(), lastDate.getMonth() + 1, 1)
      : new Date(lastDate.getFullYear(), lastDate.getMonth(), 1)

    while (nextRunDate <= currentMonthEnd) {
      if (asset.current_book_value <= (asset.salvage_value || 0)) break;
      if (asset.useful_life_months <= 0) break;

      const monthlyAmount = (asset.purchase_price - (asset.salvage_value || 0)) / asset.useful_life_months
      const periodLabel = nextRunDate.toLocaleString('id-ID', { month: 'long', year: 'numeric' })

      projections.push({
        asset_name: asset.name,
        asset_code: asset.code,
        period: periodLabel,
        amount: monthlyAmount,
        expense_account: asset.dep_expense_account_id,
        accum_account: asset.accum_dep_account_id
      })

      // Update local values for multi-month simulation
      asset.current_book_value -= monthlyAmount
      nextRunDate = new Date(nextRunDate.getFullYear(), nextRunDate.getMonth() + 1, 1)
    }
  }

  return { projections }
}

// ─────────────────────────────────────────────────────────────
// runOrganizationDepreciation — Main Execution Engine
// ─────────────────────────────────────────────────────────────
export async function runOrganizationDepreciation(orgId: string, branchId?: string | null) {
  const supabase = await createClient()
  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk menjalankan penyusutan aset.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }

  // 1. Ambil semua aset aktif yang bisa disusutkan
  const { data: assets, error: assetError } = await ((supabase as any).from('fixed_assets') as any)
    .select('*')
    .eq('org_id', orgId)
    .eq('branch_id', activeBranchResult.branchId)
    .eq('status', 'ACTIVE')
    .neq('depreciation_method', 'NON_DEPRECIABLE')

  if (assetError) {
    (console as any).error('Depreciation Error:', assetError)
    return { error: 'Gagal memproses data aset.' }
  }

  const today = new Date()
  let totalProcessed = 0

  for (const asset of assets) {
    // Tentukan tanggal terakhir penyusutan (atau tanggal beli jika baru)
    let lastDate = asset.last_depreciation_date 
      ? new Date(asset.last_depreciation_date) 
      : new Date(asset.purchase_date)
    
    // Kita proses untuk setiap bulan yang terlewati sampai BULAN INI (pindah ke akhir bulan berjalan)
    const currentMonthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    
    // Mulai dari: 
    // Jika belum pernah disusutkan, mulai dari BULAN PEMBELIAN (month 0).
    // Jika sudah pernah, mulai dari BULAN BERIKUTNYA.
    let nextRunDate = asset.last_depreciation_date 
      ? new Date(lastDate.getFullYear(), lastDate.getMonth() + 1, 1)
      : new Date(lastDate.getFullYear(), lastDate.getMonth(), 1);

    while (nextRunDate <= currentMonthEnd) {
      console.log(`Processing ${asset.name} for period ${nextRunDate.toISOString()}`);
      
      // Cek apakah sudah habis umur ekonomis atau sudah mencapai nilai sisa
      if (asset.current_book_value <= asset.salvage_value) {
        console.log(`Asset ${asset.name} reached salvage value or is fully depreciated.`);
        break;
      }
      if (asset.useful_life_months <= 0) {
        console.log(`Asset ${asset.name} has zero useful life.`);
        break;
      }

      // Kalkulasi Flat (Garis Lurus): (Harga - Sisa) / Umur
      const monthlyAmount = (asset.purchase_price - asset.salvage_value) / asset.useful_life_months;
      console.log(`Calculated amount: ${monthlyAmount}`);
      
      const periodLabel = nextRunDate.toLocaleString('id-ID', { month: 'long', year: 'numeric' })
      const description = `[AUTO] Penyusutan ${asset.name} (${asset.code}) - ${periodLabel}`
      
      // POSTING JURNAL OTOMATIS
      const journalRes = await createJournalEntry({
        org_id: orgId,
        branch_id: activeBranchResult.branchId,
        entry_date: nextRunDate.toISOString().split('T')[0],
        description: description,
        reference_type: 'DEPRECIATION',
        reference_id: asset.id,
        auto_post: true, // Langsung sah-kan jurnalnya!
        lines: [
          { 
            account_id: asset.dep_expense_account_id, 
            debit: monthlyAmount, 
            credit: 0, 
            memo: `Beban Penyusutan Aset - ${asset.code}` 
          },
          { 
            account_id: asset.accum_dep_account_id, 
            debit: 0, 
            credit: monthlyAmount, 
            memo: `Akumulasi Penyusutan Aset - ${asset.code}` 
          }
        ]
      })

      if (!('error' in journalRes)) {
        // Update data Aset (State Internal)
        const updatedAccum = Number(asset.accumulated_depreciation) + monthlyAmount
        const updatedBook = Number(asset.purchase_price) - updatedAccum

        const { error: updateError } = await ((supabase as any).from('fixed_assets') as any)
          .update({
            accumulated_depreciation: updatedAccum,
            current_book_value: updatedBook,
            last_depreciation_date: nextRunDate.toISOString().split('T')[0]
          })
          .eq('id', asset.id)
          .eq('branch_id', activeBranchResult.branchId)

        if (updateError) (console as any).error('Error updating asset state:', updateError)

        // Catat Log Penyusutan
        await ((supabase as any).from('asset_depreciation_logs') as any).insert({
          asset_id: asset.id,
          org_id: orgId,
          branch_id: activeBranchResult.branchId,
          period_date: nextRunDate.toISOString().split('T')[0],
          amount: monthlyAmount,
          journal_entry_id: (journalRes as any).entryId
        })

        totalProcessed++
        
        // Update local asset object for next iteration in loop
        asset.accumulated_depreciation = updatedAccum
        asset.current_book_value = updatedBook
      } else {
        const errorMsg = `Failed to create journal for asset ${asset.name}: ${(journalRes as any).error}`;
        (console as any).error(errorMsg);
        return { error: errorMsg, success: false, processed: totalProcessed };
      }

      // Lanjut ke bulan berikutnya
      nextRunDate = new Date(nextRunDate.getFullYear(), nextRunDate.getMonth() + 1, 1)
    }
  }

  revalidatePath('/accounting/assets')
  revalidatePath('/accounting/journal')
  
  return { success: true, processed: totalProcessed }
}

export async function updateFixedAsset(assetId: string, orgId: string, assetData: any) {
  const supabase = await createClient()
  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk memperbarui aset tetap.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }

  const accessibleAsset = await getAccessibleAsset(supabase as any, orgId, assetId, activeBranchResult.branchId)
  if (!accessibleAsset) {
    return { error: 'Aset tetap tidak ditemukan pada unit aktif.' }
  }

  const { 
    source_account_id, 
    source_lines, 
    payment_method, 
    cash_amount, 
    liability_amount, 
    cash_account_id, 
    liability_account_id,
    tax_percent,
    tax_account_id,
    tax_amount,
    should_capitalize_tax,
    ...cleanData 
  } = assetData

  // GUARDRAIL: Jika sudah ada penyusutan, melarang edit data finansial
  const { count: logCount } = await ((supabase as any).from('asset_depreciation_logs') as any)
    .select('*', { count: 'exact', head: true })
    .eq('asset_id', accessibleAsset.id)

  if (logCount && logCount > 0) {
     const hasFinancialEdit = 
        (cleanData.purchase_price !== undefined) || 
        (cleanData.salvage_value !== undefined) || 
        (cleanData.useful_life_months !== undefined) ||
        (cleanData.purchase_date !== undefined) ||
        (cleanData.asset_account_id !== undefined);

     if (hasFinancialEdit) {
        return { error: 'Gagal: Data finansial (Harga/Umur/Tanggal) tidak boleh diubah karena aset sudah memiliki histori penyusutan. Gunakan Jurnal Penyesuaian untuk koreksi nilai.' }
     }
  }

  const sanitizedData = {
    ...cleanData,
    asset_account_id: cleanData.asset_account_id || undefined,
    accum_dep_account_id: cleanData.accum_dep_account_id || undefined,
    dep_expense_account_id: cleanData.dep_expense_account_id || undefined,
  }

  const { data, error } = await ((supabase as any).from('fixed_assets') as any)
    .update(sanitizedData)
    .eq('id', accessibleAsset.id)
    .eq('org_id', orgId)
    .eq('branch_id', activeBranchResult.branchId)
    .select('*, branch:branches(id, name, code)')
    .single()

  if (error) {
    (console as any).error('Error updating fixed asset:', error)
    return { error: error.message }
  }

  revalidatePath('/accounting/assets')
  return { data }
}

export async function deleteFixedAsset(assetId: string, orgId: string) {
  const supabase = await createClient()
  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk menghapus aset tetap.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }

  const { error } = await ((supabase as any).from('fixed_assets') as any)
    .delete()
    .eq('id', assetId)
    .eq('org_id', orgId)
    .eq('branch_id', activeBranchResult.branchId)

  if (error) {
    (console as any).error('Error deleting fixed asset:', error)
    return { error: error.message }
  }

  revalidatePath('/accounting/assets')
  return { success: true }
}

export async function disposeFixedAsset(orgId: string, payload: {
  assetId: string
  salePrice: number
  saleDate: string
  cashAccountId: string
  notes?: string
}) {
  const supabase = await createClient()
  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk melepas aset tetap.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }

  const accessibleAsset = await getAccessibleAsset(
    supabase as any,
    orgId,
    payload.assetId,
    activeBranchResult.branchId
  )
  if (!accessibleAsset) {
    return { error: 'Aset tetap tidak ditemukan pada unit aktif.' }
  }

  const { data, error } = await (supabase as any).rpc('process_asset_disposal', {
    p_org_id: orgId,
    p_asset_id: accessibleAsset.id,
    p_sale_price: payload.salePrice,
    p_sale_date: payload.saleDate,
    p_cash_account_id: payload.cashAccountId,
    p_notes: payload.notes || null
  })

  if (error || !data?.success) {
    return { error: data?.error || error?.message || 'Gagal memproses penjualan aset.' }
  }

  revalidatePath('/accounting/assets')
  revalidatePath('/accounting/journal')
  revalidatePath('/accounting/reports')
  return { 
    success: true, 
    gainLoss: data.gain_loss,
    bookValue: data.book_value,
    salePrice: data.sale_price
  }
}
