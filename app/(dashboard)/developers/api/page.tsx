/**
 * app/(dashboard)/developers/api/page.tsx
 *
 * Developer API portal — server component.
 * Hanya bisa diakses oleh owner/admin organisasi.
 */

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getActiveOrg, getBranches } from '@/modules/organization/actions/org.actions'
import {
  listApiKeys,
  getApiConfiguration,
  listWebhookDeliveries,
} from '@/modules/organization/actions/api-key.actions'
import { ApiSettingsClient } from '@/app/(dashboard)/settings/api/ApiSettingsClient'

export const revalidate = 0

export default async function DeveloperApiPage() {
  const orgData = await getActiveOrg()
  if (!orgData) redirect('/onboarding')

  const role = String(orgData.role || '').toLowerCase()
  if (role !== 'owner' && role !== 'admin') redirect('/dashboard')

  const [apiKeys, branches, config, webhookDeliveries] = await Promise.all([
    listApiKeys(orgData.org.id),
    getBranches(orgData.org.id),
    getApiConfiguration(orgData.org.id),
    listWebhookDeliveries(orgData.org.id, 10),
  ])

  // Fetch active CoA accounts for API mappings.
  // The client will split liquid cash/bank accounts (11xx) from counter accounts.
  const { createAdminClient } = await import('@/lib/supabase/server')
  let accounts: Array<{
    id: string
    code: string | null
    name: string | null
    type: string | null
  }> = []
  let bankAccounts: Array<{
    id: string
    branch_id: string | null
    account_id: string | null
    bank_name: string | null
    account_number: string | null
    currency: string | null
  }> = []
  let inventoryProducts: Array<{
    id: string
    sku: string | null
    name: string | null
    type: string | null
    unit: string | null
    purchase_price: number | string | null
    selling_price: number | string | null
    average_cost: number | string | null
    category: string | null
    asset_account_id: string | null
  }> = []
  try {
    const admin = await createAdminClient()
    const [accountsResult, bankAccountsResult, inventoryProductsResult] = await Promise.all([
      admin
        .from('accounts')
        .select('id, code, name, type')
        .eq('org_id', orgData.org.id)
        .eq('is_active', true)
        .order('code', { ascending: true }),
      admin
        .from('bank_accounts')
        .select('id, branch_id, account_id, bank_name, account_number, currency')
        .eq('org_id', orgData.org.id)
        .eq('is_active', true)
        .order('created_at', { ascending: true }),
      admin
        .from('products')
        .select('id, sku, name, type, unit, purchase_price, selling_price, average_cost, category, asset_account_id')
        .eq('org_id', orgData.org.id)
        .eq('is_active', true)
        .eq('type', 'INVENTORY')
        .order('name', { ascending: true })
        .limit(20),
    ])

    accounts = Array.isArray(accountsResult.data) ? accountsResult.data : []
    bankAccounts = Array.isArray(bankAccountsResult.data) ? bankAccountsResult.data : []
    inventoryProducts = Array.isArray(inventoryProductsResult.data) ? inventoryProductsResult.data : []
  } catch {
    // Non-fatal: portal tetap bisa dibuka tanpa daftar akun CoA.
  }

  const requestHeaders = await headers()
  const configuredBaseUrl =
    process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const forwardedProto = requestHeaders.get('x-forwarded-proto')
  const forwardedHost = requestHeaders.get('x-forwarded-host')
  const host = forwardedHost || requestHeaders.get('host')
  const protocol =
    forwardedProto || (host?.includes('localhost') || host?.includes('127.0.0.1') ? 'http' : 'https')
  const baseUrl = host ? `${protocol}://${host}` : configuredBaseUrl

  return (
    <ApiSettingsClient
      orgId={orgData.org.id}
      currentRole={orgData.role}
      initialApiKeys={apiKeys}
      initialConfig={config}
      initialAccounts={accounts}
      initialBankAccounts={bankAccounts}
      initialInventoryProducts={inventoryProducts}
      branches={branches ?? []}
      webhookDeliveries={webhookDeliveries}
      baseUrl={baseUrl}
    />
  )
}
