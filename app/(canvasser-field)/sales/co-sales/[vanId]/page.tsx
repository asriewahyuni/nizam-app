import { redirect, notFound } from 'next/navigation'
import { getActiveOrg, getActiveBranch } from '@/modules/organization/actions/org.actions'
import {
  getCanvasserVans,
  getTodaySession,
  getSessionVisits,
  getVanCustomerRoster,
} from '@/modules/canvasser/actions/canvasser.actions'
import { getOrgBrandColor } from '@/modules/canvasser/lib/canvasser-theme.server'
import { queryPostgres } from '@/lib/db/postgres'
import { VanOperationalClient } from './VanOperationalClient'

export default async function VanOperationalPage({
  params,
}: {
  params: Promise<{ vanId: string }>
}) {
  const { vanId } = await params
  const orgData = await getActiveOrg()
  if (!orgData) redirect('/onboarding')

  const orgId = orgData.org.id
  const activeBranch = await getActiveBranch(orgId)

  const vans = await getCanvasserVans(orgId)
  const van = vans.find(v => v.id === vanId)
  if (!van) notFound()

  const session = await getTodaySession(orgId, vanId)
  const [visits, contactsRes, productsRes, roster, unassignedRes, brandColor, warehousesRes] = await Promise.all([
    session ? getSessionVisits(orgId, session.id) : Promise.resolve([]),
    queryPostgres<{ id: string; name: string; address: string | null; credit_limit: string }>(
      `SELECT id, name, address, credit_limit FROM contacts
       WHERE org_id = $1 AND is_active = true AND type IN ('CUSTOMER', 'BOTH')
         AND assigned_van_id = $2
       ORDER BY name ASC`,
      [orgId, vanId]
    ),
    queryPostgres<{ id: string; name: string; unit: string; selling_price: string }>(
      `SELECT id, name, unit, selling_price FROM products
       WHERE org_id = $1 AND type = 'INVENTORY' AND is_active = true
       ORDER BY name ASC`,
      [orgId]
    ),
    getVanCustomerRoster(orgId, vanId),
    queryPostgres<{ id: string; name: string }>(
      `SELECT id, name FROM contacts
       WHERE org_id = $1 AND is_active = true AND type IN ('CUSTOMER', 'BOTH')
         AND assigned_van_id IS NULL
       ORDER BY name ASC`,
      [orgId]
    ),
    getOrgBrandColor(orgId),
    queryPostgres<{ id: string; name: string }>(
      `SELECT id, name FROM warehouses WHERE org_id = $1 AND is_active = true ORDER BY name ASC`,
      [orgId]
    ),
  ])
  const warehouses = warehousesRes.rows.map(w => ({ id: w.id, name: w.name }))

  const contacts = contactsRes.rows.map(c => ({
    id: c.id,
    name: c.name,
    address: c.address,
    creditLimit: Number(c.credit_limit),
  }))
  const products = productsRes.rows.map(p => ({
    id: p.id,
    name: p.name,
    unit: p.unit,
    sellingPrice: Number(p.selling_price),
  }))
  const unassignedContacts = unassignedRes.rows.map(c => ({ id: c.id, name: c.name }))

  return (
    <VanOperationalClient
      orgId={orgId}
      branchId={activeBranch?.id || null}
      van={van}
      session={session}
      visits={visits}
      contacts={contacts}
      products={products}
      roster={roster}
      unassignedContacts={unassignedContacts}
      brandColor={brandColor}
      warehouses={warehouses}
    />
  )
}
