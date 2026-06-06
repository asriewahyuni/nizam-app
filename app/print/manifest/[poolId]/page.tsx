import { notFound } from 'next/navigation'
import { queryPostgres } from '@/lib/db/postgres'
import { PrintButton } from '@/components/ui/PrintButton'

export const revalidate = 0

async function getManifestData(poolId: string) {
  const poolRes = await queryPostgres(
    `SELECT p.*, o.name AS org_name
     FROM bus_pools p
     LEFT JOIN organizations o ON p.org_id = o.id
     WHERE p.id = $1 LIMIT 1`,
    [poolId]
  )
  if (!poolRes.rows[0]) return null
  const pool = poolRes.rows[0]

  const cargoRes = await queryPostgres(
    `SELECT c.*,
       ot.name AS origin_name,
       ot.location_name AS origin_loc,
       dt.name AS destination_name,
       dt.location_name AS destination_loc
     FROM fleet_cargo_shipments c
     LEFT JOIN fleet_terminals ot ON c.origin_terminal_id = ot.id
     LEFT JOIN fleet_terminals dt ON c.destination_terminal_id = dt.id
     WHERE c.bus_pool_id = $1
     ORDER BY c.created_at DESC`,
    [poolId]
  )

  return { pool, cargo: cargoRes.rows }
}

function n(v: unknown) { const x = Number(v); return isNaN(x) ? 0 : x }
function fmt(v: unknown) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n(v))
}
function fmtDate(s?: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}
function fmtDateTime(s?: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  DRAFT:      { label: 'Draft',      cls: 'bg-slate-100 text-slate-500' },
  MANIFESTED: { label: 'Manifes',    cls: 'bg-blue-100 text-blue-700' },
  IN_TRANSIT: { label: 'Perjalanan', cls: 'bg-indigo-100 text-indigo-700' },
  ARRIVED:    { label: 'Tiba',       cls: 'bg-amber-100 text-amber-700' },
  DELIVERED:  { label: 'Terkirim',   cls: 'bg-emerald-100 text-emerald-700' },
  CANCELLED:  { label: 'Batal',      cls: 'bg-rose-100 text-rose-700' },
}

