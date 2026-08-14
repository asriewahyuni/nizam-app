'use client'
// app/(dashboard)/wacrm/WaCrmDashboardClient.tsx
// Kanban pipeline + inbox dua-panel untuk WA CRM

import { useState, useMemo, useTransition, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
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
  Pencil,
  Trash2,
  X,
  Calendar,
  Hash,
  User,
  Tag,
  Phone,
  Clock,
  MessageSquare,
  Paperclip,
  CheckSquare,
  Share2,
  History,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WaCrmContact, WaCrmMessage, WaCrmConnectionStatus } from './page'
import { TambahKontakModal } from './TambahKontakModal'
import { saveModuleSettings } from '@/modules/marketplace/actions/marketplace.actions'

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

const STAGE_BADGE: Record<string, string> = {
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
  onEditContact,
  onDeleteContact,
  onStageChange,
  onDeleteStage,
  selectedId,
  isAddingStage,
  setIsAddingStage,
  newStageName,
  setNewStageName,
  isSavingStage,
  onAddStageSubmit,
}: {
  contacts: WaCrmContact[]
  stageLabels: string[]
  onSelectContact: (c: WaCrmContact) => void
  onEditContact: (c: WaCrmContact) => void
  onDeleteContact: (id: string) => void
  onStageChange: (contactId: string, newStage: string) => void
  onDeleteStage: (stageLabel: string) => void
  selectedId: string | null
  isAddingStage: boolean
  setIsAddingStage: (b: boolean) => void
  newStageName: string
  setNewStageName: (s: string) => void
  isSavingStage: boolean
  onAddStageSubmit: (e: React.FormEvent) => void
}) {
  const stageKeys = useMemo(() => {
    return stageLabels.map(label => label.trim().toLowerCase().replace(/\s+/g, '_'))
  }, [stageLabels])

  const byStage = useMemo(() => {
    const map = {} as Record<string, WaCrmContact[]>
    stageKeys.forEach(k => (map[k] = []))
    contacts.forEach(c => {
      const key = stageKeys.includes(c.stage) ? c.stage : 'masuk'
      if (map[key]) {
        map[key].push(c)
      } else {
        // Fallback to first stage if not matching
        const first = stageKeys[0]
        if (first && map[first]) {
          map[first].push(c)
        }
      }
    })
    return map
  }, [contacts, stageKeys])

  const handleDragStart = (e: React.DragEvent, contactId: string) => {
    e.dataTransfer.setData('text/plain', contactId)
  }

  const handleDrop = (e: React.DragEvent, newStage: string) => {
    e.preventDefault()
    const contactId = e.dataTransfer.getData('text/plain')
    if (contactId) {
      onStageChange(contactId, newStage)
    }
  }

  const getStageColorClass = (key: string) => {
    const map: Record<string, string> = {
      masuk:      'border-t-slate-400 bg-slate-50',
      follow_up:  'border-t-blue-400 bg-blue-50/30',
      negosiasi:  'border-t-amber-400 bg-amber-50/30',
      closing:    'border-t-emerald-500 bg-emerald-50/30',
    }
    return map[key] || 'border-t-indigo-400 bg-indigo-50/30'
  }

  return (
    <div className="flex gap-4 p-4 overflow-x-auto select-none items-start min-h-[500px]">
      {stageKeys.map((key, idx) => (
        <div
          key={key}
          onDragOver={e => e.preventDefault()}
          onDrop={e => handleDrop(e, key)}
          className={cn('rounded-xl border-t-4 border border-slate-200 p-3 space-y-2 min-h-[300px] w-72 shrink-0 transition-all', getStageColorClass(key))}
        >
          <div className="flex items-center justify-between group/header h-6">
            <span className="text-xs font-semibold text-slate-700 truncate mr-2">{stageLabels[idx] ?? key}</span>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className="text-[10px] font-semibold text-slate-400">{byStage[key]?.length || 0}</span>
              {stageLabels.length > 1 && (
                <button
                  type="button"
                  title="Hapus board/list"
                  onClick={() => onDeleteStage(stageLabels[idx])}
                  className="opacity-0 group-hover/header:opacity-100 p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-600 transition-all cursor-pointer border-none bg-transparent"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
          {byStage[key]?.map(contact => (
            <div
              key={contact.id}
              draggable
              onDragStart={e => handleDragStart(e, contact.id)}
              className={cn(
                'group relative rounded-lg border bg-white p-3 shadow-sm hover:shadow-md transition-all cursor-grab active:cursor-grabbing',
                selectedId === contact.id ? 'border-green-400 ring-1 ring-green-300' : 'border-slate-200',
              )}
            >
              {/* Area klik utama — buka inbox */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => onSelectContact(contact)}
                onKeyDown={e => e.key === 'Enter' && onSelectContact(contact)}
                className="cursor-pointer pr-14"
              >
                <div className="font-semibold text-sm text-slate-800 truncate">{contact.name}</div>
                <div className="text-xs text-slate-500 mt-0.5 truncate">{contact.phone}</div>
                {contact.product_interest && (
                  <div className="text-[11px] text-slate-400 mt-1 truncate">{contact.product_interest}</div>
                )}
                {contact.last_message_at && (
                  <div className="text-[11px] text-slate-400 mt-1">{relativeTime(contact.last_message_at)}</div>
                )}
              </div>

              {/* Tombol CRUD — muncul saat hover */}
              <div className="absolute top-2 right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                <button
                  type="button"
                  title="Edit kontak"
                  onClick={e => { e.stopPropagation(); onEditContact(contact) }}
                  className="p-1.5 rounded-md bg-slate-100 hover:bg-blue-100 text-slate-500 hover:text-blue-600 transition-colors cursor-pointer"
                >
                  <Pencil className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  title="Hapus kontak"
                  onClick={e => { e.stopPropagation(); onDeleteContact(contact.id) }}
                  className="p-1.5 rounded-md bg-slate-100 hover:bg-red-100 text-slate-500 hover:text-red-600 transition-colors cursor-pointer"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ))}

      {/* Button to add a new stage */}
      <div className="w-72 shrink-0 rounded-xl border border-dashed border-slate-300 p-4 flex flex-col items-center justify-center min-h-[120px] bg-slate-50/50 hover:bg-slate-50 hover:border-green-500/50 transition-colors">
        {isAddingStage ? (
          <form onSubmit={onAddStageSubmit} className="w-full space-y-2">
            <input
              type="text"
              value={newStageName}
              onChange={e => setNewStageName(e.target.value)}
              placeholder="Nama board baru..."
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
              autoFocus
            />
            <div className="flex justify-end gap-1.5">
              <button
                type="button"
                onClick={() => setIsAddingStage(false)}
                className="px-2.5 py-1 text-[11px] rounded-md border border-slate-200 text-slate-500 bg-white hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSavingStage || !newStageName.trim()}
                className="px-2.5 py-1 text-[11px] rounded-md bg-green-600 text-white hover:bg-green-700 transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1"
              >
                {isSavingStage && <Loader2 className="h-3 w-3 animate-spin" />}
                Tambah
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setIsAddingStage(true)}
            className="flex flex-col items-center gap-2 text-slate-500 hover:text-green-600 transition-colors cursor-pointer bg-transparent border-none outline-none font-semibold text-xs py-4 w-full h-full"
          >
            <Plus className="h-5 w-5" />
            <span>Tambah Board / List</span>
          </button>
        )}
      </div>
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
          <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-semibold', STAGE_BADGE[contact.stage] || 'bg-indigo-100 text-indigo-700')}>
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
  onStageChange: (contactId: string, newStage: string) => void
  stageLabels: string[]
  aiEnabled: boolean
  onMessageSent: (msg: WaCrmMessage) => void
}) {
  const [body, setBody]             = useState('')
  const [isSending, startTransition] = useTransition()

  const stageKeys = useMemo(() => {
    return stageLabels.map(label => label.trim().toLowerCase().replace(/\s+/g, '_'))
  }, [stageLabels])

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
          onChange={e => onStageChange(contact.id, e.target.value)}
          className="text-xs rounded-lg border border-slate-200 px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-green-500 cursor-pointer animate-none"
        >
          {stageKeys.map((key, i) => (
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
            {msg.media_type === 'image' && msg.media_url && (
              <a href={msg.media_url} target="_blank" rel="noopener noreferrer">
                <img src={msg.media_url} alt="Gambar" className="max-w-full max-h-60 object-cover block" loading="lazy" />
              </a>
            )}
            {msg.media_type === 'video' && msg.media_url && (
              <video src={msg.media_url} controls className="max-w-full max-h-60 block" />
            )}
            {msg.media_type === 'audio' && msg.media_url && (
              <div className="px-3 pt-2">
                <audio src={msg.media_url} controls className="w-full h-8" />
              </div>
            )}
            {msg.media_type === 'sticker' && msg.media_url && (
              <img src={msg.media_url} alt="Sticker" className="w-24 h-24 object-contain block p-1" />
            )}
            {msg.media_type === 'document' && msg.media_url && (
              <a href={msg.media_url} target="_blank" rel="noopener noreferrer"
                 className={cn('flex items-center gap-2 px-3 py-2 text-xs underline', msg.direction === 'out' ? 'text-green-100' : 'text-blue-600')}>
                📄 {msg.media_url.split('/').pop() ?? 'Dokumen'}
              </a>
            )}
            {(msg.media_type && !msg.media_url) && (
              <div className={cn('px-3 pt-2 pb-1 text-xs opacity-60 italic', msg.direction === 'out' ? 'text-green-100' : 'text-slate-500')}>
                {{ image: '📷 Gambar', video: '🎥 Video', audio: '🎵 Pesan suara', document: '📄 Dokumen', sticker: '🎭 Sticker', unknown: '📎 Media' }[msg.media_type] ?? '📎 Media'}
              </div>
            )}
            <div className="px-3 py-2">
              {msg.body && msg.body !== 'non-text message' && <div>{msg.body}</div>}
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
  const router = useRouter()
  const [view, setView]               = useState<View>('pipeline')
  const [search, setSearch]           = useState('')
  const [selectedContact, setSelected] = useState<WaCrmContact | null>(null)
  const [localContacts, setLocalContacts] = useState(contacts)
  const [localMessages, setLocalMessages] = useState(messages)
  const [showTambahModal, setShowTambahModal] = useState(false)
  const [editContact, setEditContact]   = useState<WaCrmContact | null>(null)
  const [editName, setEditName]         = useState('')
  const [editInterest, setEditInterest] = useState('')
  const [editNotes, setEditNotes]       = useState('')
  const [editSubtasks, setEditSubtasks] = useState<{ id: string; title: string; completed: boolean }[]>([])
  const [editChecklist, setEditChecklist] = useState<{ id: string; title: string; completed: boolean }[]>([])
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [editError, setEditError]       = useState('')

  // Modal Message Send States
  const [modalMessageBody, setModalMessageBody] = useState('')
  const [isSendingModalMsg, startModalMsgTransition] = useTransition()

  function handleSendModalMessage() {
    if (!modalMessageBody.trim() || !editContact) return
    startModalMsgTransition(async () => {
      const res = await fetch('/api/wacrm/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId: editContact.id, body: modalMessageBody.trim() }),
      })
      if (res.ok) {
        const { data } = await res.json()
        if (data) setLocalMessages(prev => [...prev, data])
      }
      setModalMessageBody('')
    })
  }

  const modalContactMessages = useMemo(() => {
    if (!editContact) return []
    return localMessages
      .filter(m => m.contact_id === editContact.id)
      .sort((a, b) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime())
  }, [localMessages, editContact])

  // Dynamic Pipeline Stages
  const [stagesState, setStagesState] = useState(pipelineStages)
  const [isAddingStage, setIsAddingStage] = useState(false)
  const [newStageName, setNewStageName] = useState('')
  const [isSavingStage, setIsSavingStage] = useState(false)

  useEffect(() => {
    setStagesState(pipelineStages)
  }, [pipelineStages])

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

  const stageKeys = useMemo(() => {
    return stagesState.map(label => label.trim().toLowerCase().replace(/\s+/g, '_'))
  }, [stagesState])

  function getStageLabel(stage: string): string {
    const idx = stageKeys.indexOf(stage)
    return stagesState[idx] ?? stage
  }

  function handleStageChange(contactId: string, newStage: string) {
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

  async function handleAddStageSubmit(e: React.FormEvent) {
    e.preventDefault()
    const name = newStageName.trim()
    if (!name) return

    if (stagesState.some(s => s.toLowerCase() === name.toLowerCase())) {
      alert('Nama board/list sudah ada!')
      return
    }

    setIsSavingStage(true)
    try {
      const res = await fetch('/api/wacrm/stages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) {
        const d = await res.json()
        alert(d.error || 'Gagal menyimpan board baru.')
        return
      }
      const updatedStages = [...stagesState, name]
      setStagesState(updatedStages)
      setIsAddingStage(false)
      setNewStageName('')
      router.refresh()
    } catch (err) {
      console.error('[WA_CRM] Gagal menyimpan board baru:', err)
      alert('Gagal menyimpan board baru.')
    } finally {
      setIsSavingStage(false)
    }
  }

  async function handleDeleteStage(stageLabelToDelete: string) {
    if (stagesState.length <= 1) {
      alert('Minimal harus menyisakan 1 board/list!')
      return
    }
    
    const remainingStages = stagesState.filter(s => s !== stageLabelToDelete)
    const fallbackLabel = remainingStages[0]

    if (!confirm(`Hapus board "${stageLabelToDelete}"? Semua kontak di board ini akan dipindahkan ke "${fallbackLabel}".`)) return

    try {
      const res = await fetch('/api/wacrm/stages', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stageLabel: stageLabelToDelete }),
      })
      if (!res.ok) {
        const d = await res.json()
        alert(d.error || 'Gagal menghapus board.')
        return
      }

      const keyToDelete = stageLabelToDelete.trim().toLowerCase().replace(/\s+/g, '_')
      const fallbackKey = fallbackLabel.trim().toLowerCase().replace(/\s+/g, '_')
      
      setLocalContacts(prev =>
        prev.map(c => c.stage === keyToDelete ? { ...c, stage: fallbackKey } : c)
      )
      setStagesState(remainingStages)
      router.refresh()
    } catch (err) {
      console.error('[WA_CRM] Gagal menghapus board:', err)
      alert('Gagal menghapus board.')
    }
  }

  function openEdit(contact: WaCrmContact) {
    setEditContact(contact)
    setEditName(contact.name)
    setEditInterest(contact.product_interest ?? '')
    setEditNotes(contact.notes ?? '')
    setEditSubtasks(contact.subtasks ?? [])
    setEditChecklist(contact.checklist ?? [])
    setEditError('')
  }

  function addSubtask() {
    const newItem = { id: Date.now().toString(), title: '', completed: false }
    setEditSubtasks(prev => [...prev, newItem])
  }

  function toggleSubtask(id: string) {
    setEditSubtasks(prev => prev.map(item => item.id === id ? { ...item, completed: !item.completed } : item))
  }

  function updateSubtaskTitle(id: string, title: string) {
    setEditSubtasks(prev => prev.map(item => item.id === id ? { ...item, title } : item))
  }

  function deleteSubtask(id: string) {
    setEditSubtasks(prev => prev.filter(item => item.id !== id))
  }

  function addChecklistItem() {
    const newItem = { id: Date.now().toString(), title: '', completed: false }
    setEditChecklist(prev => [...prev, newItem])
  }

  function toggleChecklistItem(id: string) {
    setEditChecklist(prev => prev.map(item => item.id === id ? { ...item, completed: !item.completed } : item))
  }

  function updateChecklistItemTitle(id: string, title: string) {
    setEditChecklist(prev => prev.map(item => item.id === id ? { ...item, title } : item))
  }

  function deleteChecklistItem(id: string) {
    setEditChecklist(prev => prev.filter(item => item.id !== id))
  }

  async function handleSaveEdit() {
    if (!editContact) return
    if (!editName.trim()) { setEditError('Nama tidak boleh kosong.'); return }
    setIsSavingEdit(true)
    setEditError('')
    try {
      const res = await fetch('/api/wacrm/contacts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId: editContact.id,
          name: editName.trim(),
          product_interest: editInterest.trim() || null,
          notes: editNotes.trim() || null,
          subtasks: editSubtasks,
          checklist: editChecklist,
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        setEditError(d.error ?? 'Gagal menyimpan.')
        return
      }
      setLocalContacts(prev =>
        prev.map(c => c.id === editContact.id
          ? { ...c, name: editName.trim(), product_interest: editInterest.trim() || null, subtasks: editSubtasks, checklist: editChecklist }
          : c
        )
      )
      if (selectedContact?.id === editContact.id) {
        setSelected(prev => prev ? { ...prev, name: editName.trim(), product_interest: editInterest.trim() || null, subtasks: editSubtasks, checklist: editChecklist } : prev)
      }
      setEditContact(null)
    } finally {
      setIsSavingEdit(false)
    }
  }

  async function handleDeleteContact(contactId: string) {
    if (!confirm('Hapus kontak ini dari Whatslab CRM?')) return
    const res = await fetch('/api/wacrm/contacts', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contactId }),
    })
    if (res.ok) {
      setLocalContacts(prev => prev.filter(c => c.id !== contactId))
      if (selectedContact?.id === contactId) setSelected(null)
    }
  }

  const totalByStage = useMemo(() => {
    const map = {} as Record<string, number>
    stageKeys.forEach(k => (map[k] = 0))
    localContacts.forEach(c => {
      const key = stageKeys.includes(c.stage) ? c.stage : 'masuk'
      if (map[key] !== undefined) {
        map[key]++
      } else {
        const first = stageKeys[0]
        if (first && map[first] !== undefined) map[first]++
      }
    })
    return map
  }, [localContacts, stageKeys])

  const getStageBadgeClass = (key: string) => {
    const map: Record<string, string> = {
      masuk:     'bg-slate-100 text-slate-600',
      follow_up: 'bg-blue-100 text-blue-700',
      negosiasi: 'bg-amber-100 text-amber-700',
      closing:   'bg-emerald-100 text-emerald-700',
    }
    return map[key] || 'bg-indigo-100 text-indigo-700'
  }

  return (
    <div className="flex flex-col h-full">

      {/* ── Top Bar ── */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-200 bg-white sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-green-600" />
          <h1 className="text-base font-bold text-slate-900">Whatslab CRM</h1>
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
        {stageKeys.map((key, i) => (
          <div key={key} className={cn('flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap', getStageBadgeClass(key))}>
            {stagesState[i] ?? key}
            <span className="opacity-70">({totalByStage[key] ?? 0})</span>
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
            stageLabels={stagesState}
            onSelectContact={c => { setSelected(c); setView('inbox') }}
            onEditContact={openEdit}
            onDeleteContact={handleDeleteContact}
            onStageChange={handleStageChange}
            onDeleteStage={handleDeleteStage}
            selectedId={selectedContact?.id ?? null}
            isAddingStage={isAddingStage}
            setIsAddingStage={setIsAddingStage}
            newStageName={newStageName}
            setNewStageName={setNewStageName}
            isSavingStage={isSavingStage}
            onAddStageSubmit={handleAddStageSubmit}
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
                stageLabels={stagesState}
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
        pipelineStages={stagesState}
        onCreated={(newContact) => {
          setLocalContacts(prev => [newContact, ...prev])
          setSelected(newContact)
          setView('inbox')
        }}
      />

      {/* ── Modal Edit Kontak ── */}
      {editContact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-transparent" onClick={() => setEditContact(null)} aria-hidden="true" />
          
          <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl flex flex-col md:flex-row h-[80vh] overflow-hidden border border-slate-200 animation-fade-in">
            {/* Left Panel - Details */}
            <div className="w-full md:w-3/5 p-6 overflow-y-auto flex flex-col justify-between bg-white border-r border-slate-200">
              <div className="space-y-4">
                {/* Breadcrumb / Top Row */}
                <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <span className="flex items-center gap-1.5">
                    <MessageSquare className="h-3.5 w-3.5" /> Whatslab CRM / Kontak
                  </span>
                </div>

                {/* Inline editable name */}
                <div className="pt-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className="text-2xl font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-green-500 rounded px-1 -ml-1 w-full bg-transparent hover:bg-slate-50 transition-colors"
                    placeholder="Nama Kontak"
                  />
                </div>

                {/* Metadata Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 bg-slate-50/50 p-4 rounded-xl border border-slate-100/80 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 w-24 flex items-center gap-1"><Hash className="h-3.5 w-3.5" /> Status</span>
                    <select
                      value={editContact.stage}
                      onChange={e => handleStageChange(editContact.id, e.target.value)}
                      className={cn("rounded-lg border-none px-2.5 py-1.5 font-bold uppercase tracking-wider text-[9px] cursor-pointer focus:outline-none focus:ring-1 focus:ring-green-500", getStageBadgeClass(editContact.stage))}
                    >
                      {stageKeys.map((key, i) => (
                        <option key={key} value={key} className="bg-white text-slate-700 font-normal normal-case">{stagesState[i] ?? key}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 w-24 flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> Telepon</span>
                    <span className="font-mono text-slate-700 bg-slate-100 px-2 py-0.5 rounded font-medium">{editContact.phone}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 w-24 flex items-center gap-1"><Tag className="h-3.5 w-3.5" /> Minat Produk</span>
                    <input
                      type="text"
                      value={editInterest}
                      onChange={e => setEditInterest(e.target.value)}
                      className="rounded-lg border border-slate-200 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-green-500 bg-white text-xs w-full max-w-[150px] font-medium"
                      placeholder="Minat produk"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 w-24 flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> Dibuat Pada</span>
                    <span className="text-slate-600 flex items-center gap-1 font-medium">
                      {new Date(editContact.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                </div>

                {/* Notes/Catatan */}
                <div className="space-y-2 pt-2">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-slate-400" /> Catatan Kontak
                  </span>
                  <textarea
                    value={editNotes}
                    onChange={e => setEditNotes(e.target.value)}
                    rows={5}
                    className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:outline-none focus:ring-1 focus:ring-green-500 bg-white resize-none shadow-2xs leading-relaxed"
                    placeholder="Tulis catatan khusus, kebutuhan produk, atau info follow up tentang kontak ini..."
                  />
                </div>

                {/* Subtasks Section */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <CheckSquare className="h-3.5 w-3.5 text-slate-400" /> Subtask
                    </span>
                    <button
                      type="button"
                      onClick={addSubtask}
                      className="text-xs text-green-600 hover:text-green-700 font-bold flex items-center gap-1 cursor-pointer bg-transparent border-none"
                    >
                      <Plus className="h-3 w-3" /> Add subtask
                    </button>
                  </div>
                  {editSubtasks.length === 0 ? (
                    <p className="text-[11px] text-slate-400 italic pl-1">Belum ada subtask</p>
                  ) : (
                    <div className="space-y-1 pl-1">
                      {editSubtasks.map(item => (
                        <div key={item.id} className="flex items-center gap-2 group/task">
                          <input
                            type="checkbox"
                            checked={item.completed}
                            onChange={() => toggleSubtask(item.id)}
                            className="rounded border-slate-300 text-green-600 focus:ring-green-500 cursor-pointer h-3.5 w-3.5"
                          />
                          <input
                            type="text"
                            value={item.title}
                            onChange={e => updateSubtaskTitle(item.id, e.target.value)}
                            className={cn(
                              "text-xs px-2 py-1 flex-1 bg-transparent hover:bg-slate-50 focus:bg-white border-none rounded focus:outline-none focus:ring-1 focus:ring-green-500",
                              item.completed && "line-through text-slate-400"
                            )}
                            placeholder="Tulis judul subtask..."
                          />
                          <button
                            type="button"
                            onClick={() => deleteSubtask(item.id)}
                            className="opacity-0 group-hover/task:opacity-100 p-1 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded transition-all cursor-pointer border-none bg-transparent"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Checklist Section */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <CheckSquare className="h-3.5 w-3.5 text-slate-400" /> Checklist
                    </span>
                    <button
                      type="button"
                      onClick={addChecklistItem}
                      className="text-xs text-green-600 hover:text-green-700 font-bold flex items-center gap-1 cursor-pointer bg-transparent border-none"
                    >
                      <Plus className="h-3 w-3" /> Create checklist
                    </button>
                  </div>
                  {editChecklist.length === 0 ? (
                    <p className="text-[11px] text-slate-400 italic pl-1">Belum ada item checklist</p>
                  ) : (
                    <div className="space-y-1 pl-1">
                      {editChecklist.map(item => (
                        <div key={item.id} className="flex items-center gap-2 group/check">
                          <input
                            type="checkbox"
                            checked={item.completed}
                            onChange={() => toggleChecklistItem(item.id)}
                            className="rounded border-slate-300 text-green-600 focus:ring-green-500 cursor-pointer h-3.5 w-3.5"
                          />
                          <input
                            type="text"
                            value={item.title}
                            onChange={e => updateChecklistItemTitle(item.id, e.target.value)}
                            className={cn(
                              "text-xs px-2 py-1 flex-1 bg-transparent hover:bg-slate-50 focus:bg-white border-none rounded focus:outline-none focus:ring-1 focus:ring-green-500",
                              item.completed && "line-through text-slate-400"
                            )}
                            placeholder="Tulis item checklist..."
                          />
                          <button
                            type="button"
                            onClick={() => deleteChecklistItem(item.id)}
                            className="opacity-0 group-hover/check:opacity-100 p-1 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded transition-all cursor-pointer border-none bg-transparent"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Buttons */}
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-100">
                {editError && <span className="text-xs text-red-500">{editError}</span>}
                <div className="flex gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => setEditContact(null)}
                    className="px-4 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer bg-white"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveEdit}
                    disabled={isSavingEdit}
                    className="flex items-center gap-1.5 px-5 py-1.5 rounded-lg bg-green-600 text-white text-xs font-semibold hover:bg-green-700 disabled:opacity-60 transition-colors cursor-pointer border-none"
                  >
                    {isSavingEdit && <Loader2 className="h-3 w-3 animate-spin" />}
                    Simpan Perubahan
                  </button>
                </div>
              </div>
            </div>

            {/* Right Panel - Activity / Chat */}
            <div className="w-full md:w-2/5 bg-slate-50 p-6 flex flex-col justify-between h-full">
              {/* Activity Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4 flex-shrink-0">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <History className="h-4 w-4 text-slate-400" /> Activity Log (WhatsApp)
                </span>
                <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-bold">
                  {modalContactMessages.length} Messages
                </span>
              </div>

              {/* Activity Messages Feed */}
              <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin">
                {modalContactMessages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2 py-12">
                    <MessageSquare className="h-8 w-8 opacity-30" />
                    <p className="text-xs font-medium">Belum ada chat aktivitas</p>
                  </div>
                ) : (
                  modalContactMessages.map(msg => (
                    <div key={msg.id} className="flex items-start gap-2.5">
                      <div className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center font-bold text-[9px] flex-shrink-0",
                        msg.direction === 'out' ? "bg-green-100 text-green-700" : "bg-slate-200 text-slate-700"
                      )}>
                        {msg.direction === 'out' ? 'ST' : editContact.name[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-slate-700 text-[11px]">
                            {msg.direction === 'out' ? 'Staff' : editContact.name}
                          </span>
                          <span className="text-[8px] text-slate-400">
                            {new Date(msg.sent_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-slate-600 bg-white border border-slate-200/60 p-2.5 rounded-lg shadow-2xs whitespace-pre-wrap leading-relaxed">
                          {msg.body}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Write WhatsApp Msg Box */}
              <div className="mt-4 pt-3 border-t border-slate-200 flex-shrink-0">
                <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl p-1.5 focus-within:ring-1 focus-within:ring-green-500 shadow-2xs">
                  <textarea
                    value={modalMessageBody}
                    onChange={e => setModalMessageBody(e.target.value)}
                    placeholder="Ketik pesan WhatsApp / komentar..."
                    rows={1}
                    className="flex-1 text-xs resize-none focus:outline-none border-none bg-transparent py-1 px-1.5"
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleSendModalMessage()
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleSendModalMessage}
                    disabled={isSendingModalMsg || !modalMessageBody.trim()}
                    className="p-2 rounded-lg bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 transition-colors cursor-pointer border-none flex items-center justify-center flex-shrink-0"
                  >
                    {isSendingModalMsg ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
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
