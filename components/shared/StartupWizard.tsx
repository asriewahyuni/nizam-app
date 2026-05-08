'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { 
  CheckCircle2, 
  ChevronRight, 
  X,
  CreditCard,
  Building,
  TrendingUp,
  Sparkles,
  ArrowRight
} from 'lucide-react'
import Link from 'next/link'
import {
  STARTUP_WIZARD_HIDE_STORAGE_KEY,
  STARTUP_WIZARD_VISIBILITY_EVENT,
  isStartupWizardHiddenInBrowser,
  setStartupWizardHiddenInBrowser,
} from '@/lib/startup-wizard/preferences'

const WIZARD_STEPS = [
  {
    id: 'setup',
    title: '1. Buat Kas/Bank',
    description: 'Klik "Rekening", hubungkan ke Akun GL (e.g. 1101 - Kas Besar).',
    detail: 'Nanti anda gunakan ini sebagai "dompet" utama bisnis Anda.',
    icon: Building,
    href: '/cash'
  },
  {
    id: 'capital',
    title: '2. Input Modal Awal',
    description: 'Klik "Transaksi MASUK", lawan jurnal ke akun (3001 - Modal Disetor).',
    detail: 'Uang masuk ke Kas/Bank tadi dari kantong pribadi/investor Anda.',
    icon: CreditCard,
    href: '/cash'
  },
  {
    id: 'product',
    title: '3. Persiapan Stok',
    description: 'Klik "Tambah Produk", masukkan Harga Beli (HPP) & Harga Jual.',
    detail: 'Hubungkan ke Akun (1301 - Persediaan) agar stok terhitung otomatis.',
    icon: Sparkles,
    href: '/inventory'
  },
  {
    id: 'sales',
    title: '4. Mulai Berjualan',
    description: 'Klik "Penjualan Baru", lalu klik "Mark as Paid" saat sudah dibayar.',
    detail: 'Sistem otomatis memindahkan Stok ke Penjualan & mencatat margin laba.',
    icon: TrendingUp,
    href: '/sales'
  },
  {
    id: 'report',
    title: '5. Pantau Arus Kas',
    description: 'Klik menu "Laporan", lalu pilih tab "Arus Kas".',
    detail: 'Monitor OCF Anda untuk memastikan bisnis benar-benar profit tunai.',
    icon: CheckCircle2,
    href: '/reports'
  }
]

export function StartupWizard({
  isDemo = false,
  enabled = true,
}: {
  isDemo?: boolean
  enabled?: boolean
}) {
  const [isVisible, setIsVisible] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)

  React.useEffect(() => {
    const syncVisibility = () => {
      setIsVisible(!isStartupWizardHiddenInBrowser())
    }

    const handleVisibilityChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ hidden?: boolean }>
      if (typeof customEvent.detail?.hidden === 'boolean') {
        setIsVisible(!customEvent.detail.hidden)
        return
      }

      syncVisibility()
    }

    const handleStorage = (event: StorageEvent) => {
      if (
        event.key &&
        event.key !== STARTUP_WIZARD_HIDE_STORAGE_KEY
      ) {
        return
      }

      syncVisibility()
    }

    syncVisibility()
    window.addEventListener(STARTUP_WIZARD_VISIBILITY_EVENT, handleVisibilityChange as EventListener)
    window.addEventListener('storage', handleStorage)

    return () => {
      window.removeEventListener(STARTUP_WIZARD_VISIBILITY_EVENT, handleVisibilityChange as EventListener)
      window.removeEventListener('storage', handleStorage)
    }
  }, [])

  const handleClose = () => {
    setStartupWizardHiddenInBrowser(true)
  }

  if (!enabled || !isVisible || isDemo) return null

  return (
    <motion.div 
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      className="print:hidden bg-white border-b border-slate-100 overflow-hidden relative"
    >
      <div className="max-w-7xl mx-auto px-8 py-4">
        <div className="flex items-center justify-between gap-8">
           <div className="flex items-center gap-6 flex-1 overflow-x-auto no-scrollbar py-2">
             {WIZARD_STEPS.map((step, idx) => {
               const isActive = idx === currentStep
               const isDone = idx < currentStep

               return (
                 <React.Fragment key={step.id}>
                    <div 
                      onClick={() => setCurrentStep(idx)}
                      className={`flex items-center gap-3 shrink-0 cursor-pointer transition-all ${isActive ? 'opacity-100 scale-100' : 'opacity-40 hover:opacity-60 scale-95'}`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${isActive ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200' : isDone ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                        {isDone ? <CheckCircle2 size={16} /> : <span className="text-xs font-black">{idx + 1}</span>}
                      </div>
                      <div className="flex flex-col">
                        <span className={`text-[11px] font-black uppercase tracking-widest ${isActive ? 'text-slate-900' : 'text-slate-500'}`}>{step.title}</span>
                        {isActive && (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-medium text-slate-500 leading-tight">{step.description}</span>
                            <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md w-fit mt-1">{step.detail}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    {idx < WIZARD_STEPS.length - 1 && (
                      <ChevronRight size={14} className="text-slate-200 shrink-0" />
                    )}
                 </React.Fragment>
               )
             })}
           </div>

           <div className="flex items-center gap-3 shrink-0 pl-6 border-l border-slate-100">
              <Link
                href={WIZARD_STEPS[currentStep].href}
                className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-[11px] font-bold hover:bg-black transition-all group"
              >
                Mulai {WIZARD_STEPS[currentStep].title}
                <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform" />
              </Link>
               <button 
                 onClick={handleClose}
                 className="p-2 text-slate-300 hover:text-slate-600 transition-colors"
                 title="Tutup & Jangan Tampilkan Lagi"
               >
                 <X size={16} />
               </button>
           </div>
        </div>
      </div>
      
      {/* Progress Bar (at the bottom of the section) */}
      <div className="absolute bottom-0 left-0 w-full h-[2px] bg-slate-50">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${((currentStep + 1) / WIZARD_STEPS.length) * 100}%` }}
          className="h-full bg-emerald-500"
        />
      </div>
    </motion.div>
  )
}
