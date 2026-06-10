'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FileText, Plus, ExternalLink } from 'lucide-react'
import { createBastDocument } from '@/modules/saas/actions/bast.actions'
import type { BastDocument } from '@/modules/saas/actions/bast.actions'
import type { UatSession } from '@/modules/saas/actions/uat.actions'

type Props = {
  basts: BastDocument[]
  uatSessions: UatSession[]
}

const ALL_MODULES = ['Dashboard', 'Accounting', 'Finance', 'Inventory', 'Sales', 'Purchasing', 'HRIS', 'POS', 'CRM', 'Warehouse', 'Syirkah', 'Reports', 'Audit']

function formatDate(d: string) {
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(d))
}

export default function BastListClient({ basts, uatSessions }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showForm, setShowForm] = useState(false)

  const [orgId, setOrgId] = useState('')
  const [uatId, setUatId] = useState('')
  const [issuedDate, setIssuedDate] = useState(new Date().toISOString().slice(0, 10))
  const [selectedModules, setSelectedModules] = useState<string[]>([])
  const [operatorName, setOperatorName] = useState('')
  const [operatorTitle, setOperatorTitle] = useState('Implementation Consultant')
  const [clientName, setClientName] = useState('')
  const [clientTitle, setClientTitle] = useState('Pimpinan / Direktur')

  function toggleModule(m: string) {
    setSelectedModules(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])
  }

  function handleUatChange(id: string) {
    setUatId(id)
    const s = uatSessions.find(x => x.id === id)
    if (s) {
      setOrgId(s.org_id)
      setSelectedModules(s.template_name ? [] : [])
    }
  }

  function handleCreate() {
    startTransition(async () => {
      const { id } = await createBastDocument({
        org_id: orgId,
        uat_session_id: uatId || undefined,
        issued_date: issuedDate,
        modules_delivered: selectedModules,
        operator_name: operatorName || undefined,
        operator_title: operatorTitle || undefined,
        client_name: clientName || undefined,
        client_title: clientTitle || undefined,
      })
      router.push(`/saas/bast/${id}`)
    })
  }

  return (
    <div className="space-y-6 pb-20 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 flex items-center gap-2">
            <FileText size={22} className="text-emerald-600" />
            BAST — Berita Acara Serah Terima
          </h1>
          <p className="mt-1 text-sm text-slate-500">Dokumen formal penyerahan sistem ke klien</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 cursor-pointer"
        >
          <Plus size={14} /> Buat BAST Baru
        </button>
      </div>

      {/* Nav tabs */}
      <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
        <Link href="/saas/spk" className="rounded-xl px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500 hover:bg-slate-50">SPK</Link>
        <Link href="/saas/uat" className="rounded-xl px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500 hover:bg-slate-50">UAT</Link>
        <Link href="/saas/bast" className="rounded-xl px-4 py-2 text-xs font-semibold uppercase tracking-wider bg-[#003366] text-white">BAST</Link>
        <Link href="/saas/penjualan" className="rounded-xl px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500 hover:bg-slate-50">Penjualan</Link>
      </div>

      {/* Form */}
      {showForm && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 space-y-4">
          <p className="text-sm font-semibold text-emerald-900">Buat BAST Baru</p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">UAT Session (opsional)</label>
              <select value={uatId} onChange={e => handleUatChange(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 cursor-pointer">
                <option value="">— Tanpa UAT —</option>
                {uatSessions.map(s => <option key={s.id} value={s.id}>{s.session_number} · {s.org_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Org ID Klien</label>
              <input value={orgId} onChange={e => setOrgId(e.target.value)} placeholder="UUID org" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Tanggal BAST</label>
              <input type="date" value={issuedDate} onChange={e => setIssuedDate(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 cursor-pointer" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Nama Operator</label>
              <input value={operatorName} onChange={e => setOperatorName(e.target.value)} placeholder="Nama implementor" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Jabatan Operator</label>
              <input value={operatorTitle} onChange={e => setOperatorTitle(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Nama Klien</label>
              <input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Nama penerima" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">Modul yang Diserahkan</label>
            <div className="flex flex-wrap gap-2">
              {ALL_MODULES.map(m => (
                <button
                  key={m}
                  onClick={() => toggleModule(m)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold cursor-pointer transition-all ${selectedModules.includes(m) ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-emerald-400'}`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={isPending || !orgId.trim() || selectedModules.length === 0} className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer">
              {isPending ? 'Membuat...' : 'Buat & Lihat BAST'}
            </button>
            <button onClick={() => setShowForm(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer">Batal</button>
          </div>
        </div>
      )}

      {/* BAST list */}
      {basts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 p-10 text-center text-sm text-slate-400">
          Belum ada BAST. Buat setelah UAT selesai.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-4 py-3 text-left">No. Dokumen</th>
                <th className="px-4 py-3 text-left">Klien</th>
                <th className="px-4 py-3 text-left">Tanggal</th>
                <th className="px-4 py-3 text-left">Modul</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {basts.map(b => (
                <tr key={b.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{b.document_number}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{b.org_name}</td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(b.issued_date)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {b.modules_delivered.slice(0, 4).map(m => (
                        <span key={m} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">{m}</span>
                      ))}
                      {b.modules_delivered.length > 4 && (
                        <span className="text-[10px] text-slate-400">+{b.modules_delivered.length - 4}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${b.status === 'ISSUED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {b.status === 'ISSUED' ? 'Diterbitkan' : 'Draft'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/saas/bast/${b.id}`} className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline cursor-pointer">
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
