'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  CheckCircle2, Circle, ClipboardList, FlaskConical,
  Plus, RefreshCcw, XCircle, ChevronRight, FileText,
} from 'lucide-react'
import { createUatSession, createUatTemplate } from '@/modules/saas/actions/uat.actions'
import type { UatSession, UatTemplate } from '@/modules/saas/actions/uat.actions'

type Props = {
  sessions: UatSession[]
  templates: UatTemplate[]
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Menunggu',
  IN_PROGRESS: 'Sedang Berjalan',
  COMPLETED: 'Selesai',
}
const STATUS_COLOR: Record<string, string> = {
  PENDING: 'bg-slate-100 text-slate-600',
  IN_PROGRESS: 'bg-amber-100 text-amber-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
}

function formatDate(d: string | null) {
  if (!d) return '-'
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(d))
}

export default function UatListClient({ sessions, templates }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showNewSession, setShowNewSession] = useState(false)
  const [showNewTemplate, setShowNewTemplate] = useState(false)

  // Form: new session
  const [orgId, setOrgId] = useState('')
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? '')

  // Form: new template (nama saja dulu, item di-edit di halaman detail)
  const [tplName, setTplName] = useState('')
  const [tplDesc, setTplDesc] = useState('')
  const [tplModules, setTplModules] = useState('')

  function handleCreateSession() {
    if (!orgId.trim() || !templateId) return
    startTransition(async () => {
      const { id } = await createUatSession({ org_id: orgId.trim(), template_id: templateId })
      router.push(`/saas/uat/${id}`)
    })
  }

  function handleCreateTemplate() {
    if (!tplName.trim()) return
    startTransition(async () => {
      const modules = tplModules.split(',').map(s => s.trim()).filter(Boolean)
      const { id } = await createUatTemplate({ name: tplName.trim(), description: tplDesc || undefined, applicable_modules: modules, items: [] })
      router.push(`/saas/uat/template/${id}`)
    })
  }

  return (
    <div className="space-y-6 pb-20 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 flex items-center gap-2">
            <FlaskConical size={22} className="text-indigo-600" />
            UAT — User Acceptance Testing
          </h1>
          <p className="mt-1 text-sm text-slate-500">Kelola sesi pengujian penerimaan sistem per klien</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setShowNewTemplate(true); setShowNewSession(false) }}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            <Plus size={14} /> Template Baru
          </button>
          <button
            onClick={() => { setShowNewSession(true); setShowNewTemplate(false) }}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 cursor-pointer"
          >
            <Plus size={14} /> Sesi UAT Baru
          </button>
        </div>
      </div>

      {/* Nav tabs */}
      <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
        <Link href="/saas/uat" className="rounded-xl px-4 py-2 text-xs font-semibold uppercase tracking-wider bg-[#003366] text-white">UAT</Link>
        <Link href="/saas/bast" className="rounded-xl px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500 hover:bg-slate-50">BAST</Link>
        <Link href="/saas/penjualan" className="rounded-xl px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500 hover:bg-slate-50">Penjualan</Link>
      </div>

      {/* Form: New Session */}
      {showNewSession && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 space-y-3">
          <p className="text-sm font-semibold text-indigo-800">Buat Sesi UAT Baru</p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Org ID Klien</label>
              <input
                value={orgId} onChange={e => setOrgId(e.target.value)}
                placeholder="UUID org klien..."
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Template UAT</label>
              <select
                value={templateId} onChange={e => setTemplateId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer"
              >
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name} ({t.item_count ?? 0} item)</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreateSession} disabled={isPending || !orgId.trim()}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
            >
              {isPending ? 'Membuat...' : 'Buat Sesi'}
            </button>
            <button onClick={() => setShowNewSession(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer">
              Batal
            </button>
          </div>
        </div>
      )}

      {/* Form: New Template */}
      {showNewTemplate && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
          <p className="text-sm font-semibold text-slate-800">Buat Template UAT Baru</p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Nama Template</label>
              <input value={tplName} onChange={e => setTplName(e.target.value)} placeholder="contoh: Full ERP Standard" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Modul (pisah koma)</label>
              <input value={tplModules} onChange={e => setTplModules(e.target.value)} placeholder="Accounting, Inventory, HRIS" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Deskripsi</label>
              <input value={tplDesc} onChange={e => setTplDesc(e.target.value)} placeholder="Opsional" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreateTemplate} disabled={isPending || !tplName.trim()} className="rounded-lg bg-slate-700 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-900 disabled:opacity-50 cursor-pointer">
              {isPending ? 'Membuat...' : 'Buat & Edit Item'}
            </button>
            <button onClick={() => setShowNewTemplate(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer">
              Batal
            </button>
          </div>
        </div>
      )}

      {/* Templates section */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Template Tersedia ({templates.length})</h2>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          {templates.map(t => (
            <Link key={t.id} href={`/saas/uat/template/${t.id}`} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 hover:border-indigo-300 hover:bg-indigo-50 cursor-pointer">
              <div>
                <p className="text-sm font-semibold text-slate-800">{t.name}</p>
                <p className="text-xs text-slate-400">{t.item_count ?? 0} item · {(t.applicable_modules ?? []).join(', ') || '-'}</p>
              </div>
              <ChevronRight size={16} className="text-slate-300" />
            </Link>
          ))}
          {templates.length === 0 && (
            <p className="text-sm text-slate-400 col-span-3">Belum ada template. Buat template dulu sebelum membuat sesi UAT.</p>
          )}
        </div>
      </div>

      {/* Sessions table */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Sesi UAT ({sessions.length})</h2>
        {sessions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 p-10 text-center text-sm text-slate-400">
            Belum ada sesi UAT. Buat sesi baru untuk memulai pengujian.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-4 py-3 text-left">No. Sesi</th>
                  <th className="px-4 py-3 text-left">Klien</th>
                  <th className="px-4 py-3 text-left">Template</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Progres</th>
                  <th className="px-4 py-3 text-left">Tanggal</th>
                  <th className="px-4 py-3 text-left">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sessions.map(s => {
                  const total = s.total_items ?? 0
                  const passed = s.passed_items ?? 0
                  const failed = s.failed_items ?? 0
                  const pct = total > 0 ? Math.round((passed / total) * 100) : 0
                  return (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">{s.session_number}</td>
                      <td className="px-4 py-3 font-medium text-slate-800">{s.org_name}</td>
                      <td className="px-4 py-3 text-slate-500">{s.template_name}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLOR[s.status]}`}>
                          {STATUS_LABEL[s.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-20 rounded-full bg-slate-100 overflow-hidden">
                            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-slate-500">{passed}/{total}</span>
                          {failed > 0 && <span className="text-xs text-red-500">{failed} gagal</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">{formatDate(s.created_at)}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <Link href={`/saas/uat/${s.id}`} className="text-xs font-semibold text-indigo-600 hover:underline cursor-pointer">
                            Buka
                          </Link>
                          {s.status === 'COMPLETED' && (
                            <Link href={`/saas/bast/new?uat=${s.id}&org=${s.org_id}`} className="text-xs font-semibold text-emerald-600 hover:underline cursor-pointer">
                              BAST
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
