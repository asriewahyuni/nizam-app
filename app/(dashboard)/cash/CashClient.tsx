'use client'

import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Plus, 
  ArrowUpRight, 
  ArrowDownRight, 
  ArrowRightLeft,
  ChevronRight,
  MoreVertical,
  AlertCircle,
  X,
  PlusCircle,
  Calendar,
  CreditCard,
  Building,
  Building2,
  Upload,
  FileText,
  Filter,
  Trash,
  Trash2,
  PiggyBank,
  Wallet,
  MoreHorizontal,
  TrendingUp,
  CheckCircle2,
  Search,
  History,
  TrendingDown,
  Activity,
  Download,
  CheckCircle,
  Hash,
  User,
  ExternalLink
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createBankAccount, createBankTransaction, deleteBankAccount, deleteBankTransaction } from '@/modules/cash/actions/bank.actions'
import { processBankCSV } from '@/modules/cash/actions/reconcile.actions'
import { BankTransaction, BankAccount, Account } from '@/types/database.types'
import { formatRupiah, formatDate } from '@/lib/utils'
import { CurrencyInput } from '@/components/ui/CurrencyInput'
import { PageHeader, StatCard, SectionCard, SectionHeader, StatusBadge, SafeButton } from '@/components/ui/NizamUI'

interface CashClientProps {
  orgId: string
  orgName: string
  activeBranchId: string | null
  activeBranchName: string | null
  bankAccounts: (BankAccount & {
    account: Account;
    balances?: { balance: number }
  })[]
  categoryAccounts: Account[]
  bankGlAccounts: Account[]
  recentTransactions: (BankTransaction & { bank_account: any; category: any })[]
  userRole: string
}

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } }
}

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
}

