import { notFound } from 'next/navigation'
import { getPortalTenant } from '@/modules/member/lib/portal.server'
import AccountClaimForm from './AccountClaimForm'

export default async function AccountClaimPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>
  searchParams: Promise<{ token?: string }>
}) {
  const { orgSlug } = await params
  const { token = '' } = await searchParams
  const tenant = await getPortalTenant(orgSlug)
  if (!tenant) notFound()

  return (
    <div className="mx-auto max-w-xl px-4 py-12 sm:px-6">
      {token ? (
        <AccountClaimForm orgSlug={orgSlug} token={token} />
      ) : (
        <div role="alert" className="rounded-2xl border border-amber-300 bg-amber-50 p-6 text-amber-950">
          Tautan klaim akun tidak lengkap. Gunakan tautan terbaru yang dikirim ke email Anda.
        </div>
      )}
    </div>
  )
}
