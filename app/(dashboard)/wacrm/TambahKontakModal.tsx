'use client'
// app/(dashboard)/wacrm/TambahKontakModal.tsx
// Modal tambah kontak WA CRM — dua tab: manual & import dari pelanggan yang ada

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  X,
  UserPlus,
  Search,
  Loader2,
  CheckCircle2,
  Users,
  Phone,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WaCrmContact } from './page'

// ── Types ─────────────────────────────────────────────────────────────────

type Props = {
  open: boolean
  onClose: () => void
  pipelineStages: string[]
  onCreated: (contact: WaCrmContact) => void
}

type ExistingCustomer = {
  id: string
  name: string
  phone: string
  email: string | null
  type: string
}

const STAGE_KEYS = ['masuk', 'follow_up', 'negosiasi', 'closing'] as const

// ── Tab: Manual ───────────────────────────────────────────────────────────

function TabManual({
  pipelineStages,
  onCreated,
  onClose,
}: {
  pipelineStages: string[]
  onCreated: (c: WaCrmContact) => void
  onClose: () => void
}) {
  const [name, setName]                   = useState('')
  const [phone, setPhone]                 = useState('')
  const [stage, setStage]                 = useState<typeof STAGE_KEYS[number]>('masuk')
  const [productInterest, setProductInterest] = useState('')
  const [notes, setNotes]                 = useState('')
  const [loading, setLoading]             = useState(false)
  const [error, setError]                 = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/wacrm/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, stage, product_interest: productInterest, notes }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Gagal menyimpan kontak'); return }
      onCreated(json.data)
      onClose()
    } catch {
      setError('Terjadi kesalahan. Coba lagi.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-2">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-600">Nama <span className="text-red-500">*</span></label>
          <input
            required
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="cth: Budi Santoso"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-600">Nomor WhatsApp <span className="text-red-500">*</span></label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              required
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="08xx atau 628xx"
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <p className="text-[11px] text-slate-400">Awalan 0 otomatis diubah ke 62</p>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-slate-600">Stage Pipeline</label>
        <div className="flex flex-wrap gap-2">
          {STAGE_KEYS.map((key, i) => (
            <button
              key={key}
              type="button"
              onClick={() => setStage(key)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors cursor-pointer',
                stage === key
                  ? 'bg-green-600 text-white border-green-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300',
              )}
            >
              {pipelineStages[i] ?? key}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-slate-600">Produk / Minat</label>
        <input
          value={productInterest}
          onChange={e => setProductInterest(e.target.value)}
          placeholder="cth: Paket Website, Desain Logo"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-slate-600">Catatan</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={2}
          placeholder="Informasi tambahan tentang prospek ini..."
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
        />
      </div>

      {error && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

      <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
        >
          Batal
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 px-5 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-60 transition-colors cursor-pointer"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
          Tambah Kontak
        </button>
      </div>
    </form>
  )
}

// ── Tab: Import dari Pelanggan ─────────────────────────────────────────────

function TabImportPelanggan({
  pipelineStages,
  onCreated,
  onClose,
}: {
  pipelineStages: string[]
  onCreated: (c: WaCrmContact) => void
  onClose: () => void
}) {
  const [query, setQuery]                   = useState('')
  const [customers, setCustomers]           = useState<ExistingCustomer[]>([])
  const [selected, setSelected]             = useState<Set<string>>(new Set())
  const [stage, setStage]                   = useState<typeof STAGE_KEYS[number]>('masuk')
  const [loadingSearch, setLoadingSearch]   = useState(false)
  const [loadingImport, setLoadingImport]   = useState(false)
  const [error, setError]                   = useState('')
  const [importedCount, setImportedCount]   = useState(0)
  const debounceRef = useRef<NodeJS.Timeout | undefined>(undefined)

  const searchCustomers = useCallback(async (q: string) => {
    setLoadingSearch(true)
    try {
      const res = await fetch(`/api/wacrm/contacts?source=customers&q=${encodeURIComponent(q)}`)
      const json = await res.json()
      setCustomers(json.data ?? [])
    } catch {
      setCustomers([])
    } finally {
      setLoadingSearch(false)
    }
  }, [])

  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => searchCustomers(query), 300)
    return () => clearTimeout(debounceRef.current)
  }, [query, searchCustomers])

  // Load awal tanpa query
  useEffect(() => { searchCustomers('') }, [searchCustomers])  // eslint-disable-line react-hooks/exhaustive-deps

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (selected.size === customers.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(customers.map(c => c.id)))
    }
  }

  async function handleImport() {
    if (selected.size === 0) { setError('Pilih minimal satu pelanggan'); return }
    setError('')
    setLoadingImport(true)
    let count = 0
    let lastCreated: WaCrmContact | null = null
    try {
      for (const customerId of Array.from(selected)) {
        const cust = customers.find(c => c.id === customerId)
        if (!cust) continue
        const res = await fetch('/api/wacrm/contacts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: cust.name,
            phone: cust.phone,
            stage,
          }),
        })
        if (res.ok) {
          const json = await res.json()
          lastCreated = json.data
          count++
        }
      }
      setImportedCount(count)
      if (lastCreated) onCreated(lastCreated)
      // Refresh daftar (hapus yang sudah di-import)
      setSelected(new Set())
      await searchCustomers(query)
    } finally {
      setLoadingImport(false)
    }
  }

  return (
    <div className="space-y-4 pt-2">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Cari nama atau nomor pelanggan..."
          className="w-full pl-10 pr-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          autoFocus
        />
      </div>

      {/* Stage untuk semua yang diimport */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs font-semibold text-slate-500 flex-shrink-0">Masukkan ke stage:</span>
        {STAGE_KEYS.map((key, i) => (
          <button
            key={key}
            type="button"
            onClick={() => setStage(key)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors cursor-pointer',
              stage === key
                ? 'bg-green-600 text-white border-green-600'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300',
            )}
          >
            {pipelineStages[i] ?? key}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-3 py-2 bg-slate-50 border-b border-slate-200">
          <input
            type="checkbox"
            checked={customers.length > 0 && selected.size === customers.length}
            onChange={toggleAll}
            className="accent-green-600 cursor-pointer"
          />
          <span className="text-xs font-semibold text-slate-500">
            {loadingSearch
              ? 'Mencari...'
              : `${customers.length} pelanggan belum di Whatslab CRM`}
          </span>
          {selected.size > 0 && (
            <span className="ml-auto text-xs font-semibold text-green-600">
              {selected.size} dipilih
            </span>
          )}
        </div>

        {/* Rows */}
        <div className="max-h-56 overflow-y-auto divide-y divide-slate-100">
          {loadingSearch && (
            <div className="flex items-center justify-center py-8 gap-2 text-slate-400 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Memuat...
            </div>
          )}
          {!loadingSearch && customers.length === 0 && (
            <div className="py-8 text-center text-sm text-slate-400">
              {query ? 'Tidak ada pelanggan yang cocok' : 'Semua pelanggan sudah ada di Whatslab CRM'}
            </div>
          )}
          {!loadingSearch && customers.map(cust => (
            <label
              key={cust.id}
              className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 cursor-pointer transition-colors"
            >
              <input
                type="checkbox"
                checked={selected.has(cust.id)}
                onChange={() => toggleSelect(cust.id)}
                className="accent-green-600 cursor-pointer flex-shrink-0"
              />
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-xs font-bold text-green-700 flex-shrink-0">
                {cust.name[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-slate-800 truncate">{cust.name}</div>
                <div className="text-xs text-slate-500">{cust.phone}</div>
              </div>
              <span className={cn(
                'text-[10px] px-2 py-0.5 rounded-full font-semibold flex-shrink-0',
                cust.type === 'CUSTOMER' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500',
              )}>
                {cust.type === 'CUSTOMER' ? 'Pelanggan' : cust.type === 'SUPPLIER' ? 'Vendor' : 'Keduanya'}
              </span>
            </label>
          ))}
        </div>
      </div>

      {importedCount > 0 && (
        <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-lg">
          <CheckCircle2 className="h-4 w-4" />
          {importedCount} kontak berhasil ditambahkan ke Whatslab CRM
        </div>
      )}
      {error && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

      <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
        >
          {importedCount > 0 ? 'Tutup' : 'Batal'}
        </button>
        <button
          type="button"
          onClick={handleImport}
          disabled={loadingImport || selected.size === 0}
          className="flex items-center gap-2 px-5 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-60 transition-colors cursor-pointer"
        >
          {loadingImport ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
          Import {selected.size > 0 ? `(${selected.size})` : ''}
        </button>
      </div>
    </div>
  )
}

// ── Main Modal ─────────────────────────────────────────────────────────────

export function TambahKontakModal({ open, onClose, pipelineStages, onCreated }: Props) {
  const [tab, setTab] = useState<'manual' | 'import'>('manual')

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-base font-bold text-slate-900">Tambah Kontak Whatslab CRM</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-slate-200 px-6">
          {([['manual', 'Kontak Baru'], ['import', 'Dari Pelanggan']] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={cn(
                'px-4 py-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer -mb-px',
                tab === key
                  ? 'border-green-600 text-green-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="overflow-y-auto px-6 py-4">
          {tab === 'manual' ? (
            <TabManual
              pipelineStages={pipelineStages}
              onCreated={onCreated}
              onClose={onClose}
            />
          ) : (
            <TabImportPelanggan
              pipelineStages={pipelineStages}
              onCreated={onCreated}
              onClose={onClose}
            />
          )}
        </div>
      </div>
    </div>
  )
}
