'use client'

import React, { useState } from 'react'
import { Plus, X, Trash2, Download, FileText, History, CheckCircle2, AlertCircle, Wallet, ListChecks, FilePlus, Search, Loader2, Calculator, ArrowRightLeft } from 'lucide-react'
import { PageHeader, StatCard, SectionCard, SectionHeader, StatusBadge, SafeButton } from '@/components/ui/NizamUI'
import { createJournalEntry, postJournalEntry, voidJournalEntry, hardDeleteDraftJournal, getJournalEntries, getAccountLedger } from '@/modules/accounting/actions/journal.actions'
import type { AccountLedgerResult } from '@/modules/accounting/actions/journal.actions'
import { CurrencyInput } from '@/components/ui/CurrencyInput'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { motion, AnimatePresence } from 'framer-motion'
import { formatRupiah } from '@/lib/utils'
import { format } from 'date-fns'

type JournalEntryItem = {
  id?: string | null
  status?: string | null
  [key: string]: any
}

interface JournalClientProps {
  orgId: string
  initialEntries: JournalEntryItem[]
  initialFilterStatus?: JournalStatusFilter
  initialLoadedCounts: Record<JournalStatusFilter, number>
  accounts: any[]
  fiscalPeriods: any[]
  userRole: string
  activeBranchId: string | null
  activeBranchName: string | null
}

type JournalStatusFilter = 'POSTED' | 'VOIDED' | 'DRAFT'
const JOURNAL_PAGE_SIZE = 100
const EMPTY_ACCOUNT_LEDGER: AccountLedgerResult = {
  account: null,
  summary: {
    openingBalance: 0,
    totalDebit: 0,
    totalCredit: 0,
    endingBalance: 0,
    rowCount: 0,
  },
  rows: [],
  hasMore: false,
}

type PurchaseTransparencySummary = {
  subtotal?: number
  lineDiscount?: number
  headerDiscount?: number
  subtotalAfterDiscount?: number
  landedCost?: number
  inventoryValue?: number
  tax?: number
  grandTotal?: number
  note?: string | null
}

function uniqueJournalEntries(entries: JournalEntryItem[]) {
  const entriesById = new Map<string, JournalEntryItem>()

  for (const entry of entries) {
    const id = String(entry?.id || '').trim()
    if (!id || entriesById.has(id)) continue
    entriesById.set(id, entry)
  }

  return Array.from(entriesById.values())
}

