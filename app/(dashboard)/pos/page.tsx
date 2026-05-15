import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import POSClient from './POSClient'
import { getActiveBranch, getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getModuleInstanceStatus } from '@/modules/marketplace/actions/marketplace.actions'
import { getProducts } from '@/modules/inventory/actions/inventory.actions'
import { getWarehouses } from '@/modules/inventory/actions/warehouse.actions'
import type { ProductWithStock } from '@/modules/inventory/actions/inventory.actions'
import { getPosShiftHistory, getPosShiftSnapshot } from '@/modules/sales/actions/pos-shift.actions'
import { getPosShiftConfig, isPosShiftFeatureEnabled } from '@/modules/sales/lib/pos-shift'

export default async function POSPage() {
  const orgData = await getActiveOrg()
  if (!orgData) redirect('/onboarding')

  // ── Module Onboarding Guard ──
  const moduleInstance = await getModuleInstanceStatus(orgData.org.id, 'POS')
  if (!moduleInstance || moduleInstance.status !== 'READY') {
    return redirect('/pos/onboarding')
  }

  const supabase = await createClient()
  const orgId = orgData.org.id
  const activeBranch = await getActiveBranch(orgId)
  const posShiftConfig = getPosShiftConfig(orgData.org.settings || {})
  const [products, warehouses, { data: customers }, { data: accounts }, { data: employeeProfile }, posShiftSnapshot, posShiftHistory] = await Promise.all([
    activeBranch ? getProducts(orgId, activeBranch.id) : Promise.resolve([]),
    activeBranch ? getWarehouses(orgId, activeBranch.id) : Promise.resolve([]),
    supabase.from('contacts').select('id, name, phone').eq('org_id', orgId).eq('type', 'CUSTOMER'),
    supabase.from('accounts').select('id, name, code, type').eq('org_id', orgId).eq('is_active', true),
    supabase
      .from('employees')
      .select('first_name, last_name')
      .eq('org_id', orgId)
      .eq('user_id', orgData.user.id)
      .maybeSingle(),
    isPosShiftFeatureEnabled(posShiftConfig)
      ? getPosShiftSnapshot(orgId)
      : Promise.resolve(null),
    isPosShiftFeatureEnabled(posShiftConfig)
      ? getPosShiftHistory(orgId)
      : Promise.resolve(null),
  ])

  const isReadyToSellInventory = (product: ProductWithStock) => {
    const productType = String(product?.type || '').trim().toUpperCase()
    const normalizedCategory = String(product?.category || '').trim().toLowerCase()
    const normalizedSku = String(product?.sku || '').trim().toUpperCase()

    if (productType !== 'INVENTORY') return false

    return (
      normalizedCategory === 'siap jual' ||
      normalizedCategory === 'barang jadi' ||
      normalizedCategory === 'fg' ||
      normalizedSku.startsWith('FG-')
    )
  }

  const productsWithStock = (products || [])
    .filter((product) => product.is_active && isReadyToSellInventory(product))
    .map((product) => ({
      ...product,
      stock: Number(product.stock_available || 0),
    }))

  const employeeRow = (employeeProfile || null) as { first_name?: string | null; last_name?: string | null } | null
  const employeeFirstName = String(employeeRow?.first_name || '').trim()
  const employeeLastName = String(employeeRow?.last_name || '').trim()
  const employeeFullName = [employeeFirstName, employeeLastName].filter(Boolean).join(' ').trim()
  const userMetadata = ((orgData.user.user_metadata || {}) as Record<string, unknown>)
  const metadataName = String(
    (typeof userMetadata.full_name === 'string' ? userMetadata.full_name : '') ||
    (typeof userMetadata.name === 'string' ? userMetadata.name : '')
  ).trim()
  const emailPrefix = String(orgData.user.email || '').split('@')[0]?.trim() || ''
  const currentUserDisplayName = employeeFullName || metadataName || emailPrefix || 'User'
    
  return (
    <POSClient
      orgId={orgId}
      org={orgData.org}
      products={productsWithStock}
      customers={customers || []}
      accounts={accounts || []}
      warehouses={warehouses || []}
      currentUser={orgData.user}
      currentUserDisplayName={currentUserDisplayName}
      currentOrgRole={orgData.role || null}
      activeBranchId={activeBranch?.id || null}
      activeBranchName={activeBranch?.name || null}
      posShiftConfig={posShiftConfig}
      posShiftSnapshot={posShiftSnapshot}
      initialShiftHistory={posShiftHistory}
    />
  )
}