export default async function PrintManifestPage({ params }: { params: Promise<{ poolId: string }> }) {
  const { poolId } = await params
  const data = await getManifestData(poolId)
  if (!data) notFound()

  const { pool, cargo } = data
  const totalWeight  = cargo.reduce((s: number, c: any) => s + n(c.weight_kg), 0)
  const totalKoli    = cargo.reduce((s: number, c: any) => s + n(c.koli_count), 0)
  const totalRevenue = cargo.reduce((s: number, c: any) => s + n(c.grand_total), 0)
  const paidCount    = cargo.filter((c: any) => c.payment_status === 'PAID').length
  const now          = new Date()

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; padding: 0; background: white; }
          .page-break { page-break-before: always; }
          th, td { font-size: 10px !important; }
        }
        @page { margin: 10mm; size: A4 landscape; }
        body { font-family: 'Segoe UI', system-ui, sans-serif; background: #f8fafc; }
      `}</style>

      {/* Toolbar */}
      <div className="no-print fixed top-4 right-4 z-50 flex gap-2">
        <PrintButton />
        <a href="javascript:history.back()"
          className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50 cursor-pointer shadow-sm">
          Kembali
        </a>
      </div>

      <div className="min-h-screen bg-slate-50 p-8">
        <div className="max-w-5xl mx-auto bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">

          {/* ── Header ── */}
          <div className="bg-slate-900 px-8 py-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-white font-extrabold text-xl tracking-tight">{pool.org_name ?? 'Perusahaan Otobus'}</p>
                <p className="text-slate-400 text-sm mt-0.5">MANIFEST KARGO — {pool.name}</p>
                {pool.code && <p className="text-slate-500 text-xs mt-0.5 font-mono">{pool.code}</p>}
              </div>
              <div className="text-right">
                <p className="text-slate-400 text-xs uppercase tracking-wider">Dicetak</p>
                <p className="text-white text-sm font-semibold mt-0.5">
                  {now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
                <p className="text-slate-400 text-xs mt-0.5">
                  {now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                </p>
              </div>
            </div>

            {/* Summary strip */}
            <div className="mt-4 grid grid-cols-4 gap-3">
              {[
                { label: 'Total Resi', value: String(cargo.length) },
                { label: 'Total Berat', value: `${totalWeight.toLocaleString('id-ID')} kg` },
                { label: 'Total Koli', value: String(totalKoli) },
                { label: 'Total Nilai', value: fmt(totalRevenue) },
              ].map(s => (
                <div key={s.label} className="bg-white/10 rounded-lg px-3 py-2">
                  <p className="text-slate-400 text-[10px] uppercase tracking-wider">{s.label}</p>
                  <p className="text-white font-bold text-sm mt-0.5">{s.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Table ── */}
          {cargo.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-sm">
              Belum ada data kargo untuk pool ini.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    {['No', 'AWB / Resi', 'Pengirim', 'Penerima', 'Asal → Tujuan', 'Deskripsi', 'Berat', 'Koli', 'Nilai', 'Bayar', 'Status', 'Tanggal'].map((h, i) => (
                      <th key={h} className={`py-3 px-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap ${i === 0 ? 'pl-6 text-center w-8' : i >= 6 ? 'text-right' : 'text-left'}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cargo.map((c: any, idx: number) => {
                    const sc = STATUS_CFG[c.status] ?? STATUS_CFG.DRAFT
                    const paid = c.payment_status === 'PAID'
                    return (
                      <tr key={c.id} className={`border-b border-slate-100 ${idx % 2 === 0 ? '' : 'bg-slate-50/50'} hover:bg-blue-50/30`}>
                        <td className="py-2.5 px-3 pl-6 text-center text-xs text-slate-400 font-mono">{idx + 1}</td>
                        <td className="py-2.5 px-3">
                          <p className="font-mono text-xs font-bold text-slate-700">{c.tracking_number}</p>
                        </td>
                        <td className="py-2.5 px-3">
                          <p className="text-xs font-medium text-slate-700">{c.sender_name}</p>
                          {c.sender_phone && <p className="text-[10px] text-slate-400">{c.sender_phone}</p>}
                        </td>
                        <td className="py-2.5 px-3">
                          <p className="text-xs font-medium text-slate-700">{c.receiver_name}</p>
                          {c.receiver_phone && <p className="text-[10px] text-slate-400">{c.receiver_phone}</p>}
                        </td>
                        <td className="py-2.5 px-3">
                          <p className="text-xs text-slate-600">
                            {c.origin_name ?? '—'} → {c.destination_name ?? '—'}
                          </p>
                          {(c.origin_loc || c.destination_loc) && (
                            <p className="text-[10px] text-slate-400">
                              {c.origin_loc ?? ''} → {c.destination_loc ?? ''}
                            </p>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-xs text-slate-600 max-w-[120px]">
                          <p className="truncate">{c.item_description}</p>
                        </td>
                        <td className="py-2.5 px-3 text-right text-xs font-semibold text-slate-700">
                          {n(c.weight_kg).toLocaleString('id-ID')} kg
                        </td>
                        <td className="py-2.5 px-3 text-right text-xs font-semibold text-slate-700">
                          {n(c.koli_count)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-xs font-semibold text-slate-700 whitespace-nowrap">
                          {fmt(c.grand_total)}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${paid ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-600'}`}>
                            {paid ? 'LUNAS' : 'BELUM'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${sc.cls}`}>{sc.label}</span>
                        </td>
                        <td className="py-2.5 px-3 pr-6 text-right text-[10px] text-slate-400 whitespace-nowrap">
                          {fmtDate(c.created_at)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-900 text-white">
                    <td colSpan={6} className="py-3 px-3 pl-6 text-xs font-bold">
                      TOTAL — {cargo.length} resi · {paidCount} lunas
                    </td>
                    <td className="py-3 px-3 text-right text-xs font-bold">{totalWeight.toLocaleString('id-ID')} kg</td>
                    <td className="py-3 px-3 text-right text-xs font-bold">{totalKoli}</td>
                    <td className="py-3 px-3 text-right text-xs font-bold whitespace-nowrap">{fmt(totalRevenue)}</td>
                    <td colSpan={3} className="py-3 px-3 pr-6" />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* ── Footer ── */}
          <div className="px-8 py-4 border-t border-slate-100 flex items-center justify-between">
            <p className="text-xs text-slate-400">
              {pool.name} · {pool.city ?? ''} · Manifest dibuat otomatis oleh sistem
            </p>
            <p className="text-xs text-slate-400 font-mono">
              {fmtDateTime(now.toISOString())}
            </p>
          </div>

          {/* ── Signature block ── */}
          <div className="px-8 pb-8 grid grid-cols-3 gap-8">
            {['Dibuat Oleh', 'Diperiksa Oleh', 'Disetujui Oleh'].map(role => (
              <div key={role} className="text-center">
                <div className="h-16 border-b border-slate-300 mb-2" />
                <p className="text-xs text-slate-400">{role}</p>
                <p className="text-xs text-slate-300 mt-0.5">( ________________ )</p>
              </div>
            ))}
          </div>

        </div>
      </div>
    </>
  )
}
