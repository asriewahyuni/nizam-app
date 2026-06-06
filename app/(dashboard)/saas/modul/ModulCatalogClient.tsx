'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, Package, Puzzle, Layers, ToggleLeft, ToggleRight,
  Pencil, Trash2, X, Save, ChevronDown, AlertCircle, Upload,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  type SaasCustomModule,
  upsertSaasCustomModule,
  toggleSaasCustomModuleStatus,
  deleteSaasCustomModule,
} from '@/modules/saas/actions/module-catalog.actions'

const KIND_LABELS: Record<string, string> = {
  vertical_module: 'Vertical Module',
  addon: 'Add-on',
  platform_core: 'Platform Core',
}

const KIND_COLORS: Record<string, string> = {
  vertical_module: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  addon: 'bg-amber-50 text-amber-700 border-amber-200',
  platform_core: 'bg-slate-100 text-slate-700 border-slate-300',
}

const CORE_FAMILY_LABELS: Record<string, string> = {
  lite: 'Lite Core',
  starter: 'Starter Core',
  full: 'Full Core',
}

const ICON_OPTIONS = [
  'Package', 'Puzzle', 'Layers', 'Boxes', 'Truck', 'Users', 'Building2',
  'Wrench', 'BarChart3', 'ShoppingCart', 'Factory', 'MapPin', 'Globe',
  'Cpu', 'Database', 'Webhook', 'BookOpen', 'Briefcase', 'Bus', 'Cog',
]

const EMPTY_FORM = {
  id: '',
  module_key: '',
  name: '',
  tagline: '',
  description: '',
  kind: 'vertical_module' as const,
  required_core_family: 'lite' as const,
  default_price: 0,
  icon_name: 'Package',
  dependencies: [] as string[],
  version: '1.0.0',
  changelog: '',
}

function formatIdr(value: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value || 0)
}

