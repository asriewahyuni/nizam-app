'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertCircle, CheckCircle, Eye, EyeOff, KeyRound, Lock, X } from 'lucide-react'
import { updateMyPassword } from '@/modules/auth/actions/auth.actions'

interface ChangePasswordModalProps {
  open: boolean
  onClose: () => void
}

export function ChangePasswordModal({ open, onClose }: ChangePasswordModalProps) {
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [showNewPwd, setShowNewPwd] = useState(false)
  const [showConfirmPwd, setShowConfirmPwd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const reset = () => {
    setNewPwd('')
    setConfirmPwd('')
    setShowNewPwd(false)
    setShowConfirmPwd(false)
    setError(null)
    setSuccess(false)
  }

  const handleClose = () => {
    if (saving) return
    reset()
    onClose()
  }

  const handleSubmit = async () => {
    if (newPwd.length < 8) return setError('Password minimal 8 karakter.')
    if (newPwd !== confirmPwd) return setError('Konfirmasi password tidak cocok.')

    setError(null)
    setSaving(true)
    const res = await updateMyPassword(newPwd)
    setSaving(false)

    if (res.error) {
      setError(res.error)
      return
    }

    setSuccess(true)
    setTimeout(() => {
      reset()
      onClose()
    }, 1400)
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
            onClick={handleClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 30 }}
            className="relative bg-white w-full max-w-md rounded-xl shadow-md overflow-hidden text-slate-900"
          >
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2.5">
                <KeyRound size={20} className="text-amber-500" /> Ganti Password
              </h3>
              <button
                type="button"
                onClick={handleClose}
                className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {success ? (
                <div className="flex flex-col items-center gap-3 py-6 text-center">
                  <CheckCircle size={36} className="text-emerald-500" />
                  <p className="text-sm font-semibold text-slate-700">Password berhasil diperbarui!</p>
                </div>
              ) : (
                <>
                  {[
                    { label: 'Password Baru', value: newPwd, setter: setNewPwd, show: showNewPwd, toggle: () => setShowNewPwd(v => !v) },
                    { label: 'Konfirmasi Password', value: confirmPwd, setter: setConfirmPwd, show: showConfirmPwd, toggle: () => setShowConfirmPwd(v => !v) },
                  ].map(field => (
                    <div key={field.label} className="space-y-2">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide ml-1">{field.label}</label>
                      <div className="relative">
                        <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                        <input
                          type={field.show ? 'text' : 'password'}
                          value={field.value}
                          onChange={e => field.setter(e.target.value)}
                          placeholder="••••••••"
                          autoFocus={field.label === 'Password Baru'}
                          className="w-full pl-11 pr-11 py-3 rounded-xl border border-slate-100 bg-slate-50 text-sm font-semibold text-slate-700 focus:bg-white focus:border-amber-400 outline-none transition-colors"
                        />
                        <button
                          type="button"
                          onClick={field.toggle}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-600 cursor-pointer"
                        >
                          {field.show ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>
                  ))}

                  {error && (
                    <p className="text-[11px] text-rose-500 font-bold flex items-center gap-1.5 ml-1">
                      <AlertCircle size={12} /> {error}
                    </p>
                  )}
                  {!error && newPwd && newPwd.length < 8 && (
                    <p className="text-[11px] text-amber-500 font-bold flex items-center gap-1.5 ml-1">
                      <AlertCircle size={12} /> Minimal 8 karakter
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={saving || !newPwd || !confirmPwd}
                    className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold uppercase tracking-wide text-[11px] flex items-center justify-center gap-2 transition-colors cursor-pointer active:scale-[0.98]"
                  >
                    {saving ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Lock size={16} />
                    )}
                    {saving ? 'Memperbarui...' : 'Ubah Password'}
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
