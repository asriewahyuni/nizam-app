'use client'

import Link from 'next/link'
import { ArrowLeft, Bug, Clock3, FileStack, ShieldCheck } from 'lucide-react'
import type { SupportTicketDocUpdateRecord } from '@/modules/saas/actions/ticketing.actions'

type TicketingDocUpdateClientProps = {
  updates: SupportTicketDocUpdateRecord[]
}

function formatDateTime(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '-'
  return parsed.toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' })
}

function statusBadgeClass(status: string) {
  if (status === 'RESOLVED') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (status === 'CLOSED') return 'border-slate-300 bg-slate-100 text-slate-700'
  if (status === 'IN_PROGRESS') return 'border-amber-200 bg-amber-50 text-amber-700'
  return 'border-blue-200 bg-blue-50 text-blue-700'
}

export default function TicketingDocUpdateClient({ updates }: TicketingDocUpdateClientProps) {
  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-16">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-slate-600">
              <FileStack size={14} />
              Doc Update
            </div>
            <h1 className="mt-3 text-2xl font-black text-slate-900 md:text-3xl">Progress Perbaikan Ticketing</h1>
            <p className="mt-2 text-sm font-medium text-slate-600">
              Halaman ini menampilkan update resmi dari tim terkait investigasi dan penyelesaian bug yang Anda laporkan.
            </p>
          </div>
          <Link
            href="/settings/ticketing"
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft size={14} />
            Kembali ke Ticketing
          </Link>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        {updates.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-6 text-sm font-semibold text-slate-500">
            Belum ada doc update publik. Update akan muncul setelah tim support mempublikasikan progres.
          </div>
        ) : (
          <div className="space-y-4">
            {updates.map((update) => (
              <article key={update.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-slate-300 bg-slate-50 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-600">
                    {update.ticket?.ticket_no || 'TICKET'}
                  </span>
                  <span className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${statusBadgeClass(update.status_after)}`}>
                    {update.status_after}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700">
                    <ShieldCheck size={11} />
                    Publik
                  </span>
                </div>

                <h2 className="mt-3 text-sm font-black text-slate-900">{update.update_title}</h2>
                <p className="mt-1 text-sm font-medium text-slate-600">{update.update_body || '-'}</p>

                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs font-bold text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <Bug size={13} />
                    {update.ticket?.title || '-'}
                  </span>
                  <span>{update.ticket?.found_in_menu || '-'}</span>
                  <span className="inline-flex items-center gap-1">
                    <Clock3 size={13} />
                    {formatDateTime(update.created_at)}
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
