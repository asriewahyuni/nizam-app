'use client'

import Link from 'next/link'
import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowUpRight, CheckCircle2, ChevronDown, ChevronUp, Clock3, Eye, EyeOff, LifeBuoy, Send } from 'lucide-react'
import {
  postSupportTicketProgress,
  type OperatorSupportTicketRecord,
  type OperatorSupportTicketUpdateRecord,
  type OperatorTicketingSnapshot,
} from '@/modules/saas/actions/ticketing.actions'

function formatDateTime(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '-'
  return parsed.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
}

function severityBadge(severity: OperatorSupportTicketRecord['severity']) {
  if (severity === 'CRITICAL') return 'border-rose-200 bg-rose-50 text-rose-700'
  if (severity === 'HIGH') return 'border-amber-200 bg-amber-50 text-amber-700'
  if (severity === 'LOW') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  return 'border-blue-200 bg-blue-50 text-blue-700'
}

function statusBadge(status: OperatorSupportTicketRecord['status']) {
  if (status === 'RESOLVED') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (status === 'CLOSED') return 'border-slate-200 bg-slate-100 text-slate-700'
  if (status === 'IN_PROGRESS') return 'border-amber-200 bg-amber-50 text-amber-700'
  return 'border-blue-200 bg-blue-50 text-blue-700'
}

type SaasTicketingClientProps = {
  snapshot: OperatorTicketingSnapshot
}

