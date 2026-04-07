'use client'

import React, { useState, useTransition } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Target, 
  Plus, 
  Calendar,
  AlertCircle,
  Filter,
  Package,
  CheckCircle2,
  Save
} from 'lucide-react'
import { formatRupiah } from '@/lib/utils'
import type { BudgetPeriodStatus } from '@/modules/accounting/actions/budget.actions'
import { saveBudget } from '@/modules/accounting/actions/budget.actions'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import type { Account } from '@/types/database.types'

type BudgetEntry = {
  account_id: string
  budget_amount: number | string
}

type BudgetReportRow = {
  account_id: string
  account_code: string
  account_name: string
  budget_amount: number
  actual_amount: number
}

type BudgetAccount = Pick<Account, 'id' | 'code' | 'name'> & {
  type: string
  description?: string | null
}

function getAllocationCategory(account: BudgetAccount) {
  if (account.type === 'REVENUE' || account.code.startsWith('4')) return 'Pendapatan'
  if (account.type === 'COGS' || account.code.startsWith('5')) return 'Biaya Pokok'
  if (account.type === 'EXPENSE' || account.code.startsWith('6')) return 'Beban Operasional'
  return 'Anggaran'
}

function getAllocationDescription(account: BudgetAccount) {
  const customDescription = String(account.description || '').trim()
  if (customDescription) return customDescription

  if (account.type === 'REVENUE' || account.code.startsWith('4')) {
    return 'Tetapkan target pendapatan bulanan yang ingin dicapai pada akun ini.'
  }

  if (account.type === 'COGS' || account.code.startsWith('5')) {
    return 'Batasi biaya pokok atau biaya langsung agar realisasi tetap terkendali.'
  }

  if (account.type === 'EXPENSE' || account.code.startsWith('6')) {
    return 'Tentukan pagu beban operasional bulanan untuk menjaga efisiensi pengeluaran.'
  }

  return 'Tetapkan alokasi budget bulanan untuk akun ini.'
}

function formatVarianceLabel(amount: number) {
  if (amount === 0) return formatRupiah(0)
  return `${amount > 0 ? '+' : '-'}${formatRupiah(Math.abs(amount))}`
}

