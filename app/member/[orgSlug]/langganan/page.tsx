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
    <div className="px-4 py-6">
      <p className="text-xs font-semibold text-emerald-700">Akses berulang</p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight">Langganan</h1>
      <p className="mt-2 text-xs text-slate-600">Pantau status trial, masa aktif, grace period, dan jadwal perpanjangan.</p>

      {subscriptions.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-emerald-300 bg-white p-6 text-center">
          <WalletCards aria-hidden="true" className="mx-auto text-emerald-700" size={36} />
          <h2 className="mt-3 text-sm font-semibold">Tidak ada langganan</h2>
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-4">
          {subscriptions.map((subscription) => (
            <article key={subscription.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
                  <RefreshCw aria-hidden="true" size={18} />
                </span>
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
                  {subscription.status.replaceAll('_', ' ')}
                </span>
              </div>
              <h2 className="mt-4 text-lg font-bold">{subscription.planName}</h2>
              <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-slate-50 p-3 text-xs text-slate-700">
                <CalendarClock aria-hidden="true" className="mt-0.5 shrink-0 text-emerald-700" size={16} />
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
