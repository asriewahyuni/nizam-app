import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getActiveOrg, getActiveBranch } from '@/modules/organization/actions/org.actions'
import { getModuleInstanceStatus } from '@/modules/marketplace/actions/marketplace.actions'
import {
  getWorkshopWorkOrders,
  getWorkshopVehicles,
  getWorkshopServiceRates,
  getWorkshopPartProducts,
} from '@/modules/workshop/actions/workshop.actions'
import { WorkshopClient } from './WorkshopClient'

export const revalidate = 0

export default async function WorkshopPage() {
  const orgData = await getActiveOrg()
  if (!orgData) return redirect('/onboarding')

  // ── Module Onboarding Guard ──
  const moduleInstance = await getModuleInstanceStatus(orgData.org.id, 'Workshop')
  if (!moduleInstance || moduleInstance.status !== 'READY') {
    return redirect('/workshop/onboarding')
  }

  const orgId = orgData.org.id
  const activeBranch = await getActiveBranch(orgId)
  const branchId = activeBranch?.id ?? null
  const supabase = await createClient() as any

  const [workOrders, vehicles, contactsResult, invoicesResult, serviceRates, partProducts] = await Promise.all([
    getWorkshopWorkOrders(orgId),
    getWorkshopVehicles(orgId),
    supabase.from('contacts').select('id, name').eq('org_id', orgId).order('name'),
    // Invoice ter-link ke modul workshop via reference_type
    supabase
      .from('sales')
      .select('id, sale_number, sale_date, grand_total, status, reference_id, customer_id, contacts(name)')
      .eq('org_id', orgId)
      .eq('reference_type', 'WORKSHOP')
      .neq('status', 'VOIDED')
      .order('created_at', { ascending: false }),
    getWorkshopServiceRates(orgId),
    getWorkshopPartProducts(orgId, branchId),
  ])

  const invoices = (invoicesResult.data || []).map((s: any) => ({
    id: String(s.id),
    saleNumber: String(s.sale_number || s.id),
    saleDate: String(s.sale_date || ''),
    grandTotal: Number(s.grand_total || 0),
    status: String(s.status || ''),
    spkId: s.reference_id ? String(s.reference_id) : null,
    customerName: s.contacts?.name || '',
  }))

  return (
    <div className="p-4 md:p-8 min-h-screen">
      <WorkshopClient
        orgId={orgId}
        workOrders={workOrders}
        vehicles={vehicles}
        contacts={contactsResult.data || []}
        invoices={invoices}
        serviceRates={serviceRates}
        partProducts={partProducts}
      />
    </div>
  )
}

