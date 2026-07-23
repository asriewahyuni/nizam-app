import { notFound, redirect } from 'next/navigation'
import { Archive, CircleCheck, ReceiptText } from 'lucide-react'
import { formatRupiah } from '@/lib/utils'
import {
  getPortalMemberContext,
  getPortalOrders,
  getPortalTenant,
} from '@/modules/member/lib/portal.server'

export default async function MemberOrdersPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const tenant = await getPortalTenant(orgSlug)
  if (!tenant) notFound()
  const member = await getPortalMemberContext(tenant)
  if (!member) redirect(`/login?callbackUrl=${encodeURIComponent(`/member/${orgSlug}/pesanan`)}`)
  const orders = await getPortalOrders(tenant, member)

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <p className="text-sm font-semibold text-emerald-700">Riwayat transaksi</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Pesanan saya</h1>
      <p className="mt-3 text-slate-600">Pesanan Nizam dan arsip WordPress lama tersedia dalam satu daftar.</p>

      {orders.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-emerald-300 bg-white p-10 text-center">
          <ReceiptText aria-hidden="true" className="mx-auto text-emerald-700" size={42} />
          <h2 className="mt-4 text-lg font-semibold">Belum ada pesanan</h2>
        </div>
      ) : (
        <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <ul className="divide-y divide-slate-100">
            {orders.map((order) => (
              <li key={`${order.source}-${order.id}`} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${
                    order.source === 'WORDPRESS_ARCHIVE'
                      ? 'bg-amber-100 text-amber-900'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {order.source === 'WORDPRESS_ARCHIVE'
                      ? <Archive aria-hidden="true" size={20} />
                      : <CircleCheck aria-hidden="true" size={20} />}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-bold">{order.orderNumber}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(order.orderedAt))}
                      {' · '}
                      {order.source === 'WORDPRESS_ARCHIVE' ? 'Arsip Coreisec' : 'Nizam'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-5 sm:justify-end">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                    {order.status.replaceAll('_', ' ')}
                  </span>
                  <strong className="whitespace-nowrap text-emerald-900">{formatRupiah(order.totalAmount)}</strong>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