export function CashClient({
  orgId,
  orgName,
  activeBranchId,
  activeBranchName,
  bankAccounts,
  categoryAccounts,
  bankGlAccounts,
  recentTransactions,
  userRole,
}: CashClientProps) {
  const router = useRouter()
  const [showTransactionModal, setShowTransactionModal] = useState(false)
  const [showAccountModal, setShowAccountModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'reconcile'>('overview')
  const [selectedBankId, setSelectedBankId] = useState<string | null>(null)

  // Form states for transaction
  const [txType, setTxType] = useState<'IN' | 'OUT' | 'TRANSFER'>('OUT')
  const [txAmount, setTxAmount] = useState(0)
  const [txDescription, setTxDescription] = useState('')
  const [filterStatus, setFilterStatus] = useState<'POSTED' | 'VOIDED'>('POSTED')
  const [filterAccountId, setFilterAccountId] = useState<string | null>(null)
  const searchParams = useSearchParams()
  const isOwner = userRole === 'owner'
  const canWriteCash = Boolean(activeBranchId)

  useEffect(() => {
    const pay = searchParams.get('pay')
    const type = searchParams.get('type')
    const amount = searchParams.get('amount')
    const desc = searchParams.get('desc')

    if (pay) {
      if (type === 'IN' || type === 'OUT' || type === 'TRANSFER') setTxType(type)
      if (amount) setTxAmount(Number(amount))
      if (desc) setTxDescription(desc)
      setShowTransactionModal(true)
    }
  }, [searchParams])

  const handleCreateAccount = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const formData = new FormData(e.currentTarget)
    const res = await createBankAccount(orgId, formData)
    if (res?.error) setError(res.error)
    else {
      setSuccess('Rekening bank berhasil ditambahkan.')
      setShowAccountModal(false)
      setTimeout(() => setSuccess(null), 3000)
    }
    setLoading(false)
  }

  const handleCreateTransaction = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const formData = new FormData(e.currentTarget)
    const res = await createBankTransaction(orgId, formData)
    if (res?.error) setError(res.error)
    else {
      setSuccess('Transaksi berhasil dicatat.')
      setShowTransactionModal(false)
      setTxAmount(0)
      router.refresh()
      setTimeout(() => setSuccess(null), 3000)
    }
    setLoading(false)
  }

  const handleUploadCSV = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!selectedBankId) {
      setError('Pilih rekening bank tujuan terlebih dahulu.')
      return
    }
    setLoading(true)
    setError(null)
    const formData = new FormData(e.currentTarget)
    const file = formData.get('csv') as File
    if (!file || file.size === 0) {
      setError('Pilih file CSV mutasi.')
      setLoading(false)
      return
    }

    try {
      const text = await file.text()
      const res = await processBankCSV(orgId, selectedBankId, text)
      if ('error' in res) setError(res.error || 'Gagal memproses mutasi bank.')
      else {
        setSuccess(`${res.count} mutasi berhasil diunggah.`)
        setTimeout(() => setSuccess(null), 3000)
      }
    } catch (err: any) {
      setError('Gagal membaca file: ' + err.message)
    }
    setLoading(false)
  }

  const handleDeleteAccount = async (id: string, name: string) => {
    if (!confirm(`Hapus rekening "${name}"? Tindakan ini tidak bisa dibatalkan jika rekeing masih kosong.`)) return

    setLoading(true)
    const res = await deleteBankAccount(orgId, id)
    if (res?.error) setError(res.error)
    else {
      setSuccess('Rekening berhasil dihapus.')
      setTimeout(() => setSuccess(null), 3000)
    }
    setLoading(false)
  }

  const handleDeleteTransaction = async (id: string) => {
    if (!confirm('Hapus transaksi ini? Saldo buku besar akan disesuaikan otomatis.')) return
    setLoading(true)
    const res = await deleteBankTransaction(orgId, id)
    if (res?.error) setError(res.error)
    else {
      setSuccess('Transaksi berhasil dihapus.')
      router.refresh()
      setTimeout(() => setSuccess(null), 3000)
    }
    setLoading(false)
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-7xl mx-auto space-y-12 pb-24">
      <PageHeader
        icon={<Wallet />}
        title="Kas & Bank"
        subtitle={activeBranchName
          ? `Mutasi kas dan bank untuk unit aktif ${activeBranchName}.`
          : 'Mode semua unit aktif. Pilih unit spesifik untuk membuat rekening atau transaksi baru.'}
        tag="Cash Module"
        actions={
          <>
            <div className="flex bg-slate-100/60 p-1 rounded-2xl border border-slate-100 mr-2 shadow-inner">
               <button
                  onClick={() => setActiveTab('overview')}
                  className={`px-6 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'overview' ? 'bg-white text-emerald-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
               >
                 Overview
               </button>
               <button
                  onClick={() => setActiveTab('reconcile')}
                  className={`px-6 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'reconcile' ? 'bg-white text-emerald-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
               >
                 Rekonsiliasi
               </button>
            </div>
            <SafeButton 
              variant="white"
              icon={<Building2 size={16} />}
              disabled={!canWriteCash}
              onClick={() => setShowAccountModal(true)}
            >
              Rekening
            </SafeButton>
            <SafeButton 
              variant="primary"
              icon={<Plus size={18} />}
              disabled={!canWriteCash}
              onClick={() => { 
                setTxType('OUT'); 
                setTxAmount(0);
                setTxDescription('');
                setShowTransactionModal(true); 
              }}
            >
              Transaksi
            </SafeButton>
          </>
        }
      />

      {!canWriteCash ? (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 px-6 py-4 text-sm font-semibold text-amber-900 shadow-sm">
          Pilih unit aktif terlebih dahulu untuk menambah rekening, mencatat transaksi, atau unggah mutasi bank.
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          label="Total Likuiditas" 
          value={formatRupiah(bankAccounts.reduce((sum, acc) => sum + (acc.balances?.balance || 0), 0))} 
          icon={Wallet}
          color="emerald"
          sub="Total Saldo dari Seluruh Rekening"
        />
        <StatCard 
          label="Transaksi Bulan Ini" 
          value={`${recentTransactions.length} Mutasi`} 
          icon={Activity}
          color="blue"
          sub="Volume aktivitas keuangan"
        />
        <StatCard 
          label="Draft Reconcile" 
          value="0 Post" 
          icon={CheckCircle2}
          color="amber"
          sub="Menunggu verifikasi bank"
        />
        <StatCard 
          label="Pengeluaran Hari Ini" 
          value={formatRupiah(recentTransactions.filter(t => t.type === 'OUT' && t.transaction_date === new Date().toISOString().split('T')[0]).reduce((sum, t) => sum + (t.amount || 0), 0))} 
          icon={TrendingDown}
          color="rose"
          sub="Mutasi keluar terposting"
        />
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'overview' ? (
          <motion.div
            key="overview"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-10"
          >
            {/* Account Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {bankAccounts.length === 0 ? (
                <div className="col-span-full py-24 bg-white rounded-[40px] border-2 border-dashed border-slate-100 flex flex-col items-center justify-center text-center space-y-6 shadow-inner">
                  <div className="w-20 h-20 rounded-[32px] bg-slate-50 flex items-center justify-center text-slate-200 border border-slate-100 shadow-sm">
                    <PiggyBank size={36} strokeWidth={1.5} />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-black text-slate-900 text-xl tracking-tight">Belum ada Rekening</h3>
                    <p className="text-sm text-slate-400 max-w-xs mx-auto font-medium">Tambahkan rekening bank atau kas kecil Anda untuk mulai mencatat transaksi.</p>
                  </div>
                </div>
              ) : (
                bankAccounts.map((acc, idx) => (
                  <motion.div
                    key={acc.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    whileHover={{ y: -8, scale: 1.02 }}
                    className="bg-white rounded-[40px] p-8 border border-slate-100 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.03)] group relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 rounded-full -mr-16 -mt-16 opacity-0 group-hover:opacity-100 transition-all duration-500 ease-out" />
                    
                    <div className="flex items-start justify-between mb-10 relative z-10">
                      <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-emerald-500 group-hover:text-white transition-all duration-500 shadow-sm">
                        <Wallet size={28} strokeWidth={2} />
                      </div>
                      <div className="text-right">
                         <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-1">{acc.bank_name}</span>
                         <span className="text-xs font-black text-slate-900 font-mono tracking-tighter bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">{acc.account_number || 'Cash Asset'}</span>
                      </div>
                    </div>

                    <div className="space-y-1 relative z-10">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Saldo Saat Ini</p>
                      <h2 className="text-3xl font-black text-slate-900 leading-none tracking-tighter font-mono">
                        {formatRupiah(acc.balances?.balance || 0)}
                      </h2>
                      <div className="flex items-center gap-2 mt-4">
                        <StatusBadge label={acc.account.code} variant="indigo" />
                        <span className="text-[10px] text-slate-400 font-bold truncate max-w-[120px]">{acc.account.name}</span>
                      </div>
                    </div>

                    <div className="mt-10 pt-8 border-t border-slate-50 flex items-center justify-between relative z-10">
                      <button 
                        onClick={() => {
                          setFilterAccountId(acc.id)
                          document.getElementById('recent-activities')?.scrollIntoView({ behavior: 'smooth' })
                        }}
                        className="text-[10px] font-black text-emerald-600 hover:text-emerald-700 transition-colors flex items-center gap-2 uppercase tracking-widest bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-100"
                      >
                        Mutasi Detail <ChevronRight size={14} strokeWidth={3} />
                      </button>
                      <div className="relative group/menu">
                        <button className="p-3 text-slate-300 hover:text-slate-900 transition-colors bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-100">
                          <MoreHorizontal size={18} />
                        </button>
                        <div className="absolute right-0 bottom-full mb-3 w-52 bg-white rounded-3xl border border-slate-100 shadow-2xl opacity-0 invisible group-hover/menu:opacity-100 group-hover/menu:visible transition-all z-30 overflow-hidden ring-4 ring-slate-900/5">
                          {isOwner && (
                            <button
                              onClick={() => handleDeleteAccount(acc.id, acc.bank_name)}
                              className="w-full flex items-center gap-3 px-5 py-4 text-[10px] font-black uppercase tracking-widest text-rose-500 hover:bg-rose-50 transition-colors"
                            >
                              <Trash2 size={16} /> Hapus Rekening
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>

            {/* Recent Activities */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
              <div className="lg:col-span-2 space-y-8">
                <SectionCard>
                  <div id="recent-activities" />
                  <SectionHeader 
                    title="Aktivitas Keuangan Terkini" 
                    subtitle="Daftar mutasi kas dan bank yang sudah terposting."
                    icon={History}
                    actions={
                      <div className="flex items-center gap-2">
                        {filterAccountId && (
                          <button
                            onClick={() => setFilterAccountId(null)}
                            className="px-4 py-1.5 text-[10px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-600 rounded-lg shadow-sm border border-emerald-100 hover:bg-emerald-100 transition-colors"
                          >
                            Semua Rekening
                          </button>
                        )}
                        <div className="flex bg-white/50 p-1 rounded-xl border border-slate-100 shadow-sm">
                         <button
                            onClick={() => setFilterStatus('POSTED')}
                            className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${filterStatus === 'POSTED' ? 'bg-white text-emerald-600 shadow-sm border border-slate-100' : 'text-slate-400 hover:text-slate-600'}`}>
                            POSTED
                         </button>
                         <button
                            onClick={() => setFilterStatus('VOIDED')}
                            className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${filterStatus === 'VOIDED' ? 'bg-white text-rose-600 shadow-sm border border-slate-100' : 'text-slate-400 hover:text-slate-600'}`}>
                            VOIDED
                         </button>
                       </div>
                      </div>
                    }
                  />
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50/50 border-b border-slate-100">
                           <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Tanggal</th>
                           <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Rincian Transaksi</th>
                           <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Nominal (IDR)</th>
                           <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                          {recentTransactions.filter(t => t.status === filterStatus && (!filterAccountId || t.bank_account_id === filterAccountId)).length === 0 ? (
                            <tr>
                              <td colSpan={4} className="py-40 text-center">
                                <div className="flex flex-col items-center gap-3 opacity-40">
                                  <History size={40} className="text-slate-400" />
                                  <span className="text-xs font-black uppercase tracking-widest">Tidak ada transaksi {filterStatus.toLowerCase()}</span>
                                </div>
                              </td>
                            </tr>
                          ) : (
                            recentTransactions.filter(t => t.status === filterStatus && (!filterAccountId || t.bank_account_id === filterAccountId)).map((tx) => (
                             <tr key={tx.id} className="hover:bg-slate-50/80 transition-all group">
                                <td className="px-8 py-6 align-top">
                                  <div className="flex flex-col">
                                    <span className="text-xs font-black text-slate-900 font-mono italic">#{tx.id.substring(0,6)}</span>
                                    <span className="text-[10px] font-bold text-slate-400 mt-1">{formatDate(tx.transaction_date, 'short')}</span>
                                  </div>
                                </td>
                                <td className="px-8 py-6 align-top">
                                   <div className="flex flex-col gap-1.5">
                                      <span className="text-sm font-black text-slate-900 leading-tight">{tx.description}</span>
                                      <div className="flex items-center gap-2">
                                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 rounded text-[9px] font-black text-slate-500 uppercase">
                                          <Building size={10} /> {tx.bank_account.bank_name}
                                        </div>
                                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-blue-50 rounded text-[9px] font-black text-indigo-500 uppercase">
                                          <Activity size={10} /> {tx.category.name}
                                        </div>
                                      </div>
                                   </div>
                                </td>
                                <td className={`px-8 py-6 align-top text-right font-black font-mono tracking-tighter text-sm ${tx.type === 'IN' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                  {tx.type === 'IN' ? '+' : '-'} {formatRupiah(tx.amount)}
                                </td>
                                <td className="px-8 py-6 align-top text-center">
                                   {isOwner && tx.status === 'POSTED' && (
                                     <button
                                       onClick={() => handleDeleteTransaction(tx.id)}
                                       className="p-2.5 text-slate-200 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                                       title="Void Transaksi"
                                     >
                                       <Trash size={16} />
                                     </button>
                                   )}
                                   {tx.status === 'VOIDED' && (
                                     <StatusBadge label="Voided" variant="error" />
                                   )}
                                </td>
                             </tr>
                           ))
                         )}
                      </tbody>
                    </table>
                  </div>
                </SectionCard>
              </div>

              <div className="space-y-8">
                 <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-[40px] p-10 text-white relative overflow-hidden group shadow-2xl">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl" />
                    <div className="relative z-10 space-y-8">
                      <div className="w-16 h-16 rounded-[24px] bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
                        <TrendingUp size={32} className="text-emerald-400" />
                      </div>
                      <div className="space-y-3">
                        <h3 className="font-black text-2xl tracking-tighter italic">Auto-Journaling Engine</h3>
                        <p className="text-xs text-slate-400 font-medium leading-relaxed">Setiap mutasi kas akan otomatis meluncurkan entri jurnal ganda di CoA organisasi Anda. Akuntabilitas instan tanpa input manual.</p>
                      </div>
                      <div className="pt-4">
                        <StatusBadge label="Powered by Nizam Intelligence" variant="indigo" />
                      </div>
                    </div>
                 </div>

                 <SectionCard className="p-10 space-y-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-500 shadow-sm border border-blue-100">
                        <Download size={20} />
                      </div>
                      <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Ekspor Laporan</h4>
                    </div>
                    <p className="text-xs text-slate-400 font-medium">Download mutasi kas dalam format PDF atau Excel untuk keperluan audit dan arsip.</p>
                    <div className="grid grid-cols-2 gap-3">
                       <button className="py-4 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all">Format PDF</button>
                       <button className="py-4 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all">Format XLSX</button>
                    </div>
                 </SectionCard>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="reconcile"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-10"
          >
            <div className="space-y-8">
              <SectionCard className="p-10 space-y-10">
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Pilih Rekening Target</label>
                  <div className="grid grid-cols-1 gap-3">
                    {bankAccounts.map(acc => (
                      <button
                        key={acc.id}
                        onClick={() => setSelectedBankId(acc.id)}
                        className={`flex items-center gap-4 px-6 py-5 rounded-2xl border-2 text-left transition-all group ${selectedBankId === acc.id ? 'bg-emerald-50 border-emerald-500 text-emerald-900 shadow-md shadow-emerald-100' : 'bg-white border-slate-100 hover:border-slate-200'}`}
                      >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${selectedBankId === acc.id ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-200' : 'bg-slate-50 text-slate-400 group-hover:bg-slate-100'}`}>
                           <Building2 size={20} />
                        </div>
                        <div>
                          <span className="text-xs font-black uppercase tracking-tight block">{acc.bank_name}</span>
                          <span className="text-[10px] font-medium text-slate-400 font-mono tracking-tighter">{acc.account_number || 'Cash Asset Account'}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-6 pt-10 border-t border-slate-50">
                  <div className="space-y-2">
                    <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest tracking-tighter">Import CSV Mutasi</h4>
                    <p className="text-[10px] text-slate-400 font-medium leading-relaxed italic">Unggah riwayat transaksi dari e-banking (BCA, Mandiri, BNI, dll) untuk pencocokan otomatis.</p>
                  </div>
                  <form onSubmit={handleUploadCSV} className="space-y-6">
                    <div className="relative group">
                       <input type="file" name="csv" accept=".csv" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                       <div className="w-full py-12 border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center gap-4 group-hover:bg-slate-50 group-hover:border-blue-400 group-hover:text-blue-500 transition-all duration-300 shadow-inner">
                          <Upload size={32} strokeWidth={1.5} />
                          <div className="text-center">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] block">Seret & Lepas File</span>
                            <span className="text-[8px] font-bold text-slate-400 uppercase mt-1 tracking-widest">Atau klik untuk memilih (.csv)</span>
                          </div>
                       </div>
                    </div>
                    <SafeButton type="submit" variant="primary" size="lg" className="w-full shadow-lg" isLoading={loading} disabled={!selectedBankId || !canWriteCash}>
                      MULAI PROSES MUTASI
                    </SafeButton>
                  </form>
                </div>
              </SectionCard>
            </div>

            <div className="lg:col-span-2">
              <SectionCard>
                <SectionHeader 
                  title="Pratinjau Data Impor" 
                  subtitle="Hasil pembacaan data CSV sebelum masuk ke ledger."
                  icon={FileText}
                />
                <div className="min-h-[500px] overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50 border-b border-slate-100">
                        <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Tanggal</th>
                        <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Keterangan Bank</th>
                        <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Nominal (IDR)</th>
                        <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td colSpan={4} className="py-40 text-center">
                          <div className="flex flex-col items-center gap-6 text-slate-200">
                            <div className="w-24 h-24 rounded-[40px] bg-slate-50/50 flex items-center justify-center border border-slate-100 shadow-inner"><Building2 size={48} strokeWidth={1} /></div>
                            <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-300">Belum ada mutasi yang diunggah</span>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODALS */}
      <AnimatePresence>
        {showAccountModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAccountModal(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-lg bg-white rounded-[40px] shadow-2xl overflow-hidden flex flex-col">
               <div className="px-10 py-8 bg-emerald-600 text-white flex justify-between items-start">
                  <div>
                    <h3 className="text-2xl font-black tracking-tight flex items-center gap-3"><Building2 /> Add Bank Account</h3>
                    <p className="text-xs text-emerald-100 mt-1 font-medium italic">Define a new ledger account for your cash or bank assets.</p>
                  </div>
                  <button onClick={() => setShowAccountModal(false)} className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center hover:bg-white/20 transition"><X size={20} /></button>
               </div>

               <form onSubmit={handleCreateAccount} className="p-10 space-y-6">
                 <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Account Display Name</label>
                    <input name="bank_name" required placeholder="e.g. BCA Operasional Utama" className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none text-sm font-bold focus:bg-white focus:border-emerald-500 transition-all shadow-inner" />
                 </div>

                 <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5"><Hash size={12}/> Account Number</label>
                      <input name="account_number" placeholder="8821..." className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none text-sm font-black font-mono focus:bg-white focus:border-emerald-500 transition-all shadow-inner" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5"><User size={12}/> Holder Name</label>
                      <input name="account_holder" placeholder="PT. Nizam Digital" className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none text-sm font-bold focus:bg-white focus:border-emerald-500 transition-all shadow-inner" />
                    </div>
                 </div>

                 <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mapped GL Account (CoA)</label>
                    <div className="relative">
                      <select name="account_id" required className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none text-sm font-bold appearance-none focus:bg-white focus:border-emerald-500 transition-all shadow-inner">
                         <option value="">Select Asset Account...</option>
                         {bankGlAccounts.map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                      </select>
                      <ChevronRight className="absolute right-5 top-1/2 -translate-y-1/2 rotate-90 text-slate-300 pointer-events-none" size={16} />
                    </div>
                 </div>

                 <div className="flex gap-4 pt-6 border-t border-slate-50">
                   <button type="button" onClick={() => setShowAccountModal(false)} className="flex-1 py-5 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors">Cancel</button>
                   <SafeButton type="submit" variant="primary" size="lg" className="flex-[2] shadow-xl shadow-emerald-100" isLoading={loading}>
                     SAVE ACCOUNT
                   </SafeButton>
                 </div>
               </form>
            </motion.div>
          </div>
        )}

        {showTransactionModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowTransactionModal(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-xl bg-white rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
               <div className="px-10 py-8 bg-blue-600 text-white flex justify-between items-start shrink-0">
                  <div>
                    <h3 className="text-2xl font-black tracking-tight flex items-center gap-3">
                       {txType === 'IN' ? <ArrowDownRight /> : txType === 'OUT' ? <ArrowUpRight /> : <ArrowRightLeft />} 
                       Record {txType === 'TRANSFER' ? 'Transfer' : 'Mutation'}
                    </h3>
                    <p className="text-xs text-blue-100 mt-1 font-medium italic">Create an instant double-entry transaction record.</p>
                  </div>
                  <div className="flex bg-white/10 p-1 rounded-2xl border border-white/20">
                     <button type="button" onClick={() => setTxType('IN')} className={`px-4 py-2 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all ${txType === 'IN' ? 'bg-white text-emerald-600 shadow-md' : 'text-blue-100 hover:bg-white/5'}`}>IN</button>
                     <button type="button" onClick={() => setTxType('OUT')} className={`px-4 py-2 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all ${txType === 'OUT' ? 'bg-white text-rose-600 shadow-md' : 'text-blue-100 hover:bg-white/5'}`}>OUT</button>
                     <button type="button" onClick={() => setTxType('TRANSFER')} className={`px-4 py-2 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all ${txType === 'TRANSFER' ? 'bg-white text-blue-600 shadow-md' : 'text-blue-100 hover:bg-white/5'}`}>XFER</button>
                  </div>
               </div>

               <form onSubmit={handleCreateTransaction} className="flex-1 overflow-y-auto p-10 space-y-8">
                 <input type="hidden" name="type" value={txType} />
                 
                 <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Source Account</label>
                      <select name="bank_account_id" required className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold shadow-inner outline-none focus:bg-white focus:border-blue-500 transition-all">
                         <option value="">Select Account...</option>
                         {bankAccounts.map(acc => <option key={acc.id} value={acc.id}>{acc.bank_name}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Date</label>
                      <input type="date" name="transaction_date" defaultValue={new Date().toISOString().split('T')[0]} required className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold shadow-inner outline-none focus:bg-white focus:border-blue-500 transition-all font-mono" />
                    </div>
                 </div>

                 <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Transaction Description</label>
                     <input 
                        name="description" 
                        required 
                        placeholder="e.g. Payment for Store Rent / Office Supplies" 
                        value={txDescription}
                        onChange={(e) => setTxDescription(e.target.value)}
                        className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold shadow-inner outline-none focus:bg-white focus:border-blue-500 transition-all" 
                     />
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                    <CurrencyInput
                       label="Total Amount"
                       value={txAmount}
                       onChange={setTxAmount}
                       name="amount"
                       highlight={true}
                    />
                    
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.1em] ml-1 flex items-center gap-1.5">
                          <ExternalLink size={12}/> {txType === 'TRANSFER' ? 'Target Account' : 'Counterparty Account'}
                        </label>
                        <select name="category_id" required className="w-full px-6 py-4 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest outline-none shadow-xl border border-slate-800 transition-all">
                           <option value="">{txType === 'TRANSFER' ? 'Select Target...' : 'Select Ledger Account...'}</option>
                           {txType === 'TRANSFER' ? 
                             bankAccounts.map(b => (
                               <option key={b.id} value={b.account_id}>
                                 {b.bank_name} ({b.account_number})
                               </option>
                             )) :
                             <>
                               {['EXPENSE', 'LIABILITY', 'ASSET', 'REVENUE', 'EQUITY'].map(type => {
                                 const group = categoryAccounts.filter(a => a.type === type);
                                 if (group.length === 0) return null;
                                 return (
                                   <optgroup key={type} className="text-slate-400" label={type}>
                                      {group.map(a => <option key={a.id} value={a.id} className="text-white">{a.code} - {a.name}</option>)}
                                   </optgroup>
                                 )
                               })}
                             </>
                           }
                        </select>
                    </div>
                 </div>

                 <div className="bg-slate-50 p-6 rounded-[28px] border border-slate-100 text-[10px] font-medium text-slate-400 leading-relaxed italic flex gap-3">
                    <AlertCircle size={16} className="shrink-0 text-slate-300" />
                    {txType === 'OUT' ? 'Choosing an EXPENSE account will decrease equity. Choosing a LIABILITY will settle or create a debt.' : 
                     txType === 'IN' ? 'Choosing REVENUE will increase equity. Choosing ASSET (e.g. Accounts Receivable) will settle a customer debt.' : 
                     'A transfer involves two asset accounts. The source will be credited and the target will be debited.'}
                 </div>

                 <div className="flex gap-4 pt-4 shrink-0">
                   <button type="button" onClick={() => setShowTransactionModal(false)} className="flex-1 py-5 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors">Abort</button>
                   <SafeButton type="submit" variant="primary" size="lg" className="flex-[2] shadow-2xl shadow-blue-100" isLoading={loading}>
                     {txType === 'IN' ? 'RECEIVE FUNDS' : txType === 'OUT' ? 'SEND PAYMENT' : 'PROCESS TRANSFER'}
                   </SafeButton>
                 </div>
               </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Notifications */}
      <div className="fixed bottom-8 right-8 z-[100] flex flex-col gap-2">
        <AnimatePresence>
          {error && (
            <motion.div initial={{ x: 100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 100, opacity: 0 }} className="bg-red-50 border border-red-100 px-6 py-4 rounded-2xl shadow-xl flex items-center gap-3 text-red-600 text-sm font-bold">
              <AlertCircle size={18} /> {error}
            </motion.div>
          )}
          {success && (
            <motion.div initial={{ x: 100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 100, opacity: 0 }} className="bg-emerald-50 border border-emerald-100 px-6 py-4 rounded-2xl shadow-xl flex items-center gap-3 text-emerald-600 text-sm font-bold">
              <CheckCircle2 size={18} /> {success}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
