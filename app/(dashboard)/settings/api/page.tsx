/**
 * app/(dashboard)/settings/api/page.tsx
 *
 * Halaman pengaturan Open API — server component.
 * Hanya bisa diakses oleh owner/admin organisasi.
 */

import { redirect } from 'next/navigation'
import { getActiveOrg, getBranches } from '@/modules/organization/actions/org.actions'
import {
  listApiKeys,
  getApiConfiguration,
  listWebhookDeliveries,
} from '@/modules/organization/actions/api-key.actions'
import { ApiSettingsClient } from './ApiSettingsClient'

export const revalidate = 0

export default async function ApiSettingsPage() {
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

  // Fetch CoA accounts needed by cash-in / cash-out mapping:
  // asset accounts for kas/bank, plus revenue/expense counter accounts.
  const { createAdminClient } = await import('@/lib/supabase/server')
  let accounts: Array<{ id: string; code: string; name: string; type: string }> = []
  try {
    const admin = await createAdminClient()
    const { data } = await admin
      .from('accounts')
      .select('id, code, name, type')
      .eq('org_id', orgData.org.id)
      .in('type', ['ASSET', 'REVENUE', 'EXPENSE'])
      .eq('is_active', true)
      .order('code', { ascending: true })
    accounts = Array.isArray(data) ? data : []
  } catch { /* non-fatal */ }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://brain.kliknizam.app'

  return (
    <ApiSettingsClient
      orgId={orgData.org.id}
      currentRole={orgData.role}
      initialApiKeys={apiKeys}
      initialConfig={config}
      initialAccounts={accounts}
      branches={branches ?? []}
      webhookDeliveries={webhookDeliveries}
      baseUrl={baseUrl}
    />
  )
}
