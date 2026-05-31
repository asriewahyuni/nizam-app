'use client'

import { useState, useTransition, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  MessageSquare, Plus, Search, Filter, Copy, CheckCheck,
  AlertTriangle, HelpCircle, Lightbulb, ClipboardList,
  Clock, CheckCircle2, XCircle, ChevronRight, ExternalLink,
  ArrowUpDown, Ticket
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CrmTicket, CrmTicketStatus, CrmTicketType, CrmTicketPriority } from '@/modules/crm/lib/ticket-constants'
import { TICKET_TYPE_LABEL, TICKET_STATUS_LABEL, TICKET_PRIORITY_LABEL } from '@/modules/crm/lib/ticket-constants'

// ─── Config ──────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<CrmTicketType, { icon: typeof MessageSquare; color: string }> = {
  COMPLAINT:  { icon: AlertTriangle, color: 'text-rose-600 bg-rose-50' },
  REQUEST:    { icon: ClipboardList, color: 'text-blue-600 bg-blue-50' },
  INQUIRY:    { icon: HelpCircle,    color: 'text-amber-600 bg-amber-50' },
  SUGGESTION: { icon: Lightbulb,    color: 'text-emerald-600 bg-emerald-50' },
}

const STATUS_CONFIG: Record<CrmTicketStatus, { label: string; color: string; icon: typeof Clock }> = {
  NEW:         { label: 'Baru',      color: 'text-blue-700 bg-blue-100',    icon: Clock },
  IN_PROGRESS: { label: 'Diproses', color: 'text-amber-700 bg-amber-100',  icon: ArrowUpDown },
  RESOLVED:    { label: 'Selesai',  color: 'text-emerald-700 bg-emerald-100', icon: CheckCircle2 },
  CLOSED:      { label: 'Ditutup', color: 'text-slate-600 bg-slate-100',   icon: XCircle },
}