export function ModulCatalogClient({ modules }: { modules: SaasCustomModule[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [depInput, setDepInput] = useState('')
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const openNew = () => {
    setForm(EMPTY_FORM)
    setDepInput('')
    setShowForm(true)
    setMsg(null)
  }

  const openEdit = (m: SaasCustomModule) => {
    setForm({
      id: m.id,
      module_key: m.module_key,
      name: m.name,
      tagline: m.tagline,
      description: m.description,
      kind: m.kind,
      required_core_family: m.required_core_family,
      default_price: m.default_price,
      icon_name: m.icon_name,
      dependencies: m.dependencies,
      version: m.version,
      changelog: m.changelog ?? '',
    })
    setDepInput('')
    setShowForm(true)
    setMsg(null)
  }

  const handleSave = () => {
    startTransition(async () => {
      const res = await upsertSaasCustomModule({
        ...form,
        module_key: form.module_key.trim(),
        name: form.name.trim(),
      })
      if (res.error) {
        setMsg({ type: 'err', text: res.error })
      } else {
        setMsg({ type: 'ok', text: 'Modul berhasil disimpan.' })
        setShowForm(false)
        router.refresh()
      }
    })
  }

  const handleToggle = (id: string, current: boolean) => {
    startTransition(async () => {
      await toggleSaasCustomModuleStatus(id, !current)
      router.refresh()
    })
  }

  const handleDelete = (id: string) => {
    startTransition(async () => {
      await deleteSaasCustomModule(id)
      setConfirmDelete(null)
      router.refresh()
    })
  }

  const addDep = () => {
    const key = depInput.trim()
    if (!key || form.dependencies.includes(key)) { setDepInput(''); return }
    setForm(f => ({ ...f, dependencies: [...f.dependencies, key] }))
    setDepInput('')
  }

  const removeDep = (key: string) =>
    setForm(f => ({ ...f, dependencies: f.dependencies.filter(d => d !== key) }))

  const verticals = modules.filter(m => m.kind === 'vertical_module')
  const addons = modules.filter(m => m.kind === 'addon')
  const cores = modules.filter(m => m.kind === 'platform_core')

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Katalog Modul</h1>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Daftarkan dan kelola modul kustom yang dapat dijual kepada klien SaaS.
          </p>
        </div>
        <button
          onClick={openNew}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 active:scale-[0.98] transition-all cursor-pointer"
        >
          <Upload size={16} /> Upload Modul Baru
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Vertical Module', count: verticals.length, active: verticals.filter(m => m.is_active).length, color: 'text-indigo-600' },
          { label: 'Add-on', count: addons.length, active: addons.filter(m => m.is_active).length, color: 'text-amber-600' },
          { label: 'Platform Core', count: cores.length, active: cores.filter(m => m.is_active).length, color: 'text-slate-600' },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{s.label}</p>
            <p className={cn('mt-1 text-2xl font-semibold', s.color)}>{s.count}</p>
            <p className="text-xs text-slate-400">{s.active} aktif</p>
          </div>
        ))}
      </div>

      {/* Message */}
      {msg && (
        <div className={cn('rounded-xl border px-4 py-3 text-sm font-bold flex items-center gap-2',
          msg.type === 'ok'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
            : 'border-rose-200 bg-rose-50 text-rose-700')}>
          <AlertCircle size={16} /> {msg.text}
          <button onClick={() => setMsg(null)} className="ml-auto cursor-pointer"><X size={14} /></button>
        </div>
      )}

      {/* Module List */}
      {modules.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 py-20 text-center">
          <Package className="mx-auto text-slate-300 mb-3" size={40} />
          <p className="text-sm font-semibold text-slate-500">Belum ada modul yang terdaftar.</p>
          <p className="text-xs text-slate-400 mt-1">Klik "Upload Modul Baru" untuk memulai.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {[
            { label: 'Vertical Modules', items: verticals, icon: Layers },
            { label: 'Add-ons', items: addons, icon: Puzzle },
            { label: 'Platform Core', items: cores, icon: Package },
          ].filter(g => g.items.length > 0).map(group => (
            <div key={group.label}>
              <div className="flex items-center gap-2 mb-3">
                <group.icon size={16} className="text-slate-400" />
                <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">{group.label}</h2>
                <span className="text-xs text-slate-400">({group.items.length})</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {group.items.map(m => (
                  <div
                    key={m.id}
                    className={cn(
                      'rounded-2xl border bg-white p-5 flex flex-col gap-3 transition-all',
                      m.is_active ? 'border-slate-200' : 'border-slate-100 opacity-60'
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className={cn('text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border', KIND_COLORS[m.kind])}>
                            {KIND_LABELS[m.kind]}
                          </span>
                          <span className="text-[10px] font-semibold text-slate-400">v{m.version}</span>
                        </div>
                        <p className="font-bold text-slate-900 truncate">{m.name}</p>
                        <p className="text-xs font-mono text-slate-400 truncate">{m.module_key}</p>
                      </div>
                      <button
                        onClick={() => handleToggle(m.id, m.is_active)}
                        disabled={isPending}
                        className="shrink-0 cursor-pointer transition-colors"
                        title={m.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                      >
                        {m.is_active
                          ? <ToggleRight size={28} className="text-indigo-600" />
                          : <ToggleLeft size={28} className="text-slate-300" />}
                      </button>
                    </div>

                    {m.tagline && (
                      <p className="text-xs text-slate-500 leading-relaxed">{m.tagline}</p>
                    )}

                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span className="font-semibold text-slate-700">
                        {formatIdr(m.default_price)}<span className="font-normal text-slate-400">/bln</span>
                      </span>
                      <span className="text-slate-300">·</span>
                      <span>{CORE_FAMILY_LABELS[m.required_core_family]}</span>
                    </div>

                    {m.dependencies.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {m.dependencies.map(d => (
                          <span key={d} className="text-[10px] px-2 py-0.5 bg-slate-100 rounded-full text-slate-500">{d}</span>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                      <button
                        onClick={() => openEdit(m)}
                        className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-600 transition-colors cursor-pointer"
                      >
                        <Pencil size={12} /> Edit
                      </button>
                      <button
                        onClick={() => setConfirmDelete(m.id)}
                        className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-rose-600 transition-colors cursor-pointer ml-auto"
                      >
                        <Trash2 size={12} /> Hapus
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/40 backdrop-blur-sm" onClick={() => setShowForm(false)}>
          <div
            className="relative h-full w-full max-w-lg bg-white shadow-2xl overflow-y-auto flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white">
              <h2 className="text-lg font-bold text-slate-900">
                {form.id ? 'Edit Modul' : 'Upload Modul Baru'}
              </h2>
              <button onClick={() => setShowForm(false)} className="p-1 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 px-6 py-6 space-y-5">
              {/* Module Key */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Module Key <span className="text-rose-500">*</span>
                </label>
                <input
                  value={form.module_key}
                  onChange={e => setForm(f => ({ ...f, module_key: e.target.value }))}
                  placeholder="Contoh: PO Bus, Workshop, E-Commerce"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 outline-none transition-all"
                />
                <p className="mt-1 text-[11px] text-slate-400">Identifier unik, huruf besar, spasi diperbolehkan. Tidak bisa diubah setelah dipakai di paket.</p>
              </div>

              {/* Name */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Nama Modul <span className="text-rose-500">*</span>
                </label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Contoh: Manajemen Perusahaan Otobus"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 outline-none transition-all"
                />
              </div>

              {/* Tagline */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Tagline</label>
                <input
                  value={form.tagline}
                  onChange={e => setForm(f => ({ ...f, tagline: e.target.value }))}
                  placeholder="Deskripsi singkat dalam 1 kalimat"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 outline-none transition-all"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Deskripsi</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={3}
                  placeholder="Jelaskan fitur-fitur utama modul ini..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 outline-none transition-all resize-none"
                />
              </div>

              {/* Kind & Core Family */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Jenis</label>
                  <div className="relative">
                    <select
                      value={form.kind}
                      onChange={e => setForm(f => ({ ...f, kind: e.target.value as any }))}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 outline-none transition-all appearance-none cursor-pointer"
                    >
                      <option value="vertical_module">Vertical Module</option>
                      <option value="addon">Add-on</option>
                      <option value="platform_core">Platform Core</option>
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Min. Core Family</label>
                  <div className="relative">
                    <select
                      value={form.required_core_family}
                      onChange={e => setForm(f => ({ ...f, required_core_family: e.target.value as any }))}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 outline-none transition-all appearance-none cursor-pointer"
                    >
                      <option value="lite">Lite Core</option>
                      <option value="starter">Starter Core</option>
                      <option value="full">Full Core</option>
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Price & Icon */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Harga Default / Bln</label>
                  <input
                    type="number"
                    min={0}
                    step={50000}
                    value={form.default_price}
                    onChange={e => setForm(f => ({ ...f, default_price: Number(e.target.value) }))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Ikon (Lucide)</label>
                  <div className="relative">
                    <select
                      value={form.icon_name}
                      onChange={e => setForm(f => ({ ...f, icon_name: e.target.value }))}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 outline-none transition-all appearance-none cursor-pointer"
                    >
                      {ICON_OPTIONS.map(ic => <option key={ic} value={ic}>{ic}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Version & Changelog */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Versi</label>
                <input
                  value={form.version}
                  onChange={e => setForm(f => ({ ...f, version: e.target.value }))}
                  placeholder="1.0.0"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Changelog</label>
                <textarea
                  value={form.changelog}
                  onChange={e => setForm(f => ({ ...f, changelog: e.target.value }))}
                  rows={2}
                  placeholder="Catatan perubahan versi ini..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 outline-none transition-all resize-none"
                />
              </div>

              {/* Dependencies */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Dependensi Modul</label>
                <div className="flex gap-2">
                  <input
                    value={depInput}
                    onChange={e => setDepInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addDep())}
                    placeholder="Ketik module_key, lalu Enter"
                    className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={addDep}
                    className="px-3 py-2.5 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 text-sm font-semibold transition-colors cursor-pointer"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                {form.dependencies.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {form.dependencies.map(d => (
                      <span key={d} className="inline-flex items-center gap-1 text-xs bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full font-medium">
                        {d}
                        <button onClick={() => removeDep(d)} className="cursor-pointer hover:text-indigo-900"><X size={10} /></button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 border-t border-slate-100 bg-white px-6 py-4 flex gap-3">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleSave}
                disabled={isPending || !form.module_key.trim() || !form.name.trim()}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white hover:bg-indigo-700 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-indigo-200"
              >
                <Save size={16} />
                {isPending ? 'Menyimpan...' : form.id ? 'Simpan Perubahan' : 'Upload Modul'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4">
            <h3 className="text-lg font-bold text-slate-900">Hapus Modul?</h3>
            <p className="mt-2 text-sm text-slate-500">Tindakan ini tidak dapat dibatalkan. Modul yang sudah dipakai di paket aktif tidak disarankan untuk dihapus.</p>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                disabled={isPending}
                className="flex-1 rounded-xl bg-rose-600 py-2.5 text-sm font-bold text-white hover:bg-rose-700 transition-colors cursor-pointer disabled:opacity-50"
              >
                {isPending ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
