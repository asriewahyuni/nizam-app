'use client'

import React, { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  TRAINING_SCORING_CRITERIA,
  TRAINING_PHASE_LABELS,
  TRAINING_QUESTIONS,
  TRAINING_MAX_SCORE,
  type TrainingBoardData,
} from '@/lib/edu/training-simulation'
import { createTrainingTeam } from '@/modules/edu/actions/training.actions'
import { startTrainingSession } from '@/modules/edu/actions/session.actions'

export default function EduSimulationClient({
  initialBoard,
  canManage,
  trainerLabel,
}: {
  initialBoard: TrainingBoardData
  canManage: boolean
  trainerLabel: string | null
}) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'board' | 'curriculum'>('board')
  const [teamNameDraft, setTeamNameDraft] = useState('')
  const [feedback, setFeedback] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleCreateTeam = () => {
    const normalizedName = teamNameDraft.trim()
    if (!normalizedName) {
      setFeedback('Nama tim belum diisi.')
      return
    }

    startTransition(async () => {
      const result = await createTrainingTeam({
        teamName: normalizedName,
        eventSlug: initialBoard.event.slug,
      })

      if (result.error) {
        setFeedback(result.error)
        return
      }

      setTeamNameDraft('')
      setFeedback('Tim berhasil dibuat. Lanjut klik "Mulai EDU Mode" pada baris tim.')
      router.refresh()
    })
  }

  const handleStartSession = (teamId: string) => {
    startTransition(async () => {
      const result = await startTrainingSession({
        teamId,
        eventSlug: initialBoard.event.slug,
      })

      if (result.error) {
        setFeedback(result.error)
        return
      }

      setFeedback(null)
      router.push(result.redirectTo || '/dashboard')
      router.refresh()
    })
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl font-black text-slate-800 tracking-tight">
                {initialBoard.event.title || 'Simulasi Pelatihan ERP'}
              </h1>
              <p className="text-slate-500 mt-2 max-w-2xl text-sm leading-relaxed">
                {initialBoard.event.description || 'Skenario pelatihan operasional end-to-end multi-perusahaan.'}
              </p>
            </div>
            {canManage && (
              <div className="px-4 py-2 bg-blue-50 border border-blue-200 rounded-xl">
                <p className="text-xs font-bold text-blue-600 uppercase tracking-widest">Akses Trainer</p>
                <p className="font-medium text-blue-900 mt-0.5">{trainerLabel}</p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-8 mt-8 border-b-2 border-slate-100">
            <button
              onClick={() => setActiveTab('board')}
              className={`pb-4 px-2 font-bold text-sm tracking-wide transition-colors ${
                activeTab === 'board' ? 'text-blue-600 border-b-2 border-blue-600 -mb-[2px]' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              LEADERBOARD
            </button>
            <button
              onClick={() => setActiveTab('curriculum')}
              className={`pb-4 px-2 font-bold text-sm tracking-wide transition-colors ${
                activeTab === 'curriculum' ? 'text-blue-600 border-b-2 border-blue-600 -mb-[2px]' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              15 SKENARIO SOAL
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {activeTab === 'board' && (
          <div className="space-y-6">
            {canManage && (
              <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                  <div className="max-w-2xl">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-fuchsia-600">EDU Mode Realtime</p>
                    <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-900">EDU realtime 15 soal siap dipakai.</h3>
                    <p className="mt-2 text-sm font-medium leading-relaxed text-slate-600">
                      Mode ini menjalankan overlay di dashboard asli, timer global, dan validator otomatis untuk seluruh 15 soal. Setelah klik mulai, user akan diarahkan ke dashboard dengan org training aktif.
                    </p>
                  </div>

                  <div className="w-full max-w-xl rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                    <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Buat Tim Baru</label>
                    <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                      <input
                        value={teamNameDraft}
                        onChange={(event) => setTeamNameDraft(event.target.value)}
                        placeholder="Misalnya Tim Alpha"
                        className="h-12 flex-1 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 outline-none transition-colors focus:border-blue-400"
                      />
                      <button
                        onClick={handleCreateTeam}
                        disabled={isPending}
                        className="h-12 rounded-2xl bg-slate-900 px-5 text-sm font-black uppercase tracking-[0.14em] text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isPending ? 'Menyimpan...' : 'Tambah Tim'}
                      </button>
                    </div>
                    {feedback && (
                      <p className="mt-3 text-sm font-semibold text-slate-600">{feedback}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-5 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                <h3 className="font-bold text-slate-800">Skor Tim Saat Ini</h3>
                <span className="text-xs font-bold px-3 py-1 bg-white border border-slate-200 rounded-full">
                  Total Tim: {initialBoard.teams.length}
                </span>
              </div>
              <div className="p-0">
                {initialBoard.teams.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">
                    <p>Belum ada tim yang terdaftar di event ini.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[600px]">
                      <thead>
                        <tr className="bg-slate-50 text-xs font-black text-slate-500 uppercase tracking-wider">
                          <th className="p-4 border-b border-slate-200">Peringkat & Tim</th>
                          <th className="p-4 border-b border-slate-200">Total Skor</th>
                          <th className="p-4 border-b border-slate-200">Task Berhasil</th>
                          <th className="p-4 border-b border-slate-200">Waktu</th>
                          {canManage && (
                            <th className="p-4 border-b border-slate-200 text-right">EDU Mode</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {initialBoard.teams.map((team, idx) => (
                          <tr key={team.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <span className="w-8 h-8 flex items-center justify-center bg-blue-100 text-blue-700 font-black rounded-full shrink-0">
                                  {idx + 1}
                                </span>
                                <span className="font-bold text-slate-800">{team.name}</span>
                              </div>
                            </td>
                            <td className="p-4">
                              <span className="text-xl font-black text-blue-600">{team.totalScore}</span>
                              <span className="text-xs font-bold text-slate-400 ml-1">/ {TRAINING_MAX_SCORE}</span>
                            </td>
                            <td className="p-4">
                              <span className="font-bold text-slate-700">{team.verifiedTasks}</span> dari {initialBoard.questionCount} tugas
                              {team.correctionCount > 0 && (
                                <span className="ml-2 text-xs font-bold text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full inline-block mt-1 sm:mt-0">
                                  {team.correctionCount} Direvisi
                                </span>
                              )}
                            </td>
                            <td className="p-4">
                              <span className="font-mono text-sm font-bold text-slate-600">{team.elapsedMinutes} mnt</span>
                            </td>
                            {canManage && (
                              <td className="p-4 text-right">
                                <button
                                  onClick={() => handleStartSession(team.id)}
                                  disabled={isPending}
                                  className="inline-flex items-center rounded-2xl border border-fuchsia-200 bg-fuchsia-50 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-fuchsia-700 transition-colors hover:border-fuchsia-300 hover:bg-fuchsia-100 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {isPending ? 'Menyiapkan...' : 'Mulai EDU Mode'}
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
              {TRAINING_SCORING_CRITERIA.map(crit => (
                <div key={crit.key} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-black text-slate-800 tracking-tight">{crit.label}</h4>
                    <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
                      +{crit.points} Poin
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 leading-relaxed font-medium">{crit.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'curriculum' && (
          <div className="space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {(['SETUP', 'OPERATIONS', 'CONTROL'] as const).map((phaseKey, pIdx) => {
              const phaseInfo = TRAINING_PHASE_LABELS[phaseKey]
              const phaseQuestions = TRAINING_QUESTIONS.filter(q => q.phase === phaseKey)

              return (
                <section key={phaseKey} className="space-y-6">
                  <div className="pb-3 border-b-2 border-slate-800 flex items-end gap-4">
                    <span className="text-5xl font-black text-slate-200 shrink-0 leading-none">0{pIdx + 1}</span>
                    <div>
                      <h2 className="text-2xl font-black text-slate-800 tracking-tight">{phaseInfo.label}</h2>
                      <p className="text-slate-500 font-medium">{phaseInfo.description}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-5 pl-0 md:pl-[68px]">
                    {phaseQuestions.map(q => (
                      <div key={q.id} className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm hover:border-blue-300 transition-colors flex flex-col md:flex-row gap-6">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <span className="shrink-0 w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-black text-sm">
                              {q.id}
                            </span>
                            <h3 className="font-bold text-lg text-slate-800 leading-tight">{q.title}</h3>
                          </div>
                          <p className="text-slate-600 leading-relaxed font-medium text-sm mb-4">{q.prompt}</p>
                          <div className="flex flex-wrap gap-2 text-xs font-bold">
                            <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full border border-slate-200">Modul: {q.module}</span>
                            <span className="px-3 py-1 bg-amber-50 text-amber-700 rounded-full border border-amber-200">Scope: {q.scope}</span>
                          </div>
                        </div>
                        <div className="md:w-72 shrink-0 bg-slate-50 rounded-xl p-4 border border-slate-100">
                          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Indikator Sukses</h4>
                          <ul className="space-y-2.5">
                            {q.verification.map((v, vidx) => (
                              <li key={vidx} className="text-sm font-medium text-slate-700 flex items-start gap-2.5">
                                <span className="text-emerald-500 mt-0.5 shrink-0 text-lg leading-none">✔</span>
                                <span className="leading-snug">{v}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
         )}
      </main>
    </div>
  )
}
