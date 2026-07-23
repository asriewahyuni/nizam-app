import { notFound } from 'next/navigation'
import { LockKeyhole } from 'lucide-react'
import {
  getMemberCheckoutOfferings,
} from '@/modules/member/actions/checkout.actions'
import {
  getPortalMemberContext,
  getPortalTenant,
} from '@/modules/member/lib/portal.server'
import CheckoutForm from './CheckoutForm'

export default async function MemberCheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>
  searchParams: Promise<{ course?: string; product?: string; ref?: string }>
}) {
  const { orgSlug } = await params
  const query = await searchParams
  const tenant = await getPortalTenant(orgSlug)
  if (!tenant) notFound()
  const member = await getPortalMemberContext(tenant)
  const offerings = await getMemberCheckoutOfferings(orgSlug, {
    courseSlug: query.course,
    storeProductId: query.product,
  })

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-emerald-700">Checkout resmi</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Selesaikan pendaftaran</h1>
          <p className="mt-3 max-w-2xl leading-7 text-slate-600">
            Pilih paket dan pembayaran. Akses kelas diberikan otomatis setelah pembayaran tervalidasi.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
          <LockKeyhole aria-hidden="true" size={18} />
          Transaksi terenkripsi
        </div>
      </div>

      {offerings.length === 0 ? (
        <div role="alert" className="rounded-2xl border border-amber-300 bg-amber-50 p-6 text-amber-950">
          Paket untuk program ini belum dikaitkan oleh admin. Checkout belum dapat dilanjutkan.
        </div>
      ) : (
        <CheckoutForm
          orgSlug={orgSlug}
          offerings={offerings}
          initialReferralCode={query.ref || ''}
          signedIn={Boolean(member)}
          memberName={member?.displayName || ''}
          memberEmail={member?.email || ''}
        />
      )}
    </div>
  )
}
