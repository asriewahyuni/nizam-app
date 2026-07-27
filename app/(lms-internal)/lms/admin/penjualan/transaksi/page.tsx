import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { redirect } from 'next/navigation'
import {
  getLmsAdminSalesList,
  getLmsSalesSummaryMetrics,
} from '@/modules/edu/lib/lms-sales.server'
import { LmsSalesListClient } from './LmsSalesListClient'

export const metadata = {
  title: 'Riwayat Transaksi LMS — Nizam LMS Admin',
}

export default async function LmsAdminSalesPage() {
  const orgData = await getActiveOrg()
  if (!orgData?.org?.id) return redirect('/onboarding')

  const [metrics, { sales }] = await Promise.all([
    getLmsSalesSummaryMetrics(orgData.org.id),
    getLmsAdminSalesList(orgData.org.id, { limit: 50 }),
  ])

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">
          /lms/admin/penjualan · Transaksi
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Daftar Penjualan LMS</h1>
        <p className="mt-1 text-slate-500">
          Kelola riwayat transaksi kelas, pendaftaran peserta, status pembayaran, dan komisi afiliasi.
        </p>
      </div>

      <LmsSalesListClient metrics={metrics} initialSales={sales} />
    </div>
  )
}
