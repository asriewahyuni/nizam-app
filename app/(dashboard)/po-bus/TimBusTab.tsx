'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import {
  Users, Plus, Phone, Edit2, Trash2, CheckCircle2,
  AlertTriangle, ShieldCheck, Car, UserCog, Ticket, AlertCircle, Share2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { SafeButton, EmptyState, useConfirm } from '@/components/ui/NizamUI'
import { CrewShortcutModal } from './CrewShortcutModal'
import {
  createBusCrew, updateBusCrew, deleteBusCrew,
} from '@/modules/po-bus/actions/po-bus.actions'
import type { BusCrew } from '@/modules/po-bus/lib/po-bus-types'

// ─── Types ────────────────────────────────────────────────────────────────────

type RoleFilter = 'SEMUA' | 'DRIVER' | 'CO_DRIVER' | 'KERNET' | 'KONDEKTUR'

// ─── Config ───────────────────────────────────────────────────────────────────

const ROLE_CONFIG = {
  DRIVER: {
    label: 'Driver',
    color: 'bg-blue-50 text-blue-700 border-blue-200',
    avatarBg: 'bg-blue-100',
    avatarText: 'text-blue-700',
    icon: Car,
    desc: 'Pengemudi utama',
    licenseRequired: true,
  },
  CO_DRIVER: {
    label: 'Co-Driver',
    color: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    avatarBg: 'bg-indigo-100',
    avatarText: 'text-indigo-700',
    icon: UserCog,
    desc: 'Pengemudi cadangan',
    licenseRequired: true,
  },
  KERNET: {
    label: 'Kernet',
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    avatarBg: 'bg-emerald-100',
    avatarText: 'text-emerald-700',
    icon: Users,
    desc: 'Pembantu pengemudi',
    licenseRequired: false,
  },
  KONDEKTUR: {
    label: 'Kondektur',
    color: 'bg-amber-50 text-amber-700 border-amber-200',
    avatarBg: 'bg-amber-100',
    avatarText: 'text-amber-700',
    icon: Ticket,
    desc: 'Penjual & pemeriksa tiket',
    licenseRequired: false,
  },
} as const

function getLicenseStatus(expiry?: string | null): 'ok' | 'warning' | 'danger' | 'none' {
  if (!expiry) return 'none'
  const diff = new Date(expiry).getTime() - Date.now()
  const days = diff / 86400000
  if (days < 0) return 'danger'
  if (days < 30) return 'danger'
  if (days < 90) return 'warning'
  return 'ok'
}

function formatDate(s?: string | null) {
  if (!s) return '-'
  return new Date(s).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

function daysUntil(s: string) {
  const diff = new Date(s).getTime() - Date.now()
  return Math.ceil(diff / 86400000)
}

// ─── Inline Form UI ───────────────────────────────────────────────────────────

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      {children}
    </div>
  )
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white',
        'focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400',
        'placeholder:text-slate-300 transition-colors',
        props.className,
      )}
    />
  )
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white',
        'focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400',
        'transition-colors cursor-pointer',
        props.className,
      )}
    />
  )
}

// ─── Crew Card ────────────────────────────────────────────────────────────────

