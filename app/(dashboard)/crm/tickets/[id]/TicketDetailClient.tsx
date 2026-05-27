'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, MessageSquare, AlertTriangle, HelpCircle, Lightbulb,
  ClipboardList, Clock, CheckCircle2, XCircle, ArrowUpDown,
  User, Mail, Phone, Calendar, Link2, Send, Lock, Unlock,
  ChevronDown, Save, RefreshCw
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CrmTicket, CrmTicketNote, CrmTicketStatus } from '@/modules/crm/actions/tickets.actions'
import {
  TICKET_TYPE_LABEL, TICKET_STATUS_LABEL, TICKET_PRIORITY_LABEL,
  updateCrmTicket, addCrmTicketNote
} from '@/modules/crm/actions/tickets.actions'

// ─── Config ──────────────────────────────────────────────────────────────────

const TYPE_CONFIG = {
  COMPLAINT:  { icon: AlertTriangle, color: 'text-rose-600 bg-rose-50 border-rose-200' },
  REQUEST:    { icon: ClipboardList, color: 'text-blue-600 bg-blue-50 border-blue-200' },
  INQUIRY:    { icon: HelpCircle,    color: 'text-amber-600 bg-amber-50 border-amber-200' },
  SUGGESTION: { icon: Lightbulb,    color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
}

const STATUS_FLOW: CrmTicketStatus[] = ['NEW', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']

const STATUS_CONFIG: Record<CrmTicketStatus, { label: string; color: string; bg: string }> = {
  NEW:         { label: 'Baru',      color: 'text-blue-700',    bg: 'bg-blue-100' },
  IN_PROGRESS: { label: 'Diproses', color: 'text-amber-700',   bg: 'bg-amber-100' },
  RESOLVED:    { label: 'Selesai',  color: 'text-emerald-700', bg: 'bg-emerald-100' },
  CLOSED:      { label: 'Ditutup', color: 'text-slate-600',   bg: 'bg-slate-100' },
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  ticket: CrmTicket
  notes: CrmTicketNote[]
  orgId: string
  currentUserName: string
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TicketDetailClient({ ticket: initialTicket, notes: initialNotes, orgId, currentUserName }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [ticket, setTicket] = useState(initialTicket)
  const [notes, setNotes] = useState(initialNotes)

  // Note form
  const [noteContent, setNoteContent] = useState('')
  const [noteIsInternal, setNoteIsInternal] = useState(true)

  // Resolution form
  const [resolution, setResolution] = useState(ticket.resolution || '')
  const [showResolutionForm, setShowResolutionForm] = useState(false)

  const TypeCfg = TYPE_CONFIG[ticket.type]
  const TypeIcon = TypeCfg.icon
  const statusCfg = STATUS_CONFIG[ticket.status]

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleStatusChange = (newStatus: CrmTicketStatus) => {
    if (newStatus === ticket.status) return
    startTransition(async () => {
      const result = await updateCrmTicket(ticket.id, { status: newStatus })
      if ('error' in result) { alert(result.error); return }
      setTicket(prev => ({
        ...prev,
        status: newStatus,
        resolved_at: newStatus === 'RESOLVED' ? new Date().toISOString() : prev.resolved_at,
        closed_at: newStatus === 'CLOSED' ? new Date().toISOString() : prev.closed_at,
      }))
      router.refresh()
    })
  }

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault()
    if (!noteContent.trim()) return
    startTransition(async () => {
      const result = await addCrmTicketNote(ticket.id, noteContent, noteIsInternal)
      if ('error' in result) { alert(result.error); return }
      setNotes(prev => [...prev, {
        id: crypto.randomUUID(),
        ticket_id: ticket.id,
        author_name: currentUserName,
        author_type: 'STAFF',
        content: noteContent.trim(),
        is_internal: noteIsInternal,
        created_at: new Date().toISOString(),
      }])
      setNoteContent('')
    })
  }

  const handleSaveResolution = () => {
    startTransition(async () => {
      const result = await updateCrmTicket(ticket.id, {
        resolution: resolution.trim() || null,
        status: resolution.trim() ? 'RESOLVED' : ticket.status,
      })
      if ('error' in result) { alert(result.error); return }
      setTicket(prev => ({
        ...prev,
        resolution: resolution.trim() || null,
        status: resolution.trim() ? 'RESOLVED' : prev.status,
      }))
      setShowResolutionForm(false)
      router.refresh()
    })
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex items-center gap-3 mb-3">
          <Link
            href="/crm/tickets"
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
          >
            <ArrowLeft size={14} />
            Kembali
          </Link>
          <span className="text-slate-300">/</span>
          <span className="text-sm text-slate-500 font-mono">{ticket.ticket_number}</span>
        </div>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border', TypeCfg.color)}>
              <TypeIcon size={18} />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 leading-snug">{ticket.subject}</h1>
              <p className="text-sm text-slate-400 mt-0.5">
                {TICKET_TYPE_LABEL[ticket.type]} &middot; {ticket.submitter_name} &middot;{' '}
                {new Date(ticket.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>

          {/* Status stepper */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {STATUS_FLOW.map((s, i) => {
              const cfg = STATUS_CONFIG[s]
              const isActive = ticket.status === s
              const isDone = STATUS_FLOW.indexOf(ticket.status) > i
              return (
                <button
                  key={s}
                  onClick={() => handleStatusChange(s)}
                  disabled={isPending}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border',
                    isActive
                      ? cn(cfg.bg, cfg.color, 'border-transparent shadow-sm')
                      : isDone
                        ? 'bg-slate-50 text-slate-400 border-slate-200'
                        : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300 hover:text-slate-600'
                  )}
                >
                  {cfg.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-6 grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* Kolom kiri: detail + notes */}
          <div className="md:col-span-2 space-y-5">

            {/* Deskripsi */}
            {ticket.description && (
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Deskripsi</p>
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{ticket.description}</p>
              </div>
            )}

            {/* Resolusi */}
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Resolusi / Tindakan</p>
                <button
                  onClick={() => setShowResolutionForm(!showResolutionForm)}
                  className="text-xs text-[#003366] hover:underline cursor-pointer"
                >
                  {showResolutionForm ? 'Batal' : (ticket.resolution ? 'Edit' : '+ Tambah')}
                </button>
              </div>

              {showResolutionForm ? (
                <div className="space-y-2">
                  <textarea
                    value={resolution}
                    onChange={e => setResolution(e.target.value)}
                    rows={3}
                    placeholder="Tuliskan tindakan yang sudah diambil untuk menyelesaikan tiket ini..."
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003366]/20 focus:border-[#003366] resize-none"
                  />
                  <button
                    onClick={handleSaveResolution}
                    disabled={isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg cursor-pointer transition-colors disabled:opacity-60"
                  >
                    <Save size={12} />
                    Simpan &amp; Selesaikan
                  </button>
                </div>
              ) : ticket.resolution ? (
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{ticket.resolution}</p>
              ) : (
                <p className="text-sm text-slate-400 italic">Belum ada resolusi dicatat.</p>
              )}
            </div>

            {/* Activity / Notes */}
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Aktivitas</p>

              <div className="space-y-3 mb-4">
                {notes.length === 0 && (
                  <p className="text-sm text-slate-400 italic">Belum ada catatan.</p>
                )}
                {notes.map(note => (
                  <div key={note.id} className={cn(
                    'rounded-lg px-3 py-2.5 text-sm',
                    note.author_type === 'SYSTEM'
                      ? 'bg-slate-50 text-slate-500 italic'
                      : note.is_internal
                        ? 'bg-amber-50 border border-amber-100 text-slate-700'
                        : 'bg-blue-50 border border-blue-100 text-slate-700'
                  )}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-xs text-slate-600">{note.author_name}</span>
                      {note.is_internal && note.author_type !== 'SYSTEM' && (
                        <span className="text-[10px] text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded font-medium">Internal</span>
                      )}
                      <span className="text-[11px] text-slate-400 ml-auto">
                        {new Date(note.created_at).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="leading-relaxed whitespace-pre-wrap">{note.content}</p>
                  </div>
                ))}
              </div>

              {/* Form tambah catatan */}
              <form onSubmit={handleAddNote} className="space-y-2 border-t border-slate-100 pt-3">
                <textarea
                  value={noteContent}
                  onChange={e => setNoteContent(e.target.value)}
                  rows={2}
                  placeholder="Tambah catatan atau update penanganan..."
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003366]/20 focus:border-[#003366] resize-none"
                />
                <div className="flex items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={noteIsInternal}
                      onChange={e => setNoteIsInternal(e.target.checked)}
                      className="rounded border-slate-300 cursor-pointer"
                    />
                    Catatan internal (tidak dikirim ke pelanggan)
                  </label>
                  <button
                    type="submit"
                    disabled={isPending || !noteContent.trim()}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#003366] hover:bg-[#002a55] text-white text-xs font-semibold rounded-lg cursor-pointer transition-colors disabled:opacity-60"
                  >
                    <Send size={12} />
                    Tambah
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Kolom kanan: info submitter + metadata */}
          <div className="space-y-4">

            {/* Submitter */}
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Pengirim</p>
              <div className="space-y-2.5">
                <div className="flex items-center gap-2.5">
                  <User size={14} className="text-slate-400 shrink-0" />
                  <span className="text-sm font-medium text-slate-800">{ticket.submitter_name}</span>
                </div>
                {ticket.submitter_email && (
                  <div className="flex items-center gap-2.5">
                    <Mail size={14} className="text-slate-400 shrink-0" />
                    <a href={`mailto:${ticket.submitter_email}`} className="text-sm text-[#003366] hover:underline truncate">
                      {ticket.submitter_email}
                    </a>
                  </div>
                )}
                {ticket.submitter_phone && (
                  <div className="flex items-center gap-2.5">
                    <Phone size={14} className="text-slate-400 shrink-0" />
                    <a href={`https://wa.me/${ticket.submitter_phone.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" className="text-sm text-[#003366] hover:underline">
                      {ticket.submitter_phone}
                    </a>
                  </div>
                )}
                {ticket.contact_name && (
                  <div className="flex items-center gap-2.5 pt-1 border-t border-slate-100">
                    <Link2 size={14} className="text-slate-400 shrink-0" />
                    <span className="text-sm text-slate-600">Kontak: <span className="font-medium">{ticket.contact_name}</span></span>
                  </div>
                )}
              </div>
            </div>

            {/* Metadata */}
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Detail Tiket</p>
              <div className="space-y-2.5 text-sm">
                <Row label="Nomor" value={<span className="font-mono">{ticket.ticket_number}</span>} />
                <Row label="Jenis" value={TICKET_TYPE_LABEL[ticket.type]} />
                <Row label="Prioritas" value={TICKET_PRIORITY_LABEL[ticket.priority]} />
                <Row label="Status" value={
                  <span className={cn('px-1.5 py-0.5 rounded text-xs font-semibold', STATUS_CONFIG[ticket.status].bg, STATUS_CONFIG[ticket.status].color)}>
                    {STATUS_CONFIG[ticket.status].label}
                  </span>
                } />
                {ticket.reference_number && (
                  <Row label={ticket.reference_type === 'SALE' ? 'Invoice' : 'PO'} value={<span className="font-mono">{ticket.reference_number}</span>} />
                )}
                {ticket.assigned_to_name && (
                  <Row label="Ditangani" value={ticket.assigned_to_name} />
                )}
                <Row label="Masuk" value={new Date(ticket.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })} />
                {ticket.resolved_at && (
                  <Row label="Selesai" value={new Date(ticket.resolved_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })} />
                )}
              </div>
            </div>

            {/* Saluran notifikasi — disiapkan, belum aktif */}
            {(ticket.notification_email || ticket.notification_phone) && (
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Saluran Notifikasi</p>
                <p className="text-[11px] text-slate-400 mb-2 italic">Disiapkan — integrasi WA/email aktif di fase berikutnya</p>
                {ticket.notification_email && (
                  <p className="text-xs text-slate-600 flex items-center gap-1.5"><Mail size={11} /> {ticket.notification_email}</p>
                )}
                {ticket.notification_phone && (
                  <p className="text-xs text-slate-600 flex items-center gap-1.5 mt-1"><Phone size={11} /> {ticket.notification_phone}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="text-slate-400 shrink-0">{label}</span>
      <span className="text-slate-700 text-right font-medium">{value}</span>
    </div>
  )
}
