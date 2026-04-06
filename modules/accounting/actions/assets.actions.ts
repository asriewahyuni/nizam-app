'use server'

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { resolveAccessibleBranchSelection } from '@/modules/organization/lib/branch-access.server'
import { withDbUserContext } from '@/modules/sales/lib/sales-write.server'

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

function normalizeAsset(row: any) {
  return {
    ...row,
    purchase_date: row.purchase_date instanceof Date ? row.purchase_date.toISOString().slice(0, 10) : row.purchase_date,
    last_depreciation_date:
      row.last_depreciation_date instanceof Date ? row.last_depreciation_date.toISOString().slice(0, 10) : row.last_depreciation_date,
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
    purchase_price: Number(row.purchase_price || 0),
    salvage_value: Number(row.salvage_value || 0),
    accumulated_depreciation: Number(row.accumulated_depreciation || 0),
    current_book_value: Number(row.current_book_value || 0),
    branch: row.branches ?? row.branch ?? null,
  }
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
  orgId: string,
  assetId: string,
  branchId: string
): Promise<FixedAssetAccessRecord | null> {
  const data = await prisma.fixed_assets.findFirst({
    where: {
      id: assetId,
      org_id: orgId,
      branch_id: branchId,
    },
    select: {
      id: true,
      org_id: true,
      branch_id: true,
      accumulated_depreciation: true,
      current_book_value: true,
      purchase_price: true,
      salvage_value: true,
      useful_life_months: true,
      last_depreciation_date: true,
      purchase_date: true,
      name: true,
      code: true,
      status: true,
      asset_account_id: true,
      accum_dep_account_id: true,
      dep_expense_account_id: true,
    },
  })

  if (!data) return null

  return {
    id: data.id,
    org_id: data.org_id,
    branch_id: data.branch_id,
    accumulated_depreciation: Number(data.accumulated_depreciation || 0),
    current_book_value: Number(data.current_book_value || 0),
    purchase_price: Number(data.purchase_price || 0),
    salvage_value: Number(data.salvage_value || 0),
    useful_life_months: data.useful_life_months,
    last_depreciation_date: data.last_depreciation_date ? data.last_depreciation_date.toISOString().slice(0, 10) : null,
    purchase_date: data.purchase_date.toISOString().slice(0, 10),
    name: data.name,
    code: data.code,
    status: data.status,
    asset_account_id: data.asset_account_id,
    accum_dep_account_id: data.accum_dep_account_id,
    dep_expense_account_id: data.dep_expense_account_id,
  }
}

