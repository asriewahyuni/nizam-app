/**
 * /settings/accounts/new/page.tsx
 * SERVER COMPONENT — checks CoA governance permission at server side.
 * Child/Branch orgs are redirected to the CoA request workflow instead.
 */

import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getChartOfAccounts, checkCanManageCoA } from '@/modules/accounting/actions/coa.actions'
import NewAccountForm from './NewAccountForm'

export const metadata: Metadata = { title: 'Tambah Rekening CoA | NIZAM' }

export default async function NewAccountPage() {
  const orgData = await getActiveOrg()

  // Not logged in / no org → onboarding
  if (!orgData) redirect('/onboarding')

  const { canManageDirect } = await checkCanManageCoA(orgData.org.id)

  // Child / Branch: wajib melalui request workflow, tidak boleh akses halaman ini
  if (!canManageDirect) {
    redirect('/accounting/coa-requests')
  }

  // Parent: lanjut ke form
  const accounts = await getChartOfAccounts(orgData.org.id)

  return (
    <NewAccountForm
      orgId={orgData.org.id}
      existingAccounts={accounts}
    />
  )
}
