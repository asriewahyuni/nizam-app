'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ClipboardCheck, ExternalLink, Plus } from 'lucide-react'
import { createSpkDocument } from '@/modules/saas/actions/spk.actions'
import type { SpkDocument } from '@/modules/saas/actions/spk.actions'

type Props = {
  spks: SpkDocument[]
}

const ALL_MODULES = ['Dashboard', 'Accounting', 'Finance', 'Inventory', 'Sales', 'Purchasing', 'HRIS', 'POS', 'CRM', 'Warehouse', 'Syirkah', 'Reports', 'Audit']

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Draft',
  ISSUED: 'Diterbitkan',
  IN_PROGRESS: 'Sedang Berjalan',
  COMPLETED: 'Selesai',
}

const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-600',
  ISSUED: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-amber-100 text-amber-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
}

function formatDate(d: string | null) {
  if (!d) return '-'
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(d))
}

export default function SpkListClient({ spks }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showForm, setShowForm] = useState(false)

  const [orgId, setOrgId] = useState('')
  const [issuedDate, setIssuedDate] = useState(new Date().toISOString().slice(0, 10))
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedModules, setSelectedModules] = useState<string[]>([])
  const [consultantName, setConsultantName] = useState('')
  const [consultantTitle, setConsultantTitle] = useState('Implementation Consultant')
  const [clientPicName, setClientPicName] = useState('')
  const [clientPicTitle, setClientPicTitle] = useState('Pimpinan / Direktur')
  const [notes, setNotes] = useState('')

  function toggleModule(m: string) {
    setSelectedModules(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])
  }

  function handleCreate() {
    if (!orgId.trim() || selectedModules.length === 0) return
    startTransition(async () => {
      const { id } = await createSpkDocument({
        org_id: orgId.trim(),
        issued_date: issuedDate,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        modules_scope: selectedModules,
        consultant_name: consultantName || undefined,
        consultant_title: consultantTitle || undefined,
        client_pic_name: clientPicName || undefined,
        client_pic_title: clientPicTitle || undefined,
        notes: notes || undefined,
      })
      router.push(`/saas/spk/${id}`)
    })
  }

  return (
    <div className="space-y-6 pb-20 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 flex items-center gap-2">
            <ClipboardCheck size={22} className="text-blue-600" />
            SPK — Surat Perintah Kerja
          </h1>
          <p className="mt-1 text-sm text-slate-500">Dokumen perintah kerja implementasi setelah penjualan dikonfirmasi</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 cursor-pointer"
        >
          <Plus size={14} /> Buat SPK Baru
        </button>
      </div>

      {/* Nav tabs */}
      <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
        <Link href="/saas/spk" className="rounded-xl px-4 py-2 text-xs font-semibold uppercase tracking-wider bg-[#003366] text-white">SPK</Link>
        <Link href="/saas/uat" className="rounded-xl px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500 hover:bg-slate-50">UAT</Link>
        <Link href="/saas/bast" className="rounded-xl px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500 hover:bg-slate-50">BAST</Link>
        <Link href="/saas/penjualan" className="rounded-xl px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500 hover:bg-slate-50">Penjualan</Link>
      </div>

      {/* Form */}
      {showForm && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 space-y-4">
          <p className="text-sm font-semibold text-blue-900">Buat SPK Baru</p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Org ID Klien</label>
              <input
                value={orgId} onChange={e => setOrgId(e.target.value)}
                placeholder="UUID org klien..."
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Tanggal SPK</label>
              <input type="date" value={issuedDate} onChange={e => setIssuedDate(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Nama Konsultan</label>
              <input value={consultantName} onChange={e => setConsultantName(e.target.value)} placeholder="Nama implementor"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Jabatan Konsultan</label>
              <input value={consultantTitle} onChange={e => setConsultantTitle(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Nama PIC Klien</label>
              <input value={clientPicName} onChange={e => setClientPicName(e.target.value)} placeholder="Nama perwakilan klien"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Jabatan PIC Klien</label>
              <input value={clientPicTitle} onChange={e => setClientPicTitle(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Rencana Mulai</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Rencana Selesai</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Catatan</label>
              <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Opsional"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">Ruang Lingkup Modul</label>
            <div className="flex flex-wrap gap-2">
              {ALL_MODULES.map(m => (
                <button
                  key={m}
                  onClick={() => toggleModule(m)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold cursor-pointer transition-all ${selectedModules.includes(m) ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-blue-400'}`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={isPending || !orgId.trim() || selectedModules.length === 0}
              className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
            >
              {isPending ? 'Membuat...' : 'Buat & Lihat SPK'}
            </button>
            <button onClick={() => setShowForm(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer">Batal</button>
          </div>
        </div>
      )}

      {/* SPK list */}
      {spks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 p-10 text-center text-sm text-slate-400">
          Belum ada SPK. Buat SPK setelah penjualan dikonfirmasi.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-4 py-3 text-left">No. Dokumen</th>
                <th className="px-4 py-3 text-left">Klien</th>
                <th className="px-4 py-3 text-left">Tanggal</th>
                <th className="px-4 py-3 text-left">Timeline</th>
                <th className="px-4 py-3 text-left">Modul</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {spks.map(s => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{s.document_number}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{s.org_name}</td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(s.issued_date)}</td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {s.start_date ? <span>{formatDate(s.start_date)} — {formatDate(s.end_date)}</span> : <span>—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {s.modules_scope.slice(0, 3).map(m => (
                        <span key={m} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">{m}</span>
                      ))}
                      {s.modules_scope.length > 3 && (
                        <span className="text-[10px] text-slate-400">+{s.modules_scope.length - 3}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLOR[s.status]}`}>
                      {STATUS_LABEL[s.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/saas/spk/${s.id}`} className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline cursor-pointer">
                      <ExternalLink size={12} /> Buka
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