export async function getFixedAssets(orgId: string, branchId?: string | null) {
  const branchSelection = await resolveAssetsBranchId(orgId, branchId)
  if ('error' in branchSelection) return []

  try {
    const data = await prisma.fixed_assets.findMany({
      where: {
        org_id: orgId,
        ...(branchSelection.branchId ? { branch_id: branchSelection.branchId } : {}),
      },
      include: {
        branches: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
      orderBy: {
        purchase_date: 'desc',
      },
    })

    return data.map(normalizeAsset)
  } catch (error) {
    console.error('Error fetching fixed assets:', error)
    return []
  }
}

export async function createFixedAsset(orgId: string, assetData: any) {
  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk mendaftarkan aset tetap.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }

  const {
    source_account_id,
    source_lines,
    payment_method: acquisition_method,
    cash_amount,
    liability_amount,
    cash_account_id,
    liability_account_id,
    tax_percent,
    tax_account_id,
    tax_amount,
    ...finalAssetData
  } = assetData

  try {
    const asset = await prisma.fixed_assets.create({
      data: {
        ...finalAssetData,
        org_id: orgId,
        branch_id: activeBranchResult.branchId,
        asset_account_id: finalAssetData.asset_account_id || null,
        accum_dep_account_id: finalAssetData.accum_dep_account_id || null,
        dep_expense_account_id: finalAssetData.dep_expense_account_id || null,
        purchase_date: new Date(`${finalAssetData.purchase_date}T00:00:00.000Z`),
      },
      include: {
        branches: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    })

    const normalizedAsset = normalizeAsset(asset)

    const computedTaxAmount = assetData.tax_amount || 0
    if (assetData.tax_percent > 0 && !assetData.tax_account_id && computedTaxAmount > 0) {
      return { error: 'Akun PPN Masukan harus dipilih jika ada pajak!' }
    }

    const description = `Kapitalisasi Aset: ${normalizedAsset.name} (${normalizedAsset.code})`
    const isCapitalized = assetData.should_capitalize_tax || false
    const totalFunding = normalizedAsset.purchase_price + (isCapitalized ? 0 : computedTaxAmount)

    const journalLines: any[] = [
      {
        account_id: normalizedAsset.asset_account_id,
        debit: normalizedAsset.purchase_price,
        credit: 0,
        memo: `Perolehan Aset Tetap (Base) - ${normalizedAsset.name}`,
      },
    ]

    if (computedTaxAmount > 0 && assetData.tax_account_id) {
      journalLines.push({
        account_id: assetData.tax_account_id,
        debit: computedTaxAmount,
        credit: 0,
        memo: `PPN Masukan Perolehan Aset - ${normalizedAsset.code}`,
      })
    }

    if (source_lines && source_lines.length > 0) {
      source_lines.forEach((sl: any) => {
        journalLines.push({
          account_id: sl.account_id,
          debit: 0,
          credit: parseFloat(sl.amount),
          memo: `Pembiayaan Aset - ${normalizedAsset.code}`,
        })
      })
    } else if (source_account_id) {
      journalLines.push({
        account_id: source_account_id,
        debit: 0,
        credit: totalFunding,
        memo: `Pembiayaan Aset - ${normalizedAsset.code}`,
      })
    }

    if (journalLines.length > 1) {
      const resJournal = await createJournalEntry({
        org_id: orgId,
        branch_id: activeBranchResult.branchId,
        entry_date: normalizedAsset.purchase_date,
        description,
        reference_type: 'ADJUSTMENT',
        reference_id: normalizedAsset.id,
        auto_post: true,
        lines: journalLines,
      })

      if ((resJournal as any).error) {
        return { error: `Aset terdaftar, tapi Jurnal GAGAL: ${(resJournal as any).error}` }
      }
    }

    revalidatePath('/accounting/assets')
    return { data: normalizedAsset }
  } catch (assetError: any) {
    console.error('Error creating fixed asset:', assetError)
    return { error: assetError.message }
  }
}

// ─────────────────────────────────────────────────────────────
// previewOrganizationDepreciation — Idiot-Proof Preview (UX MASTER)
// ─────────────────────────────────────────────────────────────
export async function previewOrganizationDepreciation(orgId: string, branchId?: string | null) {
  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk melihat preview penyusutan aset.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }

  const assets = await prisma.fixed_assets.findMany({
    where: {
      org_id: orgId,
      branch_id: activeBranchResult.branchId,
      status: 'ACTIVE',
    },
  })

  if (!assets) return { error: 'Gagal mengambil data aset.' }

  const today = new Date()
  const projections: any[] = []

  for (const assetRow of assets) {
    const asset = {
      ...assetRow,
      purchase_price: Number(assetRow.purchase_price || 0),
      salvage_value: Number(assetRow.salvage_value || 0),
      current_book_value: Number(assetRow.current_book_value || 0),
      accumulated_depreciation: Number(assetRow.accumulated_depreciation || 0),
    }

    const lastDate = asset.last_depreciation_date
      ? new Date(asset.last_depreciation_date)
      : new Date(asset.purchase_date)

    const currentMonthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    let nextRunDate = asset.last_depreciation_date
      ? new Date(lastDate.getFullYear(), lastDate.getMonth() + 1, 1)
      : new Date(lastDate.getFullYear(), lastDate.getMonth(), 1)

    while (nextRunDate <= currentMonthEnd) {
      if (asset.current_book_value <= (asset.salvage_value || 0)) break
      if (asset.useful_life_months <= 0) break

      const monthlyAmount = (asset.purchase_price - (asset.salvage_value || 0)) / asset.useful_life_months
      const periodLabel = nextRunDate.toLocaleString('id-ID', { month: 'long', year: 'numeric' })

      projections.push({
        asset_name: asset.name,
        asset_code: asset.code,
        period: periodLabel,
        amount: monthlyAmount,
        expense_account: asset.dep_expense_account_id,
        accum_account: asset.accum_dep_account_id,
      })

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
  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk menjalankan penyusutan aset.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }

  let assets: Awaited<ReturnType<typeof prisma.fixed_assets.findMany>> = []
  try {
    assets = await prisma.fixed_assets.findMany({
      where: {
        org_id: orgId,
        branch_id: activeBranchResult.branchId,
        status: 'ACTIVE',
        depreciation_method: { not: 'NON_DEPRECIABLE' as any },
      },
    })
  } catch (assetError) {
    console.error('Depreciation Error:', assetError)
    return { error: 'Gagal memproses data aset.' }
  }

  const today = new Date()
  let totalProcessed = 0

  for (const assetRow of assets) {
    const asset: any = {
      ...assetRow,
      purchase_price: Number(assetRow.purchase_price || 0),
      salvage_value: Number(assetRow.salvage_value || 0),
      current_book_value: Number(assetRow.current_book_value || 0),
      accumulated_depreciation: Number(assetRow.accumulated_depreciation || 0),
    }

    const lastDate = asset.last_depreciation_date
      ? new Date(asset.last_depreciation_date)
      : new Date(asset.purchase_date)

    const currentMonthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    let nextRunDate = asset.last_depreciation_date
      ? new Date(lastDate.getFullYear(), lastDate.getMonth() + 1, 1)
      : new Date(lastDate.getFullYear(), lastDate.getMonth(), 1)

    while (nextRunDate <= currentMonthEnd) {
      console.log(`Processing ${asset.name} for period ${nextRunDate.toISOString()}`)

      if (asset.current_book_value <= asset.salvage_value) {
        console.log(`Asset ${asset.name} reached salvage value or is fully depreciated.`)
        break
      }
      if (asset.useful_life_months <= 0) {
        console.log(`Asset ${asset.name} has zero useful life.`)
        break
      }

      const monthlyAmount = (asset.purchase_price - asset.salvage_value) / asset.useful_life_months
      console.log(`Calculated amount: ${monthlyAmount}`)

      const periodLabel = nextRunDate.toLocaleString('id-ID', { month: 'long', year: 'numeric' })
      const description = `[AUTO] Penyusutan ${asset.name} (${asset.code}) - ${periodLabel}`

      const journalRes = await createJournalEntry({
        org_id: orgId,
        branch_id: activeBranchResult.branchId,
        entry_date: nextRunDate.toISOString().split('T')[0],
        description,
        reference_type: 'DEPRECIATION',
        reference_id: asset.id,
        auto_post: true,
        lines: [
          {
            account_id: asset.dep_expense_account_id,
            debit: monthlyAmount,
            credit: 0,
            memo: `Beban Penyusutan Aset - ${asset.code}`,
          },
          {
            account_id: asset.accum_dep_account_id,
            debit: 0,
            credit: monthlyAmount,
            memo: `Akumulasi Penyusutan Aset - ${asset.code}`,
          },
        ],
      })

      if (!('error' in journalRes)) {
        const updatedAccum = Number(asset.accumulated_depreciation) + monthlyAmount
        const updatedBook = Number(asset.purchase_price) - updatedAccum

        try {
          await prisma.fixed_assets.update({
            where: { id: asset.id },
            data: {
              accumulated_depreciation: updatedAccum,
              current_book_value: updatedBook,
              last_depreciation_date: new Date(nextRunDate.toISOString().split('T')[0] + 'T00:00:00.000Z'),
            },
          })

          await prisma.asset_depreciation_logs.create({
            data: {
              asset_id: asset.id,
              org_id: orgId,
              branch_id: activeBranchResult.branchId,
              period_date: new Date(nextRunDate.toISOString().split('T')[0] + 'T00:00:00.000Z'),
              amount: monthlyAmount,
              journal_entry_id: (journalRes as any).entryId,
            },
          })
        } catch (updateError) {
          console.error('Error updating asset state:', updateError)
        }

        totalProcessed++
        asset.accumulated_depreciation = updatedAccum
        asset.current_book_value = updatedBook
      } else {
        const errorMsg = `Failed to create journal for asset ${asset.name}: ${(journalRes as any).error}`
        console.error(errorMsg)
        return { error: errorMsg, success: false, processed: totalProcessed }
      }

      nextRunDate = new Date(nextRunDate.getFullYear(), nextRunDate.getMonth() + 1, 1)
    }
  }

  revalidatePath('/accounting/assets')
  revalidatePath('/accounting/journal')

  return { success: true, processed: totalProcessed }
}

export async function updateFixedAsset(assetId: string, orgId: string, assetData: any) {
  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk memperbarui aset tetap.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }

  const accessibleAsset = await getAccessibleAsset(orgId, assetId, activeBranchResult.branchId)
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

  const logCount = await prisma.asset_depreciation_logs.count({
    where: {
      asset_id: accessibleAsset.id,
    },
  })

  if (logCount > 0) {
    const hasFinancialEdit =
      cleanData.purchase_price !== undefined ||
      cleanData.salvage_value !== undefined ||
      cleanData.useful_life_months !== undefined ||
      cleanData.purchase_date !== undefined ||
      cleanData.asset_account_id !== undefined

    if (hasFinancialEdit) {
      return { error: 'Gagal: Data finansial (Harga/Umur/Tanggal) tidak boleh diubah karena aset sudah memiliki histori penyusutan. Gunakan Jurnal Penyesuaian untuk koreksi nilai.' }
    }
  }

  const sanitizedData = {
    ...cleanData,
    asset_account_id: cleanData.asset_account_id || undefined,
    accum_dep_account_id: cleanData.accum_dep_account_id || undefined,
    dep_expense_account_id: cleanData.dep_expense_account_id || undefined,
    ...(cleanData.purchase_date ? { purchase_date: new Date(`${cleanData.purchase_date}T00:00:00.000Z`) } : {}),
  }

  try {
    const data = await prisma.fixed_assets.update({
      where: {
        id: accessibleAsset.id,
      },
      data: sanitizedData as any,
      include: {
        branches: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    })

    revalidatePath('/accounting/assets')
    return { data: normalizeAsset(data) }
  } catch (error: any) {
    console.error('Error updating fixed asset:', error)
    return { error: error.message }
  }
}

export async function deleteFixedAsset(assetId: string, orgId: string) {
  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk menghapus aset tetap.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }

  try {
    await prisma.fixed_assets.deleteMany({
      where: {
        id: assetId,
        org_id: orgId,
        branch_id: activeBranchResult.branchId,
      },
    })
  } catch (error: any) {
    console.error('Error deleting fixed asset:', error)
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
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return { error: 'Tidak terautentikasi.' }

  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk melepas aset tetap.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }

  const accessibleAsset = await getAccessibleAsset(
    orgId,
    payload.assetId,
    activeBranchResult.branchId
  )
  if (!accessibleAsset) {
    return { error: 'Aset tetap tidak ditemukan pada unit aktif.' }
  }

  try {
    const data: any = await withDbUserContext(userId, async (tx) => {
      const result = await tx.$queryRaw`
        SELECT process_asset_disposal(
          ${orgId}::uuid,
          ${accessibleAsset.id}::uuid,
          ${payload.salePrice}::numeric,
          ${payload.saleDate}::date,
          ${payload.cashAccountId}::uuid,
          ${payload.notes || null}
        ) as result
      `
      return (result as any[])[0]?.result
    })

    if (!data?.success) {
      return { error: data?.error || 'Gagal memproses penjualan aset.' }
    }

    revalidatePath('/accounting/assets')
    revalidatePath('/accounting/journal')
    revalidatePath('/accounting/reports')
    return {
      success: true,
      gainLoss: data.gain_loss,
      bookValue: data.book_value,
      salePrice: data.sale_price,
    }
  } catch (error: any) {
    return { error: error?.message || 'Gagal memproses penjualan aset.' }
  }
}
