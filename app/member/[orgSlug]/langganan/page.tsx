import { notFound, redirect } from 'next/navigation'
import { CalendarClock, RefreshCw, WalletCards } from 'lucide-react'
import {
  getPortalMemberContext,
  getPortalSubscriptions,
  getPortalTenant,
} from '@/modules/member/lib/portal.server'

export default async function MemberSubscriptionsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const tenant = await getPortalTenant(orgSlug)
  if (!tenant) notFound()
  const member = await getPortalMemberContext(tenant)
  if (!member) redirect(`/login?callbackUrl=${encodeURIComponent(`/member/${orgSlug}/langganan`)}`)
  const subscriptions = await getPortalSubscriptions(tenant, member)

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <p className="text-sm font-semibold text-emerald-700">Akses berulang</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Langganan</h1>
      <p className="mt-3 text-slate-600">Pantau status trial, masa aktif, grace period, dan jadwal perpanjangan.</p>

      {subscriptions.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-emerald-300 bg-white p-10 text-center">
          <WalletCards aria-hidden="true" className="mx-auto text-emerald-700" size={42} />
          <h2 className="mt-4 text-lg font-semibold">Tidak ada langganan</h2>
        </div>
      ) : (
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {subscriptions.map((subscription) => (
            <article key={subscription.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="flex size-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
                  <RefreshCw aria-hidden="true" size={20} />
                </span>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">
                  {subscription.status.replaceAll('_', ' ')}
                </span>
              </div>
              <h2 className="mt-5 text-xl font-bold">{subscription.planName}</h2>
              <div className="mt-5 flex items-start gap-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
                <CalendarClock aria-hidden="true" className="mt-0.5 shrink-0 text-emerald-700" size={18} />
                <span>
                  {subscription.nextRenewalAt
                    ? `Perpanjangan berikutnya ${new Intl.DateTimeFormat('id-ID', { dateStyle: 'long' }).format(new Date(subscription.nextRenewalAt))}`
                    : subscription.currentPeriodEnd
                      ? `Aktif sampai ${new Intl.DateTimeFormat('id-ID', { dateStyle: 'long' }).format(new Date(subscription.currentPeriodEnd))}`
                      : 'Tidak ada jadwal perpanjangan.'}
                </span>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
