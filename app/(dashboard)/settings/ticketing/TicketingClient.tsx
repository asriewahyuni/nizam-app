'use client'

import Link from 'next/link'
import { useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Bug, Camera, ChevronDown, ChevronUp, CircleAlert, Clock3, LifeBuoy, Send } from 'lucide-react'
import { createSupportTicket, type SupportTicketRecord } from '@/modules/saas/actions/ticketing.actions'

type TicketingClientProps = {
  tickets: SupportTicketRecord[]
}

const MENU_SUGGESTIONS = [
  'Dashboard',
  'Sales',
  'Sales Pipeline',
  'POS',
  'Purchasing',
  'Inventory',
  'Gudang (WMS)',
  'Kas & Bank',
  'Buku Besar',
  'HRIS',
  'Laporan',
  'Pengaturan Bisnis',
  'Cabang & Divisi',
]

function formatDateTime(value: string | null) {
  if (!value) return '-'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '-'
  return parsed.toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function severityClassName(severity: SupportTicketRecord['severity']) {
  if (severity === 'CRITICAL') return 'border-rose-200 bg-rose-50 text-rose-700'
  if (severity === 'HIGH') return 'border-amber-200 bg-amber-50 text-amber-700'
  if (severity === 'LOW') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  return 'border-blue-200 bg-blue-50 text-blue-700'
}

function statusClassName(status: SupportTicketRecord['status']) {
  if (status === 'RESOLVED') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (status === 'CLOSED') return 'border-slate-200 bg-slate-100 text-slate-700'
  if (status === 'IN_PROGRESS') return 'border-amber-200 bg-amber-50 text-amber-700'
  return 'border-blue-200 bg-blue-50 text-blue-700'
}

export default function TicketingClient({ tickets }: TicketingClientProps) {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [selectedFileName, setSelectedFileName] = useState('')
  const [isCreateCardOpen, setIsCreateCardOpen] = useState(tickets.length === 0)

  const menuDatalistId = useMemo(() => 'ticket-menu-suggestions', [])

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMessage(null)

    const formData = new FormData(event.currentTarget)

    startTransition(async () => {
      const result = await createSupportTicket(formData)
      if (result.error) {
        setMessage({ type: 'err', text: result.error })
        return
      }

      formRef.current?.reset()
      setSelectedFileName('')
      setMessage({ type: 'ok', text: 'Support ticket berhasil dikirim. Tim support akan menindaklanjuti.' })
      router.refresh()
    })
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold tracking-[0.12em] text-slate-600">
              <LifeBuoy size={14} />
              Support Ticket
            </div>
            <h1 className="mt-3 text-2xl font-semibold text-slate-900 md:text-3xl">Kirim Support Ticket</h1>
            <p className="mt-2 max-w-3xl text-sm font-medium leading-relaxed text-slate-600">
              Isi detail bug atau kendala sejelas mungkin, termasuk menu tempat masalah muncul, kapan kejadian terjadi,
              dan screenshot agar proses investigasi lebih cepat.
            </p>
          </div>
          <Link
            href="/settings/ticketing/doc-update"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold tracking-[0.08em] text-slate-700 hover:bg-slate-50"
          >
            Dokumen Update Support Ticket
          </Link>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Card Support Ticket Baru</h2>
            <p className="mt-1 text-sm font-medium text-slate-500">
              {isCreateCardOpen
                ? 'Form sedang terbuka. Silakan isi detail kendala yang ingin dilaporkan.'
                : 'Form disembunyikan agar halaman lebih rapi. Buka kembali saat ingin kirim ticket baru.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsCreateCardOpen((current) => !current)}
            aria-expanded={isCreateCardOpen}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-700 hover:bg-slate-100"
          >
            {isCreateCardOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {isCreateCardOpen ? 'Tutup Card' : 'Buka Card'}
          </button>
        </div>

        {message && (
          <div
            className={`mt-5 rounded-xl border px-4 py-3 text-sm font-bold ${
              message.type === 'ok'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-rose-200 bg-rose-50 text-rose-700'
            }`}
          >
            {message.text}
          </div>
        )}

        {isCreateCardOpen ? (
          <form ref={formRef} onSubmit={handleSubmit} className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Judul Bug</span>
              <input
                required
                name="title"
                placeholder="Contoh: Error saat simpan transaksi"
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-500"
              />
            </label>

            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Tingkat Prioritas</span>
              <select
                name="severity"
                defaultValue="MEDIUM"
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-500"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </label>

            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Menu/Lokasi Bug Ditemukan</span>
              <input
                required
                list={menuDatalistId}
                name="found_in_menu"
                placeholder="Contoh: Inventory > Gudang"
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-500"
              />
              <datalist id={menuDatalistId}>
                {MENU_SUGGESTIONS.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </label>

            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Kapan Bug Terjadi</span>
              <input
                type="datetime-local"
                name="found_at"
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-500"
              />
            </label>

            <label className="block md:col-span-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Pada Saat Apa Terjadi (Langkah)</span>
              <input
                name="found_during"
                placeholder="Contoh: Klik tombol Simpan setelah pilih pelanggan"
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-500"
              />
            </label>

            <label className="block md:col-span-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Deskripsi Detail Bug</span>
              <textarea
                required
                name="description"
                rows={5}
                placeholder="Jelaskan gejala error, langkah reproduksi, dan dampak ke proses kerja."
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-500"
              />
            </label>

            <label className="block md:col-span-2">
              <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                <Camera size={14} />
                Upload Screenshot (Opsional)
              </span>
              <input
                type="file"
                name="screenshot"
                accept="image/*"
                onChange={(event) => setSelectedFileName(event.target.files?.[0]?.name || '')}
                className="mt-2 block w-full rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700"
              />
              <p className="mt-2 text-xs font-semibold text-slate-500">
                {selectedFileName ? `File dipilih: ${selectedFileName}` : 'Maksimal 5MB. Format: JPG, PNG, WEBP, GIF, HEIC.'}
              </p>
            </label>

            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={isPending}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Send size={15} />
                {isPending ? 'Mengirim Support Ticket...' : 'Kirim Support Ticket'}
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm font-semibold text-slate-500">
            Card support ticket baru sedang ditutup. Klik tombol <span className="font-semibold text-slate-700">Buka Card</span> untuk menampilkan form.
          </div>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Riwayat Support Ticket</h2>
        <div className="mt-5 space-y-3">
          {tickets.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm font-semibold text-slate-500">
              Belum ada support ticket. Silakan kirim laporan bug pertama Anda.
            </div>
          ) : (
            tickets.map((ticket) => (
              <article key={ticket.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-slate-300 bg-slate-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                    {ticket.ticket_no}
                  </span>
                  <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${severityClassName(ticket.severity)}`}>
                    {ticket.severity}
                  </span>
                  <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${statusClassName(ticket.status)}`}>
                    {ticket.status}
                  </span>
                </div>
                <h3 className="mt-3 text-sm font-semibold text-slate-900">{ticket.title}</h3>
                <p className="mt-2 text-sm font-medium text-slate-600">{ticket.description}</p>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs font-bold text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <Bug size={13} />
                    {ticket.found_in_menu}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock3 size={13} />
                    {formatDateTime(ticket.found_at)}
                  </span>
                </div>
                {ticket.found_during ? (
                  <p className="mt-2 text-xs font-semibold text-slate-500">
                    Pada saat: {ticket.found_during}
                  </p>
                ) : null}
                {ticket.screenshot_url ? (
                  <a
                    href={ticket.screenshot_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
                  >
                    <CircleAlert size={13} />
                    Lihat screenshot
                  </a>
                ) : null}
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  )
}
