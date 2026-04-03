'use client'

import React, { useState, useTransition } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Coins, 
  Target, 
  PieChart, 
  Activity, 
  Plus, 
  Save, 
  Calendar,
  ChevronRight,
  ChevronDown,
  AlertCircle,
  TrendingDown,
  TrendingUp,
  History,
  ArrowRight,
  Filter,
  Package,
  FileText,
  CheckCircle2
} from 'lucide-react'
import { formatRupiah, formatDate } from '@/lib/utils'
import { saveBudget } from '@/modules/accounting/actions/budget.actions'
import { useRouter, useSearchParams } from 'next/navigation'

interface BudgetClientProps {
  orgId: string
  activeBranchId?: string | null
  activeBranchName?: string | null
  allowAllBranchSelection?: boolean
  initialBudgets: any[]
  reportData: any[]
  accounts: any[]
  currentPeriod: string
}

export function BudgetClient({
  orgId,
  activeBranchId = null,
  activeBranchName = null,
  allowAllBranchSelection = false,
  initialBudgets,
  reportData,
  accounts,
  currentPeriod,
}: BudgetClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [activeTab, setActiveTab] = useState<'EDIT' | 'ANALYSIS'>('ANALYSIS')
  const canEditBudget = Boolean(activeBranchId)
  const scopeLabel = activeBranchName || (allowAllBranchSelection ? 'Semua Unit' : 'Unit belum dipilih')
  const branchGuardMessage = 'Pilih satu unit aktif terlebih dahulu untuk mengelola budget.'
  
  // Local state for editing amounts
  const [editMap, setEditMap] = useState<Record<string, number>>(
    initialBudgets.reduce((acc, b) => ({ ...acc, [b.account_id]: Number(b.budget_amount) }), {})
  )

  const handleSave = async (accountId: string, amount: number) => {
    if (!canEditBudget) {
      window.alert(branchGuardMessage)
      return
    }

    startTransition(async () => {
       const result = await saveBudget(orgId, accountId, currentPeriod, amount)
       if ((result as any)?.error) {
         window.alert((result as any).error)
         return
       }
       router.refresh()
    })
  }

  const updatePeriod = (p: string) => {
    const params = new URLSearchParams(searchParams)
    params.set('period', p)
    router.push(`/accounting/budgets?${params.toString()}`)
  }

  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.05 } }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-12 pb-20 animate-in fade-in duration-1000">
      
      {/* Strategic Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div className="space-y-2">
          <div className="flex items-center gap-3 text-emerald-600 font-black tracking-widest text-[10px] uppercase bg-emerald-50 w-fit px-4 py-2 rounded-full border border-emerald-100 mb-2">
             <Target size={14} />
             Financial Planning Unit
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight tracking-tighter">Budgeting & Analysis</h1>
          <p className="text-slate-500 font-medium">Kendalikan pengeluaran operasional dengan pagu anggaran yang terukur.</p>
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border text-[10px] font-black uppercase tracking-widest ${
            activeBranchName
              ? 'bg-blue-50 text-blue-700 border-blue-100'
              : 'bg-amber-50 text-amber-700 border-amber-100'
          }`}>
            <Package size={12} />
            {scopeLabel}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm print:hidden">
            <button 
              onClick={() => setActiveTab('ANALYSIS')}
              className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'ANALYSIS' ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Realisasi Anggaran
            </button>
            <button 
              onClick={() => {
                if (!canEditBudget) {
                  window.alert(branchGuardMessage)
                  return
                }
                setActiveTab('EDIT')
              }}
              disabled={!canEditBudget}
              className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${
                activeTab === 'EDIT'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                  : canEditBudget
                    ? 'text-slate-500 hover:text-slate-800'
                    : 'text-slate-300 cursor-not-allowed'
              }`}
            >
              Alokasi Budget
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-2 flex items-center gap-3">
             <Calendar size={16} className="text-slate-400 ml-2" />
             <input 
               type="month" 
               value={currentPeriod.slice(0, 7)}
               onChange={(e) => updatePeriod(`${e.target.value}-01`)}
               className="text-sm font-black text-slate-700 outline-none pr-3"
             />
          </div>
        </div>
      </div>

      {!canEditBudget && (
        <div className="rounded-[32px] border border-amber-200 bg-amber-50 px-6 py-5 flex items-start gap-4">
          <AlertCircle className="text-amber-600 mt-0.5" size={18} />
          <div className="space-y-1">
            <p className="text-sm font-black text-amber-900 uppercase tracking-widest">Mode Read-Only</p>
            <p className="text-sm font-medium text-amber-800">
              Pilih satu unit aktif terlebih dahulu untuk menyusun atau mengubah budget. Dalam mode ini data masih tampil sebagai ringkasan {scopeLabel.toLowerCase()}.
            </p>
          </div>
        </div>
      )}

      <AnimatePresence mode="wait">
        {activeTab === 'ANALYSIS' ? (
          <motion.div 
            key="analysis"
            variants={container}
            initial="hidden"
            animate="show"
            className="space-y-12"
          >
            {/* Analysis Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
               {reportData.map((row) => {
                  const percent = Math.min(100, Math.max(0, (row.actual_amount / row.budget_amount) * 100))
                  const isOver = row.actual_amount > row.budget_amount
                  
                  return (
                    <motion.div 
                      key={row.account_code} 
                      className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm hover:border-blue-200 transition-all group"
                    >
                       <div className="flex justify-between items-start mb-6">
                          <div>
                             <p className="text-[10px] font-black text-slate-400 tracking-widest uppercase">{row.account_code}</p>
                             <h4 className="font-black text-slate-900 group-hover:text-blue-600 transition-colors uppercase italic tracking-tighter">{row.account_name}</h4>
                          </div>
                          {isOver ? (
                            <div className="text-rose-500 flex flex-col items-end">
                               <AlertCircle size={20} />
                               <span className="text-[9px] font-black uppercase mt-1">Exceeded</span>
                            </div>
                          ) : (
                            <div className="text-emerald-500 flex flex-col items-end">
                               <CheckCircle2 size={20} />
                               <span className="text-[9px] font-black uppercase mt-1">Safe</span>
                            </div>
                          )}
                       </div>

                       <div className="space-y-5">
                          <div className="flex justify-between items-end">
                             <div className="space-y-1">
                                <p className="text-[9px] font-bold text-slate-300 uppercase">Actual Spend</p>
                                <p className="text-lg font-black text-slate-900">{formatRupiah(row.actual_amount)}</p>
                             </div>
                             <div className="text-right">
                                <p className="text-[9px] font-bold text-slate-300 uppercase">Budget Goal</p>
                                <p className="text-xs font-black text-slate-500">{formatRupiah(row.budget_amount)}</p>
                             </div>
                          </div>

                          <div className="relative h-2 bg-slate-50 rounded-full overflow-hidden">
                             <motion.div 
                               initial={{ width: 0 }}
                               animate={{ width: `${percent}%` }}
                               className={`h-full rounded-full ${isOver ? 'bg-rose-500' : 'bg-blue-500'} shadow-[0_0_15px_rgba(99,102,241,0.3)]`}
                             />
                          </div>

                          <div className="flex justify-between items-center bg-slate-50/50 p-4 rounded-2xl">
                             <span className="text-[10px] font-black text-slate-400 tracking-widest uppercase">Realization</span>
                             <span className={`text-sm font-black ${isOver ? 'text-rose-600' : 'text-blue-600'}`}>{percent.toFixed(1)}%</span>
                          </div>
                       </div>
                    </motion.div>
                  )
               })}
            </div>
            {reportData.length === 0 && (
              <div className="py-32 text-center bg-white rounded-[50px] border-2 border-dashed border-slate-100 italic font-bold text-slate-300 uppercase tracking-widest">
                 No budget realization data for this period.
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div 
            key="edit"
            className="bg-white rounded-[50px] border border-slate-100 shadow-sm overflow-hidden"
          >
             {!canEditBudget ? (
               <div className="p-16 text-center space-y-4">
                 <AlertCircle size={28} className="mx-auto text-amber-500" />
                 <h3 className="text-xl font-black text-slate-900 tracking-tight">Pilih Unit Aktif</h3>
                 <p className="text-sm font-medium text-slate-500 max-w-xl mx-auto">
                   Budget sekarang disimpan per unit. Pilih satu unit aktif dari header sebelum melakukan alokasi budget bulanan.
                 </p>
               </div>
             ) : (
              <>
                <div className="p-10 border-b border-slate-50 flex justify-between items-center">
                  <h3 className="text-2xl font-black text-slate-900 flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
                      <Plus size={24} />
                    </div>
                    Input Alokasi Bulanan
                  </h3>
                  <div className="flex items-center gap-3 text-xs font-black text-slate-400 bg-slate-50 px-5 py-2 rounded-2xl">
                    <Filter size={14} /> Only Income & Expense Recommended
                  </div>
                </div>

                <div className="p-10">
                  <div className="grid grid-cols-1 gap-4">
                    {accounts.filter(a => ['REVENUE', 'EXPENSE', 'COGS'].includes(a.type) || a.code.startsWith('4') || a.code.startsWith('5') || a.code.startsWith('6')).map((a) => (
                      <div key={a.id} className="flex flex-col md:flex-row md:items-center gap-6 p-6 hover:bg-slate-50 rounded-[32px] transition-all group">
                        <div className="w-64">
                          <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">{a.code}</p>
                          <p className="font-black text-slate-800 uppercase italic group-hover:text-blue-600 transition-colors truncate">{a.name}</p>
                        </div>
                        <div className="flex-1">
                          <div className="relative group/input">
                            <input
                              type="number"
                              placeholder="IDR 0,00"
                              defaultValue={editMap[a.id]}
                              onBlur={(e) => handleSave(a.id, Number(e.target.value))}
                              className="w-full bg-slate-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-2xl px-6 py-4 text-sm font-black outline-none transition-all placeholder:text-slate-300"
                            />
                            <div className="absolute right-6 top-1/2 -translate-y-1/2 flex items-center gap-2 opacity-0 group-focus-within/input:opacity-100 transition-opacity">
                              <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest italic tracking-tighter">Auto-saving...</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
             )}
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  )
}
