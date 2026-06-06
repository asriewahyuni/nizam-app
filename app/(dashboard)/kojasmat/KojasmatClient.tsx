'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { FolderKanban, PiggyBank, Users, Plus, CheckCircle2, Trash2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { KojasmatProyek, KojasmatTabungan, KojasmatAnggota } from '@/modules/kojasmat/lib/kojasmat-types'
import { createProyek, updateProyekStatus, deleteProyek, createTabungan, createAnggota, verifyAnggota } from '@/modules/kojasmat/actions/kojasmat.actions'

type Tab = 'proyek' | 'tabungan' | 'anggota'

const STATUS_BADGE: Record<string, string> = {
  MENUNGGU: 'bg-slate-100 text-slate-600',
  PROSES: 'bg-blue-50 text-blue-600',
  SELESAI: 'bg-emerald-50 text-emerald-600',
  DIBAYAR: 'bg-violet-50 text-violet-600',
}

function formatIdr(v: number | null) {
  if (!v) return '—'
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v)
}

export default function KojasmatClient({
  orgId, proyek, tabungan, anggota,
}: {
  orgId: string
  proyek: KojasmatProyek[]
  tabungan: KojasmatTabungan[]
  anggota: KojasmatAnggota[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [tab, setTab] = useState<Tab>('proyek')
  const [showForm, setShowForm] = useState(false)

  // Form state
  const [nama, setNama] = useState('')
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')

  const resetForm = () => { setNama(''); setAmount(''); setNotes(''); setShowForm(false) }

  const handleSubmit = () => {
    if (!nama.trim()) return
    startTransition(async () => {
      if (tab === 'proyek') {
        await createProyek({ org_id: orgId, nama_proyek: nama, amount: amount ? Number(amount) : undefined, notes: notes || undefined })
      } else if (tab === 'tabungan') {
        await createTabungan({ org_id: orgId, nama_anggota: nama, saldo: amount ? Number(amount) : 0, notes: notes || undefined })
      } else {
        await createAnggota({ org_id: orgId, nama_anggota: nama, no_anggota: amount || undefined, notes: notes || undefined })
      }
      resetForm()
      router.refresh()
    })
  }

  const handleStatusProyek = (id: string, status: KojasmatProyek['status']) => {
    startTransition(async () => {
      await updateProyekStatus(id, orgId, status)
      router.refresh()
    })
  }

  const handleDeleteProyek = (id: string) => {
    if (!confirm('Hapus proyek ini?')) return
    startTransition(async () => {
      await deleteProyek(id, orgId)
      router.refresh()
    })
  }

  const handleVerifyAnggota = (id: string) => {
    startTransition(async () => {
      await verifyAnggota(id, orgId)
      router.refresh()
    })
  }

  const tabs: { id: Tab; label: string; count: number; Icon: any }[] = [
    { id: 'proyek', label: 'Proyek', count: proyek.length, Icon: FolderKanban },
    { id: 'tabungan', label: 'Tabungan', count: tabungan.length, Icon: PiggyBank },
    { id: 'anggota', label: 'Anggota', count: anggota.length, Icon: Users },
  ]

  return (
    <div className="p-4 md:p-8 min-h-screen bg-slate-50/30 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Kojasmat</h1>
          <p className="text-sm text-slate-500 mt-1">Koperasi Jasa & Tabungan Anggota</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 active:scale-[0.98] transition-all cursor-pointer shadow-md shadow-indigo-200"
        >
          <Plus size={16} /> Tambah {tab === 'proyek' ? 'Proyek' : tab === 'tabungan' ? 'Tabungan' : 'Anggota'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100/70 p-1 rounded-xl w-fit">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer',
              tab === t.id ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-800'
            )}
          >
            <t.Icon size={14} /> {t.label}
            <span className={cn('text-xs font-bold', tab === t.id ? 'text-indigo-600' : 'text-slate-400')}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Proyek Tab */}
      {tab === 'proyek' && (
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          {proyek.length === 0 ? (
            <div className="py-20 text-center text-slate-400">
              <FolderKanban className="mx-auto mb-3 text-slate-200" size={40} />
              <p className="text-sm font-semibold">Belum ada proyek.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {proyek.map(p => (
                <div key={p.id} className="flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 truncate">{p.nama_proyek}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{new Date(p.created_at).toLocaleDateString('id-ID')}</p>
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    <span className="text-sm font-semibold text-slate-700">{formatIdr(p.amount)}</span>
                    <select
                      value={p.status}
                      disabled={isPending}
                      onChange={e => handleStatusProyek(p.id, e.target.value as KojasmatProyek['status'])}
                      className={cn('text-xs font-bold rounded-full px-3 py-1 border cursor-pointer', STATUS_BADGE[p.status])}
                    >
                      {['MENUNGGU', 'PROSES', 'SELESAI', 'DIBAYAR'].map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleDeleteProyek(p.id)}
                      disabled={isPending}
                      className="p-1.5 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors cursor-pointer"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tabungan Tab */}
      {tab === 'tabungan' && (
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          {tabungan.length === 0 ? (
            <div className="py-20 text-center text-slate-400">
              <PiggyBank className="mx-auto mb-3 text-slate-200" size={40} />
              <p className="text-sm font-semibold">Belum ada data tabungan.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {tabungan.map(t => (
                <div key={t.id} className="flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors">
                  <div>
                    <p className="font-semibold text-slate-900">{t.nama_anggota}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{new Date(t.created_at).toLocaleDateString('id-ID')}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-emerald-600">{formatIdr(t.saldo)}</p>
                    <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', STATUS_BADGE[t.status])}>{t.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Anggota Tab */}
      {tab === 'anggota' && (
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          {anggota.length === 0 ? (
            <div className="py-20 text-center text-slate-400">
              <Users className="mx-auto mb-3 text-slate-200" size={40} />
              <p className="text-sm font-semibold">Belum ada anggota.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {anggota.map(a => (
                <div key={a.id} className="flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-900">{a.nama_anggota}</p>
                      {a.is_verified && <CheckCircle2 size={14} className="text-emerald-500" />}
                    </div>
                    {a.no_anggota && <p className="text-xs text-slate-400">No. {a.no_anggota}</p>}
                  </div>
                  {!a.is_verified && (
                    <button
                      onClick={() => handleVerifyAnggota(a.id)}
                      disabled={isPending}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer transition-colors"
                    >
                      Verifikasi
                    </button>
                  )}
                  {a.is_verified && <span className="text-xs font-semibold text-emerald-600">Terverifikasi</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal Form */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={resetForm}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-900">
                Tambah {tab === 'proyek' ? 'Proyek' : tab === 'tabungan' ? 'Tabungan' : 'Anggota'}
              </h2>
              <button onClick={resetForm} className="p-1 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  {tab === 'proyek' ? 'Nama Proyek' : 'Nama Anggota'} *
                </label>
                <input
                  value={nama}
                  onChange={e => setNama(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 outline-none transition-all"
                  placeholder={tab === 'proyek' ? 'Nama proyek...' : 'Nama anggota...'}
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  {tab === 'tabungan' ? 'Saldo Awal (IDR)' : tab === 'proyek' ? 'Nilai Proyek (IDR)' : 'No. Anggota'}
                </label>
                <input
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  type={tab === 'anggota' ? 'text' : 'number'}
                  min={0}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 outline-none transition-all"
                  placeholder={tab === 'anggota' ? 'KJM-001' : '0'}
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Catatan</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={2}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 outline-none transition-all resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={resetForm} className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer">
                Batal
              </button>
              <button
                onClick={handleSubmit}
                disabled={isPending || !nama.trim()}
                className="flex-1 rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white hover:bg-indigo-700 transition-colors cursor-pointer disabled:opacity-50 shadow-md shadow-indigo-200"
              >
                {isPending ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