function CrewCard({
  crew,
  onEdit,
  onDelete,
  onShortcut,
}: {
  crew: BusCrew
  onEdit: (c: BusCrew) => void
  onDelete: (c: BusCrew) => void
  onShortcut: (c: BusCrew) => void
}) {
  const cfg = ROLE_CONFIG[crew.role] ?? ROLE_CONFIG.KERNET
  const licSt = getLicenseStatus(crew.license_expiry)
  const initials = crew.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()

  return (
    <div className={cn(
      'bg-white border rounded-2xl p-4 flex flex-col gap-3 transition-all duration-200',
      'hover:shadow-md hover:-translate-y-0.5',
      crew.is_active ? 'border-slate-200' : 'border-slate-100 opacity-60',
    )}>
      {/* Header */}
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-bold text-sm', cfg.avatarBg, cfg.avatarText)}>
          {initials}
        </div>

        {/* Name + Role */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-800 text-sm leading-tight truncate">{crew.name}</p>
          <span className={cn('inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border', cfg.color)}>
            {cfg.label}
          </span>
        </div>

        {/* Actions */}
        <div className="flex gap-1 shrink-0">
          <button
            onClick={() => onShortcut(crew)}
            className="p-1.5 rounded-lg text-slate-300 hover:text-blue-500 hover:bg-blue-50 cursor-pointer transition-colors"
            title="Shortcut / QR Code"
          >
            <Share2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onEdit(crew)}
            className="p-1.5 rounded-lg text-slate-300 hover:text-blue-500 hover:bg-blue-50 cursor-pointer transition-colors"
            title="Edit"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(crew)}
            className="p-1.5 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 cursor-pointer transition-colors"
            title="Hapus"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Info rows */}
      <div className="space-y-1.5 text-xs text-slate-500">
        {crew.phone && (
          <p className="flex items-center gap-1.5">
            <Phone className="w-3 h-3 shrink-0" />
            {crew.phone}
          </p>
        )}
        {crew.nik && (
          <p className="flex items-center gap-1.5">
            <span className="w-3 h-3 shrink-0 text-center font-bold text-[9px] text-slate-400">ID</span>
            <span className="font-mono">{crew.nik}</span>
          </p>
        )}
      </div>

      {/* License block (only for driver roles) */}
      {cfg.licenseRequired && (
        <div className={cn(
          'rounded-xl px-3 py-2.5 border text-xs',
          licSt === 'danger' && 'bg-rose-50 border-rose-200',
          licSt === 'warning' && 'bg-amber-50 border-amber-200',
          licSt === 'ok' && 'bg-emerald-50 border-emerald-200',
          licSt === 'none' && 'bg-slate-50 border-slate-200',
        )}>
          <div className="flex items-center gap-1.5">
            {licSt === 'danger' && <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />}
            {licSt === 'warning' && <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
            {licSt === 'ok' && <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
            {licSt === 'none' && <AlertCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
            <span className={cn(
              'font-medium',
              licSt === 'danger' && 'text-rose-700',
              licSt === 'warning' && 'text-amber-700',
              licSt === 'ok' && 'text-emerald-700',
              licSt === 'none' && 'text-slate-500',
            )}>
              {crew.license_number ?? 'SIM belum diisi'}
            </span>
          </div>
          {crew.license_expiry && (
            <p className={cn(
              'mt-1 text-[10px]',
              licSt === 'danger' && 'text-rose-600',
              licSt === 'warning' && 'text-amber-600',
              licSt === 'ok' && 'text-emerald-600',
            )}>
              {licSt === 'danger' && daysUntil(crew.license_expiry) < 0
                ? `Expired ${Math.abs(daysUntil(crew.license_expiry))} hari lalu`
                : `Berlaku s/d ${formatDate(crew.license_expiry)}`}
              {licSt === 'warning' && ` · ${daysUntil(crew.license_expiry)} hari lagi`}
              {licSt === 'danger' && daysUntil(crew.license_expiry) >= 0 && ` · ${daysUntil(crew.license_expiry)} hari lagi`}
            </p>
          )}
        </div>
      )}

      {/* Footer: blood type + join date + active status */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
        <div className="flex items-center gap-2 text-[10px] text-slate-400">
          {crew.blood_type && (
            <span className="bg-rose-50 text-rose-600 border border-rose-100 px-1.5 py-0.5 rounded-md font-bold">
              {crew.blood_type}
            </span>
          )}
          {crew.join_date && <span>Bergabung {formatDate(crew.join_date)}</span>}
        </div>
        <div className="flex items-center gap-2">
          <span className={cn(
            'text-[10px] font-medium px-2 py-0.5 rounded-full',
            crew.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400',
          )}>
            {crew.is_active ? 'Aktif' : 'Nonaktif'}
          </span>
          <Link
            href={`/po-bus/crew/${crew.id}`}
            className="text-[10px] font-medium text-blue-500 hover:text-blue-700 transition-colors cursor-pointer"
          >
            Detail →
          </Link>
        </div>
      </div>
    </div>
  )
}

// ─── Crew Form Modal ──────────────────────────────────────────────────────────

function CrewModal({
  open,
  editing,
  onClose,
}: {
  open: boolean
  editing: BusCrew | null
  onClose: () => void
}) {
  const [pending, startTransition] = useTransition()

  if (!open) return null

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const payload = {
        name: fd.get('name') as string,
        role: fd.get('role') as BusCrew['role'],
        phone: (fd.get('phone') as string) || undefined,
        nik: (fd.get('nik') as string) || undefined,
        license_number: (fd.get('license_number') as string) || undefined,
        license_expiry: (fd.get('license_expiry') as string) || undefined,
        blood_type: (fd.get('blood_type') as string) || undefined,
        join_date: (fd.get('join_date') as string) || undefined,
        is_active: fd.get('is_active') === 'true',
      }
      // orgId injected via data attribute on form
      const orgId = (e.currentTarget.dataset.orgid as string) || ''
      if (editing) {
        await updateBusCrew(orgId, editing.id, payload)
      } else {
        await createBusCrew(orgId, payload)
      }
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">{editing ? 'Edit Kru' : 'Tambah Kru'}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 cursor-pointer transition-colors">
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit} data-orgid="" className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <FormField label="Nama Lengkap *">
                <Input name="name" defaultValue={editing?.name ?? ''} placeholder="Ahmad Santoso" required />
              </FormField>
            </div>
            <FormField label="Jabatan *">
              <Select name="role" defaultValue={editing?.role ?? 'DRIVER'} required>
                {Object.entries(ROLE_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label} — {v.desc}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Status">
              <Select name="is_active" defaultValue={String(editing?.is_active ?? true)}>
                <option value="true">Aktif</option>
                <option value="false">Nonaktif</option>
              </Select>
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="No. HP">
              <Input name="phone" defaultValue={editing?.phone ?? ''} placeholder="08123456789" />
            </FormField>
            <FormField label="NIK (16 digit)">
              <Input name="nik" defaultValue={editing?.nik ?? ''} placeholder="3201..." maxLength={16} />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Nomor SIM">
              <Input name="license_number" defaultValue={editing?.license_number ?? ''} placeholder="B2-123456" />
            </FormField>
            <FormField label="Masa Berlaku SIM">
              <Input name="license_expiry" type="date" defaultValue={editing?.license_expiry ?? ''} />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Golongan Darah">
              <Select name="blood_type" defaultValue={editing?.blood_type ?? ''}>
                <option value="">— Pilih —</option>
                {['A', 'B', 'AB', 'O'].map(b => <option key={b} value={b}>{b}</option>)}
              </Select>
            </FormField>
            <FormField label="Tanggal Bergabung">
              <Input name="join_date" type="date" defaultValue={editing?.join_date ?? ''} />
            </FormField>
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <SafeButton type="button" variant="ghost" onClick={onClose}>Batal</SafeButton>
            <SafeButton type="submit" disabled={pending} icon={<CheckCircle2 className="w-4 h-4" />}>
              {pending ? 'Menyimpan...' : 'Simpan'}
            </SafeButton>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface TimBusTabProps {
  orgId: string
  initialCrew: BusCrew[]
}

export function TimBusTab({ orgId, initialCrew }: TimBusTabProps) {
  const [crew, setCrew] = useState(initialCrew)
  const [filter, setFilter] = useState<RoleFilter>('SEMUA')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<BusCrew | null>(null)
  const [shortcutCrew, setShortcutCrew] = useState<BusCrew | null>(null)
  const [, startTransition] = useTransition()
  const { confirm, ConfirmUI } = useConfirm()

  const counts = {
    SEMUA: crew.length,
    DRIVER: crew.filter(c => c.role === 'DRIVER').length,
    CO_DRIVER: crew.filter(c => c.role === 'CO_DRIVER').length,
    KERNET: crew.filter(c => c.role === 'KERNET').length,
    KONDEKTUR: crew.filter(c => c.role === 'KONDEKTUR').length,
  }

  const expiringCount = crew.filter(c => {
    const st = getLicenseStatus(c.license_expiry)
    return st === 'danger' || st === 'warning'
  }).length

  const filtered = filter === 'SEMUA' ? crew : crew.filter(c => c.role === filter)

  function openCreate() {
    setEditing(null)
    setShowModal(true)
  }

  function openEdit(c: BusCrew) {
    setEditing(c)
    setShowModal(true)
  }

  function handleClose() {
    setShowModal(false)
    setEditing(null)
    // Optimistic: reload state from server action result handled by parent
    // For now just close - parent should refresh on revalidate
  }

  async function handleDelete(c: BusCrew) {
    const ok = await confirm({ title: `Hapus "${c.name}"?`, message: 'Data kru akan dihapus permanen.' })
    if (!ok) return
    startTransition(async () => {
      const res = await deleteBusCrew(orgId, c.id)
      if (!('error' in res)) {
        setCrew(prev => prev.filter(cr => cr.id !== c.id))
      }
    })
  }

  const FILTER_TABS: { id: RoleFilter; label: string }[] = [
    { id: 'SEMUA', label: 'Semua' },
    { id: 'DRIVER', label: 'Driver' },
    { id: 'CO_DRIVER', label: 'Co-Driver' },
    { id: 'KERNET', label: 'Kernet' },
    { id: 'KONDEKTUR', label: 'Kondektur' },
  ]

  return (
    <div className="space-y-5">
      {/* Stats strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(['DRIVER', 'CO_DRIVER', 'KERNET', 'KONDEKTUR'] as const).map(role => {
          const cfg = ROLE_CONFIG[role]
          const Icon = cfg.icon
          return (
            <button
              key={role}
              onClick={() => setFilter(role === filter ? 'SEMUA' : role)}
              className={cn(
                'bg-white border rounded-xl p-3 text-left cursor-pointer transition-all duration-200',
                'hover:shadow-sm hover:-translate-y-0.5',
                filter === role ? 'border-blue-300 ring-2 ring-blue-100' : 'border-slate-200',
              )}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-slate-500">{cfg.label}</span>
                <div className={cn('p-1 rounded-lg', cfg.avatarBg)}>
                  <Icon className={cn('w-3.5 h-3.5', cfg.avatarText)} />
                </div>
              </div>
              <p className="text-2xl font-bold text-slate-800">{counts[role]}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{cfg.desc}</p>
            </button>
          )
        })}
      </div>

      {/* License alert banner */}
      {expiringCount > 0 && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
          <p className="text-sm text-amber-800">
            <span className="font-semibold">{expiringCount} kru</span> memiliki SIM yang akan segera berakhir atau sudah expired.
          </p>
          <button
            onClick={() => setFilter('DRIVER')}
            className="ml-auto text-xs font-medium text-amber-700 hover:text-amber-900 cursor-pointer transition-colors shrink-0"
          >
            Lihat Driver →
          </button>
        </div>
      )}

      {/* Header + Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        {/* Role filter pills */}
        <div className="flex gap-1 overflow-x-auto pb-1">
          {FILTER_TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setFilter(t.id)}
              className={cn(
                'px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap cursor-pointer transition-all duration-150',
                filter === t.id
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50',
              )}
            >
              {t.label}
              <span className={cn('ml-1.5 text-[10px]', filter === t.id ? 'opacity-70' : 'text-slate-400')}>
                {counts[t.id]}
              </span>
            </button>
          ))}
        </div>
        <div className="sm:ml-auto">
          <SafeButton onClick={openCreate} icon={<Plus className="w-4 h-4" />} size="sm">
            Tambah Kru
          </SafeButton>
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title={filter === 'SEMUA' ? 'Belum ada kru terdaftar' : `Belum ada ${ROLE_CONFIG[filter as keyof typeof ROLE_CONFIG]?.label || filter}`}
          description="Tambahkan driver, co-driver, kernet, atau kondektur."
          action={<SafeButton onClick={openCreate} icon={<Plus className="w-4 h-4" />}>Tambah Kru</SafeButton>}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(c => (
            <CrewCard key={c.id} crew={c} onEdit={openEdit} onDelete={handleDelete} onShortcut={setShortcutCrew} />
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <CrewFormModal
          orgId={orgId}
          editing={editing}
          onClose={handleClose}
          onSaved={(saved) => {
            if (editing) {
              setCrew(prev => prev.map(c => c.id === saved.id ? saved : c))
            } else {
              setCrew(prev => [...prev, saved])
            }
            setShowModal(false)
            setEditing(null)
          }}
        />
      )}
      {ConfirmUI}
      {shortcutCrew && <CrewShortcutModal crew={shortcutCrew} onClose={() => setShortcutCrew(null)} />}
    </div>
  )
}

