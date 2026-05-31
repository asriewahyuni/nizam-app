'use client'

import React, { startTransition, useState, useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Plus, 
  ArrowUpRight, 
  ArrowDownRight, 
  ArrowRightLeft,
  ChevronDown,
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
import { createBankAccount, createBankTransaction, createInterOrgCapitalTransfer, deleteBankAccount, deleteBankTransaction } from '@/modules/cash/actions/bank.actions'
import { processBankCSV } from '@/modules/cash/actions/reconcile.actions'
import { formatRupiah, formatDate, getDateInTimeZone } from '@/lib/utils'
import { CurrencyInput } from '@/components/ui/CurrencyInput'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { PageHeader, StatCard, SectionCard, SectionHeader, StatusBadge, SafeButton, useConfirm} from '@/components/ui/NizamUI'
import type {
  CashAccountOption,
  CashBankAccount,
  CashViewMode,
  PlacementAccountOption,
  RecentTransactionOption,
  TransferCategoryOption,
} from '@/modules/cash/types'

function isFinancingTransferAccount(account: Pick<TransferCategoryOption, 'code' | 'type' | 'cash_flow_category'> | null | undefined) {
  const code = String(account?.code || '').trim()

  return (
    (account?.type === 'EQUITY' || account?.type === 'LIABILITY') &&
    (
      account?.cash_flow_category === 'FINANCING' ||
      code.startsWith('25') ||
      code.startsWith('26') ||
      code.startsWith('3')
    )
  )
}

function formatDateTime(date: string | null | undefined): string {
  if (!date) return '-'
  const parsedDate = new Date(date)
  if (Number.isNaN(parsedDate.getTime())) return '-'

  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(parsedDate)
}

interface CashClientProps {
  orgId: string
  orgName: string
  isAllBranchesView?: boolean
  activeBranchId: string | null
  activeBranchName: string | null
  bankAccounts: CashBankAccount[]
  managedBankAccounts?: CashBankAccount[]
  categoryAccounts: CashAccountOption[]
  bankGlAccounts: CashAccountOption[]
  interOrgSourceAccounts?: CashAccountOption[]
  recentTransactions: RecentTransactionOption[]
  cashViewMode: CashViewMode
  userRole: string
  /** TRUE jika org adalah organisasi induk/holding dan user bisa kelola rekening langsung */
  canManageDirect: boolean
  /** TRUE jika org adalah induk (parent_org_id IS NULL) */
  isParentOrg: boolean
  pendingCoaRequests?: number
  branches?: { id: string; name: string }[]
  placementNodes?: {
    orgId: string;
    orgName: string;
    branches: { id: string; name: string }[];
    accounts: PlacementAccountOption[];
  }[]
  transferCategoryNodes?: {
    orgId: string
    orgName: string
    accounts: TransferCategoryOption[]
  }[]
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
  isAllBranchesView = false,
  activeBranchId,
  activeBranchName,
  bankAccounts,
  managedBankAccounts = [],
  categoryAccounts,
  bankGlAccounts,
  interOrgSourceAccounts = [],
  recentTransactions,
  cashViewMode,
  userRole,
  canManageDirect,
  isParentOrg,
  pendingCoaRequests = 0,
  branches = [],
  placementNodes = [],
  transferCategoryNodes = [],
}: CashClientProps) {
  const router = useRouter()
  const [showTransactionModal, setShowTransactionModal] = useState(false)
  const { confirm, ConfirmUI } = useConfirm()
  const [showAccountModal, setShowAccountModal] = useState(false)
  const [loading, setLoading] = useState(false)
  
  // Dynamic mapped accounts logic
  const [targetOrgId, setTargetOrgId] = useState<string>(orgId)
  
  // Find currently active node to supply dynamic GL accounts
  const activePlacementNode = placementNodes.find(n => n.orgId === targetOrgId)
  const dynamicGlAccounts = activePlacementNode ? activePlacementNode.accounts : bankGlAccounts
  const canWriteCash = Boolean(activeBranchId)
  const canUseHoldingView = canManageDirect && isParentOrg
  const isHoldingView = cashViewMode === 'holding'
  const isParentButRestricted = isParentOrg && !canManageDirect
  const canOpenParentAccountModal = isParentOrg && canManageDirect && canWriteCash
  const visibleBankAccounts = isHoldingView && canManageDirect && managedBankAccounts.length > 0
    ? managedBankAccounts
    : bankAccounts
  const transferBankAccounts = canManageDirect && managedBankAccounts.length > 0
    ? managedBankAccounts
    : bankAccounts
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'reconcile'>('overview')
  const [selectedBankId, setSelectedBankId] = useState<string | null>(null)

  // Form state for account creation GL mapping
  const [glAccountId, setGlAccountId] = useState('')

  // Form states for transaction
  const [txType, setTxType] = useState<'IN' | 'OUT' | 'TRANSFER'>('OUT')
  const [txBankAccountId, setTxBankAccountId] = useState('')
  const [txTargetBankId, setTxTargetBankId] = useState('')
  const [txAmount, setTxAmount] = useState(0)
  const [txDescription, setTxDescription] = useState('')
  const [txDate, setTxDate] = useState(getDateInTimeZone('Asia/Jakarta'))
  const [txCategoryId, setTxCategoryId] = useState('')
  const [txSourceCounterAccountId, setTxSourceCounterAccountId] = useState('')
  const [txTargetCounterAccountId, setTxTargetCounterAccountId] = useState('')
  const [isCategoryLocked, setIsCategoryLocked] = useState(false)
  const [filterStatus, setFilterStatus] = useState<'POSTED' | 'VOIDED'>('POSTED')
  const [filterAccountId, setFilterAccountId] = useState<string | null>(null)
  const [expandedTransactionId, setExpandedTransactionId] = useState<string | null>(null)
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const categoryNodeByOrg = new Map(transferCategoryNodes.map((node) => [node.orgId, node]))
  const selectedSourceBankAccount = bankAccounts.find((bankAccount) => bankAccount.id === txBankAccountId) || null
  const transferTargetBankOptions = transferBankAccounts.filter(
    (bankAccount) => bankAccount.id !== txBankAccountId
  )
  const selectedTransferTarget = transferTargetBankOptions.find((bankAccount) => bankAccount.id === txTargetBankId) || null
  const isInterOrgTransfer = txType === 'TRANSFER' && Boolean(selectedTransferTarget?.org_id && selectedTransferTarget.org_id !== orgId)
  const targetOrgTransferAccounts = selectedTransferTarget?.org_id
    ? categoryNodeByOrg.get(selectedTransferTarget.org_id)?.accounts || []
    : []
  const targetFinancingAccounts = targetOrgTransferAccounts.filter(isFinancingTransferAccount)
  const sourceInterOrgCounterAccounts = interOrgSourceAccounts.filter(
    (account) => account.id !== selectedSourceBankAccount?.account_id
  )
  const preferredSourceInterOrgAccount =
    sourceInterOrgCounterAccounts.find((account) => account.code === '1601')
    || sourceInterOrgCounterAccounts[0]
    || null
  const hasSelectedSourceInterOrgAccount = sourceInterOrgCounterAccounts.some(
    (account) => account.id === txSourceCounterAccountId
  )
  const effectiveSourceCounterAccountId = isInterOrgTransfer
    ? (hasSelectedSourceInterOrgAccount ? txSourceCounterAccountId : preferredSourceInterOrgAccount?.id || '')
    : txSourceCounterAccountId
  const preferredTargetFinancingAccount =
    targetFinancingAccounts.find((account) => account.code === '3001')
    || targetFinancingAccounts[0]
    || null
  const hasSelectedTargetFinancingAccount = targetFinancingAccounts.some(
    (account) => account.id === txTargetCounterAccountId
  )
  const effectiveTargetCounterAccountId = isInterOrgTransfer
    ? (hasSelectedTargetFinancingAccount ? txTargetCounterAccountId : preferredTargetFinancingAccount?.id || '')
    : txTargetCounterAccountId
  const isOwner = userRole === 'owner'
  const todayInJakarta = getDateInTimeZone('Asia/Jakarta')
  const hasSettlementPrefill = Boolean(searchParams.get('pay'))
  const hasCrossEntityAccounts = transferBankAccounts.some((account) => account.org_id !== orgId)
  const availableCashBalance = Number(selectedSourceBankAccount?.balances?.balance || 0)
  const shouldCheckAvailableCash = txType === 'OUT' || txType === 'TRANSFER'
  const isAmountExceedingAvailable = shouldCheckAvailableCash && Boolean(txBankAccountId) && txAmount > availableCashBalance
  const reconcileScopeLabel = activeBranchName
    ? `unit aktif ${activeBranchName}`
    : 'unit aktif organisasi induk yang sedang dipilih'
  const visibleScopeLabel = isAllBranchesView
    ? 'semua unit'
    : activeBranchName
      ? `unit aktif ${activeBranchName}`
      : 'unit aktif organisasi induk yang sedang dipilih'
  const filteredTransactions = recentTransactions.filter(
    (transaction) => transaction.status === filterStatus && (!filterAccountId || transaction.bank_account_id === filterAccountId)
  )
  const transactionSummaryByAccountId = recentTransactions.reduce<Record<string, { total: number; posted: number; voided: number }>>((accumulator, transaction) => {
    const currentSummary = accumulator[transaction.bank_account_id] || { total: 0, posted: 0, voided: 0 }
    const postedCount = currentSummary.posted + (transaction.status === 'POSTED' ? 1 : 0)
    const voidedCount = currentSummary.voided + (transaction.status === 'VOIDED' ? 1 : 0)
    accumulator[transaction.bank_account_id] = {
      total: currentSummary.total + 1,
      posted: postedCount,
      voided: voidedCount,
    }
    return accumulator
  }, {})
  const hasPostedTransactionsInScope = recentTransactions.some(
    (transaction) => transaction.status === 'POSTED' && (!filterAccountId || transaction.bank_account_id === filterAccountId)
  )
  const hasVoidedTransactionsInScope = recentTransactions.some(
    (transaction) => transaction.status === 'VOIDED' && (!filterAccountId || transaction.bank_account_id === filterAccountId)
  )

  const handleCashViewChange = (nextMode: CashViewMode) => {
    if (!canUseHoldingView || nextMode === cashViewMode) return
    const params = new URLSearchParams(searchParams.toString())
    params.set('cash_view', nextMode)
    const nextQuery = params.toString()
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname)
  }

  const pageSubtitle = isHoldingView
    ? 'Mode holding aktif. Pantau saldo dan mutasi organisasi induk + seluruh entitas dari satu halaman.'
    : isAllBranchesView
      ? (activeBranchName
          ? `Menampilkan saldo dan mutasi semua unit. Transaksi baru tetap diproses dari unit aktif ${activeBranchName}.`
          : 'Menampilkan saldo dan mutasi semua unit. Pilih unit aktif spesifik untuk membuat rekening atau transaksi baru.')
    : activeBranchName
      ? `Mutasi kas dan bank untuk unit aktif ${activeBranchName}.`
      : 'Mode semua unit aktif. Pilih unit spesifik untuk membuat rekening atau transaksi baru.'

  useEffect(() => {
    const pay = searchParams.get('pay')
    const type = searchParams.get('type')
    const amount = searchParams.get('amount')
    const desc = searchParams.get('desc')
    const categoryId = searchParams.get('category_id')
    const lockCategory = searchParams.get('lock_category') === '1'
    const date = searchParams.get('date')

    if (pay) {
      startTransition(() => {
        if (type === 'IN' || type === 'OUT' || type === 'TRANSFER') setTxType(type)
        setTxBankAccountId('')
        setTxTargetBankId('')
        setTxSourceCounterAccountId('')
        setTxTargetCounterAccountId('')
        if (amount) setTxAmount(Number(amount))
        if (desc) setTxDescription(desc)
        setTxCategoryId(categoryId || '')
        setIsCategoryLocked(lockCategory && Boolean(categoryId))
        setTxDate(date || todayInJakarta)
        setShowTransactionModal(true)
      })
    }
  }, [searchParams, todayInJakarta])

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
      setGlAccountId('')
      setTimeout(() => setSuccess(null), 3000)
    }
    setLoading(false)
  }

  const closeTransactionModal = () => {
    setShowTransactionModal(false)
    if (hasSettlementPrefill) {
      router.replace(pathname)
    }
  }

  const handleCreateTransaction = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    if (isAmountExceedingAvailable) {
      setError(`Nominal melebihi available kas. Saldo tersedia: ${formatRupiah(availableCashBalance)}.`)
      return
    }

    setLoading(true)
    const formData = new FormData(e.currentTarget)
    const useInterOrgTransfer = txType === 'TRANSFER' && isInterOrgTransfer
    const res = useInterOrgTransfer
      ? await createInterOrgCapitalTransfer(orgId, formData)
      : await createBankTransaction(orgId, formData)
    if (res?.error) setError(res.error)
    else {
      setSuccess(useInterOrgTransfer ? 'Transfer modal antar entitas berhasil dicatat.' : 'Transaksi berhasil dicatat.')
      if (hasSettlementPrefill) {
        router.replace(pathname)
      }
      setShowTransactionModal(false)
      setTxBankAccountId('')
      setTxTargetBankId('')
      setTxAmount(0)
      setTxDescription('')
      setTxCategoryId('')
      setTxSourceCounterAccountId('')
      setTxTargetCounterAccountId('')
      setIsCategoryLocked(false)
      setTxDate(todayInJakarta)
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
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError('Gagal membaca file: ' + message)
    }
    setLoading(false)
  }

  const handleDeleteAccount = async (id: string, name: string) => {
    if (!await confirm(`Hapus rekening "${name}"? Tindakan ini tidak bisa dibatalkan jika rekeing masih kosong.`)) return

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
    if (!await confirm('Void transaksi ini? Mutasi sumber tetap disimpan untuk audit dan jurnal terkait akan ikut di-void.')) return
    setLoading(true)
    const res = await deleteBankTransaction(orgId, id)
    if (res?.error) setError(res.error)
    else {
      setSuccess('Transaksi berhasil di-void.')
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
        subtitle={pageSubtitle}
        tag="Cash Module"
        actions={
          <>
            {canUseHoldingView ? (
              <div className="flex bg-blue-50 p-1 rounded-xl border border-blue-100 mr-2 shadow-inner">
                <button
                  onClick={() => handleCashViewChange('parent')}
                  className={`px-4 py-2 text-[10px] font-semibold uppercase tracking-wide rounded-xl transition-all ${!isHoldingView ? 'bg-white text-blue-700 shadow-md' : 'text-blue-400 hover:text-blue-600'}`}
                >
                  Kas Induk
                </button>
                <button
                  onClick={() => handleCashViewChange('holding')}
                  className={`px-4 py-2 text-[10px] font-semibold uppercase tracking-wide rounded-xl transition-all ${isHoldingView ? 'bg-white text-blue-700 shadow-md' : 'text-blue-400 hover:text-blue-600'}`}
                >
                  Kas Holding
                </button>
              </div>
            ) : null}
            <div className="flex bg-slate-100/60 p-1 rounded-xl border border-slate-100 mr-2 shadow-inner">
               <button
                  onClick={() => setActiveTab('overview')}
                  className={`px-6 py-2 text-[10px] font-semibold uppercase tracking-wide rounded-xl transition-all ${activeTab === 'overview' ? 'bg-white text-emerald-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
               >
                 Overview
               </button>
               <button
                  onClick={() => setActiveTab('reconcile')}
                  className={`px-6 py-2 text-[10px] font-semibold uppercase tracking-wide rounded-xl transition-all ${activeTab === 'reconcile' ? 'bg-white text-emerald-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
               >
                 Rekonsiliasi
               </button>
            </div>
            {isParentOrg ? (
              /* Organisasi induk/holding: bisa tambah rekening langsung */
              <div className="flex items-center gap-2">
                <a
                  href="/accounting/coa-requests"
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wide border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-all shadow-sm"
                  title="Persetujuan & Riwayat CoA"
                >
                  Persetujuan CoA
                  <span className={`flex items-center justify-center px-1.5 min-w-[20px] h-5 rounded-full text-[9px] shadow-sm transition-colors ${pendingCoaRequests > 0 ? 'bg-rose-500 text-white animate-pulse-slow' : 'bg-slate-100 text-slate-400 font-bold'}`}>
                    {pendingCoaRequests || 0}
                  </span>
                </a>
                <SafeButton 
                  variant="white"
                  icon={<Building2 size={16} />}
                  disabled={!canOpenParentAccountModal}
                  title={
                    !canManageDirect
                      ? 'Pindah ke konteks Unit Utama organisasi induk untuk membuat rekening.'
                      : (!canWriteCash ? 'Pilih unit aktif organisasi induk terlebih dahulu.' : undefined)
                  }
                  onClick={() => setShowAccountModal(true)}
                >
                  Buat Rekening
                </SafeButton>
              </div>
            ) : (
              /* Entitas anak: diarahkan ke halaman pengajuan */
              <a
                href="/accounting/coa-requests"
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wide border border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 transition-all shadow-sm"
                title="Ajukan rekening baru melalui organisasi induk/holding"
              >
                <Building2 size={14} />
                Ajukan Rekening
              </a>
            )}
            <SafeButton 
              variant="primary"
              icon={<Plus size={18} />}
              disabled={!canWriteCash}
              onClick={() => { 
                setTxType('OUT'); 
                setTxBankAccountId('');
                setTxTargetBankId('');
                setTxAmount(0);
                setTxDescription('');
                setTxCategoryId('');
                setTxSourceCounterAccountId('');
                setTxTargetCounterAccountId('');
                setIsCategoryLocked(false);
                setTxDate(todayInJakarta);
                setShowTransactionModal(true); 
              }}
            >
              Transaksi
            </SafeButton>
          </>
        }
      />

      {!canWriteCash ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-6 py-4 text-sm font-semibold text-amber-900 shadow-sm">
          Pilih unit aktif terlebih dahulu untuk menambah rekening, mencatat transaksi, atau unggah mutasi bank.
        </div>
      ) : null}
      {isHoldingView && hasCrossEntityAccounts ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-6 py-4 text-sm font-semibold text-blue-900 shadow-sm">
          Mode holding aktif: kartu rekening dan aktivitas terbaru menampilkan organisasi induk + seluruh entitas anak. Pencatatan transaksi baru dan rekonsiliasi tetap diproses dari unit aktif organisasi induk.
        </div>
      ) : isParentButRestricted ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-6 py-4 text-sm font-semibold text-amber-900 shadow-sm">
          Anda berada di organisasi induk, tetapi pembuatan rekening hanya bisa dari konteks Unit Utama. Pindah unit aktif ke Unit Utama organisasi induk lalu coba lagi.
        </div>
      ) : canUseHoldingView && hasCrossEntityAccounts ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-6 py-4 text-sm font-semibold text-slate-700 shadow-sm">
          Mode induk aktif: yang tampil hanya rekening dan mutasi organisasi induk. Pindah ke `Kas Holding` untuk melihat seluruh entitas.
        </div>
      ) : isAllBranchesView ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-6 py-4 text-sm font-semibold text-emerald-900 shadow-sm">
          Mode semua unit aktif: total likuiditas dan daftar rekening di bawah ini mencakup seluruh unit dalam entitas ini. Pencatatan transaksi baru tetap memakai unit aktif {activeBranchName || 'yang sedang dipilih'}.
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          label="Total Likuiditas" 
          value={formatRupiah(visibleBankAccounts.reduce((sum, acc) => sum + (acc.balances?.balance || 0), 0))} 
          icon={Wallet}
          color="emerald"
          sub={isHoldingView ? 'Total saldo organisasi induk + seluruh entitas' : `Total saldo rekening pada ${visibleScopeLabel}`}
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
          value={formatRupiah(recentTransactions.filter(t => t.status === 'POSTED' && t.type === 'OUT' && t.transaction_date === todayInJakarta).reduce((sum, t) => sum + (t.amount || 0), 0))} 
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
              {visibleBankAccounts.length === 0 ? (
                <div className="col-span-full py-24 bg-white rounded-xl border-2 border-dashed border-slate-100 flex flex-col items-center justify-center text-center space-y-6 shadow-inner">
                  <div className="w-20 h-20 rounded-[32px] bg-slate-50 flex items-center justify-center text-slate-200 border border-slate-100 shadow-sm">
                    <PiggyBank size={36} strokeWidth={1.5} />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-semibold text-slate-900 text-xl tracking-tight">Belum ada Rekening</h3>
                    <p className="text-sm text-slate-400 max-w-xs mx-auto font-medium">Tambahkan rekening bank atau kas kecil Anda untuk mulai mencatat transaksi.</p>
                  </div>
                </div>
              ) : (
                visibleBankAccounts.map((acc, idx) => {
                  const isCrossEntity = acc.org_id !== orgId
                  const showScopeBadge = isCrossEntity || (isAllBranchesView && Boolean(acc.branch_name))
                  const canOpenDetails = !isCrossEntity || isHoldingView
                  const accountMutationSummary = transactionSummaryByAccountId[acc.id] || { total: 0, posted: 0, voided: 0 }
                  const hasPostedMutations = accountMutationSummary.posted > 0
                  const hasVoidedMutations = accountMutationSummary.voided > 0
                  const accountMutationCount = accountMutationSummary.total
                  const detailCountLabel = hasPostedMutations
                    ? `${accountMutationSummary.posted} posted${hasVoidedMutations ? ` • ${accountMutationSummary.voided} voided` : ''}`
                    : `${accountMutationSummary.voided} voided`
                  return (
                    <motion.div
                      key={acc.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      whileHover={{ y: -8, scale: 1.02 }}
                      className="bg-white rounded-xl p-8 border border-slate-100 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.03)] group relative overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 rounded-full -mr-16 -mt-16 opacity-0 group-hover:opacity-100 transition-all duration-500 ease-out" />

                      <div className="flex items-start justify-between mb-10 relative z-10">
                        <div className="w-14 h-14 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-emerald-500 group-hover:text-white transition-all duration-500 shadow-sm">
                          <Wallet size={28} strokeWidth={2} />
                        </div>
                        <div className="text-right">
                           <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block mb-1">{acc.bank_name}</span>
                           <span className="text-xs font-semibold text-slate-900 font-mono tracking-tighter bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">{acc.account_number || 'Cash Asset'}</span>
                           {showScopeBadge && (
                             <span className="mt-2 inline-flex items-center rounded-lg bg-blue-50 px-2 py-1 text-[9px] font-semibold uppercase tracking-wide text-blue-700 border border-blue-100">
                               {isCrossEntity
                                 ? `${acc.org_name || 'Entitas Anak'}${acc.branch_name ? ` • ${acc.branch_name}` : ''}`
                                 : (acc.branch_name || 'Semua Unit')}
                             </span>
                           )}
                        </div>
                      </div>

                      <div className="space-y-1 relative z-10">
                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide ml-1">Saldo Saat Ini</p>
                        <h2 className="text-3xl font-semibold text-slate-900 leading-none tracking-tighter font-mono">
                          {formatRupiah(acc.balances?.balance || 0)}
                        </h2>
                        <div className="flex items-center gap-2 mt-4">
                          <StatusBadge label={acc.account.code} variant="indigo" />
                          <span className="text-[10px] text-slate-400 font-bold truncate max-w-[120px]">{acc.account.name}</span>
                        </div>
                      </div>

                      <div className="mt-10 pt-8 border-t border-slate-50 flex items-center justify-between relative z-10">
                        {!canOpenDetails ? (
                          <span className="text-[10px] font-semibold text-blue-600 uppercase tracking-wide bg-blue-50 px-4 py-2 rounded-xl border border-blue-100">
                            Lintas Entitas
                          </span>
                        ) : accountMutationCount === 0 ? (
                          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide bg-slate-100 px-4 py-2 rounded-xl border border-slate-200">
                            Belum ada mutasi
                          </span>
                        ) : (
                          <button
                            onClick={() => {
                              setFilterAccountId(acc.id)
                              setExpandedTransactionId(null)
                              if (!hasPostedMutations && hasVoidedMutations) {
                                setFilterStatus('VOIDED')
                              } else {
                                setFilterStatus('POSTED')
                              }
                              document.getElementById('recent-activities')?.scrollIntoView({ behavior: 'smooth' })
                            }}
                            className="text-[10px] font-semibold text-emerald-600 hover:text-emerald-700 transition-colors flex items-center gap-2 uppercase tracking-wide bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-100"
                          >
                            Mutasi Detail ({detailCountLabel}) <ChevronRight size={14} strokeWidth={3} />
                          </button>
                        )}
                        <div className="relative group/menu">
                          <button className="p-3 text-slate-300 hover:text-slate-900 transition-colors bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-100">
                            <MoreHorizontal size={18} />
                          </button>
                          <div className="absolute right-0 bottom-full mb-3 w-52 bg-white rounded-xl border border-slate-100 shadow-md opacity-0 invisible group-hover/menu:opacity-100 group-hover/menu:visible transition-all z-30 overflow-hidden ring-4 ring-slate-900/5">
                            {isOwner && !isCrossEntity && (
                              <button
                                onClick={() => handleDeleteAccount(acc.id, acc.bank_name)}
                                className="w-full flex items-center gap-3 px-5 py-4 text-[10px] font-semibold uppercase tracking-wide text-rose-500 hover:bg-rose-50 transition-colors"
                              >
                                <Trash2 size={16} /> Hapus Rekening
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )
                })
              )}
            </div>

            {/* Recent Activities */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
              <div className="lg:col-span-2 space-y-8">
                <SectionCard>
                  <div id="recent-activities" />
                  <SectionHeader 
                    title={isHoldingView ? 'Aktivitas Holding Terkini' : 'Aktivitas Keuangan Terkini'} 
                    subtitle={isHoldingView
                      ? 'Mutasi kas/bank terbaru dari organisasi induk dan seluruh entitas dalam holding.'
                      : 'Daftar mutasi kas dan bank yang sudah terposting.'}
                    icon={History}
                    actions={
                      <div className="flex items-center gap-2">
                        {filterAccountId && (
                          <button
                            onClick={() => {
                              setFilterAccountId(null)
                              setExpandedTransactionId(null)
                            }}
                            className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wide bg-emerald-50 text-emerald-600 rounded-lg shadow-sm border border-emerald-100 hover:bg-emerald-100 transition-colors"
                          >
                            Semua Rekening
                          </button>
                        )}
                        <div className="flex bg-white/50 p-1 rounded-xl border border-slate-100 shadow-sm">
                         <button
                            onClick={() => {
                              setFilterStatus('POSTED')
                              setExpandedTransactionId(null)
                            }}
                            className={`px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wide rounded-lg transition-all ${filterStatus === 'POSTED' ? 'bg-white text-emerald-600 shadow-sm border border-slate-100' : 'text-slate-400 hover:text-slate-600'}`}>
                            POSTED
                         </button>
                         <button
                            onClick={() => {
                              setFilterStatus('VOIDED')
                              setExpandedTransactionId(null)
                            }}
                            className={`px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wide rounded-lg transition-all ${filterStatus === 'VOIDED' ? 'bg-white text-rose-600 shadow-sm border border-slate-100' : 'text-slate-400 hover:text-slate-600'}`}>
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
                           <th className="px-8 py-5 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Tanggal</th>
                           <th className="px-8 py-5 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Rincian Transaksi</th>
                           <th className="px-8 py-5 text-[10px] font-semibold text-slate-400 uppercase tracking-wide text-right">Nominal (IDR)</th>
                           <th className="px-8 py-5 text-[10px] font-semibold text-slate-400 uppercase tracking-wide text-center">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                          {filteredTransactions.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="py-40 text-center">
                                <div className="flex flex-col items-center gap-3 opacity-40">
                                  <History size={40} className="text-slate-400" />
                                  <span className="text-xs font-semibold uppercase tracking-wide">
                                    {filterStatus === 'POSTED' && !hasPostedTransactionsInScope && hasVoidedTransactionsInScope
                                      ? (filterAccountId
                                          ? 'Tidak ada mutasi posted untuk rekening ini. Ada mutasi voided, pindah ke tab VOIDED.'
                                          : 'Tidak ada transaksi posted. Ada transaksi voided, pindah ke tab VOIDED.')
                                      : (filterAccountId
                                          ? `Belum ada mutasi ${filterStatus.toLowerCase()} untuk rekening ini`
                                          : `Tidak ada transaksi ${filterStatus.toLowerCase()}`)}
                                  </span>
                                </div>
                              </td>
                            </tr>
                          ) : (
                            filteredTransactions.map((tx) => {
                              const isExpanded = expandedTransactionId === tx.id
                              const transactionTypeLabel = tx.type === 'IN'
                                ? 'Kas Masuk'
                                : tx.type === 'OUT'
                                  ? 'Kas Keluar'
                                  : 'Transfer'
                              const categoryDetail = tx.category?.code
                                ? `${tx.category.code} • ${tx.category.name || 'Tanpa Nama Akun'}`
                                : (tx.category?.name || '-')
                              const accountLabel = tx.bank_account?.bank_name || 'Rekening'
                              const accountNumber = tx.bank_account?.account_number
                              const updatedAtLabel = tx.updated_at && tx.updated_at !== tx.created_at
                                ? formatDateTime(tx.updated_at)
                                : '-'

                              return (
                                <React.Fragment key={tx.id}>
                                  <tr className={`${isExpanded ? 'bg-slate-50/80' : 'hover:bg-slate-50/80'} transition-all group`}>
                                    <td className="px-8 py-6 align-top">
                                      <div className="flex flex-col">
                                        <span className="text-xs font-semibold text-slate-900 font-mono italic">#{tx.id.substring(0,6)}</span>
                                        <span className="text-[10px] font-bold text-slate-400 mt-1">{formatDate(tx.transaction_date, 'short')}</span>
                                      </div>
                                    </td>
                                    <td className="px-8 py-6 align-top">
                                      <div className="flex flex-col gap-1.5">
                                        <span className="text-sm font-semibold text-slate-900 leading-tight">{tx.description}</span>
                                        <div className="flex items-center gap-2">
                                          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 rounded text-[9px] font-semibold text-slate-500 uppercase">
                                            <Building size={10} /> {accountLabel}
                                          </div>
                                          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-blue-50 rounded text-[9px] font-semibold text-indigo-500 uppercase">
                                            <Activity size={10} /> {tx.category?.name || 'Uncategorized'}
                                          </div>
                                          {isHoldingView && (tx.org_name || tx.org_id !== orgId) ? (
                                            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 rounded text-[9px] font-semibold text-emerald-600 uppercase">
                                              <Building2 size={10} /> {tx.org_name || 'Entitas'}{tx.branch_name ? ` / ${tx.branch_name}` : ''}
                                            </div>
                                          ) : null}
                                        </div>
                                      </div>
                                    </td>
                                    <td className={`px-8 py-6 align-top text-right font-semibold font-mono tracking-tighter text-sm ${tx.type === 'IN' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                      {tx.type === 'IN' ? '+' : '-'} {formatRupiah(tx.amount)}
                                    </td>
                                    <td className="px-8 py-6 align-top text-center">
                                      <div className="flex items-center justify-center gap-2">
                                        <button
                                          type="button"
                                          onClick={() => setExpandedTransactionId((currentId) => currentId === tx.id ? null : tx.id)}
                                          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-600 transition-colors hover:bg-slate-100"
                                        >
                                          Detail
                                          <ChevronDown size={12} className={isExpanded ? 'rotate-180 transition-transform' : 'transition-transform'} />
                                        </button>
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
                                      </div>
                                    </td>
                                  </tr>
                                  {isExpanded ? (
                                    <tr className="bg-slate-50/50">
                                      <td colSpan={4} className="px-8 pb-8">
                                        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                                          <div className="mb-4 flex items-center justify-between gap-3">
                                            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-700">Detail Riwayat Mutasi</h4>
                                            <span className={`rounded-lg px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${tx.status === 'POSTED' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}`}>
                                              {tx.status}
                                            </span>
                                          </div>
                                          <div className="grid grid-cols-1 gap-4 text-xs text-slate-600 md:grid-cols-2 lg:grid-cols-3">
                                            <div>
                                              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Jenis Mutasi</p>
                                              <p className="mt-1 font-bold text-slate-900">{transactionTypeLabel}</p>
                                            </div>
                                            <div>
                                              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Tanggal Transaksi</p>
                                              <p className="mt-1 font-bold text-slate-900">{formatDate(tx.transaction_date, 'long')}</p>
                                            </div>
                                            <div>
                                              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Dicatat Pada</p>
                                              <p className="mt-1 font-bold text-slate-900">{formatDateTime(tx.created_at)}</p>
                                            </div>
                                            <div>
                                              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Rekening</p>
                                              <p className="mt-1 font-bold text-slate-900">{accountLabel}{accountNumber ? ` • ${accountNumber}` : ''}</p>
                                            </div>
                                            <div>
                                              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Akun Lawan</p>
                                              <p className="mt-1 font-bold text-slate-900">{categoryDetail}</p>
                                            </div>
                                            <div>
                                              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Nomor Referensi</p>
                                              <p className="mt-1 font-bold text-slate-900">{tx.reference_number || '-'}</p>
                                            </div>
                                            <div>
                                              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Jurnal Terkait</p>
                                              <p className="mt-1 font-bold text-slate-900">{tx.journal_entry_id || '-'}</p>
                                            </div>
                                            <div>
                                              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Terakhir Diperbarui</p>
                                              <p className="mt-1 font-bold text-slate-900">{updatedAtLabel}</p>
                                            </div>
                                            <div>
                                              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">ID Mutasi Lengkap</p>
                                              <p className="mt-1 break-all font-mono text-[11px] font-bold text-slate-900">{tx.id}</p>
                                            </div>
                                            {isHoldingView && (tx.org_name || tx.org_id !== orgId) ? (
                                              <div className="md:col-span-2 lg:col-span-3">
                                                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Entitas</p>
                                                <p className="mt-1 font-bold text-slate-900">
                                                  {tx.org_name || 'Entitas'}{tx.branch_name ? ` / ${tx.branch_name}` : ''}
                                                </p>
                                              </div>
                                            ) : null}
                                          </div>
                                        </div>
                                      </td>
                                    </tr>
                                  ) : null}
                                </React.Fragment>
                              )
                            })
                         )}
                      </tbody>
                    </table>
                  </div>
                </SectionCard>
              </div>

              <div className="space-y-8">
                 <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-5 text-white relative overflow-hidden group shadow-md">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl" />
                    <div className="relative z-10 space-y-8">
                      <div className="w-16 h-16 rounded-[24px] bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
                        <TrendingUp size={32} className="text-emerald-400" />
                      </div>
                      <div className="space-y-3">
                        <h3 className="font-semibold text-2xl tracking-tighter italic">Auto-Journaling Engine</h3>
                        <p className="text-xs text-slate-400 font-medium leading-relaxed">Setiap mutasi kas akan otomatis meluncurkan entri jurnal ganda di CoA organisasi Anda. Akuntabilitas instan tanpa input manual.</p>
                      </div>
                      <div className="pt-4">
                        <StatusBadge label="Powered by Nizam Intelligence" variant="indigo" />
                      </div>
                    </div>
                 </div>

                 <SectionCard className="p-5 space-y-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-500 shadow-sm border border-blue-100">
                        <Download size={20} />
                      </div>
                      <h4 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">Ekspor Laporan</h4>
                    </div>
                    <p className="text-xs text-slate-400 font-medium">Download mutasi kas dalam format PDF atau Excel untuk keperluan audit dan arsip.</p>
                    <div className="grid grid-cols-2 gap-3">
                       <button className="py-4 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl text-[10px] font-semibold uppercase tracking-wide transition-all">Format PDF</button>
                       <button className="py-4 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl text-[10px] font-semibold uppercase tracking-wide transition-all">Format XLSX</button>
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
              {isHoldingView ? (
                <div className="rounded-xl border border-blue-200 bg-blue-50 px-6 py-4 text-sm font-semibold text-blue-900 shadow-sm">
                  Mode holding tetap mengizinkan rekonsiliasi, tetapi proses impor CSV hanya berjalan untuk {reconcileScopeLabel}. Gunakan toggle `Kas Induk` jika Anda ingin fokus penuh pada rekening organisasi induk saja.
                </div>
              ) : null}
              <SectionCard className="p-5 space-y-10">
                <div className="space-y-4">
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide ml-1">Pilih Rekening Target</label>
                  <div className="grid grid-cols-1 gap-3">
                    {bankAccounts.map(acc => (
                      <button
                        key={acc.id}
                        onClick={() => setSelectedBankId(acc.id)}
                        className={`flex items-center gap-4 px-6 py-5 rounded-xl border-2 text-left transition-all group ${selectedBankId === acc.id ? 'bg-emerald-50 border-emerald-500 text-emerald-900 shadow-md shadow-emerald-100' : 'bg-white border-slate-100 hover:border-slate-200'}`}
                      >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${selectedBankId === acc.id ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-200' : 'bg-slate-50 text-slate-400 group-hover:bg-slate-100'}`}>
                           <Building2 size={20} />
                        </div>
                        <div>
                          <span className="text-xs font-semibold uppercase tracking-tight block">{acc.bank_name}</span>
                          <span className="text-[10px] font-medium text-slate-400 font-mono tracking-tighter">{acc.account_number || 'Cash Asset Account'}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-6 pt-10 border-t border-slate-50">
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-slate-900 uppercase tracking-wide tracking-tighter">Import CSV Mutasi</h4>
                    <p className="text-[10px] text-slate-400 font-medium leading-relaxed italic">
                      Unggah riwayat transaksi dari e-banking (BCA, Mandiri, BNI, dll) untuk pencocokan otomatis pada {reconcileScopeLabel}.
                    </p>
                  </div>
                  <form onSubmit={handleUploadCSV} className="space-y-6">
                    <div className="relative group">
                       <input type="file" name="csv" accept=".csv" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                       <div className="w-full py-12 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center gap-4 group-hover:bg-slate-50 group-hover:border-blue-400 group-hover:text-blue-500 transition-all duration-300 shadow-inner">
                          <Upload size={32} strokeWidth={1.5} />
                          <div className="text-center">
                            <span className="text-[10px] font-semibold uppercase tracking-wide block">Seret & Lepas File</span>
                            <span className="text-[8px] font-bold text-slate-400 uppercase mt-1 tracking-wide">Atau klik untuk memilih (.csv)</span>
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
                        <th className="px-8 py-5 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Tanggal</th>
                        <th className="px-8 py-5 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Keterangan Bank</th>
                        <th className="px-8 py-5 text-[10px] font-semibold text-slate-400 uppercase tracking-wide text-right">Nominal (IDR)</th>
                        <th className="px-8 py-5 text-[10px] font-semibold text-slate-400 uppercase tracking-wide text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td colSpan={4} className="py-40 text-center">
                          <div className="flex flex-col items-center gap-6 text-slate-200">
                            <div className="w-24 h-24 rounded-xl bg-slate-50/50 flex items-center justify-center border border-slate-100 shadow-inner"><Building2 size={48} strokeWidth={1} /></div>
                            <span className="text-xs font-semibold uppercase tracking-wide text-slate-300">Belum ada mutasi yang diunggah</span>
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
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-lg bg-white rounded-xl shadow-md overflow-hidden flex flex-col">
               <div className="px-10 py-8 bg-emerald-600 text-white flex justify-between items-start">
                  <div>
                    <h3 className="text-2xl font-semibold tracking-tight flex items-center gap-3"><Building2 /> Add Bank Account</h3>
                    <p className="text-xs text-emerald-100 mt-1 font-medium italic">Define a new ledger account for your cash or bank assets.</p>
                  </div>
                  <button onClick={() => setShowAccountModal(false)} className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center hover:bg-white/20 transition"><X size={20} /></button>
               </div>

               <form onSubmit={handleCreateAccount} className="p-5 space-y-6">
                 <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide ml-1">Account Display Name</label>
                    <input name="bank_name" required placeholder="e.g. BCA Operasional Utama" className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-xl outline-none text-sm font-bold focus:bg-white focus:border-emerald-500 transition-all shadow-inner" />
                 </div>

                 <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide ml-1 flex items-center gap-1.5"><Hash size={12}/> Account Number</label>
                      <input name="account_number" placeholder="8821..." className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-xl outline-none text-sm font-semibold font-mono focus:bg-white focus:border-emerald-500 transition-all shadow-inner" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide ml-1 flex items-center gap-1.5"><User size={12}/> Holder Name</label>
                      <input name="account_holder" placeholder="PT. Nizam Digital" className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-xl outline-none text-sm font-bold focus:bg-white focus:border-emerald-500 transition-all shadow-inner" />
                    </div>
                 </div>

                 {placementNodes.length > 0 ? (
                   <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide ml-1">Penempatan Rekening (Organisasi & Unit)</label>
                      <div className="relative">
                        <select 
                          name="target_org_branch" 
                          defaultValue={`${orgId}|${activeBranchId || ''}`}
                          onChange={(e) => {
                             const selectedOrgId = e.target.value.split('|')[0]
                             setTargetOrgId(selectedOrgId)
                          }}
                          className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-xl outline-none text-sm font-bold appearance-none focus:bg-white focus:border-emerald-500 transition-all shadow-inner"
                        >
                           {placementNodes.map(node => (
                             <optgroup key={node.orgId} label={`Organisasi: ${node.orgName}`}>
                               {node.branches.length === 0 && (
                                 <option value={`${node.orgId}|`}>Kantor Utama</option>
                               )}
                               {node.branches.map(b => (
                                 <option key={b.id} value={`${node.orgId}|${b.id}`}>{b.name}</option>
                               ))}
                             </optgroup>
                           ))}
                        </select>
                        <ChevronRight className="absolute right-5 top-1/2 -translate-y-1/2 rotate-90 text-slate-300 pointer-events-none" size={16} />
                      </div>
                   </div>
                 ) : (
                   branches.length > 0 && (
                     <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide ml-1">Penempatan Rekening (Unit)</label>
                        <div className="relative">
                          <select name="target_branch_id" defaultValue={activeBranchId || undefined} className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-xl outline-none text-sm font-bold appearance-none focus:bg-white focus:border-emerald-500 transition-all shadow-inner">
                             {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                          </select>
                          <ChevronRight className="absolute right-5 top-1/2 -translate-y-1/2 rotate-90 text-slate-300 pointer-events-none" size={16} />
                        </div>
                     </div>
                   )
                 )}

                 <div className="space-y-1">
                    <input type="hidden" name="account_id" value={glAccountId} />
                    <SearchableSelect
                      label="Mapped GL Account (CoA)"
                      options={dynamicGlAccounts}
                      value={glAccountId}
                      onChange={setGlAccountId}
                      placeholder="Select Asset Account..."
                      required={true}
                    />
                 </div>

                 <div className="flex gap-4 pt-6 border-t border-slate-50">
                   <button type="button" onClick={() => setShowAccountModal(false)} className="flex-1 py-5 text-xs font-semibold uppercase tracking-wide text-slate-400 hover:text-slate-600 transition-colors">Cancel</button>
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
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeTransactionModal} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-xl bg-white rounded-xl shadow-md overflow-hidden flex flex-col max-h-[90vh]">
               <div className="px-10 py-8 bg-blue-600 text-white flex justify-between items-start shrink-0">
                  <div>
                    <h3 className="text-2xl font-semibold tracking-tight flex items-center gap-3">
                       {txType === 'IN' ? <ArrowDownRight /> : txType === 'OUT' ? <ArrowUpRight /> : <ArrowRightLeft />}
                       Record {txType === 'TRANSFER' ? 'Transfer' : 'Mutation'}
                    </h3>
                    <p className="text-xs text-blue-100 mt-1 font-medium italic">Create an instant double-entry transaction record.</p>
                  </div>
                  <div className="flex bg-white/10 p-1 rounded-xl border border-white/20">
                     <button type="button" onClick={() => setTxType('IN')} className={`px-4 py-2 text-[9px] font-semibold uppercase tracking-wide rounded-xl transition-all ${txType === 'IN' ? 'bg-white text-emerald-600 shadow-md' : 'text-blue-100 hover:bg-white/5'}`}>IN</button>
                     <button type="button" onClick={() => setTxType('OUT')} className={`px-4 py-2 text-[9px] font-semibold uppercase tracking-wide rounded-xl transition-all ${txType === 'OUT' ? 'bg-white text-rose-600 shadow-md' : 'text-blue-100 hover:bg-white/5'}`}>OUT</button>
                     <button type="button" onClick={() => setTxType('TRANSFER')} className={`px-4 py-2 text-[9px] font-semibold uppercase tracking-wide rounded-xl transition-all ${txType === 'TRANSFER' ? 'bg-white text-blue-600 shadow-md' : 'text-blue-100 hover:bg-white/5'}`}>XFER</button>
                  </div>
               </div>

               <form onSubmit={handleCreateTransaction} className="flex-1 overflow-y-auto p-5 space-y-8">
                 <input type="hidden" name="type" value={txType} />
                 
                 <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide ml-1">Source Account</label>
                      <select
                        name="bank_account_id"
                        required
                        value={txBankAccountId}
                        onChange={(e) => {
                          const nextBankId = e.target.value
                          setTxBankAccountId(nextBankId)
                          if (txType === 'TRANSFER') {
                            setTxTargetBankId('')
                            setTxSourceCounterAccountId('')
                            setTxTargetCounterAccountId('')
                          } else if (nextBankId === txTargetBankId) {
                            setTxTargetBankId('')
                          }
                        }}
                        className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold shadow-inner outline-none focus:bg-white focus:border-blue-500 transition-all"
                      >
                         <option value="">Select Account...</option>
                         {bankAccounts.map(acc => <option key={acc.id} value={acc.id}>{acc.bank_name}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide ml-1">Date</label>
                      <input type="date" name="transaction_date" value={txDate} onChange={(e) => setTxDate(e.target.value)} required className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold shadow-inner outline-none focus:bg-white focus:border-blue-500 transition-all font-mono" />
                    </div>
                 </div>

                 <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide ml-1">Transaction Description</label>
                     <input 
                        name="description" 
                        required 
                        placeholder="e.g. Payment for Store Rent / Office Supplies" 
                        value={txDescription}
                        onChange={(e) => setTxDescription(e.target.value)}
                        className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold shadow-inner outline-none focus:bg-white focus:border-blue-500 transition-all" 
                     />
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                    <div className="space-y-1">
                      <CurrencyInput
                         label="Total Amount"
                         value={txAmount}
                         onChange={setTxAmount}
                         name="amount"
                         highlight={true}
                      />
                      {shouldCheckAvailableCash ? (
                        !txBankAccountId ? (
                          <p className="text-[10px] font-bold text-slate-400 ml-1">Pilih rekening sumber untuk melihat available kas.</p>
                        ) : (
                          <div className="space-y-1 ml-1">
                            <p className="text-[10px] font-bold text-emerald-600">
                              Available Kas: {formatRupiah(availableCashBalance)}
                            </p>
                            {isAmountExceedingAvailable ? (
                              <p className="text-[10px] font-semibold text-rose-600">
                                Nominal melampaui available sebesar {formatRupiah(txAmount - availableCashBalance)}.
                              </p>
                            ) : null}
                          </div>
                        )
                      ) : null}
                    </div>
                    
                    <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.1em] ml-1 flex items-center gap-1.5">
                          <ExternalLink size={12}/> {txType === 'TRANSFER' ? 'Target Account' : 'Counterparty Account'}
                        </label>
                        {txType === 'TRANSFER' ? (
                          <>
                            <select
                              name="target_bank_account_id"
                              value={txTargetBankId}
                              onChange={(e) => {
                                setTxTargetBankId(e.target.value)
                                setTxSourceCounterAccountId('')
                                setTxTargetCounterAccountId('')
                              }}
                              required
                              className="w-full px-6 py-4 bg-slate-900 text-white rounded-xl text-xs font-semibold uppercase tracking-wide outline-none shadow-xl border border-slate-800 transition-all"
                            >
                               <option value="">Select Target...</option>
                               {transferTargetBankOptions.map((bankAccount) => (
                                   <option key={bankAccount.id} value={bankAccount.id} className="text-white">
                                     {bankAccount.bank_name}
                                     {bankAccount.account_number ? ` (${bankAccount.account_number})` : ''}
                                     {bankAccount.org_id !== orgId
                                       ? ` — ${(bankAccount.org_name || 'Entitas Anak')}${bankAccount.branch_name ? ` / ${bankAccount.branch_name}` : ''}`
                                       : bankAccount.branch_name ? ` — ${bankAccount.branch_name}` : ''}
                                   </option>
                                 ))}
                            </select>
                            <p className="text-[10px] font-bold text-blue-500 ml-1">
                              {isInterOrgTransfer
                                ? 'Transfer lintas entitas: pilih rekening entitas tujuan yang sudah diajukan dan aktif. Sistem akan posting OUT investasi di organisasi induk dan IN pendanaan di entitas tujuan.'
                                : 'Target harus rekening kas/bank lain dalam unit aktif yang sama.'}
                            </p>
                          </>
                        ) : (
                          <>
                            <input type="hidden" name="category_id" value={txCategoryId} />
                            <SearchableSelect
                              dark
                              options={categoryAccounts}
                              value={txCategoryId}
                              onChange={(val) => { if (!isCategoryLocked) setTxCategoryId(val) }}
                              placeholder="Select Ledger Account..."
                            />
                            {isCategoryLocked && (
                              <p className="text-[10px] font-bold text-indigo-500 ml-1">Akun lawan dikunci dari shortcut aging agar settlement tetap masuk ke akun piutang/hutang yang benar.</p>
                            )}
                          </>
                        )}
                    </div>
                 </div>

                 {txType === 'TRANSFER' && isInterOrgTransfer && (
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <div className="space-y-1">
                       <input type="hidden" name="source_counter_account_id" value={effectiveSourceCounterAccountId} />
                       <SearchableSelect
                         label="Akun Investasi Induk (OUT)"
                         dark
                         options={sourceInterOrgCounterAccounts}
                         value={effectiveSourceCounterAccountId}
                         onChange={setTxSourceCounterAccountId}
                         placeholder="Select Source Investment Account..."
                       />
                       {sourceInterOrgCounterAccounts.length > 0 ? (
                         <p className="text-[10px] font-bold text-blue-500 ml-1">
                           Gunakan akun investasi organisasi induk, idealnya 1601 Investasi pada Entitas Anak / Unit.
                         </p>
                       ) : (
                         <p className="text-[10px] font-bold text-amber-600 ml-1">
                           Akun investasi organisasi induk belum tersedia. Jalankan migrasi terbaru atau sinkronkan CoA terlebih dahulu.
                         </p>
                       )}
                     </div>
                     <div className="space-y-1">
                       <input type="hidden" name="target_counter_account_id" value={effectiveTargetCounterAccountId} />
                       <SearchableSelect
                         label="Akun Modal/Pendanaan Entitas Tujuan (IN)"
                         dark
                         options={targetFinancingAccounts}
                         value={effectiveTargetCounterAccountId}
                         onChange={setTxTargetCounterAccountId}
                         placeholder="Select Target Financing Account..."
                       />
                       <p className="text-[10px] font-bold text-blue-500 ml-1">
                         Gunakan akun pendanaan/modal milik penerima, biasanya 3001 Modal Disetor.
                       </p>
                     </div>
                   </div>
                 )}

                 <div className="bg-slate-50 p-6 rounded-xl border border-slate-100 text-[10px] font-medium text-slate-400 leading-relaxed italic flex gap-3">
                    <AlertCircle size={16} className="shrink-0 text-slate-300" />
                    {txType === 'OUT'
                      ? 'Choosing an EXPENSE account will decrease equity. Choosing a LIABILITY will settle or create a debt.'
                      : txType === 'IN'
                        ? 'Choosing REVENUE will increase equity. Choosing an ASSET account like Accounts Receivable will settle a customer debt.'
                        : isInterOrgTransfer
                          ? 'Transfer modal antar entitas membuat dua jurnal otomatis: organisasi induk mencatat arus kas investasi, sedangkan entitas penerima mencatat arus kas pendanaan pada rekening target yang dipilih.'
                          : 'A transfer credits the source bank account and debits the target bank account in the same unit.'}
                 </div>

                 <div className="flex gap-4 pt-4 shrink-0">
                   <button type="button" onClick={closeTransactionModal} className="flex-1 py-5 text-xs font-semibold uppercase tracking-wide text-slate-400 hover:text-slate-600 transition-colors">Abort</button>
                   <SafeButton
                     type="submit"
                     variant="primary"
                     size="lg"
                     className="flex-[2] shadow-md shadow-blue-100"
                     isLoading={loading}
                     disabled={isAmountExceedingAvailable}
                   >
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
            <motion.div initial={{ x: 100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 100, opacity: 0 }} className="bg-red-50 border border-red-100 px-6 py-4 rounded-xl shadow-xl flex items-center gap-3 text-red-600 text-sm font-bold">
              <AlertCircle size={18} /> {error}
            </motion.div>
          )}
          {success && (
            <motion.div initial={{ x: 100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 100, opacity: 0 }} className="bg-emerald-50 border border-emerald-100 px-6 py-4 rounded-xl shadow-xl flex items-center gap-3 text-emerald-600 text-sm font-bold">
              <CheckCircle2 size={18} /> {success}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  {ConfirmUI}
  )
}
