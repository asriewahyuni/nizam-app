'use client'

// Modal flow "Tambah Program" untuk LMS Dashboard.
// Step 1: Info dasar (judul, deskripsi, level)
// Step 2: Konfirmasi & simpan

import { useState, useTransition, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  BookOpen,
  ChevronRight,
  Loader2,
  CheckCircle2,
  Sparkles,
  GraduationCap,
  AlignLeft,
  Tag,
  ArrowLeft,
} from 'lucide-react'
import { createLmsCourse } from '@/modules/edu/actions/lms-commercial.actions'

const LEVEL_OPTIONS = [
  { value: 'ALL',     label: 'Semua Level',    emoji: '🌐', desc: 'Cocok untuk siapapun' },
  { value: 'BASIC',   label: 'Dasar',          emoji: '🌱', desc: 'Pemula, tidak ada prasyarat' },
  { value: 'INTER',   label: 'Menengah',       emoji: '📈', desc: 'Perlu pemahaman dasar' },
  { value: 'ADVANCE', label: 'Lanjutan',       emoji: '🚀', desc: 'Untuk yang sudah berpengalaman' },
]

interface Props {
  open: boolean
  onClose: () => void
}

export function TambahProgramModal({ open, onClose }: Props) {
  const [step, setStep] = useState<1 | 2>(1)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [levelCode, setLevelCode] = useState('ALL')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [isPending, startTransition] = useTransition()
  const titleRef = useRef<HTMLInputElement>(null)

  // Reset saat ditutup
  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setStep(1); setTitle(''); setDescription('')
        setLevelCode('ALL'); setError(null); setDone(false)
      }, 300)
    }
  }, [open])

  // Auto-focus title
  useEffect(() => {
    if (open && step === 1) {
      setTimeout(() => titleRef.current?.focus(), 100)
    }
  }, [open, step])

  function handleNext() {
    setError(null)
    if (!title.trim()) { setError('Judul program wajib diisi.'); return }
    if (title.trim().length < 3) { setError('Judul minimal 3 karakter.'); return }
    setStep(2)
  }

  function handleSubmit() {
    setError(null)
    const fd = new FormData()
    fd.set('title', title.trim())
    fd.set('description', description.trim())
    fd.set('levelCode', levelCode)

    startTransition(async () => {
      const result = await createLmsCourse(undefined, fd)
      if (result?.error) {
        setError(result.error)
        setStep(1)
      } else {
        setDone(true)
        setTimeout(() => onClose(), 1800)
      }
    })
  }

  const selectedLevel = LEVEL_OPTIONS.find(l => l.value === levelCode)!

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 20 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            className="w-full max-w-lg bg-white rounded-[32px] shadow-2xl overflow-hidden"
          >
            {/* ── Header ── */}
            <div className="relative bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 px-7 pt-7 pb-8">
              <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500 rounded-full blur-3xl opacity-15 -mr-16 -mt-16 pointer-events-none" />
              <button
                onClick={onClose}
                className="absolute top-5 right-5 w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white/60 hover:bg-white/20 hover:text-white transition-all"
              >
                <X size={16} />
              </button>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center">
                  <GraduationCap size={24} className="text-blue-300" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-400">Program Baru</p>
                  <h2 className="text-xl font-black text-white">Tambah Program Pelatihan</h2>
                </div>
              </div>

              {/* Step indicator */}
              <div className="mt-5 flex items-center gap-2">
                {[1, 2].map(s => (
                  <div key={s} className="flex items-center gap-2">
                    <div className={`flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-black transition-all ${
                      done ? 'bg-emerald-500 text-white' :
                      s < step ? 'bg-emerald-500 text-white' :
                      s === step ? 'bg-blue-500 text-white ring-2 ring-blue-300/40' :
                      'bg-white/10 text-white/40'
                    }`}>
                      {done || s < step ? <CheckCircle2 size={13} /> : s}
                    </div>
                    <span className={`text-[10px] font-bold uppercase tracking-widest transition-all ${
                      s === step && !done ? 'text-white' : 'text-white/40'
                    }`}>
                      {s === 1 ? 'Info Program' : 'Konfirmasi'}
                    </span>
                    {s < 2 && <div className="w-6 h-px bg-white/20" />}
                  </div>
                ))}
              </div>
            </div>

            {/* ── Body ── */}
            <div className="relative overflow-hidden">
              <AnimatePresence mode="wait">
                {done ? (
                  <motion.div
                    key="done"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center justify-center gap-4 px-7 py-10 text-center"
                  >
                    <div className="w-16 h-16 rounded-full bg-emerald-50 border-4 border-emerald-100 flex items-center justify-center">
                      <CheckCircle2 size={32} className="text-emerald-500" />
                    </div>
                    <div>
                      <p className="text-lg font-black text-slate-900">Program Berhasil Dibuat!</p>
                      <p className="text-sm text-slate-500 mt-1">
                        <span className="font-bold text-blue-600">{title}</span> sudah masuk katalog LMS.
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      <Loader2 size={12} className="animate-spin" /> Menutup...
                    </div>
                  </motion.div>
                ) : step === 1 ? (
                  <motion.div
                    key="step1"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                    className="px-7 py-6 space-y-5"
                  >
                    {/* Judul */}
                    <div>
                      <label className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2">
                        <BookOpen size={13} /> Judul Program <span className="text-rose-400">*</span>
                      </label>
                      <input
                        ref={titleRef}
                        value={title}
                        onChange={e => { setTitle(e.target.value); setError(null) }}
                        onKeyDown={e => e.key === 'Enter' && handleNext()}
                        placeholder="cth. Pelatihan Akuntansi Dasar"
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 placeholder-slate-300 outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50 transition-all"
                      />
                    </div>

                    {/* Deskripsi */}
                    <div>
                      <label className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2">
                        <AlignLeft size={13} /> Deskripsi <span className="text-slate-300 font-medium normal-case">(opsional)</span>
                      </label>
                      <textarea
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        placeholder="Jelaskan isi program, manfaat, dan target peserta..."
                        rows={3}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 placeholder-slate-300 outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50 transition-all resize-none"
                      />
                    </div>

                    {/* Level */}
                    <div>
                      <label className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2">
                        <Tag size={13} /> Level Peserta
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {LEVEL_OPTIONS.map(opt => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setLevelCode(opt.value)}
                            className={`flex items-start gap-3 p-3.5 rounded-2xl border text-left transition-all ${
                              levelCode === opt.value
                                ? 'border-blue-400 bg-blue-50 ring-2 ring-blue-100'
                                : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white'
                            }`}
                          >
                            <span className="text-xl leading-none mt-0.5">{opt.emoji}</span>
                            <div>
                              <p className={`text-xs font-black ${levelCode === opt.value ? 'text-blue-700' : 'text-slate-700'}`}>
                                {opt.label}
                              </p>
                              <p className="text-[10px] text-slate-400 font-medium mt-0.5">{opt.desc}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {error && (
                      <p className="text-xs font-bold text-rose-500 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">
                        ⚠ {error}
                      </p>
                    )}

                    <div className="flex gap-3 pt-1">
                      <button
                        onClick={onClose}
                        className="flex-1 rounded-2xl border border-slate-200 py-3 text-sm font-bold text-slate-500 hover:bg-slate-50 transition-colors"
                      >
                        Batal
                      </button>
                      <button
                        onClick={handleNext}
                        disabled={!title.trim()}
                        className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-slate-900 py-3 text-sm font-bold text-white hover:bg-blue-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-slate-200"
                      >
                        Lanjut <ChevronRight size={16} />
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="step2"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.2 }}
                    className="px-7 py-6 space-y-5"
                  >
                    {/* Preview card */}
                    <div className="rounded-2xl bg-gradient-to-br from-slate-50 to-blue-50/40 border border-slate-200 p-5 space-y-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Ringkasan Program</p>

                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl bg-blue-100 border border-blue-200 flex items-center justify-center shrink-0">
                          <span className="text-2xl">{selectedLevel.emoji}</span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-black text-slate-900 text-base leading-tight">{title}</p>
                          {description && (
                            <p className="text-xs text-slate-500 mt-1 line-clamp-2">{description}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2 flex-wrap">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-blue-700">
                          <Tag size={10} /> {selectedLevel.label}
                        </span>
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-700">
                          <Sparkles size={10} /> Aktif setelah disimpan
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-400 font-medium">
                      Program akan langsung masuk katalog sebagai <strong className="text-slate-600">aktif</strong>. Anda dapat menambahkan materi dan batch dari halaman Manajemen Katalog.
                    </p>

                    {error && (
                      <p className="text-xs font-bold text-rose-500 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">
                        ⚠ {error}
                      </p>
                    )}

                    <div className="flex gap-3 pt-1">
                      <button
                        onClick={() => setStep(1)}
                        disabled={isPending}
                        className="flex items-center gap-1.5 rounded-2xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-500 hover:bg-slate-50 transition-colors disabled:opacity-40"
                      >
                        <ArrowLeft size={14} /> Edit
                      </button>
                      <button
                        onClick={handleSubmit}
                        disabled={isPending}
                        className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-blue-600 py-3 text-sm font-bold text-white hover:bg-blue-700 transition-all disabled:opacity-50 shadow-lg shadow-blue-200"
                      >
                        {isPending ? (
                          <><Loader2 size={16} className="animate-spin" /> Menyimpan...</>
                        ) : (
                          <><CheckCircle2 size={16} /> Buat Program</>
                        )}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
