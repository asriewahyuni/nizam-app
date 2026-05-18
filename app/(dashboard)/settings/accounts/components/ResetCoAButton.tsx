'use client'

import { useState } from 'react'
import { RotateCcw, Loader2, AlertTriangle } from 'lucide-react'
import { resetCoAAction } from '@/modules/accounting/actions/coa-reset.actions'
import { motion, AnimatePresence } from 'framer-motion'

export default function ResetCoAButton() {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [confirmText, setConfirmText] = useState('')

  const CONFIRM_KEYWORD = 'RESET'
  const isConfirmed = confirmText.trim().toUpperCase() === CONFIRM_KEYWORD

  const handleReset = async () => {
    if (!isConfirmed) return
    setLoading(true)
    const res = await resetCoAAction()
    setLoading(false)
    if ('error' in res && res.error) {
      alert(res.error)
      setIsOpen(false)
      setConfirmText('')
    } else {
      window.location.reload()
    }
  }

  const handleClose = () => {
    if (loading) return
    setIsOpen(false)
    setConfirmText('')
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-rose-200 text-rose-600 bg-rose-50 hover:bg-rose-100 transition-all"
        title="Reset seluruh CoA ke standar PSAK"
      >
        <RotateCcw size={13} />
        Reset CoA
      </button>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleClose}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl p-8 overflow-hidden"
            >
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center">
                  <AlertTriangle size={32} />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-slate-900 tracking-tight">Reset CoA?</h3>
                  <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                    Seluruh akun CoA akan <strong className="text-slate-700">dihapus permanen</strong> dan diganti ulang dengan standar <strong className="text-slate-700">PSAK</strong>.
                  </p>
                  <p className="text-xs text-rose-500 font-semibold mt-2">
                    Tidak bisa dilakukan jika sudah ada transaksi. Tindakan ini tidak dapat dibatalkan.
                  </p>
                </div>

                <div className="w-full pt-2">
                  <label className="block text-xs font-medium text-slate-500 text-left mb-1.5">
                    Ketik <span className="font-bold text-slate-800">{CONFIRM_KEYWORD}</span> untuk mengkonfirmasi
                  </label>
                  <input
                    type="text"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    disabled={loading}
                    placeholder={CONFIRM_KEYWORD}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm text-center font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-rose-300 disabled:opacity-50"
                  />
                </div>

                <div className="flex flex-col w-full gap-2 pt-2">
                  <button
                    disabled={loading || !isConfirmed}
                    onClick={handleReset}
                    className="w-full py-3.5 bg-rose-600 text-white font-bold rounded-2xl flex items-center justify-center gap-2 hover:bg-rose-700 transition shadow-xl shadow-rose-200/50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {loading ? <Loader2 className="animate-spin" size={20} /> : <><RotateCcw size={16} /> Reset & Seed Ulang PSAK</>}
                  </button>
                  <button
                    disabled={loading}
                    onClick={handleClose}
                    className="w-full py-3 text-slate-500 font-bold rounded-xl hover:bg-slate-50 transition"
                  >
                    Batal
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
