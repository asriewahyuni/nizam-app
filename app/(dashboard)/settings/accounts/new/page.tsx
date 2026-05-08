/**
 * /settings/accounts/new/page.tsx
 * SERVER COMPONENT — checks CoA governance permission at server side.
 * Entitas mode INHERITED diarahkan ke workflow request, sedangkan mode LOCAL
 * tetap menggunakan halaman CoA biasa bila konteks unit aktif belum sesuai.
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

  const { canManageDirect, managementMode } = await checkCanManageCoA(orgData.org.id)

  // Mode INHERITED: wajib melalui request workflow.
  if (!canManageDirect) {
    redirect(managementMode === 'LOCAL' ? '/settings/accounts' : '/accounting/coa-requests')
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
