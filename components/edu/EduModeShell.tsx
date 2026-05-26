'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'

type SessionStateResponse = {
  hasSession: boolean
  active: boolean
  outsideScope?: boolean
  session?: {
    id: string
    status: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'EXPIRED' | 'ABANDONED'
    teamId: string
    teamName: string
    eventId: string
    eventSlug: string
    eventTitle: string
    orgId: string
    orgName: string
    currentQuestionId: number
    totalQuestions: number
    pilotMode: boolean
    startedAt: string
    deadlineAt: string | null
    pausedAt: string | null
    completedAt: string | null
    remainingSeconds: number
    elapsedSeconds: number
    completionPercent: number
    currentQuestion: {
      id: number
      title: string
      prompt: string
      module: string
      scope: string
      phase: 'SETUP' | 'OPERATIONS' | 'CONTROL'
      verification: string[]
      href: string
    } | null
    currentStep: {
      status: 'LOCKED' | 'ACTIVE' | 'VALIDATING' | 'PASSED' | 'NEEDS_REVIEW' | 'TIMED_OUT'
      transactionOk: boolean
      contextOk: boolean
      evidenceOk: boolean
      pointsAwarded: number
      systemNote: string | null
      trainerNote: string | null
    } | null
    steps: Array<{
      questionId: number
      status: 'LOCKED' | 'ACTIVE' | 'VALIDATING' | 'PASSED' | 'NEEDS_REVIEW' | 'TIMED_OUT'
      pointsAwarded: number
    }>
    recentEvents: Array<{
      id: string
      message: string
      severity: 'info' | 'success' | 'warning' | 'error'
      createdAt: string
    }>
  }
}

function formatDuration(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)
  const seconds = safeSeconds % 60

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function severityTone(severity: 'info' | 'success' | 'warning' | 'error') {
  if (severity === 'success') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (severity === 'warning') return 'border-amber-200 bg-amber-50 text-amber-700'
  if (severity === 'error') return 'border-rose-200 bg-rose-50 text-rose-700'
  return 'border-slate-200 bg-slate-50 text-slate-700'
}

