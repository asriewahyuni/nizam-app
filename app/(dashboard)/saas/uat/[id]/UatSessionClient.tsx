'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CheckCircle2, XCircle, MinusCircle, Clock, FileOutput } from 'lucide-react'
import { updateUatSessionResult, updateUatSessionStatus } from '@/modules/saas/actions/uat.actions'
import type { UatSessionDetail, UatSessionResult } from '@/modules/saas/actions/uat.actions'

type Props = { session: UatSessionDetail }

const RESULT_STATUS = ['PASS', 'FAIL', 'SKIP', 'PENDING'] as const
type ResultStatus = (typeof RESULT_STATUS)[number]

const STATUS_ICON: Record<ResultStatus, React.ReactNode> = {
  PASS: <CheckCircle2 size={16} className="text-emerald-500" />,
  FAIL: <XCircle size={16} className="text-red-500" />,
  SKIP: <MinusCircle size={16} className="text-slate-400" />,
  PENDING: <Clock size={16} className="text-amber-400" />,
}

const STATUS_LABEL: Record<ResultStatus, string> = {
  PASS: 'Lulus',
  FAIL: 'Gagal',
  SKIP: 'Dilewati',
  PENDING: 'Belum Diuji',
}

const STATUS_BTN: Record<ResultStatus, string> = {
  PASS: 'bg-emerald-500 text-white',
  FAIL: 'bg-red-500 text-white',
  SKIP: 'bg-slate-200 text-slate-700',
  PENDING: 'bg-amber-100 text-amber-700',
}

const SESSION_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Menunggu',
  IN_PROGRESS: 'Sedang Berjalan',
  COMPLETED: 'Selesai',
}

function groupByModule(results: UatSessionResult[]) {
  const map = new Map<string, UatSessionResult[]>()
  for (const r of results) {
    const key = r.module_name ?? 'Umum'
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(r)
  }
  return map
}

export default function UatSessionClient({ session }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [localResults, setLocalResults] = useState<Record<string, ResultStatus>>({})
  const [operatorNotes, setOperatorNotes] = useState(session.operator_notes ?? '')

  const grouped = groupByModule(session.results)
  const total = session.results.length
  const passed = session.results.filter(r => (localResults[r.id] ?? r.status) === 'PASS').length
  const failed = session.results.filter(r => (localResults[r.id] ?? r.status) === 'FAIL').length
  const pending = session.results.filter(r => (localResults[r.id] ?? r.status) === 'PENDING').length
  const pct = total > 0 ? Math.round((passed / total) * 100) : 0

  function handleResult(resultId: string, status: ResultStatus) {
    setLocalResults(prev => ({ ...prev, [resultId]: status }))
    startTransition(async () => {
      await updateUatSessionResult(resultId, { status, notes: notes[resultId] })
    })
  }

  function handleStatusChange(newStatus: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED') {
    startTransition(async () => {
      await updateUatSessionStatus(session.id, { status: newStatus, operator_notes: operatorNotes })
      router.refresh()
    })
  }

  return (
    <div className="space-y-6 pb-20 p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <button onClick={() => router.push('/saas/uat')} className="mt-1 text-slate-400 hover:text-slate-700 cursor-pointer">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">{session.org_name}</h1>
            <p className="text-xs text-slate-400 mt-0.5">{session.session_number} · Template: {session.template_name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
            session.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' :
            session.status === 'IN_PROGRESS' ? 'bg-amber-100 text-amber-700' :
            'bg-slate-100 text-slate-600'
          }`}>
            {SESSION_STATUS_LABEL[session.status]}
          </span>
          {session.status === 'COMPLETED' && (
            <Link
              href={`/saas/bast/new?uat=${session.id}&org=${session.org_id}`}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 cursor-pointer"
            >
              <FileOutput size={14} /> Buat BAST
            </Link>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-500">Progres Pengujian</span>
          <span className="text-sm font-bold text-slate-800">{pct}% ({passed}/{total})</span>
        </div>
        <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="flex gap-4 mt-3 text-xs text-slate-500">
          <span className="flex items-center gap-1"><CheckCircle2 size={12} className="text-emerald-500" /> {passed} Lulus</span>
          <span className="flex items-center gap-1"><XCircle size={12} className="text-red-500" /> {failed} Gagal</span>
          <span className="flex items-center gap-1"><Clock size={12} className="text-amber-400" /> {pending} Belum</span>
        </div>
      </div>

      {/* Test items per module */}
      {Array.from(grouped.entries()).map(([moduleName, items]) => (
        <div key={moduleName} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{moduleName}</span>
            <span className="ml-2 text-xs text-slate-400">({items.length} item)</span>
          </div>
          <div className="divide-y divide-slate-100">
            {items.map((item) => {
              const currentStatus = (localResults[item.id] ?? item.status) as ResultStatus
              return (
                <div key={item.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      {item.category && (
                        <span className="inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 mb-1">{item.category}</span>
                      )}
                      <p className="text-sm font-medium text-slate-800">{item.test_scenario}</p>
                      <p className="text-xs text-slate-400 mt-0.5">Ekspektasi: {item.expected_result}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {(['PASS', 'FAIL', 'SKIP'] as ResultStatus[]).map(s => (
                        <button
                          key={s}
                          onClick={() => handleResult(item.id, s)}
                          disabled={isPending}
                          className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all cursor-pointer disabled:opacity-60 ${
                            currentStatus === s ? STATUS_BTN[s] : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                          }`}
                        >
                          {STATUS_ICON[s]} {STATUS_LABEL[s]}
                        </button>
                      ))}
                    </div>
                  </div>
                  {(currentStatus === 'FAIL' || notes[item.id]) && (
                    <input
                      value={notes[item.id] ?? ''}
                      onChange={e => setNotes(prev => ({ ...prev, [item.id]: e.target.value }))}
                      onBlur={() => handleResult(item.id, currentStatus)}
                      placeholder="Catatan kegagalan / temuan..."
                      className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-red-300"
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {/* Status update panel */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Update Status Sesi</p>
        <textarea
          value={operatorNotes}
          onChange={e => setOperatorNotes(e.target.value)}
          rows={2}
          placeholder="Catatan operator (opsional)..."
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        <div className="flex gap-2">
          {session.status !== 'IN_PROGRESS' && (
            <button
              onClick={() => handleStatusChange('IN_PROGRESS')}
              disabled={isPending}
              className="rounded-lg bg-amber-500 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-50 cursor-pointer"
            >
              Mulai Pengujian
            </button>
          )}
          {session.status !== 'COMPLETED' && (
            <button
              onClick={() => handleStatusChange('COMPLETED')}
              disabled={isPending || pending > 0}
              title={pending > 0 ? `Masih ada ${pending} item belum diuji` : ''}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
            >
              Tandai Selesai
            </button>
          )}
        </div>
        {pending > 0 && session.status !== 'COMPLETED' && (
          <p className="text-xs text-amber-600">⚠ Masih ada {pending} item yang belum diuji.</p>
        )}
      </div>
    </div>
  )
}