export default function JournalClient({
  orgId,
  initialEntries,
  initialFilterStatus = 'POSTED',
  initialLoadedCounts,
  accounts,
  fiscalPeriods,
  userRole,
  activeBranchId,
  activeBranchName,
}: JournalClientProps) {
  const toAmount = (value: unknown) => {
    const parsed = Number(value ?? 0)
    return Number.isFinite(parsed) ? parsed : 0
  }

  const [entries, setEntries] = useState<JournalEntryItem[]>(initialEntries)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [filterStatus, setFilterStatus] = useState<JournalStatusFilter>(initialFilterStatus)
  const [searchText, setSearchText] = useState('')
  const [activeSearch, setActiveSearch] = useState('')
  const [searchResults, setSearchResults] = useState<JournalEntryItem[] | null>(null)
  const [searchHasMore, setSearchHasMore] = useState(false)
  const [accountSearch, setAccountSearch] = useState('')
  const [selectedAccountId, setSelectedAccountId] = useState('')
  const [accountLedger, setAccountLedger] = useState<AccountLedgerResult>(EMPTY_ACCOUNT_LEDGER)
  const [isLoadingAccountLedger, setIsLoadingAccountLedger] = useState(false)
  const [isLoadingEntries, setIsLoadingEntries] = useState(false)
  const [loadedCountByStatus, setLoadedCountByStatus] = useState<Record<JournalStatusFilter, number>>(initialLoadedCounts)
  const [hasMoreByStatus, setHasMoreByStatus] = useState<Record<JournalStatusFilter, boolean>>(() => ({
    POSTED: initialLoadedCounts.POSTED >= JOURNAL_PAGE_SIZE,
    VOIDED: initialLoadedCounts.VOIDED >= JOURNAL_PAGE_SIZE,
    DRAFT: initialLoadedCounts.DRAFT >= JOURNAL_PAGE_SIZE,
  }))
  
  const isOwner = userRole === 'owner'

  const getPurchaseTransparency = (entry: any): PurchaseTransparencySummary | null => {
    if (!entry || typeof entry !== 'object') return null
    const summary = entry.purchase_transparency
    return summary && typeof summary === 'object' ? (summary as PurchaseTransparencySummary) : null
  }

  const getLedgerDisclosureNote = (entry: any) => {
    const notes = typeof entry?.notes === 'string' ? entry.notes.trim() : ''
    if (notes) return notes
    return String(getPurchaseTransparency(entry)?.note || '').trim()
  }
  
  // Form State
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0])
  const [description, setDescription] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<{ id: number, account_id: string, debit: number, credit: number, memo: string }[]>([
    { id: 1, account_id: '', debit: 0, credit: 0, memo: '' },
    { id: 2, account_id: '', debit: 0, credit: 0, memo: '' }
  ])
  const canCreateManualJournal = Boolean(activeBranchId)
  const closedFiscalPeriods = (fiscalPeriods || []).filter((period: any) => period?.is_closed)

  const totalDebit = lines.reduce((sum: number, line: any) => sum + (line.debit || 0), 0)
  const totalCredit = lines.reduce((sum: number, line: any) => sum + (line.credit || 0), 0)
  const isBalanced = totalDebit === totalCredit && totalDebit > 0

  const getClosedPeriodForDate = (date?: string | null) => {
    const normalizedDate = String(date || '').trim()
    if (!normalizedDate) return null

    return closedFiscalPeriods.find((period: any) =>
      String(period?.start_date || '') <= normalizedDate &&
      String(period?.end_date || '') >= normalizedDate
    ) || null
  }

  const selectedClosedPeriod = getClosedPeriodForDate(entryDate)
  const statusEntries = entries.filter((entry) => entry.status === filterStatus)
  const visibleEntries = searchResults || statusEntries
  const canLoadMoreEntries = activeSearch ? searchHasMore : hasMoreByStatus[filterStatus]
  const selectedAccount = accounts.find((account: any) => String(account?.id || '') === selectedAccountId) || null
  const normalizedAccountSearch = accountSearch.trim().toLowerCase()
  const accountOptions = normalizedAccountSearch
    ? accounts
      .filter((account: any) => {
        if (account?.is_active === false) return false
        const label = `${account?.code || ''} ${account?.name || ''}`.toLowerCase()
        return label.includes(normalizedAccountSearch)
      })
      .slice(0, 8)
    : []
  const isAccountLedgerMode = Boolean(selectedAccountId)

  const setStatusFilter = (status: JournalStatusFilter) => {
    setFilterStatus(status)
    setSearchText('')
    setActiveSearch('')
    setSearchResults(null)
    setSearchHasMore(false)
    resetAccountLedger()
  }

  function resetAccountLedger() {
    setSelectedAccountId('')
    setAccountSearch('')
    setAccountLedger(EMPTY_ACCOUNT_LEDGER)
  }

  const loadAccountLedgerPage = async (accountId = selectedAccountId, options?: { reset?: boolean }) => {
    const normalizedAccountId = String(accountId || '').trim()
    if (!normalizedAccountId) return

    const reset = Boolean(options?.reset)
    const offset = reset ? 0 : accountLedger.rows.length

    setIsLoadingAccountLedger(true)
    try {
      const nextLedger = await getAccountLedger(orgId, {
        account_id: normalizedAccountId,
        branch_id: activeBranchId || undefined,
        status: 'POSTED',
        limit: JOURNAL_PAGE_SIZE,
        offset,
      })

      setAccountLedger((currentLedger) => {
        if (reset) return nextLedger

        return {
          ...nextLedger,
          rows: [
            ...currentLedger.rows,
            ...nextLedger.rows.filter((row) => !currentLedger.rows.some((currentRow) => currentRow.line_id === row.line_id)),
          ],
        }
      })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : ''
      alert(message || 'Gagal memuat mutasi akun.')
    } finally {
      setIsLoadingAccountLedger(false)
    }
  }

  const handleSelectAccount = async (account: any) => {
    const accountId = String(account?.id || '').trim()
    if (!accountId) return

    setSelectedAccountId(accountId)
    setAccountSearch(`${account?.code || ''} - ${account?.name || ''}`.trim())
    setSearchText('')
    setActiveSearch('')
    setSearchResults(null)
    setSearchHasMore(false)
    await loadAccountLedgerPage(accountId, { reset: true })
  }

  const loadJournalEntriesPage = async (options?: { reset?: boolean; search?: string }) => {
    const reset = Boolean(options?.reset)
    const search = String(options?.search ?? activeSearch).trim()
    const offset = reset
      ? 0
      : search
        ? (searchResults?.length || 0)
        : loadedCountByStatus[filterStatus]

    setIsLoadingEntries(true)
    try {
      const nextEntries = await getJournalEntries(orgId, {
        branch_id: activeBranchId || undefined,
        status: filterStatus,
        search: search || undefined,
        limit: JOURNAL_PAGE_SIZE,
        offset,
      })

      setActiveSearch(search)

      if (search) {
        setSearchResults((currentResults) => (
          reset
            ? nextEntries
            : uniqueJournalEntries([...(currentResults || []), ...nextEntries])
        ))
        setSearchHasMore(nextEntries.length >= JOURNAL_PAGE_SIZE)
        return
      }

      setSearchResults(null)
      setSearchHasMore(false)
      setEntries((currentEntries) => {
        const nextStatusEntries = reset
          ? nextEntries
          : uniqueJournalEntries([...statusEntries, ...nextEntries])
        const otherStatusEntries = currentEntries.filter((entry) => entry.status !== filterStatus)

        return uniqueJournalEntries([...otherStatusEntries, ...nextStatusEntries])
      })
      setLoadedCountByStatus((current) => ({
        ...current,
        [filterStatus]: reset
          ? nextEntries.length
          : current[filterStatus] + nextEntries.length,
      }))
      setHasMoreByStatus((current) => ({
        ...current,
        [filterStatus]: nextEntries.length >= JOURNAL_PAGE_SIZE,
      }))
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : ''
      alert(message || 'Gagal memuat data jurnal.')
    } finally {
      setIsLoadingEntries(false)
    }
  }

  const handleSearchEntries = async (event?: React.FormEvent<HTMLFormElement>) => {
    event?.preventDefault()
    await loadJournalEntriesPage({ reset: true, search: searchText })
  }

  const handleResetSearch = async () => {
    setSearchText('')
    await loadJournalEntriesPage({ reset: true, search: '' })
  }

  const stats = {
    postedCount: entries.filter((e: any) => e.status === 'POSTED').length,
    draftCount: entries.filter((e: any) => e.status === 'DRAFT').length,
    totalVolume: entries
      .filter((e: any) => e.status === 'POSTED')
      .reduce((sum: number, e: any) => {
        const journalLines = Array.isArray(e?.journal_lines) ? e.journal_lines : []
        const debitSum = journalLines.reduce((acc: number, l: any) => acc + toAmount(l?.debit), 0)
        return toAmount(sum) + toAmount(debitSum)
      }, 0),
    voidedToday: entries.filter((e: any) => e.status === 'VOIDED' && e.entry_date === new Date().toISOString().split('T')[0]).length
  }

  const addLine = () => {
    setLines([...lines, { id: Date.now(), account_id: '', debit: 0, credit: 0, memo: '' }])
  }

  const removeLine = (id: number) => {
    if (lines.length <= 2) return alert("Minimal 2 baris jurnal")
    setLines(lines.filter((l: any) => l.id !== id))
  }

  const handleLineChange = (id: number, field: string, value: any) => {
    let newLines = lines.map((l: any) => l.id === id ? { ...l, [field]: value } : l)
    
    if (field === 'account_id' || field === 'debit' || field === 'credit') {
      const currentLine = newLines.find((l: any) => l.id === id)
      if (currentLine?.account_id) {
        const acc = accounts.find((a: any) => String(a.id) === String(currentLine.account_id))
        const accCode = acc ? String(acc.code) : ''
        const isSalaryAcc = acc?.name?.toLowerCase().includes('gaji') || accCode.startsWith('51') || accCode === '2401'
        
        if (isSalaryAcc) {
          const pphAcc = accounts.find((a: any) => String(a.code) === '2202' || a.name?.toLowerCase().includes('pph 21'))
          if (pphAcc) {
            let pphLine = newLines.find((l: any) => String(l.account_id) === String(pphAcc.id))
            if (!pphLine) {
              const emptyLineIndex = newLines.findIndex((l: any) => !l.account_id)
              if (emptyLineIndex !== -1) {
                newLines[emptyLineIndex] = { ...newLines[emptyLineIndex], account_id: pphAcc.id }
                pphLine = newLines[emptyLineIndex]
              } else {
                const newLine = { id: Date.now() + Math.random(), account_id: pphAcc.id, debit: 0, credit: 0, memo: '' }
                newLines = [...newLines, newLine]
                pphLine = newLine
              }
            }
            
            const salaryAmount = (currentLine.debit || currentLine.credit || 0)
            if (salaryAmount > 0 && pphLine.debit === 0 && pphLine.credit === 0) {
              const suggPPh = Math.floor(salaryAmount * 0.05)
              if (suggPPh > 0) {
                newLines = newLines.map((l: any) => {
                  if (String(l.account_id) === String(pphAcc.id)) {
                    return { ...l, credit: currentLine.debit > 0 ? suggPPh : 0, debit: currentLine.credit > 0 ? suggPPh : 0 }
                  }
                  return l
                })
              }
            }
          }
        }
      }
    }
    
    setLines(newLines)
  }

  const handleSubmit = async () => {
    if (!description || !entryDate) return alert("Deskripsi dan tanggal wajib diisi.")
    if (!isBalanced) return alert("Jurnal tidak seimbang (Balance)!")
    if (lines.some(l => !l.account_id)) return alert("Semua baris harus memilih akun (CoA).")
    if (selectedClosedPeriod) {
      return alert(`Periode fiskal ${selectedClosedPeriod.name} sudah ditutup. Jurnal tanggal ${entryDate} tidak dapat dibuat.`)
    }

    setIsSubmitting(true)
    try {
      const res = await createJournalEntry({
        org_id: orgId,
        entry_date: entryDate,
        description,
        notes,
        lines: lines.map((l: any) => ({
          account_id: l.account_id,
          debit: Number(l.debit),
          credit: Number(l.credit),
          memo: l.memo
        }))
      })

      if ((res as any).error) throw new Error((res as any).error)
      window.location.reload()
    } catch (error: any) {
      alert(error.message || "Gagal membuat jurnal")
      setIsSubmitting(false)
    }
  }

  const handlePost = async (id: string) => {
    if (!confirm("Posting jurnal ini? Jurnal tidak bisa diubah setelah di-posting.")) return
    const res = await postJournalEntry(id, orgId)
    if (res.error) alert(res.error)
    else window.location.reload()
  }

  const handleVoid = async (id: string) => {
    const reason = prompt("Alasan membatalkan jurnal ini:")
    if (!reason) return
    const res = await voidJournalEntry(id, orgId, reason)
    if (res.error) alert(res.error)
    else window.location.reload()
  }

  const handleExportXLSX = () => {
    const activeEntries = entries.filter((e: any) => e.status === filterStatus)
    if (activeEntries.length === 0) return alert("Tidak ada data untuk diunduh.")

    if (filterStatus !== 'POSTED') {
      return alert('Export Buku Besar format XLSX hanya untuk jurnal POSTED. Pilih filter POSTED terlebih dahulu.')
    }

    const params = new URLSearchParams({
      type: 'gl',
      orgId,
    })

    if (activeBranchId) {
      params.set('branchId', activeBranchId)
    }

    const link = document.createElement("a")
    link.href = `/api/export?${params.toString()}`
    link.click()
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-7xl mx-auto space-y-12 pb-24">
      <PageHeader
        icon={<FileText />}
        title="Journal Ledger"
        subtitle="Riwayat transaksi akuntansi, jurnal manual, dan otomatisasi."
        tag="Ledger Module"
        actions={
          <>
            <div className="flex bg-slate-100/60 p-1 rounded-xl border border-slate-100 mr-2 shadow-inner">
              {(['POSTED', 'VOIDED', 'DRAFT'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`cursor-pointer px-4 py-2 text-[10px] font-semibold uppercase tracking-wide rounded-xl transition-all ${filterStatus === s ? 'bg-white text-blue-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  {s}
                </button>
              ))}
            </div>
            <SafeButton 
              variant="white"
              icon={<Download size={16} />}
              onClick={handleExportXLSX}
            >
              Export XLSX
            </SafeButton>
            <SafeButton 
              variant="primary"
              icon={<Plus size={18} />}
              disabled={!canCreateManualJournal}
              onClick={() => setIsModalOpen(true)}
            >
              Jurnal Manual
            </SafeButton>
          </>
        }
      />

	      {!canCreateManualJournal ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-6 py-4 text-sm font-semibold text-amber-900 shadow-sm">
          Pilih unit aktif terlebih dahulu untuk membuat jurnal manual. Buku besar saat ini masih menampilkan data level organisasi.
        </div>
	      ) : (
	        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-6 py-4 text-sm font-semibold text-emerald-900 shadow-sm">
	          Jurnal manual baru akan dicatat ke unit aktif: <span className="font-semibold">{activeBranchName}</span>.
	        </div>
	      )}

        {selectedClosedPeriod && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-6 py-4 text-sm font-semibold text-rose-900 shadow-sm">
            Periode fiskal <span className="font-semibold">{selectedClosedPeriod.name}</span> sudah ditutup. Jurnal manual bertanggal <span className="font-semibold">{entryDate}</span> tidak dapat disimpan.
          </div>
        )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          label="Posted Dimuat"
          value={`${stats.postedCount} Entri`} 
          icon={CheckCircle2}
          color="emerald"
          sub="Bisa ditambah lewat Muat Lagi"
          onClick={() => setStatusFilter('POSTED')}
        />
        <StatCard 
          label="Draft Dimuat"
          value={`${stats.draftCount} Draft`} 
          icon={History}
          color="amber"
          alert={stats.draftCount > 0}
          sub="Belum diposting"
          onClick={() => setStatusFilter('DRAFT')}
        />
        <StatCard 
          label="Volume Dimuat"
          value={formatRupiah(stats.totalVolume)} 
          icon={Wallet}
          color="indigo"
          sub="Mutasi debit yang sudah dimuat"
          onClick={() => setStatusFilter('POSTED')}
        />
        <StatCard 
          label="Voided Dimuat Hari Ini"
          value={`${stats.voidedToday} Batal`} 
          icon={AlertCircle}
          color="rose"
          sub="Dari data yang sudah dimuat"
          onClick={() => setStatusFilter('VOIDED')}
        />
      </div>

      <SectionCard>
        <SectionHeader 
          title="Buku Besar Umum"
          subtitle={
            activeSearch
              ? `Hasil pencarian "${activeSearch}" pada status ${filterStatus}.`
              : `Menampilkan daftar jurnal entri dengan status ${filterStatus}.`
          }
          actions={
            <form onSubmit={handleSearchEntries} className="flex items-center gap-2">
              <div className="relative">
                <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder="Cari nomor/deskripsi"
                  className="h-10 w-56 rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-xs font-bold text-slate-700 outline-none transition-all placeholder:text-slate-300 focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                />
              </div>
              <button
                type="submit"
                disabled={isLoadingEntries}
                className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 text-[10px] font-semibold uppercase tracking-wide text-blue-600 transition-all hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoadingEntries ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
                Cari
              </button>
              {activeSearch && (
                <button
                  type="button"
                  onClick={handleResetSearch}
                  disabled={isLoadingEntries}
                  className="inline-flex h-10 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-semibold uppercase tracking-wide text-slate-500 transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Reset
                </button>
              )}
            </form>
          }
        />

        <div className="border-b border-slate-100 bg-white px-10 py-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="relative flex-1">
              <label className="mb-2 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Mutasi Per Akun
              </label>
              <div className="relative">
                <Calculator size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={accountSearch}
                  onChange={(event) => {
                    setAccountSearch(event.target.value)
                    setSelectedAccountId('')
                    setAccountLedger(EMPTY_ACCOUNT_LEDGER)
                  }}
                  placeholder="Cari akun, contoh: 1502 Kendaraan"
                  className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm font-bold text-slate-800 outline-none transition-all placeholder:text-slate-300 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50"
                />
              </div>
              {accountOptions.length > 0 && !selectedAccountId && (
                <div className="absolute left-0 right-0 top-[74px] z-20 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-md shadow-slate-200/70">
                  {accountOptions.map((account: any) => (
                    <button
                      key={account.id}
                      type="button"
                      onClick={() => handleSelectAccount(account)}
                      className="flex min-h-12 w-full cursor-pointer items-center justify-between gap-4 border-b border-slate-50 px-4 py-3 text-left transition-colors last:border-0 hover:bg-blue-50"
                    >
                      <span>
                        <span className="block text-sm font-semibold text-slate-800">{account.code} - {account.name}</span>
                        <span className="mt-0.5 block text-[10px] font-bold uppercase tracking-wide text-slate-400">
                          {account.type || 'ACCOUNT'} / Normal {account.normal_balance || '-'}
                        </span>
                      </span>
                      <ArrowRightLeft size={15} className="shrink-0 text-blue-500" />
                    </button>
                  ))}
                </div>
              )}
            </div>
            {selectedAccount && (
              <div className="flex items-center gap-3">
                <span className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-[10px] font-semibold uppercase tracking-wide text-blue-700">
                  {selectedAccount.code} - {selectedAccount.name}
                </span>
                <button
                  type="button"
                  onClick={resetAccountLedger}
                  className="inline-flex h-11 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-[10px] font-semibold uppercase tracking-wide text-slate-500 transition-all hover:bg-slate-50"
                >
                  Kembali Umum
                </button>
              </div>
            )}
          </div>
        </div>

        {isAccountLedgerMode ? (
          <>
            <div className="grid grid-cols-1 border-b border-slate-100 bg-slate-50/40 md:grid-cols-4">
              {[
                ['Saldo Awal', accountLedger.summary.openingBalance],
                ['Total Debit', accountLedger.summary.totalDebit],
                ['Total Kredit', accountLedger.summary.totalCredit],
                ['Saldo Akhir', accountLedger.summary.endingBalance],
              ].map(([label, value]) => (
                <div key={String(label)} className="border-b border-slate-100 px-10 py-6 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
                  <div className="mt-2 font-mono text-xl font-semibold tracking-tight text-slate-900">{formatRupiah(Number(value))}</div>
                </div>
              ))}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100">
                    <th className="px-8 py-5 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Tanggal & No</th>
                    <th className="px-6 py-5 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Keterangan</th>
                    <th className="px-6 py-5 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Lawan Akun</th>
                    <th className="px-6 py-5 text-[10px] font-semibold text-slate-400 uppercase tracking-wide text-right">Debit</th>
                    <th className="px-6 py-5 text-[10px] font-semibold text-slate-400 uppercase tracking-wide text-right">Kredit</th>
                    <th className="px-8 py-5 text-[10px] font-semibold text-slate-400 uppercase tracking-wide text-right">Saldo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {isLoadingAccountLedger && accountLedger.rows.length === 0 ? (
                    <tr><td colSpan={6} className="py-24 text-center text-slate-400 font-bold text-xs uppercase italic">Memuat mutasi akun...</td></tr>
                  ) : accountLedger.rows.length === 0 ? (
                    <tr><td colSpan={6} className="py-24 text-center text-slate-400 font-bold text-xs uppercase italic">Belum ada mutasi posted untuk akun ini.</td></tr>
                  ) : (
                    accountLedger.rows.map((row) => (
                      <tr key={row.line_id} className="group hover:bg-slate-50 transition-colors">
                        <td className="px-8 py-6 align-top">
                          <div className="text-sm font-semibold text-slate-900 tracking-tight">{row.entry_date ? format(new Date(row.entry_date), 'yyyy-MM-dd') : ''}</div>
                          <div className="text-[10px] font-bold text-slate-400 mt-1 font-mono uppercase tracking-tighter">{row.entry_number}</div>
                        </td>
                        <td className="px-6 py-6 align-top">
                          <div className="text-sm font-semibold text-slate-800 leading-tight">{row.description || '-'}</div>
                          <div className="mt-2 text-[10px] font-medium italic text-slate-400">{row.memo || row.notes || row.reference_type || '-'}</div>
                        </td>
                        <td className="px-6 py-6 align-top text-xs font-bold text-slate-500">
                          {row.counterparty_accounts || '-'}
                        </td>
                        <td className="px-6 py-6 align-top text-right font-mono text-xs font-semibold text-emerald-600">
                          {row.debit > 0 ? formatRupiah(row.debit) : '-'}
                        </td>
                        <td className="px-6 py-6 align-top text-right font-mono text-xs font-semibold text-rose-600">
                          {row.credit > 0 ? formatRupiah(row.credit) : '-'}
                        </td>
                        <td className={`px-8 py-6 align-top text-right font-mono text-xs font-semibold ${row.running_balance < 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                          {formatRupiah(row.running_balance)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/40 px-10 py-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                {accountLedger.rows.length} dari {accountLedger.summary.rowCount} mutasi posted sudah dimuat.
              </div>
              {accountLedger.hasMore && (
                <button
                  type="button"
                  onClick={() => loadAccountLedgerPage()}
                  disabled={isLoadingAccountLedger}
                  className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 shadow-sm transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isLoadingAccountLedger ? <Loader2 size={14} className="animate-spin" /> : <ListChecks size={14} />}
                  Muat Lagi
                </button>
              )}
            </div>
          </>
        ) : (
          <>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-8 py-5 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Tanggal & No</th>
                <th className="px-6 py-5 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Deskripsi & Ref</th>
                <th className="px-6 py-5 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Detail Transaksi</th>
                <th className="px-6 py-5 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Status</th>
                <th className="px-8 py-5 text-[10px] font-semibold text-slate-400 uppercase tracking-wide text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {visibleEntries.length === 0 ? (
                <tr><td colSpan={5} className="py-24 text-center text-slate-400 font-bold text-xs uppercase italic">Tidak ada data jurnal {filterStatus.toLowerCase()}.</td></tr>
              ) : (
	                visibleEntries.map((entry: any) => {
                      const lockedPeriod = getClosedPeriodForDate(entry.entry_date)
                      const lockMessage = lockedPeriod
                        ? `Periode fiskal ${lockedPeriod.name} sudah ditutup.`
                        : null
                      const purchaseTransparency = getPurchaseTransparency(entry)
                      const disclosureNote = getLedgerDisclosureNote(entry)

                      return (
	                  <tr key={entry.id} className="group hover:bg-slate-50 transition-colors">
	                    <td className="px-8 py-6 align-top">
	                       <div className="text-sm font-semibold text-slate-900 tracking-tight">{entry.entry_date ? format(new Date(entry.entry_date), 'yyyy-MM-dd') : ''}</div>
	                       <div className="text-[10px] font-bold text-slate-400 mt-1 font-mono uppercase tracking-tighter">{entry.entry_number}</div>
                    </td>
                    <td className="px-6 py-6 align-top">
                       <div className="text-sm font-semibold text-slate-800 leading-tight">{entry.description}</div>
                       <div className="flex items-center gap-2 mt-2">
                         <span className="text-[9px] font-semibold text-slate-400 border border-slate-200 bg-white px-2 py-0.5 rounded uppercase tracking-wide">{entry.reference_type}</span>
                         {disclosureNote && <span className="text-[10px] font-medium text-slate-400 italic truncate max-w-[220px]">{disclosureNote}</span>}
                       </div>
                    </td>
                    <td className="px-6 py-6 align-top">
                       <div className="flex flex-col gap-1.5 w-full min-w-[340px] max-w-lg">
                        {purchaseTransparency && (
                          <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 mb-2">
                            <div className="text-[8px] font-semibold text-amber-700 uppercase tracking-[0.22em] mb-2">
                              Transparansi Diskon Pembelian
                            </div>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[10px]">
                              <div className="flex items-center justify-between gap-3 text-slate-600">
                                <span className="font-semibold">Bruto Barang</span>
                                <span className="font-mono font-semibold text-slate-800">{formatRupiah(Number(purchaseTransparency.subtotal || 0))}</span>
                              </div>
                              <div className="flex items-center justify-between gap-3 text-slate-600">
                                <span className="font-semibold">Diskon Item</span>
                                <span className="font-mono font-semibold text-rose-600">{formatRupiah(Number(purchaseTransparency.lineDiscount || 0))}</span>
                              </div>
                              <div className="flex items-center justify-between gap-3 text-slate-600">
                                <span className="font-semibold">Diskon Header</span>
                                <span className="font-mono font-semibold text-rose-600">{formatRupiah(Number(purchaseTransparency.headerDiscount || 0))}</span>
                              </div>
                              <div className="flex items-center justify-between gap-3 text-slate-600">
                                <span className="font-semibold">Neto Barang</span>
                                <span className="font-mono font-semibold text-slate-800">{formatRupiah(Number(purchaseTransparency.subtotalAfterDiscount || 0))}</span>
                              </div>
                              <div className="flex items-center justify-between gap-3 text-slate-600">
                                <span className="font-semibold">Landed Cost</span>
                                <span className="font-mono font-semibold text-slate-800">{formatRupiah(Number(purchaseTransparency.landedCost || 0))}</span>
                              </div>
                              <div className="flex items-center justify-between gap-3 text-slate-600">
                                <span className="font-semibold">Persediaan Tercatat</span>
                                <span className="font-mono font-semibold text-emerald-700">{formatRupiah(Number(purchaseTransparency.inventoryValue || 0))}</span>
                              </div>
                              <div className="flex items-center justify-between gap-3 text-slate-600">
                                <span className="font-semibold">PPN Masukan</span>
                                <span className="font-mono font-semibold text-slate-800">{formatRupiah(Number(purchaseTransparency.tax || 0))}</span>
                              </div>
                              <div className="flex items-center justify-between gap-3 text-slate-600">
                                <span className="font-semibold">Total Tagihan</span>
                                <span className="font-mono font-semibold text-blue-700">{formatRupiah(Number(purchaseTransparency.grandTotal || 0))}</span>
                              </div>
                            </div>
                          </div>
                        )}
                        <div className="grid grid-cols-12 gap-2 text-[8px] font-semibold text-slate-300 uppercase tracking-wide mb-1 pb-2 border-b border-slate-100">
                          <div className="col-span-6">Akun (CoA)</div>
                          <div className="col-span-3 text-right text-emerald-600/50">Debit</div>
                          <div className="col-span-3 text-right text-rose-600/50">Kredit</div>
                        </div>
                        {entry.journal_lines?.map((line: any) => {
                           const debitAmount = toAmount(line.debit)
                           const creditAmount = toAmount(line.credit)
                           return (
                           <div key={line.id} className="grid grid-cols-12 gap-2 text-[10px] items-center border-b border-slate-50 pb-2 pt-0.5 last:border-0 last:pb-0">
                             <div className="col-span-6 font-bold text-slate-600 truncate" title={line.accounts?.name}>
                               {line.accounts?.code} - {line.accounts?.name}
                             </div>
                             <div className={`col-span-3 text-right font-mono font-semibold tracking-tight ${debitAmount > 0 ? 'text-emerald-600' : 'text-slate-200'}`}>
                                {debitAmount > 0 ? formatRupiah(debitAmount) : '-'}
                             </div>
                             <div className={`col-span-3 text-right font-mono font-semibold tracking-tight ${creditAmount > 0 ? 'text-rose-600' : 'text-slate-200'}`}>
                                {creditAmount > 0 ? formatRupiah(creditAmount) : '-'}
                             </div>
                           </div>
                        )})}
                       </div>
                    </td>
	                    <td className="px-6 py-6 align-top">
                           <div className="space-y-2">
	                       <StatusBadge 
	                         label={entry.status}
	                         variant={
	                           entry.status === 'POSTED' ? 'success' :
	                           entry.status === 'VOIDED' ? 'error' : 'warning'
	                         }
	                       />
                             {lockMessage && (
                               <div className="text-[9px] font-semibold uppercase tracking-wide text-rose-500">
                                 Periode Terkunci
                               </div>
                             )}
                           </div>
	                    </td>
	                    <td className="px-8 py-6 align-top text-right">
	                       <div className="flex flex-col gap-2 items-end">
	                          {entry.status === 'DRAFT' && (
	                            <>
	                              <SafeButton 
	                                variant="emerald" 
	                                size="sm" 
	                                icon={<CheckCircle2 size={14}/>}
                                    disabled={Boolean(lockedPeriod)}
                                    title={lockMessage || undefined}
	                                onClick={() => handlePost(entry.id)}
	                              >
	                                POSTING
	                              </SafeButton>
	                              <button 
	                                onClick={async () => {
	                                  if (!confirm("Hapus draft jurnal ini secara permanen?")) return
	                                  const res = await hardDeleteDraftJournal(entry.id, orgId)
	                                  if (res.error) alert(res.error)
	                                  else window.location.reload()
	                                }} 
                                    disabled={Boolean(lockedPeriod)}
	                                className="text-[9px] font-semibold text-rose-400 hover:text-rose-600 px-2 py-1 uppercase tracking-wide transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-rose-400"
                                    title={lockMessage || undefined}
	                              >
	                                Delete Draft
	                              </button>
	                            </>
	                          )}
	                          {(entry.status === 'POSTED') && isOwner && (
	                            <SafeButton 
	                              variant="ghost" 
	                              size="sm" 
	                              className="text-amber-600 hover:bg-amber-50 border-amber-100"
                                  disabled={Boolean(lockedPeriod)}
                                  title={lockMessage || undefined}
	                              onClick={() => handleVoid(entry.id)}
	                            >
	                              VOID
	                            </SafeButton>
	                          )}
                          {entry.status === 'VOIDED' && (
                            <span className="text-[10px] font-semibold text-rose-300 uppercase italic tracking-wide px-3 py-1 border border-rose-100 rounded-lg">Voided</span>
                          )}
	                       </div>
	                    </td>
	                  </tr>
	                )})
	              )}
	            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/40 px-10 py-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            {visibleEntries.length} jurnal {filterStatus.toLowerCase()} sudah dimuat{activeSearch ? ' dari hasil pencarian' : ''}.
          </div>
          {canLoadMoreEntries && (
            <button
              type="button"
              onClick={() => loadJournalEntriesPage()}
              disabled={isLoadingEntries}
              className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 shadow-sm transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoadingEntries ? <Loader2 size={14} className="animate-spin" /> : <ListChecks size={14} />}
              Muat Lagi
            </button>
          )}
        </div>
          </>
        )}
      </SectionCard>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
             <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-4xl bg-white rounded-xl shadow-md overflow-hidden flex flex-col max-h-[90vh]">
                <div className="px-10 py-8 bg-blue-600 text-white flex justify-between items-start shrink-0">
                    <div>
                      <h3 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
                        <FilePlus size={24} /> New Journal Entry
                      </h3>
                      <p className="text-xs text-blue-100 mt-1 font-medium italic">Manually create a draft journal entry into the ledger.</p>
                    </div>
                    <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center hover:bg-white/20 transition">
                      <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5">
                   <div className="grid grid-cols-2 gap-6 mb-10 bg-slate-50 p-6 rounded-xl border border-slate-100 shadow-inner">
                      <div className="space-y-1">
                          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide ml-1">Jurnal Date</label>
                          <input type="date" required value={entryDate} onChange={(e) => setEntryDate(e.target.value)} className="w-full px-5 py-4 bg-white rounded-xl border border-slate-200 font-bold outline-none focus:border-blue-500 transition-all shadow-sm" />
                      </div>
                      <div className="space-y-1">
                          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide ml-1">Main Description</label>
                          <input required value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Initial Capital Deposit" className="w-full px-5 py-4 bg-white rounded-xl border border-slate-200 font-bold outline-none focus:border-blue-500 transition-all shadow-sm" />
                      </div>
                      <div className="col-span-2 space-y-1">
                          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide ml-1">Additional Notes</label>
                          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="External reference or specific explanation" className="w-full px-5 py-4 bg-white rounded-xl border border-slate-200 font-medium text-slate-600 outline-none focus:border-blue-500 transition-all shadow-sm" />
                      </div>
                   </div>

                   <div className="space-y-4">
                      <div className="flex items-center justify-between px-2">
                         <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wide">Transaction Lines</h4>
                         <button type="button" onClick={addLine} className="flex items-center gap-1.5 px-4 py-2 bg-blue-50 text-blue-600 text-[10px] font-semibold uppercase rounded-xl hover:bg-blue-100 transition-all">
                           <Plus size={14} /> Add Line
                         </button>
                      </div>

                      <div className="bg-white border border-slate-100 rounded-[32px] shadow-sm overflow-hidden">
                         <table className="w-full text-left">
                            <thead className="bg-slate-50/50 border-b border-slate-100">
                               <tr>
                                  <th className="px-6 py-4 text-[9px] font-semibold text-slate-400 uppercase tracking-wide">Account</th>
                                  <th className="px-4 py-4 text-[9px] font-semibold text-slate-400 uppercase tracking-wide text-right">Debit (Rp)</th>
                                  <th className="px-4 py-4 text-[9px] font-semibold text-slate-400 uppercase tracking-wide text-right">Credit (Rp)</th>
                                  <th className="px-6 py-4 text-[9px] font-semibold text-slate-400 uppercase tracking-wide text-center">Action</th>
                               </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                               {lines.map((line) => (
                                 <tr key={line.id}>
                                    <td className="px-6 py-4">
                                       <SearchableSelect
                                         options={accounts}
                                         value={line.account_id}
                                         onChange={(val) => handleLineChange(line.id, 'account_id', val)}
                                         placeholder="-- Select CoA --"
                                         required={true}
                                       />
                                    </td>
                                    <td className="px-4 py-4">
                                       <CurrencyInput
                                         value={line.debit}
                                         onChange={(val) => handleLineChange(line.id, 'debit', val)}
                                         className="!py-3 !rounded-xl !text-xs !font-semibold !text-emerald-600 !bg-emerald-50/30 !border-slate-100 focus:!bg-white focus:!border-blue-400 transition-all"
                                       />
                                    </td>
                                    <td className="px-4 py-4">
                                       <CurrencyInput
                                         value={line.credit}
                                         onChange={(val) => handleLineChange(line.id, 'credit', val)}
                                         className="!py-3 !rounded-xl !text-xs !font-semibold !text-rose-600 !bg-rose-50/30 !border-slate-100 focus:!bg-white focus:!border-blue-400 transition-all"
                                       />
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                       <button type="button" onClick={() => removeLine(line.id)} className="p-2.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all">
                                          <Trash2 size={18} />
                                       </button>
                                    </td>
                                 </tr>
                               ))}
                            </tbody>
                            <tfoot className="bg-slate-900 border-t border-slate-800 text-white font-mono">
                               <tr>
                                  <td className="px-6 py-4 text-[10px] font-semibold uppercase tracking-wide">Consolidated Balance</td>
                                  <td className="px-4 py-4 text-right text-xs font-semibold text-emerald-400">{formatRupiah(totalDebit)}</td>
                                  <td className="px-4 py-4 text-right text-xs font-semibold text-rose-400">{formatRupiah(totalCredit)}</td>
                                  <td className="px-6 py-4 text-center">
                                     {isBalanced ? (
                                       <span className="text-[9px] font-semibold bg-emerald-500/20 text-emerald-400 px-2.5 py-1 rounded-lg border border-emerald-500/30 tracking-wide">BALANCED</span>
                                     ) : (
                                       <span className="text-[9px] font-semibold bg-rose-500/20 text-rose-400 px-2.5 py-1 rounded-lg border border-rose-500/30 tracking-wide animate-pulse">UNBALANCED</span>
                                     )}
                                  </td>
                               </tr>
                            </tfoot>
                         </table>
                      </div>
                   </div>
                </div>

	                <div className="px-10 py-8 bg-slate-50 border-t border-slate-100 shrink-0 flex items-center justify-between">
	                   <div className="flex items-center gap-3 text-slate-400 italic text-[10px] font-medium">
	                      <ListChecks size={16} /> Entry will be saved as DRAFT before manual posting.
	                   </div>
	                   <div className="flex items-center gap-4">
                      <button type="button" onClick={() => setIsModalOpen(false)} className="px-8 py-4 text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors">Cancel</button>
	                      <SafeButton 
	                        variant="primary" 
	                        size="lg" 
	                        isLoading={isSubmitting} 
	                        disabled={!isBalanced || Boolean(selectedClosedPeriod)} 
	                        className="min-w-[200px]"
	                        onClick={handleSubmit}
	                      >
                        SAVE DRAFT ENTRY
                      </SafeButton>
                   </div>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