export default function SaasTicketingClient({ snapshot }: SaasTicketingClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [pendingTicketId, setPendingTicketId] = useState('')
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [openProgressTicketIds, setOpenProgressTicketIds] = useState<string[]>([])

  const latestUpdateByTicketId = useMemo(() => {
    const map = new Map<string, OperatorSupportTicketUpdateRecord>()
    for (const row of snapshot.updates) {
      if (!map.has(row.ticket_id)) map.set(row.ticket_id, row)
    }
    return map
  }, [snapshot.updates])

  const ticketNoById = useMemo(() => {
    const map = new Map<string, string>()
    snapshot.tickets.forEach((ticket) => map.set(ticket.id, ticket.ticket_no))
    return map
  }, [snapshot.tickets])

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>, ticketId: string) => {
    event.preventDefault()
    setMessage(null)
    const formEl = event.currentTarget
    const formData = new FormData(formEl)
    formData.set('ticket_id', ticketId)

    setPendingTicketId(ticketId)
    startTransition(async () => {
      const result = await postSupportTicketProgress(formData)
      setPendingTicketId('')
      if (result.error) {
        setMessage({ type: 'err', text: result.error })
        return
      }
      setMessage({ type: 'ok', text: 'Progress support ticket berhasil disimpan.' })
      formEl.reset()
      router.refresh()
    })
  }

  const toggleProgressCard = (ticketId: string) => {
    setOpenProgressTicketIds((current) =>
      current.includes(ticketId) ? current.filter((id) => id !== ticketId) : [...current, ticketId],
    )
  }

  return (
    <div className="space-y-6 pb-16">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-[11px] font-semibold tracking-[0.12em] text-indigo-700">
              <LifeBuoy size={14} />
              Support Ticket Operator
            </div>
            <h1 className="mt-3 text-2xl font-semibold text-slate-900 md:text-3xl">Kelola Progress Support Ticket</h1>
            <p className="mt-2 text-sm font-medium text-slate-600">
              Kelola progres support ticket dari user dan publikasikan update yang akan tampil pada halaman doc update pengguna.
            </p>
          </div>
          <Link
            href="/settings/ticketing/doc-update"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-700 hover:bg-slate-50"
          >
            Lihat Halaman User
            <ArrowUpRight size={14} />
          </Link>
        </div>
      </section>

      {message && (
        <div className={`rounded-xl border px-4 py-3 text-sm font-bold ${message.type === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
          {message.text}
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Total Support Ticket</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">{snapshot.tickets.length}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Open / Progress</div>
          <div className="mt-2 text-2xl font-semibold text-amber-600">
            {snapshot.tickets.filter((ticket) => ticket.status === 'OPEN' || ticket.status === 'IN_PROGRESS').length}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Resolved / Closed</div>
          <div className="mt-2 text-2xl font-semibold text-emerald-600">
            {snapshot.tickets.filter((ticket) => ticket.status === 'RESOLVED' || ticket.status === 'CLOSED').length}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        {snapshot.tickets.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-6 text-sm font-semibold text-slate-500">
            Belum ada support ticket yang masuk.
          </div>
        ) : (
          snapshot.tickets.map((ticket) => {
            const lastUpdate = latestUpdateByTicketId.get(ticket.id)
            const isSubmittingCurrent = isPending && pendingTicketId === ticket.id
            const isProgressCardOpen = openProgressTicketIds.includes(ticket.id)
            return (
              <article key={ticket.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-slate-300 bg-slate-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                      {ticket.ticket_no}
                    </span>
                    <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${severityBadge(ticket.severity)}`}>
                      {ticket.severity}
                    </span>
                    <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${statusBadge(ticket.status)}`}>
                      {ticket.status}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                      {ticket.organization?.name || 'Tanpa Nama Org'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleProgressCard(ticket.id)}
                    aria-expanded={isProgressCardOpen}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-700 hover:bg-slate-100"
                  >
                    {isProgressCardOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    {isProgressCardOpen ? 'Tutup Panel Update' : 'Buka Panel Update'}
                  </button>
                </div>
                <h3 className="mt-3 text-base font-semibold text-slate-900">{ticket.title}</h3>
                <p className="mt-2 text-sm font-medium text-slate-600">{ticket.description}</p>
                <div className="mt-3 flex flex-wrap gap-3 text-xs font-bold text-slate-500">
                  <span>Menu: {ticket.found_in_menu}</span>
                  <span>Dibuat: {formatDateTime(ticket.created_at)}</span>
                </div>
                {ticket.screenshot_url ? (
                  <a href={ticket.screenshot_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700">
                    <Eye size={12} />
                    Lihat Screenshot
                  </a>
                ) : null}

                {lastUpdate ? (
                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Update Terakhir</div>
                    <p className="mt-1 text-sm font-bold text-slate-900">{lastUpdate.update_title}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-600">{lastUpdate.update_body || '-'}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                      <span className="inline-flex items-center gap-1"><Clock3 size={11} />{formatDateTime(lastUpdate.created_at)}</span>
                      <span className="inline-flex items-center gap-1">
                        {lastUpdate.is_public ? <Eye size={11} /> : <EyeOff size={11} />}
                        {lastUpdate.is_public ? 'Publik' : 'Internal'}
                      </span>
                    </div>
                  </div>
                ) : null}

                {isProgressCardOpen ? (
                  <form onSubmit={(event) => handleSubmit(event, ticket.id)} className="mt-4 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-2">
                    <label className="block">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Judul Update</span>
                      <input
                        required
                        name="update_title"
                        placeholder="Contoh: Patch validasi sudah dirilis"
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-blue-500"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Status Setelah Update</span>
                      <select
                        name="status_after"
                        defaultValue={ticket.status}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-blue-500"
                      >
                        <option value="OPEN">OPEN</option>
                        <option value="IN_PROGRESS">IN_PROGRESS</option>
                        <option value="RESOLVED">RESOLVED</option>
                        <option value="CLOSED">CLOSED</option>
                      </select>
                    </label>
                    <label className="block md:col-span-2">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Detail Update</span>
                      <textarea
                        name="update_body"
                        rows={3}
                        placeholder="Jelaskan perbaikan atau hasil investigasi."
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-blue-500"
                      />
                    </label>
                    <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 md:col-span-2">
                      <input type="checkbox" name="is_public" defaultChecked className="h-4 w-4 rounded border-slate-300" />
                      Tampilkan di Doc Update pengguna (publik)
                    </label>
                    <div className="md:col-span-2">
                      <button
                        type="submit"
                        disabled={isSubmittingCurrent}
                        className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isSubmittingCurrent ? <Clock3 size={13} /> : <Send size={13} />}
                        {isSubmittingCurrent ? 'Menyimpan...' : 'Simpan Progress'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-500">
                    Panel update sedang ditutup agar daftar ticket lebih rapi. Klik <span className="font-semibold text-slate-700">Buka Panel Update</span> untuk kirim progres baru.
                  </div>
                )}
              </article>
            )
          })
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-600">Feed Update Terbaru</h2>
        <div className="mt-4 space-y-2">
          {snapshot.updates.length === 0 ? (
            <p className="text-sm font-semibold text-slate-500">Belum ada update progress.</p>
          ) : (
            snapshot.updates.slice(0, 20).map((update) => (
              <div key={update.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                <div className="flex flex-wrap items-center gap-2 font-semibold text-slate-700">
                  <span>{ticketNoById.get(update.ticket_id) || 'Support Ticket'}</span>
                  <span className="text-slate-400">•</span>
                  <span>{update.update_title}</span>
                  <span className="text-slate-400">•</span>
                  <span className="inline-flex items-center gap-1 text-slate-500">
                    {update.is_public ? <CheckCircle2 size={12} /> : <EyeOff size={12} />}
                    {update.is_public ? 'Publik' : 'Internal'}
                  </span>
                </div>
                <p className="mt-1 font-semibold text-slate-600">{update.update_body || '-'}</p>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  )
}