interface BudgetClientProps {
  orgId: string
  activeBranchId?: string | null
  activeBranchName?: string | null
  allowAllBranchSelection?: boolean
  initialBudgets: BudgetEntry[]
  reportData: BudgetReportRow[]
  accounts: BudgetAccount[]
  currentPeriod: string
  periodStatus?: BudgetPeriodStatus | null
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
  periodStatus = null,
}: BudgetClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [activeTab, setActiveTab] = useState<'EDIT' | 'ANALYSIS'>('ANALYSIS')
  const [savingAccountId, setSavingAccountId] = useState<string | null>(null)
  const safePeriodStatus: BudgetPeriodStatus = periodStatus ?? {
    periodDate: currentPeriod,
    fiscalPeriodId: null,
    fiscalPeriodName: null,
    isClosed: false,
  }
  const hasActiveBranch = Boolean(activeBranchId)
  const isPeriodClosed = safePeriodStatus.isClosed
  const canEditBudget = hasActiveBranch && !isPeriodClosed
  const scopeLabel = activeBranchName || (allowAllBranchSelection ? 'Semua Unit' : 'Unit belum dipilih')
  const branchGuardMessage = 'Pilih satu unit aktif terlebih dahulu untuk mengelola budget.'
  const periodLockMessage = safePeriodStatus.fiscalPeriodName
    ? `Periode fiskal ${safePeriodStatus.fiscalPeriodName} sudah ditutup. Budget untuk periode ini terkunci.`
    : 'Periode fiskal untuk bulan ini sudah ditutup. Budget untuk periode ini terkunci.'
  const readOnlyBudgetHint = allowAllBranchSelection
    ? 'Pilih satu unit aktif dari header untuk membuka form input budget bulanan.'
    : 'Akses unit aktif belum tersedia untuk akun ini, sehingga budget hanya bisa dilihat.'
  const budgetableAccounts = accounts.filter((account) =>
    ['REVENUE', 'EXPENSE', 'COGS'].includes(account.type) ||
    account.code.startsWith('4') ||
    account.code.startsWith('5') ||
    account.code.startsWith('6')
  )
  const hasBudgetableAccounts = budgetableAccounts.length > 0
  
  // Local state for editing amounts
  const [editMap, setEditMap] = useState<Record<string, string>>(
    initialBudgets.reduce(
      (acc, b) => ({ ...acc, [b.account_id]: String(Number(b.budget_amount)) }),
      {} as Record<string, string>
    )
  )
  const savedBudgetByAccount = initialBudgets.reduce((acc, budget) => {
    acc[budget.account_id] = Number(budget.budget_amount)
    return acc
  }, {} as Record<string, number>)
  const reportByAccount = reportData.reduce((acc, row) => {
    acc[row.account_id] = row
    return acc
  }, {} as Record<string, BudgetReportRow>)

  const handleSave = async (accountId: string) => {
    if (!hasActiveBranch) {
      window.alert(branchGuardMessage)
      return
    }

    if (isPeriodClosed) {
      window.alert(periodLockMessage)
      return
    }

    const rawAmount = String(editMap[accountId] ?? '').trim()
    const amount = rawAmount === '' ? 0 : Number(rawAmount)

    if (!Number.isFinite(amount)) {
      window.alert('Nilai budget tidak valid.')
      return
    }

    startTransition(async () => {
       setSavingAccountId(accountId)
       try {
         const result = await saveBudget(orgId, accountId, currentPeriod, amount)
         if ('error' in result) {
           window.alert(result.error)
           return
         }
         router.refresh()
       } finally {
         setSavingAccountId(null)
       }
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
          {isPeriodClosed && (
            <div className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-rose-700">
              <AlertCircle size={12} />
              Periode Terkunci
            </div>
          )}
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
              onClick={() => setActiveTab('EDIT')}
              className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${
                activeTab === 'EDIT'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                  : canEditBudget
                    ? 'text-slate-500 hover:text-slate-800'
                    : 'text-amber-700 hover:text-amber-800 bg-amber-50'
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

      {!hasActiveBranch && (
        <div className="rounded-[32px] border border-amber-200 bg-amber-50 px-6 py-5 flex items-start gap-4">
          <AlertCircle className="text-amber-600 mt-0.5" size={18} />
          <div className="space-y-1">
            <p className="text-sm font-black text-amber-900 uppercase tracking-widest">Mode Read-Only</p>
            <p className="text-sm font-medium text-amber-800">
              Pilih satu unit aktif terlebih dahulu untuk menyusun atau mengubah budget. Dalam mode ini data masih tampil sebagai ringkasan {scopeLabel.toLowerCase()}.
            </p>
            <p className="text-sm font-semibold text-amber-700">
              {readOnlyBudgetHint}
            </p>
          </div>
        </div>
      )}

      {isPeriodClosed && (
        <div className="rounded-[32px] border border-rose-200 bg-rose-50 px-6 py-5 flex items-start gap-4">
          <AlertCircle className="text-rose-600 mt-0.5" size={18} />
          <div className="space-y-1">
            <p className="text-sm font-black text-rose-900 uppercase tracking-widest">Periode Terkunci</p>
            <p className="text-sm font-medium text-rose-800">
              {periodLockMessage}
            </p>
            <p className="text-sm font-semibold text-rose-700">
              Anda masih bisa melihat realisasi anggaran, tetapi perubahan alokasi harus dilakukan setelah periode dibuka kembali dari menu Penutupan Buku.
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
             {!hasActiveBranch ? (
               <div className="p-16 text-center space-y-4">
                 <AlertCircle size={28} className="mx-auto text-amber-500" />
                 <h3 className="text-xl font-black text-slate-900 tracking-tight">Pilih Unit Aktif</h3>
                 <p className="text-sm font-medium text-slate-500 max-w-xl mx-auto">
                   Budget sekarang disimpan per unit. Pilih satu unit aktif dari header sebelum melakukan alokasi budget bulanan.
                 </p>
                 <p className="text-sm font-semibold text-amber-700 max-w-xl mx-auto">
                   {readOnlyBudgetHint}
                 </p>
               </div>
             ) : isPeriodClosed ? (
               <div className="p-16 text-center space-y-4">
                 <AlertCircle size={28} className="mx-auto text-rose-500" />
                 <h3 className="text-xl font-black text-slate-900 tracking-tight">Periode Budget Terkunci</h3>
                 <p className="text-sm font-medium text-slate-500 max-w-xl mx-auto">
                   {periodLockMessage}
                 </p>
                 <p className="text-sm font-semibold text-rose-700 max-w-xl mx-auto">
                   Buka kembali periode terkait dari menu Penutupan Buku jika Anda perlu mengubah alokasi budget bulan ini.
                 </p>
                 <div className="pt-2">
                   <Link
                     href="/accounting/closing"
                     className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-5 py-3 text-sm font-black text-white shadow-lg shadow-slate-100 transition hover:bg-slate-800"
                   >
                     Buka Menu Penutupan Buku
                   </Link>
                 </div>
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
                  {hasBudgetableAccounts ? (
                    <div className="grid grid-cols-1 gap-4">
                      <div className="rounded-[32px] border border-blue-100 bg-blue-50/70 px-6 py-5">
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-700">Info Realisasi</p>
                        <p className="mt-2 text-sm font-medium leading-relaxed text-blue-900">
                          Tab ini hanya untuk menyimpan pagu budget. Pembayaran yang sudah dicatat tidak mengubah angka alokasi di form ini, dan akan muncul pada tab
                          {' '}
                          <span className="font-black">Realisasi Anggaran</span>
                          {' '}
                          setelah jurnal berstatus
                          {' '}
                          <span className="font-black">POSTED</span>
                          {' '}
                          ke akun dan unit yang sama.
                        </p>
                      </div>
                      {budgetableAccounts.map((account) => {
                        const reportRow = reportByAccount[account.id]
                        const savedBudgetAmount = reportRow?.budget_amount ?? savedBudgetByAccount[account.id] ?? 0
                        const actualAmount = reportRow?.actual_amount ?? 0
                        const varianceAmount = actualAmount - savedBudgetAmount
                        const hasRealizationSnapshot = savedBudgetAmount !== 0 || actualAmount !== 0

                        return (
                          <div key={account.id} className="flex flex-col md:flex-row md:items-center gap-6 p-6 hover:bg-slate-50 rounded-[32px] transition-all group">
                            <div className="w-64">
                              <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">{account.code}</p>
                              <p className="font-black text-slate-800 uppercase italic group-hover:text-blue-600 transition-colors truncate">{account.name}</p>
                              <p className="mt-2 text-xs font-medium leading-relaxed text-slate-500">
                                {getAllocationDescription(account)}
                              </p>
                              <div className="mt-3 inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
                                {getAllocationCategory(account)}
                              </div>
                            </div>
                            <div className="flex-1">
                              <div className="relative">
                                <input
                                  type="number"
                                  placeholder="IDR 0,00"
                                  value={editMap[account.id] ?? ''}
                                  onChange={(e) => {
                                    setEditMap((current) => ({
                                      ...current,
                                      [account.id]: e.target.value,
                                    }))
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault()
                                      void handleSave(account.id)
                                    }
                                  }}
                                  className="w-full bg-slate-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-2xl px-6 py-4 text-sm font-black outline-none transition-all placeholder:text-slate-300"
                                />
                              </div>
                              <p className="mt-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                Tekan Enter atau klik Simpan untuk menyimpan alokasi.
                              </p>
                              {hasRealizationSnapshot ? (
                                <div className="mt-4 flex flex-wrap items-center gap-2">
                                  <div className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-600">
                                    Budget Tersimpan {formatRupiah(savedBudgetAmount)}
                                  </div>
                                  <div className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-blue-700">
                                    Realisasi {formatRupiah(actualAmount)}
                                  </div>
                                  <div className={`inline-flex items-center rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${
                                    varianceAmount > 0
                                      ? 'bg-rose-50 text-rose-700'
                                      : varianceAmount < 0
                                        ? 'bg-emerald-50 text-emerald-700'
                                        : 'bg-slate-100 text-slate-600'
                                  }`}>
                                    Selisih {formatVarianceLabel(varianceAmount)}
                                  </div>
                                </div>
                              ) : (
                                <p className="mt-4 text-xs font-medium text-slate-400">
                                  Belum ada realisasi yang terbaca untuk akun ini pada periode dan unit aktif.
                                </p>
                              )}
                            </div>
                            <div className="md:w-[148px]">
                              <button
                                type="button"
                                onClick={() => void handleSave(account.id)}
                                disabled={isPending && savingAccountId === account.id}
                                className={`inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-4 text-sm font-black transition-all ${
                                  isPending && savingAccountId === account.id
                                    ? 'cursor-wait bg-slate-200 text-slate-500'
                                    : 'bg-blue-600 text-white shadow-lg shadow-blue-100 hover:bg-blue-700'
                                }`}
                              >
                                <Save size={16} />
                                {isPending && savingAccountId === account.id ? 'Menyimpan...' : 'Simpan'}
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="rounded-[32px] border border-dashed border-slate-200 bg-slate-50 px-8 py-12 text-center space-y-4">
                      <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 flex items-center justify-center mx-auto text-slate-500">
                        <AlertCircle size={24} />
                      </div>
                      <div className="space-y-2 max-w-2xl mx-auto">
                        <h4 className="text-xl font-black text-slate-900 tracking-tight">Akun budget belum tersedia</h4>
                        <p className="text-sm font-medium text-slate-500">
                          Halaman ini hanya menampilkan akun pendapatan dan beban. Organisasi aktif Anda belum memiliki akun CoA yang bisa dialokasikan untuk budget.
                        </p>
                        <p className="text-sm font-semibold text-slate-600">
                          Buka pengaturan CoA untuk mengaktifkan atau melengkapi akun standar PSAK terlebih dahulu.
                        </p>
                      </div>
                      <div className="pt-2">
                        <Link
                          href="/settings/accounts"
                          className="inline-flex items-center justify-center rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-100 transition hover:bg-blue-700"
                        >
                          Buka Pengaturan CoA
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              </>
             )}
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  )
}