// ─── Modal with proper orgId + optimistic update ──────────────────────────────

function CrewFormModal({
  orgId,
  editing,
  onClose,
  onSaved,
}: {
  orgId: string
  editing: BusCrew | null
  onClose: () => void
  onSaved: (c: BusCrew) => void
}) {
  const [pending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const payload = {
        name: fd.get('name') as string,
        role: fd.get('role') as BusCrew['role'],
        phone: (fd.get('phone') as string) || undefined,
        nik: (fd.get('nik') as string) || undefined,
        license_number: (fd.get('license_number') as string) || undefined,
        license_expiry: (fd.get('license_expiry') as string) || undefined,
        blood_type: (fd.get('blood_type') as string) || undefined,
        join_date: (fd.get('join_date') as string) || undefined,
        is_active: fd.get('is_active') !== 'false',
      }
      if (editing) {
        const res = await updateBusCrew(orgId, editing.id, payload)
        if (!('error' in res)) onSaved({ ...editing, ...payload } as BusCrew)
        else onClose()
      } else {
        const res = await createBusCrew(orgId, payload)
        if (!('error' in res) && 'data' in res && res.data) onSaved(res.data as BusCrew)
        else onClose()
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">{editing ? 'Edit Data Kru' : 'Tambah Kru Baru'}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 cursor-pointer transition-colors">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Name + Role */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <FormField label="Nama Lengkap *">
                <Input name="name" defaultValue={editing?.name ?? ''} placeholder="Ahmad Santoso" required />
              </FormField>
            </div>
            <FormField label="Jabatan *">
              <Select name="role" defaultValue={editing?.role ?? 'DRIVER'} required>
                {Object.entries(ROLE_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label} — {v.desc}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Status">
              <Select name="is_active" defaultValue={String(editing?.is_active ?? true)}>
                <option value="true">Aktif</option>
                <option value="false">Nonaktif</option>
              </Select>
            </FormField>
          </div>

          {/* Contact */}
          <div className="grid grid-cols-2 gap-4">
            <FormField label="No. HP">
              <Input name="phone" defaultValue={editing?.phone ?? ''} placeholder="08123456789" type="tel" />
            </FormField>
            <FormField label="NIK">
              <Input name="nik" defaultValue={editing?.nik ?? ''} placeholder="3201..." maxLength={16} />
            </FormField>
          </div>

          {/* License */}
          <div className="p-3 bg-slate-50 rounded-xl space-y-3">
            <p className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" /> Surat Izin Mengemudi (SIM)
            </p>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Nomor SIM">
                <Input name="license_number" defaultValue={editing?.license_number ?? ''} placeholder="B2-12345678" />
              </FormField>
              <FormField label="Berlaku s/d">
                <Input name="license_expiry" type="date" defaultValue={editing?.license_expiry ?? ''} />
              </FormField>
            </div>
          </div>

          {/* Extra */}
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Golongan Darah">
              <Select name="blood_type" defaultValue={editing?.blood_type ?? ''}>
                <option value="">— Pilih —</option>
                {['A', 'B', 'AB', 'O'].map(b => <option key={b} value={b}>{b}</option>)}
              </Select>
            </FormField>
            <FormField label="Tanggal Bergabung">
              <Input name="join_date" type="date" defaultValue={editing?.join_date ?? ''} />
            </FormField>
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <SafeButton type="button" variant="ghost" onClick={onClose} disabled={pending}>Batal</SafeButton>
            <SafeButton type="submit" disabled={pending} icon={<CheckCircle2 className="w-4 h-4" />}>
              {pending ? 'Menyimpan...' : 'Simpan'}
            </SafeButton>
          </div>
        </form>
      </div>
    </div>
  )
}
