import { notFound, redirect } from 'next/navigation'
import { Copy, HandCoins, Link2, MousePointerClick } from 'lucide-react'
import { formatRupiah } from '@/lib/utils'
import {
  getPortalAffiliateDashboard,
  getPortalMemberContext,
  getPortalTenant,
} from '@/modules/member/lib/portal.server'

export default async function MemberAffiliatePage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const tenant = await getPortalTenant(orgSlug)
  if (!tenant) notFound()
  const member = await getPortalMemberContext(tenant)
  if (!member) redirect(`/login?callbackUrl=${encodeURIComponent(`/member/${orgSlug}/afiliasi`)}`)
  const dashboard = await getPortalAffiliateDashboard(tenant, member)
  if (!dashboard) notFound()
  const referralHost = tenant.primaryHostname || 'member.coreisec.id'
  const referralUrl = `https://${referralHost}/katalog?ref=${encodeURIComponent(dashboard.referralCode)}`

  const cards = [
    { label: 'Menunggu', value: formatRupiah(dashboard.pendingAmount), icon: MousePointerClick },
    { label: 'Dapat dibayar', value: formatRupiah(dashboard.payableAmount), icon: HandCoins },
    { label: 'Sudah dibayar', value: formatRupiah(dashboard.paidAmount), icon: HandCoins },
  ]
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <p className="text-sm font-semibold text-emerald-700">Mitra resmi</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Dashboard afiliasi</h1>

      <div className="mt-8 rounded-2xl bg-emerald-950 p-6 text-white">
        <div className="flex items-center gap-3">
          <Link2 aria-hidden="true" size={22} />
          <h2 className="font-bold">Tautan referral Anda</h2>
        </div>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <code className="min-h-11 flex-1 overflow-x-auto rounded-xl bg-white/10 px-4 py-3 text-sm">{referralUrl}</code>
          <span className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/20 px-4 text-sm font-semibold">
            <Copy aria-hidden="true" size={17} />
            Kode: {dashboard.referralCode}
          </span>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <div key={card.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <Icon aria-hidden="true" className="text-emerald-700" size={22} />
              <p className="mt-4 text-sm text-slate-600">{card.label}</p>
              <p className="mt-1 text-xl font-bold">{card.value}</p>
            </div>
          )
        })}
      </div>

      <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-5">
          <h2 className="text-lg font-bold">Riwayat komisi</h2>
        </div>
        <ul className="divide-y divide-slate-100">
          {dashboard.commissions.map((commission) => (
            <li key={commission.id} className="flex items-center justify-between gap-4 p-5">
              <div>
                <p className="font-semibold">{commission.orderNumber || 'Komisi awal migrasi'}</p>
                <p className="mt-1 text-sm text-slate-600">
                  {new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(commission.createdAt))}
                </p>
              </div>
              <div className="text-right">
                <p className="font-bold">{formatRupiah(commission.amount)}</p>
                <p className="mt-1 text-xs font-semibold text-slate-600">{commission.status}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
