'use client'

import React, { useState } from 'react'
import { Edit2, Trash2, Loader2, AlertTriangle } from 'lucide-react'
import { deleteAccount } from '@/modules/accounting/actions/coa.actions'
import { motion, AnimatePresence } from 'framer-motion'

interface AccountRowActionsProps {
  accountId: string
  orgId: string
  accountCode: string
  accountName: string
  isOwner?: boolean
}

export default function AccountRowActions({ accountId, orgId, accountCode, accountName, isOwner = false }: AccountRowActionsProps) {
  const [loading, setLoading] = useState(false)
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)

  const handleDelete = async () => {
    setLoading(true)
    const res = await deleteAccount(accountId, orgId)
    setLoading(false)
    
    if (res.error) {
      alert(res.error)
      setIsConfirmOpen(false)
    } else {
      window.location.reload()
    }
  }

  return (
    <div className="flex items-center gap-1">
      <a 
        href={`/settings/accounts/${accountId}`}
        className="p-2 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
        title="Edit Akun"
      >
        <Edit2 size={16} />
      </a>
      
      {isOwner && (
        <button
          onClick={() => setIsConfirmOpen(true)}
          className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all"
          title="Hapus Akun"
        >
          <Trash2 size={16} />
        </button>
      )}

      <AnimatePresence>
        {isConfirmOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => !loading && setIsConfirmOpen(false)}
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
                  <h3 className="text-xl font-semibold text-slate-900 tracking-tight">Hapus Akun?</h3>
                  <p className="text-sm text-slate-500 font-medium mt-1">
                     Anda akan menghapus <strong className="text-slate-800">[{accountCode}] {accountName}</strong>. 
                  </p>
                  <p className="text-[10px] text-rose-500 font-semibold tracking-tight mt-2">Tindakan ini tidak bisa dibatalkan.</p>
                </div>

                <div className="flex flex-col w-full gap-2 pt-4">
                  <button 
                    disabled={loading}
                    onClick={handleDelete}
                    className="w-full py-3.5 bg-rose-600 text-white font-bold rounded-2xl flex items-center justify-center gap-2 hover:bg-rose-700 transition shadow-xl shadow-rose-200/50 disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="animate-spin" size={20}/> : 'Ya, Hapus Permanen'}
                  </button>
                  <button 
                    disabled={loading}
                    onClick={() => setIsConfirmOpen(false)}
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
    </div>
  )
}