export function EduModeShell() {
  const [state, setState] = useState<SessionStateResponse>({ hasSession: false, active: false })
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [dismissedCompleted, setDismissedCompleted] = useState(false)
  const expiryMsRef = useRef<number | null>(null)
  const elapsedBaseSecondsRef = useRef<number>(0)
  const elapsedSyncedAtMsRef = useRef<number | null>(null)
  const [clockTick, setClockTick] = useState(0)

  const loadState = async (mode: 'GET' | 'POST' = 'GET') => {
    try {
      if (mode === 'POST') setIsRefreshing(true)
      const res = await fetch('/api/edu/session/active', {
        method: mode,
        cache: 'no-store',
        credentials: 'include',
      })
      if (!res.ok) return
      const nextState = await res.json() as SessionStateResponse
      setState(nextState)
      if (nextState.session) {
        expiryMsRef.current = Date.now() + (nextState.session.remainingSeconds * 1000)
        elapsedBaseSecondsRef.current = nextState.session.elapsedSeconds
        elapsedSyncedAtMsRef.current = Date.now()
      } else {
        expiryMsRef.current = null
        elapsedBaseSecondsRef.current = 0
        elapsedSyncedAtMsRef.current = null
      }
      if (nextState.session?.status !== 'COMPLETED') {
        setDismissedCompleted(false)
      }
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    void loadState('GET')
  }, [])

  useEffect(() => {
    if (!state.hasSession) return

    const poll = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void loadState('POST')
      }
    }, 4000)

    const onFocus = () => {
      void loadState('GET')
    }

    window.addEventListener('focus', onFocus)
    return () => {
      window.clearInterval(poll)
      window.removeEventListener('focus', onFocus)
    }
  }, [state.hasSession])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setClockTick((value) => value + 1)
    }, 1000)
    return () => {
      window.clearInterval(timer)
    }
  }, [])

  const remainingSeconds = useMemo(() => {
    if (!state.session || state.session.status !== 'ACTIVE') {
      return state.session?.remainingSeconds || 0
    }
    if (!expiryMsRef.current) return state.session.remainingSeconds
    return Math.max(0, Math.floor((expiryMsRef.current - Date.now()) / 1000))
  }, [clockTick, state.session])

  const elapsedSeconds = useMemo(() => {
    if (!state.session) return 0
    if (state.session.status !== 'ACTIVE') return state.session.elapsedSeconds
    if (!elapsedSyncedAtMsRef.current) return state.session.elapsedSeconds
    const deltaSeconds = Math.max(0, Math.floor((Date.now() - elapsedSyncedAtMsRef.current) / 1000))
    return elapsedBaseSecondsRef.current + deltaSeconds
  }, [clockTick, state.session])

  const handleDismiss = async () => {
    await fetch('/api/edu/session/active', {
      method: 'DELETE',
      credentials: 'include',
    })
    setDismissedCompleted(true)
    setState({ hasSession: false, active: false })
  }

  if (isLoading) return null
  if (!state.hasSession || !state.session) return null
  if (state.session.status === 'COMPLETED' && dismissedCompleted) return null

  if (state.outsideScope) {
    return (
      <div className="fixed inset-x-4 top-4 z-[70] rounded-xl border border-amber-200 bg-white/95 px-5 py-4 shadow-md shadow-amber-100 backdrop-blur">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-600">EDU Mode Terdeteksi</p>
        <p className="mt-1 text-sm font-bold text-slate-900">
          Session latihan aktif, tetapi organisasi yang sedang dibuka berada di luar scope session. Kembali ke org training untuk melanjutkan validasi realtime.
        </p>
      </div>
    )
  }

  const session = state.session
  const currentQuestion = session.currentQuestion
  const currentStep = session.currentStep
  const isCompleted = session.status === 'COMPLETED'
  const checkpointCards: Array<{ label: string, ok: boolean }> = [
    { label: 'Transaksi', ok: Boolean(currentStep?.transactionOk) },
    { label: 'Konteks', ok: Boolean(currentStep?.contextOk) },
    { label: 'Bukti', ok: Boolean(currentStep?.evidenceOk) },
  ]
  const phaseTone = currentQuestion?.phase === 'SETUP'
    ? 'text-blue-600 bg-blue-50 border-blue-200'
    : currentQuestion?.phase === 'OPERATIONS'
      ? 'text-amber-700 bg-amber-50 border-amber-200'
      : 'text-emerald-700 bg-emerald-50 border-emerald-200'

  return (
    <>
      <div className="fixed inset-x-3 top-3 z-[70] rounded-xl border border-slate-200 bg-white/95 shadow-md shadow-slate-200/70 backdrop-blur">
        <div className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between md:px-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-700">
                EDU Mode
              </span>
              {session.pilotMode && (
                <span className="rounded-full border border-fuchsia-200 bg-fuchsia-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-fuchsia-700">
                  Pilot Realtime 1-5
                </span>
              )}
              {currentQuestion && (
                <span className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-wide ${phaseTone}`}>
                  {currentQuestion.phase}
                </span>
              )}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-sm font-semibold text-slate-900">{session.teamName}</span>
              <span className="text-xs font-bold text-slate-500">
                Soal {Math.min(session.currentQuestionId, session.totalQuestions)}/{session.totalQuestions}
              </span>
              <span className="text-xs font-bold text-slate-500">{session.orgName}</span>
              {currentQuestion && (
                <span className="truncate text-xs font-medium text-slate-600">{currentQuestion.title}</span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 md:gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Sisa Waktu</p>
              <p className={`text-lg font-semibold ${remainingSeconds <= 600 ? 'text-rose-600' : 'text-slate-900'}`}>
                {formatDuration(remainingSeconds)}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Elapsed</p>
              <p className="text-lg font-semibold text-slate-900">{formatDuration(elapsedSeconds)}</p>
            </div>
            <div className="min-w-28">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Progress</p>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-500"
                  style={{ width: `${session.completionPercent}%` }}
                />
              </div>
              <p className="mt-1 text-right text-[11px] font-bold text-slate-500">{session.completionPercent}% selesai</p>
            </div>
            {currentQuestion && (
              <Link
                href={currentQuestion.href}
                className="inline-flex items-center rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white transition-colors hover:bg-slate-800"
              >
                Buka Modul
              </Link>
            )}
          </div>
        </div>
      </div>

      {isCompleted ? (
        <div className="fixed bottom-4 right-4 z-[70] w-[min(420px,calc(100vw-2rem))] rounded-[30px] border border-emerald-200 bg-white p-5 shadow-md shadow-emerald-100">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600">Session Selesai</p>
          <h3 className="mt-2 text-xl font-semibold text-slate-900">Pilot EDU Mode 1-5 selesai.</h3>
          <p className="mt-2 text-sm font-medium leading-relaxed text-slate-600">
            Tim <span className="font-semibold text-slate-900">{session.teamName}</span> telah menuntaskan sesi realtime awal. Progress sudah disinkronkan ke board `/edu`.
          </p>
          <div className="mt-4 flex items-center justify-between gap-3">
            <Link href="/edu" className="text-xs font-semibold uppercase tracking-wide text-blue-700">
              Kembali ke Board
            </Link>
            <button
              onClick={handleDismiss}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-700"
            >
              Tutup Mode
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="fixed bottom-4 left-4 right-4 z-[65] rounded-xl border border-slate-200 bg-white p-4 shadow-md shadow-slate-200 md:hidden">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">{currentQuestion?.title || 'Soal aktif'}</p>
                <p className="mt-1 text-xs font-medium text-slate-600">
                  {currentStep?.systemNote || currentQuestion?.module || 'Sedang menunggu validasi'}
                </p>
              </div>
              <button
                onClick={() => void loadState('POST')}
                disabled={isRefreshing}
                className="rounded-xl border border-slate-200 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-700"
              >
                {isRefreshing ? 'Cek...' : 'Cek'}
              </button>
            </div>
          </div>

          <aside className="fixed bottom-4 right-4 top-24 z-[65] hidden w-[380px] overflow-hidden rounded-[34px] border border-slate-200 bg-white shadow-md shadow-slate-200 lg:flex lg:flex-col">
            <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Mission Drawer</p>
              <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">{currentQuestion?.title || 'Soal aktif'}</h3>
              <p className="mt-2 text-sm font-medium leading-relaxed text-slate-600">{currentQuestion?.prompt}</p>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
              <section>
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Checkpoint Live</p>
                  <button
                    onClick={() => void loadState('POST')}
                    disabled={isRefreshing}
                    className="rounded-xl border border-slate-200 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-700"
                  >
                    {isRefreshing ? 'Validasi...' : 'Cek Ulang'}
                  </button>
                </div>

                <div className="space-y-2">
                  {checkpointCards.map((item) => (
                    <div key={item.label} className={`flex items-center justify-between rounded-xl border px-4 py-3 ${item.ok ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
                      <span className="text-sm font-bold text-slate-800">{item.label}</span>
                      <span className={`text-xs font-semibold uppercase tracking-[0.14em] ${item.ok ? 'text-emerald-700' : 'text-slate-500'}`}>
                        {item.ok ? 'Lolos' : 'Menunggu'}
                      </span>
                    </div>
                  ))}
                </div>

                {currentStep?.systemNote && (
                  <p className="mt-3 text-sm font-medium leading-relaxed text-slate-600">{currentStep.systemNote}</p>
                )}
              </section>

              <section>
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Indikator Sukses</p>
                <ul className="space-y-2">
                  {(currentQuestion?.verification || []).map((item) => (
                    <li key={item} className="flex items-start gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700">
                      <span className="mt-0.5 text-emerald-500">●</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <section>
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Log Terakhir</p>
                <div className="space-y-2">
                  {(session.recentEvents || []).map((event) => (
                    <div key={event.id} className={`rounded-xl border px-4 py-3 text-sm ${severityTone(event.severity)}`}>
                      <p className="font-semibold leading-relaxed">{event.message}</p>
                      <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.12em] opacity-70">
                        {new Date(event.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  ))}
                  {session.recentEvents.length === 0 && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-500">
                      Belum ada event progres yang tercatat.
                    </div>
                  )}
                </div>
              </section>
            </div>

            {currentQuestion && (
              <div className="border-t border-slate-200 px-5 py-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-bold text-slate-500">
                    Soal {session.currentQuestionId}/{session.totalQuestions}
                  </span>
                  <Link
                    href={currentQuestion.href}
                    className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white"
                  >
                    Kerjakan di Modul
                  </Link>
                </div>
              </div>
            )}
          </aside>
        </>
      )}
    </>
  )
}

export default EduModeShell
