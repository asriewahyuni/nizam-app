'use server'

import { createClient } from '@/lib/supabase/server'
import { resolveAccessibleBranchSelection } from '@/modules/organization/lib/branch-access.server'
import { revalidatePath } from 'next/cache'

export async function generateProductionFromSO(orgId: string, saleId: string) {
  const supabase = await createClient()
  const branchSelection = await resolveAccessibleBranchSelection(orgId)
  if ('error' in branchSelection || !branchSelection.branchId) {
    return { error: 'Pilih unit aktif terlebih dahulu untuk memproses produksi.' }
  }

  // Fetch the sale
  const { data: sale, error: saleErr } = await (supabase as any)
    .from('sales')
    .select('*, sales_items(*)')
    .eq('id', saleId)
    .eq('org_id', orgId)
    .single()

  if (saleErr || !sale) return { error: 'Pesanan tidak ditemukan.' }
  
  const items = sale.sales_items || []
  if (items.length === 0) return { error: 'Pesanan tidak memiliki barang.' }

  let count = 0
  
  for (const item of items) {
    if (!item.product_id) continue // Must be a catalog product

    // Note: To avoid duplicate BOM for the same SO item, we can check if a BOM with this code already exists
    const code = `BOM-ISO-${sale.sale_number}-${String(item.id).substring(0, 4).toUpperCase()}`
    
    // Check if BoM already exists
    const { data: existingBom } = await (supabase as any)
      .from('production_boms')
      .select('id')
      .eq('code', code)
      .eq('org_id', orgId)
      .maybeSingle()
      
    let bomId = existingBom?.id

    if (!bomId) {
      const { data: bom, error: bomErr } = await (supabase as any)
        .from('production_boms')
        .insert({
          org_id: orgId,
          branch_id: branchSelection.branchId,
          product_id: item.product_id,
          code: code,
          description: `BOM Otomatis SO: ${sale.sale_number} - ${item.description}`,
          is_active: true
        })
        .select('id')
        .single()

      if (bomErr) return { error: 'Gagal membuat BoM: ' + bomErr.message }
      bomId = bom.id
    }

    // Determine target SPK number
    let wo_number = `SPK-${sale.sale_number}-${count + 1}`
    
    // Check if SPK exists
    const { data: existingWo } = await (supabase as any)
      .from('production_work_orders')
      .select('id')
      .eq('wo_number', wo_number)
      .eq('org_id', orgId)
      .maybeSingle()

    if (existingWo) {
      // SPK already exists => Append random to wo_number or skip
      wo_number = `${wo_number}-${Math.floor(1000 + Math.random() * 9000)}`
    }

    // Create Work Order
    const { error: woErr } = await (supabase as any)
      .from('production_work_orders')
      .insert({
        org_id: orgId,
        branch_id: branchSelection.branchId,
        bom_id: bomId,
        wo_number: wo_number,
        quantity_planned: item.quantity,
        status: 'DRAFT',
        notes: `Diproses otomatis dari SO: ${sale.sale_number}\nItem: ${item.description}`,
        deadline_date: sale.due_date || null
      })

    if (woErr) return { error: 'Gagal membuat SPK: ' + woErr.message }
    count++
  }

  if (count === 0) return { error: 'Pesanan tidak memiliki item katalog produk. Pembuatan BoM gagal.' }

  revalidatePath('/sales')
  revalidatePath('/factory')
  
  return { success: true }
}
