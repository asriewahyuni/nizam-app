import { unstable_noStore as noStore } from 'next/cache'
import { redirect } from 'next/navigation'
import { Users, CheckCircle2, Clock, XCircle, Link2 } from 'lucide-react'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getAllLmsRegistrations } from '@/modules/edu/actions/lms-registration.actions'
import { RegistrasiActions } from './RegistrasiActions'

const STATUS_CONFIG: Record<string, { label: string; class: string }> = {
  PENDING_PAYMENT: { label: 'Menunggu Bayar', class: 'bg-amber-50 text-amber-700 border-amber-100' },
  CONFIRMED: { label: 'Terkonfirmasi', class: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  CANCELLED: { label: 'Dibatalkan', class: 'bg-slate-100 text-slate-500 border-slate-200' },
}

export default async function LmsRegistrasiPage() {
  noStore()

  const orgData = await getActiveOrg()
  if (!orgData) return redirect('/onboarding')
  if (!['owner', 'admin'].includes(orgData.role)) return redirect('/lms')

  const registrations = await getAllLmsRegistrations(orgData.org.id)

  const stats = {
    total: registrations.length,
    pending: registrations.filter((r: any) => r.status === 'PENDING_PAYMENT').length,
    confirmed: registrations.filter((r: any) => r.status === 'CONFIRMED').length,
    cancelled: registrations.filter((r: any) => r.status === 'CANCELLED').length,
  }

  // Group by batch
  const grouped = registrations.reduce((acc: Record<string, any[]>, reg: any) => {
    const batchId = reg.batch_id
    if (!acc[batchId]) acc[batchId] = []
    acc[batchId].push(reg)
    return acc
  }, {})

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || ''

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 px-1">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900 tracking-tight flex items-center gap-3">
            <Users size={32} className="text-blue-600" />
            Manajemen Registrasi
          </h1>
          <p className="text-sm text-slate-500 font-medium mt-1">
            Kelola pendaftaran dan pembayaran peserta untuk semua batch.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: 'Total Pendaftar', value: stats.total, icon: Users, color: 'text-slate-700' },
          { label: 'Menunggu Bayar', value: stats.pending, icon: Clock, color: 'text-amber-600' },
          { label: 'Terkonfirmasi', value: stats.confirmed, icon: CheckCircle2, color: 'text-emerald-600' },
          { label: 'Dibatalkan', value: stats.cancelled, icon: XCircle, color: 'text-slate-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
            <div className="text-[10px] font-semibold tracking-tight text-slate-400">{label}</div>
            <div className={`mt-2 text-3xl font-semibold ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Registrations grouped by batch */}
      {Object.keys(grouped).length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 p-16 text-center">
          <Users className="h-10 w-10 text-slate-300 mx-auto" />
          <p className="mt-4 text-sm font-bold text-slate-400">Belum ada pendaftaran.</p>
          <p className="text-xs text-slate-400 mt-1">Bagikan link pendaftaran batch ke calon peserta.</p>
        </div>
      ) : (
        Object.entries(grouped).map(([batchId, regs]: [string, any[]]) => {
          const firstReg = regs[0]
          const batchInfo = firstReg?.lms_course_batches
          const courseTitle = batchInfo?.learning_courses?.title
          const regLink = `${baseUrl}/lms/daftar/${batchId}`

          return (
            <section key={batchId} className="rounded-3xl border border-slate-100 bg-white shadow-sm overflow-hidden">
              {/* Batch header */}
              <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600">{courseTitle}</p>
                  <h3 className="text-base font-black text-slate-900">{batchInfo?.name || 'Batch'}</h3>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-500">{regs.length} pendaftar</span>
                  <a
                    href={regLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-600 hover:bg-blue-100 transition-colors"
                  >
                    <Link2 className="h-3 w-3" /> Link Daftar
                  </a>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left">
                      <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-wide text-slate-400">Nama</th>
                      <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-wide text-slate-400">Kontak</th>
                      <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-wide text-slate-400">Daftar</th>
                      <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-wide text-slate-400">Status</th>
                      <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-wide text-slate-400">Bayar</th>
                      <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-wide text-slate-400">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {regs.map((reg: any) => {
                      const statusCfg = STATUS_CONFIG[reg.status] || STATUS_CONFIG.PENDING_PAYMENT
                      return (
                        <tr key={reg.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4">
                            <p className="font-bold text-slate-900">{reg.full_name}</p>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-slate-600">{reg.email}</p>
                            {reg.phone && <p className="text-xs text-slate-400 mt-0.5">{reg.phone}</p>}
                          </td>
                          <td className="px-6 py-4 text-xs text-slate-400">
                            {new Date(reg.registered_at).toLocaleDateString('id-ID', {
                              day: 'numeric', month: 'short', year: 'numeric',
                            })}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-block rounded-full border px-2.5 py-1 text-[10px] font-bold ${statusCfg.class}`}>
                              {statusCfg.label}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm font-bold text-slate-700">
                            {reg.amount_paid
                              ? `Rp${Number(reg.amount_paid).toLocaleString('id-ID')}`
                              : <span className="text-slate-300">—</span>}
                            {reg.payment_method && (
                              <p className="text-[10px] text-slate-400 font-normal">{reg.payment_method}</p>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <RegistrasiActions reg={reg} />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )
        })
      )}
    </div>
  )
}
