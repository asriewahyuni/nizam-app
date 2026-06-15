'use client'
// app/(dashboard)/wacrm/WaCrmDashboardClient.tsx
// Kanban pipeline + inbox dua-panel untuk WA CRM

import { useState, useMemo, useTransition, useEffect, useCallback } from 'react'
import {
  MessageCircle,
  Plus,
  Search,
  Wifi,
  WifiOff,
  Send,
  UserPlus,
  Users,
  Bot,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WaCrmContact, WaCrmMessage, WaCrmConnectionStatus } from './page'
import { TambahKontakModal } from './TambahKontakModal'

// ── Types ─────────────────────────────────────────────────────────────────

type Props = {
  orgId: string
  contacts: WaCrmContact[]
  messages: WaCrmMessage[]
  connectionStatus: WaCrmConnectionStatus
  connectedPhone: string | null
  pipelineStages: string[]
  settings: Record<string, string>
}

type View = 'pipeline' | 'inbox'

const STAGE_KEYS: WaCrmContact['stage'][] = ['masuk', 'follow_up', 'negosiasi', 'closing']

const STAGE_COLOR: Record<WaCrmContact['stage'], string> = {
  masuk:      'border-t-slate-400 bg-slate-50',
  follow_up:  'border-t-blue-400 bg-blue-50/30',
  negosiasi:  'border-t-amber-400 bg-amber-50/30',
  closing:    'border-t-emerald-500 bg-emerald-50/30',
}

const STAGE_BADGE: Record<WaCrmContact['stage'], string> = {
  masuk:     'bg-slate-100 text-slate-600',
  follow_up: 'bg-blue-100 text-blue-700',
  negosiasi: 'bg-amber-100 text-amber-700',
  closing:   'bg-emerald-100 text-emerald-700',
}

// ── Helpers ───────────────────────────────────────────────────────────────

