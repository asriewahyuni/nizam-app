'use client'

// Reusable confirm-delete modal.
// Digunakan untuk menghapus course, batch, session, atau lesson.

import { motion, AnimatePresence } from 'framer-motion'
import { X, AlertTriangle, Loader2 } from 'lucide-react'

type Props = {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  labelConfirm?: string
  isPending?: boolean
}

export function ConfirmDeleteModal({
  open,
  onClose,
  onConfirm,
  title,
  message,
  labelConfirm = 'Ya, Hapus',
  isPending = false,
}: Props) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.15 }}
            className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-red-500" />
              </div>
              <button onClick={onClose} disabled={isPending} className="p-1 hover:bg-slate-100 rounded-xl transition-colors">
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>
            <h3 className="mt-4 text-lg font-semibold text-slate-900 tracking-tight">{title}</h3>
            <p className="mt-2 text-sm text-slate-500 leading-relaxed">{message}</p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={onClose}
                disabled={isPending}
                className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-all disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={onConfirm}
                disabled={isPending}
                className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 transition-all disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {labelConfirm}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
