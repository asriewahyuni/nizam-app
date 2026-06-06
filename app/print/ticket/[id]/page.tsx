import { notFound } from 'next/navigation'
import { queryPostgres } from '@/lib/db/postgres'
import { PrintButton } from '@/components/ui/PrintButton'
import { QRCodeClient } from '@/components/ui/QRCodeClient'

export const revalidate = 0

async function getTicketForPrint(id: string) {
  const res = await queryPostgres(
    `SELECT t.*,
       s.departure_time, s.arrival_time, s.notes as schedule_notes,
       r.name   AS route_name,
       r.origin AS route_origin,
       r.destination AS route_destination,
       bu.plate_number, bu.model AS bus_model,
       p.name   AS pool_name,
       p.code   AS pool_code,
       p.phone  AS pool_phone,
       p.address AS pool_address,
       p.city   AS pool_city,
       o.name   AS org_name
     FROM bus_tickets t
     LEFT JOIN bus_schedules s  ON t.schedule_id = s.id
     LEFT JOIN bus_routes r     ON s.route_id    = r.id
     LEFT JOIN bus_units bu     ON s.bus_id      = bu.id
     LEFT JOIN bus_pools p      ON t.pool_id     = p.id
     LEFT JOIN organizations o  ON t.org_id      = o.id
     WHERE t.id = $1
     LIMIT 1`,
    [id]
  )
  return res.rows[0] ?? null
}

function fmt(v: unknown) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(Number(v) || 0)
}