function relativeTime(iso: string | null): string {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'baru saja'
  if (m < 60) return `${m} menit lalu`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} jam lalu`
  return `${Math.floor(h / 24)} hari lalu`
}

// ── Connection Badge ───────────────────────────────────────────────────────

function ConnectionBadge({ status, phone }: { status: WaCrmConnectionStatus; phone: string | null }) {
  const map = {
    connected:    { icon: Wifi,    label: phone ?? 'Terhubung',    cls: 'bg-emerald-100 text-emerald-700' },
    disconnected: { icon: WifiOff, label: 'Tidak terhubung',       cls: 'bg-red-100 text-red-600'         },
    qr_pending:   { icon: Wifi,    label: 'Menunggu scan QR...',   cls: 'bg-amber-100 text-amber-700'     },
  }
  const { icon: Icon, label, cls } = map[status]
  return (
    <div className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold', cls)}>
      <Icon className="h-3 w-3" />
      {label}
    </div>
  )
}

// ── Kanban Pipeline ────────────────────────────────────────────────────────

function KanbanBoard({
  contacts,
  stageLabels,
  onSelectContact,
  selectedId,
}: {
  contacts: WaCrmContact[]
  stageLabels: string[]
  onSelectContact: (c: WaCrmContact) => void
  selectedId: string | null
}) {
  const byStage = useMemo(() => {
    const map = {} as Record<WaCrmContact['stage'], WaCrmContact[]>
    STAGE_KEYS.forEach(k => (map[k] = []))
    contacts.forEach(c => map[c.stage]?.push(c))
    return map
  }, [contacts])

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-4">
      {STAGE_KEYS.map((key, idx) => (
        <div key={key} className={cn('rounded-xl border-t-4 border border-slate-200 p-3 space-y-2 min-h-[200px]', STAGE_COLOR[key])}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">{stageLabels[idx] ?? key}</span>
            <span className="text-xs font-semibold text-slate-400">{byStage[key].length}</span>
          </div>
          {byStage[key].map(contact => (
            <button
              key={contact.id}
              type="button"
              onClick={() => onSelectContact(contact)}
              className={cn(
                'w-full text-left rounded-lg border bg-white p-3 shadow-sm hover:shadow-md transition-all cursor-pointer',
                selectedId === contact.id ? 'border-green-400 ring-1 ring-green-300' : 'border-slate-200',
              )}
            >
              <div className="font-semibold text-sm text-slate-800 truncate">{contact.name}</div>
              <div className="text-xs text-slate-500 mt-0.5 truncate">{contact.phone}</div>
              {contact.product_interest && (
                <div className="text-[11px] text-slate-400 mt-1 truncate">{contact.product_interest}</div>
              )}
              {contact.last_message_at && (
                <div className="text-[11px] text-slate-400 mt-1">{relativeTime(contact.last_message_at)}</div>
              )}
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}

// ── Contact Row (Inbox List) ───────────────────────────────────────────────

function ContactRow({
  contact,
  lastMessage,
  active,
  stageLabel,
  onClick,
}: {
  contact: WaCrmContact
  lastMessage: WaCrmMessage | undefined
  active: boolean
  stageLabel: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full text-left flex items-start gap-3 px-4 py-3 border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer',
        active && 'bg-green-50 border-l-2 border-l-green-500',
      )}
    >
      <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 text-sm font-bold text-green-700">
        {contact.name[0]?.toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold text-sm text-slate-800 truncate">{contact.name}</span>
          <span className="text-[10px] text-slate-400 flex-shrink-0">
            {relativeTime(contact.last_message_at)}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-semibold', STAGE_BADGE[contact.stage])}>
            {stageLabel}
          </span>
          {lastMessage && (
            <span className="text-xs text-slate-400 truncate">
              {lastMessage.direction === 'out' ? '↗ ' : ''}{lastMessage.body}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}

// ── Chat Panel ─────────────────────────────────────────────────────────────

function ChatPanel({
  contact,
  messages,
  stageLabel,
  onStageChange,
  stageLabels,
  aiEnabled,
  onMessageSent,
}: {
  contact: WaCrmContact
  messages: WaCrmMessage[]
  stageLabel: string
  onStageChange: (contactId: string, newStage: WaCrmContact['stage']) => void
  stageLabels: string[]
  aiEnabled: boolean
  onMessageSent: (msg: WaCrmMessage) => void
}) {
  const [body, setBody]             = useState('')
  const [isSending, startTransition] = useTransition()

  function handleSend() {
    if (!body.trim()) return
    startTransition(async () => {
      const res = await fetch('/api/wacrm/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId: contact.id, body: body.trim() }),
      })
      if (res.ok) {
        const { data } = await res.json()
        if (data) onMessageSent(data)
      }
      setBody('')
    })
  }

  const contactMessages = messages.filter(m => m.contact_id === contact.id)
    .sort((a, b) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime())

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 bg-white">
        <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center text-sm font-bold text-green-700 flex-shrink-0">
          {contact.name[0]?.toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm text-slate-800">{contact.name}</div>
          <div className="text-xs text-slate-500">{contact.phone}</div>
        </div>
        {/* Stage changer */}
        <select
          value={contact.stage}
          onChange={e => onStageChange(contact.id, e.target.value as WaCrmContact['stage'])}
          className="text-xs rounded-lg border border-slate-200 px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-green-500 cursor-pointer"
        >
          {STAGE_KEYS.map((key, i) => (
            <option key={key} value={key}>{stageLabels[i] ?? key}</option>
          ))}
        </select>
        {aiEnabled && (
          <div className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-1">
            <Bot className="h-3 w-3" />
            AI Aktif
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
        {contactMessages.length === 0 && (
          <div className="text-center text-sm text-slate-400 py-8">Belum ada pesan</div>
        )}
        {contactMessages.map(msg => (
          <div
            key={msg.id}
            className={cn(
              'max-w-[75%] rounded-xl text-sm overflow-hidden',
              msg.direction === 'out'
                ? 'ml-auto bg-green-600 text-white rounded-br-none'
                : 'mr-auto bg-white border border-slate-200 text-slate-800 rounded-bl-none',
            )}
          >
            {/* Gambar */}
            {msg.media_type === 'image' && msg.media_url && (
              <a href={msg.media_url} target="_blank" rel="noopener noreferrer">
                <img
                  src={msg.media_url}
                  alt="Gambar"
                  className="max-w-full max-h-60 object-cover block"
                  loading="lazy"
                />
              </a>
            )}
            {/* Video */}
            {msg.media_type === 'video' && msg.media_url && (
              <video src={msg.media_url} controls className="max-w-full max-h-60 block" />
            )}
            {/* Audio / Voice note */}
            {msg.media_type === 'audio' && msg.media_url && (
              <div className="px-3 pt-2">
                <audio src={msg.media_url} controls className="w-full h-8" />
              </div>
            )}
            {/* Dokumen */}
            {msg.media_type === 'document' && msg.media_url && (
              <a
                href={msg.media_url}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  'flex items-center gap-2 px-3 py-2 text-xs underline',
                  msg.direction === 'out' ? 'text-green-100' : 'text-blue-600',
                )}
              >
                📄 {msg.media_url.split('/').pop() ?? 'Dokumen'}
              </a>
            )}
            {/* Caption / teks */}
            <div className="px-3 py-2">
              {msg.body && <div>{msg.body}</div>}
              <div className={cn('text-[10px] mt-0.5', msg.direction === 'out' ? 'text-green-200' : 'text-slate-400')}>
                {new Date(msg.sent_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                {msg.direction === 'out' && (msg.delivered ? ' ✓✓' : ' ✓')}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="flex items-end gap-2 p-3 border-t border-slate-200 bg-white">
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
          rows={1}
          placeholder="Ketik pesan... (Enter untuk kirim)"
          className="flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent max-h-28"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={isSending || !body.trim()}
          className="p-2.5 rounded-xl bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors cursor-pointer flex-shrink-0"
        >
          {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
    </div>
  )
}

// ── Main Dashboard ─────────────────────────────────────────────────────────

export function WaCrmDashboardClient({
  orgId,
  contacts,
  messages,
  connectionStatus,
  connectedPhone,
  pipelineStages,
  settings,
}: Props) {
  const [view, setView]               = useState<View>('pipeline')
  const [search, setSearch]           = useState('')
  const [selectedContact, setSelected] = useState<WaCrmContact | null>(null)
  const [localContacts, setLocalContacts] = useState(contacts)
  const [localMessages, setLocalMessages] = useState(messages)
  const [showTambahModal, setShowTambahModal] = useState(false)

  const aiEnabled = settings.ai_enabled === 'true'

  // Refresh kontak (dipanggil saat ada pesan dari kontak baru)
  const refreshContacts = useCallback(async () => {
    try {
      const res = await fetch('/api/wacrm/contacts')
      if (res.ok) {
        const { data } = await res.json()
        if (data) setLocalContacts(data)
      }
    } catch { /* silent */ }
  }, [])

  // SSE — subscribe ke /api/wacrm/stream, reconnect otomatis jika putus
  useEffect(() => {
    let es: EventSource | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null

    function connect() {
      es = new EventSource('/api/wacrm/stream')

      es.onmessage = (e) => {
        try {
          const msg: WaCrmMessage = JSON.parse(e.data)
          // Tambah pesan ke state (deduplicate by id)
          setLocalMessages(prev =>
            prev.some(m => m.id === msg.id) ? prev : [...prev, msg]
          )
          // Refresh kontak agar last_message_at & nama kontak baru muncul
          refreshContacts()
        } catch { /* malformed event */ }
      }

      es.onerror = () => {
        es?.close()
        // Reconnect setelah 3 detik
        reconnectTimer = setTimeout(connect, 3_000)
      }
    }

    connect()
    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer)
      es?.close()
    }
  }, [refreshContacts])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return localContacts
    return localContacts.filter(c =>
      c.name.toLowerCase().includes(q) || c.phone.includes(q)
    )
  }, [localContacts, search])

  function getLastMessage(contactId: string): WaCrmMessage | undefined {
    return localMessages
      .filter(m => m.contact_id === contactId)
      .sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime())[0]
  }

  function getStageLabel(stage: WaCrmContact['stage']): string {
    return pipelineStages[STAGE_KEYS.indexOf(stage)] ?? stage
  }

  function handleStageChange(contactId: string, newStage: WaCrmContact['stage']) {
    setLocalContacts(prev =>
      prev.map(c => c.id === contactId ? { ...c, stage: newStage } : c)
    )
    // Optimistic UI — fire-and-forget API call
    fetch('/api/wacrm/contacts/stage', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contactId, stage: newStage }),
    })
  }

  const totalByStage = useMemo(() => {
    const map = {} as Record<WaCrmContact['stage'], number>
    STAGE_KEYS.forEach(k => (map[k] = 0))
    localContacts.forEach(c => map[c.stage]++)
    return map
  }, [localContacts])

  return (
    <div className="flex flex-col h-full">

      {/* ── Top Bar ── */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-200 bg-white sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-green-600" />
          <h1 className="text-base font-bold text-slate-900">WhatsApp CRM</h1>
        </div>
        <div className="flex items-center gap-2">
          <ConnectionBadge status={connectionStatus} phone={connectedPhone} />
          <button
            type="button"
            onClick={() => setShowTambahModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-semibold hover:bg-green-700 transition-colors cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            Tambah Kontak
          </button>
          <button
            type="button"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <Users className="h-3.5 w-3.5" />
            Import Grup WA
          </button>
        </div>
      </div>

      {/* ── Summary Chips ── */}
      <div className="flex items-center gap-2 px-4 py-2 bg-white border-b border-slate-100 overflow-x-auto">
        {STAGE_KEYS.map((key, i) => (
          <div key={key} className={cn('flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap', STAGE_BADGE[key])}>
            {pipelineStages[i] ?? key}
            <span className="opacity-70">({totalByStage[key]})</span>
          </div>
        ))}
        <div className="ml-auto flex-shrink-0 text-xs text-slate-400">
          {localContacts.length} total kontak
        </div>
      </div>

      {/* ── View Toggle + Search ── */}
      <div className="flex items-center gap-3 px-4 py-2 bg-white border-b border-slate-200">
        <div className="flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
          {(['pipeline', 'inbox'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer',
                view === v ? 'bg-white text-green-700 shadow-sm' : 'text-slate-500 hover:text-slate-700',
              )}
            >
              {v === 'pipeline' ? 'Pipeline' : 'Inbox'}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cari nama atau nomor..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
      </div>

      {/* ── Main Content ── */}
      {view === 'pipeline' ? (
        <div className="flex-1 overflow-auto">
          <KanbanBoard
            contacts={filtered}
            stageLabels={pipelineStages}
            onSelectContact={c => { setSelected(c); setView('inbox') }}
            selectedId={selectedContact?.id ?? null}
          />
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* Contact list */}
          <div className="w-72 flex-shrink-0 border-r border-slate-200 overflow-y-auto bg-white">
            {filtered.length === 0 && (
              <div className="text-center text-sm text-slate-400 py-12">Tidak ada kontak</div>
            )}
            {filtered.map(c => (
              <ContactRow
                key={c.id}
                contact={c}
                lastMessage={getLastMessage(c.id)}
                active={selectedContact?.id === c.id}
                stageLabel={getStageLabel(c.stage)}
                onClick={() => setSelected(c)}
              />
            ))}
          </div>

          {/* Chat panel */}
          <div className="flex-1 overflow-hidden">
            {selectedContact ? (
              <ChatPanel
                contact={selectedContact}
                messages={localMessages}
                stageLabel={getStageLabel(selectedContact.stage)}
                onStageChange={handleStageChange}
                stageLabels={pipelineStages}
                aiEnabled={aiEnabled}
                onMessageSent={(msg) => setLocalMessages(prev => [...prev, msg])}
              />
            ) : (
              <div className="h-full flex flex-col items-center justify-center gap-3 text-slate-400">
                <MessageCircle className="h-12 w-12 opacity-30" />
                <p className="text-sm">Pilih kontak untuk membuka percakapan</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modal Tambah Kontak ── */}
      <TambahKontakModal
        open={showTambahModal}
        onClose={() => setShowTambahModal(false)}
        pipelineStages={pipelineStages}
        onCreated={(newContact) => {
          setLocalContacts(prev => [newContact, ...prev])
          setSelected(newContact)
          setView('inbox')
        }}
      />
    </div>
  )
}

// ── Inline icon stubs (avoid extra import noise) ───────────────────────────

function LayoutKanbanIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  )
}

function MessageIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}
