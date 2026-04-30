'use client'

import React, { useState } from 'react'
import { Plus, X, Trash2, Download, FileText, Filter, History, CheckCircle2, AlertCircle, Wallet, ListChecks, FilePlus } from 'lucide-react'
import { PageHeader, StatCard, SectionCard, SectionHeader, StatusBadge, SafeButton } from '@/components/ui/NizamUI'
import { createJournalEntry, postJournalEntry, voidJournalEntry, hardDeleteDraftJournal } from '@/modules/accounting/actions/journal.actions'
import { CurrencyInput } from '@/components/ui/CurrencyInput'
import { motion, AnimatePresence } from 'framer-motion'
import { formatRupiah } from '@/lib/utils'
import { format } from 'date-fns'

interface JournalClientProps {
  orgId: string
  initialEntries: any[]
  accounts: any[]
  fiscalPeriods: any[]
  userRole: string
  activeBranchId: string | null
  activeBranchName: string | null
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

export default function JournalClient({
  orgId,
  initialEntries,
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

  const [entries] = useState<any[]>(initialEntries)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [filterStatus, setFilterStatus] = useState<'POSTED' | 'VOIDED' | 'DRAFT'>('POSTED')
  
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
            <div className="flex bg-slate-100/60 p-1 rounded-2xl border border-slate-100 mr-2 shadow-inner">
              {(['POSTED', 'VOIDED', 'DRAFT'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${filterStatus === s ? 'bg-white text-blue-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
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
        <div className="rounded-3xl border border-amber-200 bg-amber-50 px-6 py-4 text-sm font-semibold text-amber-900 shadow-sm">
          Pilih unit aktif terlebih dahulu untuk membuat jurnal manual. Buku besar saat ini masih menampilkan data level organisasi.
        </div>
	      ) : (
	        <div className="rounded-3xl border border-emerald-200 bg-emerald-50 px-6 py-4 text-sm font-semibold text-emerald-900 shadow-sm">
	          Jurnal manual baru akan dicatat ke unit aktif: <span className="font-black">{activeBranchName}</span>.
	        </div>
	      )}

        {selectedClosedPeriod && (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 px-6 py-4 text-sm font-semibold text-rose-900 shadow-sm">
            Periode fiskal <span className="font-black">{selectedClosedPeriod.name}</span> sudah ditutup. Jurnal manual bertanggal <span className="font-black">{entryDate}</span> tidak dapat disimpan.
          </div>
        )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          label="Total Jurnal Posted" 
          value={`${stats.postedCount} Entri`} 
          icon={CheckCircle2}
          color="emerald"
          sub="Tersimpan di Buku Besar"
          onClick={() => setFilterStatus('POSTED')}
        />
        <StatCard 
          label="Draft Belum Posting" 
          value={`${stats.draftCount} Draft`} 
          icon={History}
          color="amber"
          alert={stats.draftCount > 0}
          sub="Wajib diperiksa berkala"
          onClick={() => setFilterStatus('DRAFT')}
        />
        <StatCard 
          label="Volume Transaksi" 
          value={formatRupiah(stats.totalVolume)} 
          icon={Wallet}
          color="indigo"
          sub="Total Mutasi (Debit)"
          onClick={() => setFilterStatus('POSTED')}
        />
        <StatCard 
          label="Voided Hari Ini" 
          value={`${stats.voidedToday} Batal`} 
          icon={AlertCircle}
          color="rose"
          sub="Jurnal yang dibatalkan"
          onClick={() => setFilterStatus('VOIDED')}
        />
      </div>

      <SectionCard>
        <SectionHeader 
          title="Buku Besar Umum"
          subtitle={`Menampilkan daftar jurnal entri dengan status ${filterStatus}.`}
          actions={
             <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                  <Filter size={10} className="inline mr-1" /> Auto-Refresh Active
                </span>
             </div>
          }
        />
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Tanggal & No</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Deskripsi & Ref</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Detail Transaksi</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Status</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {entries.filter((e: any) => e.status === filterStatus).length === 0 ? (
                <tr><td colSpan={5} className="py-24 text-center text-slate-400 font-bold text-xs uppercase italic">Tidak ada data jurnal {filterStatus.toLowerCase()}.</td></tr>
              ) : (
	                entries.filter((e: any) => e.status === filterStatus).map((entry: any) => {
                      const lockedPeriod = getClosedPeriodForDate(entry.entry_date)
                      const lockMessage = lockedPeriod
                        ? `Periode fiskal ${lockedPeriod.name} sudah ditutup.`
                        : null
                      const purchaseTransparency = getPurchaseTransparency(entry)
                      const disclosureNote = getLedgerDisclosureNote(entry)

                      return (
	                  <tr key={entry.id} className="group hover:bg-slate-50 transition-colors">
	                    <td className="px-8 py-6 align-top">
	                       <div className="text-sm font-black text-slate-900 tracking-tight">{entry.entry_date ? format(new Date(entry.entry_date), 'yyyy-MM-dd') : ''}</div>
	                       <div className="text-[10px] font-bold text-slate-400 mt-1 font-mono uppercase tracking-tighter">{entry.entry_number}</div>
                    </td>
                    <td className="px-6 py-6 align-top">
                       <div className="text-sm font-black text-slate-800 leading-tight">{entry.description}</div>
                       <div className="flex items-center gap-2 mt-2">
                         <span className="text-[9px] font-black text-slate-400 border border-slate-200 bg-white px-2 py-0.5 rounded uppercase tracking-widest">{entry.reference_type}</span>
                         {disclosureNote && <span className="text-[10px] font-medium text-slate-400 italic truncate max-w-[220px]">{disclosureNote}</span>}
                       </div>
                    </td>
                    <td className="px-6 py-6 align-top">
                       <div className="flex flex-col gap-1.5 w-full min-w-[340px] max-w-lg">
                        {purchaseTransparency && (
                          <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 mb-2">
                            <div className="text-[8px] font-black text-amber-700 uppercase tracking-[0.22em] mb-2">
                              Transparansi Diskon Pembelian
                            </div>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[10px]">
                              <div className="flex items-center justify-between gap-3 text-slate-600">
                                <span className="font-semibold">Bruto Barang</span>
                                <span className="font-mono font-black text-slate-800">{formatRupiah(Number(purchaseTransparency.subtotal || 0))}</span>
                              </div>
                              <div className="flex items-center justify-between gap-3 text-slate-600">
                                <span className="font-semibold">Diskon Item</span>
                                <span className="font-mono font-black text-rose-600">{formatRupiah(Number(purchaseTransparency.lineDiscount || 0))}</span>
                              </div>
                              <div className="flex items-center justify-between gap-3 text-slate-600">
                                <span className="font-semibold">Diskon Header</span>
                                <span className="font-mono font-black text-rose-600">{formatRupiah(Number(purchaseTransparency.headerDiscount || 0))}</span>
                              </div>
                              <div className="flex items-center justify-between gap-3 text-slate-600">
                                <span className="font-semibold">Neto Barang</span>
                                <span className="font-mono font-black text-slate-800">{formatRupiah(Number(purchaseTransparency.subtotalAfterDiscount || 0))}</span>
                              </div>
                              <div className="flex items-center justify-between gap-3 text-slate-600">
                                <span className="font-semibold">Landed Cost</span>
                                <span className="font-mono font-black text-slate-800">{formatRupiah(Number(purchaseTransparency.landedCost || 0))}</span>
                              </div>
                              <div className="flex items-center justify-between gap-3 text-slate-600">
                                <span className="font-semibold">Persediaan Tercatat</span>
                                <span className="font-mono font-black text-emerald-700">{formatRupiah(Number(purchaseTransparency.inventoryValue || 0))}</span>
                              </div>
                              <div className="flex items-center justify-between gap-3 text-slate-600">
                                <span className="font-semibold">PPN Masukan</span>
                                <span className="font-mono font-black text-slate-800">{formatRupiah(Number(purchaseTransparency.tax || 0))}</span>
                              </div>
                              <div className="flex items-center justify-between gap-3 text-slate-600">
                                <span className="font-semibold">Total Tagihan</span>
                                <span className="font-mono font-black text-blue-700">{formatRupiah(Number(purchaseTransparency.grandTotal || 0))}</span>
                              </div>
                            </div>
                          </div>
                        )}
                        <div className="grid grid-cols-12 gap-2 text-[8px] font-black text-slate-300 uppercase tracking-widest mb-1 pb-2 border-b border-slate-100">
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
                             <div className={`col-span-3 text-right font-mono font-black tracking-tight ${debitAmount > 0 ? 'text-emerald-600' : 'text-slate-200'}`}>
                                {debitAmount > 0 ? formatRupiah(debitAmount) : '-'}
                             </div>
                             <div className={`col-span-3 text-right font-mono font-black tracking-tight ${creditAmount > 0 ? 'text-rose-600' : 'text-slate-200'}`}>
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
                               <div className="text-[9px] font-black uppercase tracking-widest text-rose-500">
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
	                                className="text-[9px] font-black text-rose-400 hover:text-rose-600 px-2 py-1 uppercase tracking-widest transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-rose-400"
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
                            <span className="text-[10px] font-black text-rose-300 uppercase italic tracking-[0.2em] px-3 py-1 border border-rose-100 rounded-lg">Voided</span>
                          )}
	                       </div>
	                    </td>
	                  </tr>
	                )})
	              )}
	            </tbody>
          </table>
        </div>
      </SectionCard>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
             <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-4xl bg-white rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="px-10 py-8 bg-blue-600 text-white flex justify-between items-start shrink-0">
                    <div>
                      <h3 className="text-2xl font-black tracking-tight flex items-center gap-2">
                        <FilePlus size={24} /> New Journal Entry
                      </h3>
                      <p className="text-xs text-blue-100 mt-1 font-medium italic">Manually create a draft journal entry into the ledger.</p>
                    </div>
                    <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center hover:bg-white/20 transition">
                      <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-10">
                   <div className="grid grid-cols-2 gap-6 mb-10 bg-slate-50 p-6 rounded-[28px] border border-slate-100 shadow-inner">
                      <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Jurnal Date</label>
                          <input type="date" required value={entryDate} onChange={(e) => setEntryDate(e.target.value)} className="w-full px-5 py-4 bg-white rounded-2xl border border-slate-200 font-bold outline-none focus:border-blue-500 transition-all shadow-sm" />
                      </div>
                      <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Main Description</label>
                          <input required value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Initial Capital Deposit" className="w-full px-5 py-4 bg-white rounded-2xl border border-slate-200 font-bold outline-none focus:border-blue-500 transition-all shadow-sm" />
                      </div>
                      <div className="col-span-2 space-y-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Additional Notes</label>
                          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="External reference or specific explanation" className="w-full px-5 py-4 bg-white rounded-2xl border border-slate-200 font-medium text-slate-600 outline-none focus:border-blue-500 transition-all shadow-sm" />
                      </div>
                   </div>

                   <div className="space-y-4">
                      <div className="flex items-center justify-between px-2">
                         <h4 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em]">Transaction Lines</h4>
                         <button type="button" onClick={addLine} className="flex items-center gap-1.5 px-4 py-2 bg-blue-50 text-blue-600 text-[10px] font-black uppercase rounded-xl hover:bg-blue-100 transition-all">
                           <Plus size={14} /> Add Line
                         </button>
                      </div>

                      <div className="bg-white border border-slate-100 rounded-[32px] shadow-sm overflow-hidden">
                         <table className="w-full text-left">
                            <thead className="bg-slate-50/50 border-b border-slate-100">
                               <tr>
                                  <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Account</th>
                                  <th className="px-4 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Debit (Rp)</th>
                                  <th className="px-4 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Credit (Rp)</th>
                                  <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Action</th>
                               </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                               {lines.map((line) => (
                                 <tr key={line.id}>
                                    <td className="px-6 py-4">
                                       <select required value={line.account_id} onChange={(e) => handleLineChange(line.id, 'account_id', e.target.value)} className="w-full text-xs font-bold border border-slate-100 rounded-xl px-4 py-3 bg-slate-50 outline-none focus:bg-white focus:border-blue-400 transition-all">
                                          <option value="">-- Select CoA --</option>
                                          {accounts.map((acc: any) => <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>)}
                                       </select>
                                    </td>
                                    <td className="px-4 py-4">
                                       <CurrencyInput
                                         value={line.debit}
                                         onChange={(val) => handleLineChange(line.id, 'debit', val)}
                                         className="!py-3 !rounded-xl !text-xs !font-black !text-emerald-600 !bg-emerald-50/30 !border-slate-100 focus:!bg-white focus:!border-blue-400 transition-all"
                                       />
                                    </td>
                                    <td className="px-4 py-4">
                                       <CurrencyInput
                                         value={line.credit}
                                         onChange={(val) => handleLineChange(line.id, 'credit', val)}
                                         className="!py-3 !rounded-xl !text-xs !font-black !text-rose-600 !bg-rose-50/30 !border-slate-100 focus:!bg-white focus:!border-blue-400 transition-all"
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
                                  <td className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">Consolidated Balance</td>
                                  <td className="px-4 py-4 text-right text-xs font-black text-emerald-400">{formatRupiah(totalDebit)}</td>
                                  <td className="px-4 py-4 text-right text-xs font-black text-rose-400">{formatRupiah(totalCredit)}</td>
                                  <td className="px-6 py-4 text-center">
                                     {isBalanced ? (
                                       <span className="text-[9px] font-black bg-emerald-500/20 text-emerald-400 px-2.5 py-1 rounded-lg border border-emerald-500/30 tracking-widest">BALANCED</span>
                                     ) : (
                                       <span className="text-[9px] font-black bg-rose-500/20 text-rose-400 px-2.5 py-1 rounded-lg border border-rose-500/30 tracking-widest animate-pulse">UNBALANCED</span>
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