function fmtDate(s?: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

function fmtTime(s?: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

const STATUS_LABEL: Record<string, string> = {
  DIPESAN: 'DIPESAN', DIBAYAR: 'LUNAS', DIGUNAKAN: 'TERPAKAI', BATAL: 'BATAL',
}

export default async function PrintTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const t = await getTicketForPrint(id)
  if (!t) notFound()

  const statusLabel = STATUS_LABEL[t.status] ?? t.status
  const isPaid      = t.status === 'DIBAYAR' || t.status === 'DIGUNAKAN'
  const appUrl      = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.kliknizam.app'
  const qrValue     = `${appUrl}/print/ticket/${t.id}`

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; padding: 0; background: white; }
          .ticket-card { box-shadow: none !important; border: 1px solid #e2e8f0 !important; }
        }
        @page { margin: 10mm; size: A5 portrait; }
        body { font-family: 'Segoe UI', system-ui, sans-serif; background: #f8fafc; }
      `}</style>

      {/* Toolbar */}
      <div className="no-print fixed top-4 right-4 z-50 flex gap-2">
        <PrintButton />
        <a
          href="javascript:history.back()"
          className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50 cursor-pointer shadow-sm"
        >
          Kembali
        </a>
      </div>

      {/* Page */}
      <div className="min-h-screen flex items-start justify-center pt-16 pb-8 px-4 bg-slate-50">
        <div className="ticket-card w-full max-w-sm bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">

          {/* ── Header: company + status ── */}
          <div className="bg-slate-900 px-5 py-4 flex items-center justify-between">
            <div>
              <p className="text-white font-extrabold text-sm tracking-wide leading-tight">
                {t.org_name ?? 'Perusahaan Otobus'}
              </p>
              <p className="text-slate-400 text-[10px] uppercase tracking-widest mt-0.5">Tiket Penumpang Bus</p>
            </div>
            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
              isPaid ? 'bg-emerald-500 text-white' : 'bg-amber-400 text-slate-900'
            }`}>
              {statusLabel}
            </span>
          </div>

          {/* ── Route ── */}
          <div className="px-5 pt-5 pb-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-center flex-1">
                <p className="text-3xl font-extrabold text-slate-800 leading-none">{t.route_origin ?? '—'}</p>
                <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">Asal</p>
              </div>
              <div className="flex flex-col items-center gap-1 shrink-0">
                <svg className="w-5 h-5 text-slate-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" />
                </svg>
                {t.route_name && (
                  <p className="text-[9px] text-slate-400 text-center leading-tight max-w-[60px]">{t.route_name}</p>
                )}
              </div>
              <div className="text-center flex-1">
                <p className="text-3xl font-extrabold text-slate-800 leading-none">{t.route_destination ?? '—'}</p>
                <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">Tujuan</p>
              </div>
            </div>
          </div>

          {/* ── Tear line ── */}
          <div className="relative mx-0 flex items-center">
            <div className="w-5 h-5 rounded-full bg-slate-50 border border-slate-200 -ml-2.5 shrink-0" />
            <div className="flex-1 border-t-2 border-dashed border-slate-200" />
            <div className="w-5 h-5 rounded-full bg-slate-50 border border-slate-200 -mr-2.5 shrink-0" />
          </div>

          {/* ── Main info ── */}
          <div className="px-5 py-4 space-y-4">

            {/* Date + Time + Seat — 3 columns */}
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Tanggal</p>
                <p className="text-xs font-semibold text-slate-700 leading-snug">{fmtDate(t.departure_time)}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Jam</p>
                <p className="text-xl font-extrabold text-slate-900">{fmtTime(t.departure_time)}</p>
              </div>
            </div>

            {/* Passenger + Seat — side by side */}
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Penumpang</p>
                <p className="text-base font-bold text-slate-800 leading-tight">{t.passenger_name}</p>
                {t.passenger_phone && (
                  <p className="text-xs text-slate-400 mt-0.5">{t.passenger_phone}</p>
                )}
              </div>
              <div className="text-center shrink-0">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Kursi</p>
                <div className="w-14 h-14 rounded-xl bg-slate-900 flex items-center justify-center">
                  <p className="text-white text-xl font-extrabold">{t.seat_number}</p>
                </div>
              </div>
            </div>

            {/* Armada + Price */}
            <div className="grid grid-cols-2 gap-3">
              {(t.plate_number || t.bus_model) ? (
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Armada</p>
                  <p className="text-xs font-semibold text-slate-700">
                    {[t.bus_model, t.plate_number].filter(Boolean).join(' · ')}
                  </p>
                </div>
              ) : <div />}
              <div className="text-right">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Harga</p>
                <p className="text-lg font-extrabold text-emerald-600">{fmt(t.price)}</p>
              </div>
            </div>
          </div>

          {/* ── Tear line ── */}
          <div className="relative mx-0 flex items-center">
            <div className="w-5 h-5 rounded-full bg-slate-50 border border-slate-200 -ml-2.5 shrink-0" />
            <div className="flex-1 border-t-2 border-dashed border-slate-200" />
            <div className="w-5 h-5 rounded-full bg-slate-50 border border-slate-200 -mr-2.5 shrink-0" />
          </div>

          {/* ── Footer strip: QR + info ── */}
          <div className="bg-slate-50/60 px-5 py-4 flex items-center gap-4">
            {/* QR Code */}
            <div className="shrink-0 p-1.5 bg-white rounded-xl border border-slate-200 shadow-sm">
              <QRCodeClient value={qrValue} size={80} />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              {t.pool_name && (
                <p className="text-xs font-semibold text-slate-700 truncate">
                  {t.pool_name}{t.pool_city ? ` · ${t.pool_city}` : ''}
                </p>
              )}
              {t.pool_phone && (
                <p className="text-[10px] text-slate-400 mt-0.5">{t.pool_phone}</p>
              )}
              {t.schedule_notes && (
                <p className="text-[10px] text-amber-600 mt-1">⚠ {t.schedule_notes}</p>
              )}
              <div className="mt-2 pt-2 border-t border-slate-200/70">
                <p className="text-[9px] text-slate-400 uppercase tracking-wider">No. Tiket</p>
                <p className="font-mono text-sm font-bold text-slate-800 mt-0.5 tracking-widest">
                  {t.id.slice(0, 8).toUpperCase()}
                </p>
                <p className="text-[9px] text-slate-400 mt-0.5">
                  {new Date(t.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
            </div>
          </div>

          {/* ── Fine print ── */}
          <div className="px-5 py-2.5 border-t border-slate-100">
            <p className="text-[10px] text-slate-400 text-center leading-relaxed">
              Tunjukkan tiket ini kepada petugas sebelum keberangkatan.<br />
              Dicetak {new Date().toLocaleString('id-ID')}
            </p>
          </div>

        </div>
      </div>
    </>
  )
}
