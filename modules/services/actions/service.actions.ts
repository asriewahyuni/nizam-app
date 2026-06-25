'use server'

import type { LooseDb } from '@/lib/supabase/loose'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { resolveAccessibleBranchSelection } from '@/modules/organization/lib/branch-access.server'
import type { ServiceOrderSeed } from '@/modules/services/lib/service-order'

type BranchResult =
  | { branchId: string | null }
  | { error: string }

async function resolveServiceBranchSelection(orgId: string, branchId?: string | null): Promise<BranchResult> {
  const branchSelection = await resolveAccessibleBranchSelection(orgId, branchId)
  if ('error' in branchSelection) {
    return { error: branchSelection.error || 'Akses unit tidak valid.' }
  }

  return { branchId: branchSelection.branchId }
}

async function requireCreateBranchId(orgId: string): Promise<{ branchId: string } | { error: string }> {
  const branchSelection = await resolveServiceBranchSelection(orgId)
  if ('error' in branchSelection || !branchSelection.branchId) {
    return { error: 'Pilih unit aktif terlebih dahulu untuk membuat job order.' }
  }

  return { branchId: branchSelection.branchId as string }
}

export async function getServiceOrders(orgId: string, branchId?: string | null) {
  const supabase = await createClient()
  const db = supabase as unknown as LooseDb
  const branchSelection = await resolveServiceBranchSelection(orgId, branchId)
  if ('error' in branchSelection) return []

  let query = db
    .from('service_orders')
    .select(`
      *,
      branch:branches(id, name, code),
      contact:contacts(id, name)
    `)
    .eq('org_id', orgId)

  if (branchSelection.branchId) {
    query = query.eq('branch_id', branchSelection.branchId)
  }

  const { data, error } = await query.order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching Service Orders:', error)
    return []
  }

  return data
}

export async function getServiceOrderSeeds(orgId: string, branchId?: string | null): Promise<ServiceOrderSeed[]> {
  const rows = await getServiceOrders(orgId, branchId)

  return rows.map((row: Record<string, unknown>) => ({
    id: String(row.id || ''),
    jobNumber: String(row.job_number || ''),
    description: String(row.description || ''),
    notes: String(row.notes || ''),
    estimatedCost: Number(row.estimated_cost || 0),
    status: String(row.status || 'PENDING'),
    branchName: String(((row.branch as { name?: unknown } | null)?.name) || ''),
    startDate: typeof row.start_date === 'string' ? row.start_date : null,
  }))
}

export async function createServiceOrder(orgId: string, formData: FormData) {
  const supabase = await createClient()
  const db = supabase as unknown as LooseDb
  const activeBranch = await requireCreateBranchId(orgId)
  if ('error' in activeBranch) return { error: activeBranch.error }

  const payload = {
    org_id: orgId,
    branch_id: activeBranch.branchId,
    contact_id: formData.get('contact_id') as string,
    job_number: formData.get('job_number') as string,
    description: formData.get('description') as string,
    status: 'PENDING',
    start_date: formData.get('start_date') as string,
    notes: formData.get('notes') as string,
    estimated_cost: Number(formData.get('estimated_cost'))
  }

  const { error } = await db.from('service_orders').insert(payload)

  if (error) return { error: error.message }

  revalidatePath('/services')
  return { success: true }
}

export async function updateServiceStatus(orgId: string, orderId: string, status: string) {
  const supabase = await createClient()
  const db = supabase as unknown as LooseDb
  const { data: order, error: orderError } = await db
    .from('service_orders')
    .select('id, branch_id, contact_id, job_number, estimated_cost, description')
    .eq('id', orderId)
    .eq('org_id', orgId)
    .maybeSingle()

  if (orderError) return { error: orderError.message }
  if (!order?.branch_id) return { error: 'Job order tidak ditemukan.' }

  const branchSelection = await resolveServiceBranchSelection(orgId, order.branch_id)
  if ('error' in branchSelection) return { error: branchSelection.error }

  const { error } = await db
    .from('service_orders')
    .update({ status })
    .eq('id', orderId)
    .eq('org_id', orgId)
    .eq('branch_id', order.branch_id)

  if (error) return { error: error.message }

  // Buat Invoice via Operational Bridge jika selesai
  if (status === 'COMPLETED' && order.estimated_cost && Number(order.estimated_cost) > 0) {
    const { createInvoiceFromOperational } = await import('@/modules/operational-bridge/actions/bridge.actions')
    
    // Ambil info kontak jika ada
    let contactName = undefined
    if (order.contact_id) {
      const { data: contact } = await db.from('contacts').select('name').eq('id', order.contact_id).maybeSingle()
      if (contact) contactName = String(contact.name)
    }

    try {
      await createInvoiceFromOperational({
        context: { type: 'JOB_ORDER', referenceId: orderId, orderNumber: String(order.job_number) },
        customerId: String(order.contact_id || ''),
        customerName: contactName,
        items: [{
          product_name: `Jasa Service: ${order.description || order.job_number}`,
          quantity: 1,
          unit_price: Number(order.estimated_cost),
          unit: 'Pcs'
        }],
        notes: `Penyelesaian Job Order ${order.job_number}`,
        paymentTerm: 'LUNAS',
        saleDate: new Date().toISOString().split('T')[0],
      })
    } catch (e) {
      console.error('[updateServiceStatus] Error creating invoice from bridge:', e)
      // Non-blocking error for status update
    }
  }

  revalidatePath('/services')
  return { success: true }
}