const PRIORITY_CONFIG: Record<CrmTicketPriority, { label: string; dot: string }> = {
  LOW:    { label: 'Rendah', dot: 'bg-slate-300' },
  MEDIUM: { label: 'Sedang', dot: 'bg-amber-400' },
  HIGH:   { label: 'Tinggi', dot: 'bg-orange-500' },
  URGENT: { label: 'Urgent', dot: 'bg-rose-600 animate-pulse' },
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  tickets: CrmTicket[]
  orgId: string
  orgSlug: string
  orgName: string
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TicketListClient({ tickets, orgId, orgSlug, orgName }: Props) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<CrmTicketStatus | 'ALL'>('ALL')
  const [typeFilter, setTypeFilter] = useState<CrmTicketType | 'ALL'>('ALL')
  const [copied, setCopied] = useState(false)

  const publicUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/submit/${orgSlug}`
    : `/submit/${orgSlug}`

  const copyLink = () => {
    navigator.clipboard.writeText(publicUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  // Hitung stats
  const stats = useMemo(() => ({
    new:         tickets.filter(t => t.status === 'NEW').length,
    in_progress: tickets.filter(t => t.status === 'IN_PROGRESS').length,
    resolved:    tickets.filter(t => t.status === 'RESOLVED').length,
    total:       tickets.length,
  }), [tickets])

  // Filter
  const filtered = useMemo(() => {
    return tickets.filter(t => {
      if (statusFilter !== 'ALL' && t.status !== statusFilter) return false
      if (typeFilter !== 'ALL' && t.type !== typeFilter) return false
      if (search) {
        const q = search.toLowerCase()
        return (
          t.subject.toLowerCase().includes(q) ||
          t.ticket_number.toLowerCase().includes(q) ||
          t.submitter_name.toLowerCase().includes(q) ||
          (t.contact_name || '').toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [tickets, statusFilter, typeFilter, search])

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Ticket size={20} className="text-[#003366]" />
              Keluhan &amp; Permintaan
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Tangani tiket dari pelanggan dan vendor {orgName}
            </p>
          </div>

          {/* Link publik */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-600 font-mono max-w-xs overflow-hidden">
              <ExternalLink size={12} className="shrink-0 text-slate-400" />
              <span className="truncate">/submit/{orgSlug}</span>
            </div>
            <button type="button"
              onClick={copyLink}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#003366] hover:bg-[#002a55] text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              {copied ? <CheckCheck size={13} /> : <Copy size={13} />}
              {copied ? 'Tersalin!' : 'Salin Link'}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-4 flex gap-4 flex-wrap">
          {[
            { label: 'Baru',      value: stats.new,         color: 'text-blue-600',    bg: 'bg-blue-50 border-blue-200' },
            { label: 'Diproses', value: stats.in_progress, color: 'text-amber-600',   bg: 'bg-amber-50 border-amber-200' },
            { label: 'Selesai',  value: stats.resolved,    color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
            { label: 'Total',    value: stats.total,        color: 'text-slate-600',   bg: 'bg-slate-50 border-slate-200' },
          ].map(s => (
            <div key={s.label} className={cn('flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm', s.bg)}>
              <span className={cn('text-lg font-bold leading-none', s.color)}>{s.value}</span>
              <span className="text-slate-500 text-xs">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Filters ────────────────────────────────────────────────────────── */}
      <div className="border-b border-slate-100 bg-white px-6 py-3 flex items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cari tiket, nama, subjek..."
            className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003366]/20 focus:border-[#003366]"
          />
        </div>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as CrmTicketStatus | 'ALL')}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#003366]/20 cursor-pointer"
        >
          <option value="ALL">Semua Status</option>
          {(Object.keys(TICKET_STATUS_LABEL) as CrmTicketStatus[]).map(s => (
            <option key={s} value={s}>{TICKET_STATUS_LABEL[s]}</option>
          ))}
        </select>

        {/* Type filter */}
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value as CrmTicketType | 'ALL')}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#003366]/20 cursor-pointer"
        >
          <option value="ALL">Semua Jenis</option>
          {(Object.keys(TICKET_TYPE_LABEL) as CrmTicketType[]).map(t => (
            <option key={t} value={t}>{TICKET_TYPE_LABEL[t]}</option>
          ))}
        </select>
      </div>

      {/* ── List ───────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-3">
              <MessageSquare size={24} className="text-slate-400" />
            </div>
            <p className="font-semibold text-slate-700">
              {tickets.length === 0 ? 'Belum ada tiket masuk' : 'Tidak ada tiket yang cocok'}
            </p>
            <p className="text-sm text-slate-400 mt-1 max-w-xs">
              {tickets.length === 0
                ? 'Bagikan link publik ke pelanggan atau vendor agar mereka bisa mengirim tiket.'
                : 'Coba ubah filter pencarian.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map(ticket => {
              const TypeIcon = TYPE_CONFIG[ticket.type].icon
              const statusCfg = STATUS_CONFIG[ticket.status]
              const StatusIcon = statusCfg.icon
              const priorityCfg = PRIORITY_CONFIG[ticket.priority]

              return (
                <Link
                  key={ticket.id}
                  href={`/crm/tickets/${ticket.id}`}
                  className="block px-6 py-4 hover:bg-slate-50 transition-colors cursor-pointer group"
                >
                  <div className="flex items-start gap-4">
                    {/* Type icon */}
                    <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5', TYPE_CONFIG[ticket.type].color)}>
                      <TypeIcon size={16} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="text-xs font-mono text-slate-400">{ticket.ticket_number}</span>
                        <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex items-center gap-1', statusCfg.color)}>
                          <StatusIcon size={10} />
                          {statusCfg.label}
                        </span>
                        <span className="flex items-center gap-1 text-[10px] text-slate-500">
                          <span className={cn('w-1.5 h-1.5 rounded-full', priorityCfg.dot)} />
                          {priorityCfg.label}
                        </span>
                      </div>

                      <p className="font-semibold text-slate-800 text-sm truncate group-hover:text-[#003366] transition-colors">
                        {ticket.subject}
                      </p>

                      <div className="flex items-center gap-3 mt-1 text-xs text-slate-400 flex-wrap">
                        <span>{ticket.submitter_name}</span>
                        {ticket.contact_name && (
                          <span className="text-slate-300">·</span>
                        )}
                        {ticket.contact_name && (
                          <span className="text-slate-500">{ticket.contact_name}</span>
                        )}
                        <span className="text-slate-300">·</span>
                        <span>{new Date(ticket.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        {ticket.reference_number && (
                          <>
                            <span className="text-slate-300">·</span>
                            <span className="font-mono">{ticket.reference_number}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Chevron */}
                    <ChevronRight size={16} className="text-slate-300 shrink-0 mt-1 group-hover:text-slate-500 transition-colors" />
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
