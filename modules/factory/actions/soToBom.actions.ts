'use server'

import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { resolveAccessibleBranchSelection } from '@/modules/organization/lib/branch-access.server'
import { revalidatePath } from 'next/cache'

export async function generateProductionFromSO(orgId: string, saleId: string) {
  const branchSelection = await resolveAccessibleBranchSelection(orgId)
  if ('error' in branchSelection || !branchSelection.branchId) {
    return { error: 'Pilih unit aktif terlebih dahulu untuk memproses produksi.' }
  }

  // Fetch the sale
  const sale = await prisma.sales.findFirst({
    where: { id: saleId, org_id: orgId },
    include: { sales_items: true },
  })

  if (!sale) return { error: 'Pesanan tidak ditemukan.' }
  
  const items = sale.sales_items || []
  if (items.length === 0) return { error: 'Pesanan tidak memiliki barang.' }

  let count = 0
  
  for (const item of items) {
    if (!item.product_id) continue // Must be a catalog product

    // Note: To avoid duplicate BOM for the same SO item, we can check if a BOM with this code already exists
    const code = `BOM-ISO-${sale.sale_number}-${String(item.id).substring(0, 4).toUpperCase()}`
    
    // Check if BoM already exists
    const existingBom = await prisma.production_boms.findFirst({
      where: { code, org_id: orgId },
      select: { id: true },
    })
      
    let bomId = existingBom?.id

    if (!bomId) {
      try {
        const bom = await prisma.production_boms.create({
          data: {
          org_id: orgId,
          branch_id: branchSelection.branchId,
          product_id: item.product_id,
          code,
          description: `BOM Otomatis SO: ${sale.sale_number} - ${item.description}`,
          is_active: true,
          },
          select: { id: true },
        })
        bomId = bom.id
      } catch (error) {
        return { error: 'Gagal membuat BoM: ' + (error instanceof Error ? error.message : 'Unknown error') }
      }
    }

    // Determine target SPK number
    let wo_number = `SPK-${sale.sale_number}-${count + 1}`
    
    // Check if SPK exists
    const existingWo = await prisma.production_work_orders.findFirst({
      where: { wo_number, org_id: orgId },
      select: { id: true },
    })

    if (existingWo) {
      // SPK already exists => Append random to wo_number or skip
      wo_number = `${wo_number}-${Math.floor(1000 + Math.random() * 9000)}`
    }

    // Create Work Order
    try {
      await prisma.$executeRaw(Prisma.sql`
        INSERT INTO public.production_work_orders (
          org_id,
          branch_id,
          bom_id,
          wo_number,
          quantity_planned,
          status,
          notes,
          deadline_date
        ) VALUES (
          CAST(${orgId} AS uuid),
          CAST(${branchSelection.branchId} AS uuid),
          CAST(${bomId} AS uuid),
          ${wo_number},
          ${Number(item.quantity || 0)},
          'DRAFT',
          ${`Diproses otomatis dari SO: ${sale.sale_number}\nItem: ${item.description}`},
          CAST(${sale.due_date ? new Date(sale.due_date).toISOString().slice(0, 10) : null} AS date)
        )
      `)
    } catch (error) {
      return { error: 'Gagal membuat SPK: ' + (error instanceof Error ? error.message : 'Unknown error') }
    }
    count++
  }

  if (count === 0) return { error: 'Pesanan tidak memiliki item katalog produk. Pembuatan BoM gagal.' }

  revalidatePath('/sales')
  revalidatePath('/factory')
  
  return { success: true }
}
