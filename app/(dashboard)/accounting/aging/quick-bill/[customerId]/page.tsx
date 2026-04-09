import { notFound, redirect } from 'next/navigation'
import { getActiveBranch, getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getArQuickBillDocument } from '@/modules/accounting/actions/aging.actions'
import QuickBillDocument from '@/app/(dashboard)/accounting/aging/quick-bill/[customerId]/QuickBillDocument'

function readStringSetting(settings: unknown, key: string) {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return ''
  const value = (settings as Record<string, unknown>)[key]
  return typeof value === 'string' ? value : ''
}

export const dynamic = 'force-dynamic'

/**
 * Printable non-posting quick-bill document sourced from AR aging rows.
 */
export default async function AgingQuickBillPage({
  params,
}: {
  params: Promise<{ customerId: string }>
}) {
  const { customerId } = await params
  const orgData = await getActiveOrg()

  if (!orgData) {
    redirect('/onboarding')
  }

  const activeBranch = await getActiveBranch(orgData.org.id)
  const snapshot = await getArQuickBillDocument(orgData.org.id, customerId, activeBranch?.id)

  if (!snapshot) {
    notFound()
  }

  const orgSettings = orgData.org.settings ?? {}
  const companyProfile = {
    name: readStringSetting(orgSettings, 'brand_name') || orgData.org.name || 'Perusahaan',
    logo: orgData.org.logo_url || '/logo.png',
    address: readStringSetting(orgSettings, 'company_address') || 'Alamat perusahaan belum diatur.',
    email: readStringSetting(orgSettings, 'email') || '',
    hotline: readStringSetting(orgSettings, 'hotline') || '',
    website: readStringSetting(orgSettings, 'website') || '',
  }

  return (
    <QuickBillDocument
      snapshot={snapshot}
      companyProfile={companyProfile}
      activeBranchName={activeBranch?.name ?? null}
    />
  )
}
