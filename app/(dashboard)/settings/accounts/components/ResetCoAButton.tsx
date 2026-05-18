'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, AlertTriangle, Loader2, RotateCcw } from 'lucide-react'
import { resetCoAAction } from '@/modules/accounting/actions/coa-reset.actions'
import { motion, AnimatePresence } from 'framer-motion'

export default function ResetCoAButton() {
  const router = useRouter()
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleReset() {
    setLoading(true)
    setError('')

    try {
      const result = await resetCoAAction()
      if (result.success) {
        setShowConfirm(false)
        router.refresh()
        // Show success message
        setTimeout(() => {
          alert(`✅ CoA berhasil direset. ${result.deletedCount || 0} akun dihapus.`)
        }, 500)
      } else {
        setError(result.error || 'Gagal reset CoA')
      }
    } catch {
      setError('Terjadi kesalahan saat reset CoA')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowConfirm(true)}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 transition-all"
        title="Hapus semua akun non-sistem dan reset CoA ke state awal"
      >
        <RotateCcw size={16} />
        Reset CoA
      </button>

      <AnimatePresence>
        {showConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !loading && setShowConfirm(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl p-8"
            >
              {/* Header */}
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center">
                  <AlertTriangle size={32} />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-slate-900 tracking-tight">Reset Chart of Accounts?</h3>
                  <p className="text-sm text-slate-500 font-medium mt-2">
                    Semua akun yang Anda buat (non-sistem) akan dihapus dan CoA kembali ke state kosong.
                  </p>
                </div>
              </div>

              {/* Warning */}
              <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex gap-3">
                  <Trash2 className="text-amber-600 flex-shrink-0 mt-0.5" size={18} />
                  <div className="text-sm text-amber-800">
                    <strong>Syarat:</strong>
                    <ul className="mt-1 space-y-1 text-xs">
                      <li>• Harus TIDAK ada transaksi (journal entries)</li>
                      <li>• Akun sistem tetap tersimpan</li>
                      <li>• Tidak bisa dibatalkan</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Error message */}
              {error && (
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3">
                  <p className="text-xs text-red-700 font-medium">{error}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-col gap-2 mt-6">
                <button
                  onClick={handleReset}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 disabled:opacity-50 transition-all"
                >
                  {loading ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Resetting...
                    </>
                  ) : (
                    <>
                      <Trash2 size={18} />
                      Ya, Reset CoA
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowConfirm(false)}
                  disabled={loading}
                  className="w-full px-4 py-3 rounded-lg border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 disabled:opacity-50 transition-all"
                >
                  Batal
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
