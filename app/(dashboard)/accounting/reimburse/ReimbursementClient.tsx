'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  FileText, 
  Plus, 
  Send, 
  Trash2, 
  CheckCircle, 
  XOctagon, 
  Clock, 
  Wallet,
  Calendar,
  ChevronRight,
  Info,
  CreditCard,
  Building2,
  DollarSign,
  AlertCircle,
  Image as ImageIcon
} from 'lucide-react'
import { formatRupiah, formatDate, getDateInTimeZone } from '@/lib/utils'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { submitReimbursement, approveReimbursement, rejectReimbursement, payReimbursement, uploadReceipt } from '@/modules/accounting/actions/reimburse.actions'
import { detectReceiptDetails } from '@/modules/ai/actions/vision.actions'

interface ReimbursementClientProps {
  reimbursements: any[]
  bankAccounts: any[]
  expenseAccounts: any[]
  orgId: string
  currentUserId: string
}

// Simplified category map: label → keyword to match in expenseAccounts name
const SIMPLE_CATEGORIES = [
  { label: 'Transportasi', emoji: '🚗', keyword: 'TRANSPORTASI' },
  { label: 'Makan & Minum', emoji: '🍱', keyword: 'OPERASIONAL' },
  { label: 'Akomodasi', emoji: '🏨', keyword: 'ASURANSI' },
  { label: 'Perlengkapan', emoji: '📦', keyword: 'PERLENGKAPAN' },
  { label: 'Komunikasi', emoji: '📱', keyword: 'UTILITAS' },
  { label: 'Pemasaran', emoji: '📢', keyword: 'PEMASARAN' },
  { label: 'Profesional', emoji: '🤝', keyword: 'PROFESIONAL' },
  { label: 'Lainnya', emoji: '📝', keyword: 'LAIN' },
]

export default function ReimbursementClient({ reimbursements, bankAccounts, expenseAccounts, orgId, currentUserId }: ReimbursementClientProps) {
  const router = useRouter()
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false)
  const [selectedReimbursement, setSelectedReimbursement] = useState<any>(null)
  const [isPayModalOpen, setIsPayModalOpen] = useState(false)
  const [selectedBankId, setSelectedBankId] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const defaultExpenseDate = getDateInTimeZone('Asia/Jakarta')

  // Form State
  const [description, setDescription] = useState('')
  const [items, setItems] = useState<any[]>([
    { expense_date: defaultExpenseDate, category_account_id: '', description: '', amount: 0, receipt_url: '', receipt_file: null as File | null, receipt_preview: '', isScanning: false, isUploading: false }
  ])

  const addItem = () => {
    setItems([...items, { expense_date: defaultExpenseDate, category_account_id: '', description: '', amount: 0, receipt_url: '', receipt_file: null, receipt_preview: '', isScanning: false, isUploading: false }])
  }

  const removeItem = (idx: number) => {
    if (items.length > 1) setItems(items.filter((_, i) => i !== idx))
  }

  const handleItemChange = (idx: number, field: string, value: any) => {
    const newItems = [...items]
    newItems[idx][field] = value
    
    // Fitur Smart UX: Jika mengubah Kategori, otomatis isi kategori yang masih kosong pada nota yang sama
    if (field === 'category_account_id' && newItems[idx].receipt_preview) {
      newItems.forEach((item, i) => {
        if (i !== idx && item.receipt_preview === newItems[idx].receipt_preview && !item.category_account_id) {
          item.category_account_id = value;
        }
      });
    }

    setItems(newItems)
  }

  const handleSubmit = async () => {
    // Validasi Detail Form
    if (!description.trim()) {
        alert('Mohon lengkapi Judul/Tujuan Pengajuan di bagian atas.')
        return
    }
    const emptyCategoryIndex = items.findIndex(it => !it.category_account_id)
    if (emptyCategoryIndex !== -1) {
        alert(`Mohon pilih "Kategori Biaya" untuk pengeluaran ke-${emptyCategoryIndex + 1} (${items[emptyCategoryIndex].description}).`)
        return
    }
    const invalidAmountIndex = items.findIndex(it => it.amount <= 0)
    if (invalidAmountIndex !== -1) {
        alert(`Mohon periksa Nominal untuk pengeluaran ke-${invalidAmountIndex + 1}.`)
        return
    }
    const emptyDescIndex = items.findIndex(it => !it.description.trim())
    if (emptyDescIndex !== -1) {
        alert(`Mohon isi Uraian untuk pengeluaran ke-${emptyDescIndex + 1}.`)
        return
    }
    if (items.some(it => !it.receipt_url)) {
        alert('Setiap pengeluaran WAJIB melampirkan foto nota/kuitansi.')
        return
    }
    setIsSubmitting(true)
    
    // Cleanup UI-only fields (like File objects / ai_items) before sending to Server Action
    const cleanItems = items.map(it => ({
      expense_date: it.expense_date,
      category_account_id: it.category_account_id,
      description: it.description,
      amount: it.amount,
      receipt_url: it.receipt_url
    }))

    const result = await submitReimbursement(orgId, { description, items: cleanItems })
    setIsSubmitting(false)
    if (result.success) {
        setIsSubmitModalOpen(false)
        setDescription('')
        setItems([{ expense_date: defaultExpenseDate, category_account_id: '', description: '', amount: 0, receipt_url: '', receipt_file: null as File | null, receipt_preview: '', isScanning: false, isUploading: false, ai_items: [] as any[] }])
        router.refresh()
    } else {
        alert(result.error)
    }
  }

  // Helper to process AI scanning
  const handleScanReceipt = async (idx: number, file: File) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;

      // Set isScanning = true using functional update (avoid stale closure)
      setItems(prev => {
        const next = [...prev];
        next[idx] = { ...next[idx], isScanning: true };
        return next;
      });

      const result = await detectReceiptDetails(base64);

      // Update with AI result using functional update
      setItems(prev => {
        const next = [...prev];
        next[idx] = { ...next[idx], isScanning: false };
        if (result.success && result.data) {
          const d = result.data;
          next[idx].ai_success = true;
          next[idx].ai_failed = false;
          if (d.total_amount >= 1) next[idx].amount = d.total_amount;
          if (d.vendor_name?.trim()) next[idx].description = `Nota: ${d.vendor_name.trim()}`;
          if (d.transaction_date?.match(/^\d{4}-\d{2}-\d{2}$/)) next[idx].expense_date = d.transaction_date;
          if (d.items) next[idx].ai_items = d.items;
        } else {
          // AI FAILED — UX requirement: harus eksplisit, tidak boleh diam
          next[idx].ai_success = false;
          next[idx].ai_failed = true;
          next[idx].ai_error = result.error || 'AI tidak dapat membaca nota.';
        }
        return next;
      });
    };
    reader.readAsDataURL(file);
  }

  const splitAiItemsToRows = (idx: number) => {
    setItems(prev => {
      const next = [...prev];
      const currentRow = next[idx];
      if (!currentRow.ai_items || currentRow.ai_items.length === 0) return next;
      
      const newRows = currentRow.ai_items.map((aiItem: any) => ({
        ...currentRow,
        description: aiItem.name || 'Item',
        amount: aiItem.amount || 0,
        ai_items: [] // Prevent this button from showing on children
      }));
      
      next.splice(idx, 1, ...newRows);
      return next;
    });
  }

  const handleApprove = async (id: string) => {
    if (!confirm('Setujui pengajuan ini?')) return
    const result = await approveReimbursement(id, orgId)
    if ('error' in result) {
      alert(result.error)
      return
    }
    router.refresh()
  }

  const handleReject = async (id: string) => {
    const reason = prompt('Alasan penolakan:')
    if (reason === null) return
    const result = await rejectReimbursement(id, orgId, reason)
    if ('error' in result) {
      alert(result.error)
      return
    }
    router.refresh()
  }

  const handlePay = async () => {
    if (!selectedBankId) return alert('Pilih rekening bank pembayaran.')
    setIsSubmitting(true)
    const result = await payReimbursement(selectedReimbursement.id, orgId, selectedBankId)
    setIsSubmitting(false)
    if (!('error' in result)) {
        setIsPayModalOpen(false)
        setSelectedReimbursement(null)
        router.refresh()
    } else {
        alert(result.error)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
        case 'PENDING': return 'bg-amber-100 text-amber-700 border-amber-200'
        case 'APPROVED': return 'bg-[#003366]/10 text-[#003366] border-[#003366]/20'
        case 'PAID': return 'bg-emerald-100 text-emerald-700 border-emerald-200'
        case 'REJECTED': return 'bg-rose-100 text-rose-700 border-rose-200'
        default: return 'bg-slate-100 text-slate-700 border-slate-200'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
        case 'PENDING': return <Clock size={14} />
        case 'APPROVED': return <CheckCircle size={14} />
        case 'PAID': return <Wallet size={14} />
        case 'REJECTED': return <XOctagon size={14} />
        default: return null
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-10 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
            <h1 className="text-4xl font-semibold text-slate-900 tracking-tight flex items-center gap-4">
                <CreditCard size={40} className="text-[#003366]" />
                Reimbursement
            </h1>
            <p className="text-slate-500 font-medium text-lg">Kelola pengajuan biaya operasional (klaim) karyawan secara transparan.</p>
        </div>
        <button 
            onClick={() => setIsSubmitModalOpen(true)}
            className="flex items-center gap-3 px-8 py-4 bg-[#003366] text-white rounded-xl font-semibold shadow-xl shadow-[#003366]/10 hover:bg-[#002d5a] transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
            <Plus size={20} /> AJUKAN REIMBURSE
        </button>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-50">
                        <th className="px-8 py-6 text-[10px] font-semibold uppercase text-slate-400 tracking-wide">Karyawan & Status</th>
                        <th className="px-6 py-6 text-[10px] font-semibold uppercase text-slate-400 tracking-wide">Klaim # & Deskripsi</th>
                        <th className="px-6 py-6 text-[10px] font-semibold uppercase text-slate-400 tracking-wide text-right">Total Biaya</th>
                        <th className="px-8 py-6 text-center text-[10px] font-semibold uppercase text-slate-400 tracking-wide">Aksi</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {reimbursements.map((re) => (
                        <tr key={re.id} className="hover:bg-slate-50/50 transition-colors group">
                             <td className="px-8 py-6">
                                 <div className="space-y-2 text-xs">
                                     <p className="font-semibold text-slate-900 leading-tight">Karyawan Pengaju</p>
                                     <p className="text-[10px] text-slate-400 font-mono italic truncate max-w-[120px]">{re.user_id}</p>
                                     <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-semibold border uppercase ${getStatusColor(re.status)}`}>
                                        {getStatusIcon(re.status)} {re.status}
                                    </span>
                                 </div>
                             </td>
                             <td className="px-6 py-6">
                                <div className="space-y-1">
                                    <p className="text-[10px] font-semibold text-[#003366] font-mono italic opacity-70">#{re.claim_number}</p>
                                    <p className="text-sm font-bold text-slate-800">{re.description}</p>
                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                        <p className="text-[10px] text-slate-400 font-medium">
                                            Diajukan: {formatDate(re.created_at)}
                                        </p>
                                        {re.items?.filter((it: any) => it.receipt_url).map((it: any, idx: number) => (
                                            <a 
                                                key={it.id || idx} 
                                                href={it.receipt_url} 
                                                target="_blank" 
                                                rel="noreferrer"
                                                className="inline-flex items-center gap-1 text-[9px] font-semibold text-[#003366] hover:text-[#003366] bg-[#003366]/5 px-2 py-0.5 rounded-full border border-[#003366]/10 transition-colors"
                                            >
                                                <ImageIcon size={10} /> NOTA {re.items.length > 1 ? `#${idx + 1}` : ''}
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            </td>
                            <td className="px-6 py-6 text-right font-semibold text-slate-900 text-lg font-mono">
                                {formatRupiah(re.total_amount)}
                            </td>
                            <td className="px-8 py-6">
                                <div className="flex items-center justify-center gap-2">
                                    {re.status === 'PENDING' && (
                                        <>
                                            <button onClick={() => handleApprove(re.id)} className="p-3 bg-white border border-slate-200 text-emerald-500 hover:bg-emerald-50 rounded-xl transition-all shadow-sm" title="Approve">
                                                <CheckCircle size={18}/>
                                            </button>
                                            <button onClick={() => handleReject(re.id)} className="p-3 bg-white border border-slate-200 text-rose-500 hover:bg-rose-50 rounded-xl transition-all shadow-sm" title="Reject">
                                                <XOctagon size={18}/>
                                            </button>
                                        </>
                                    )}
                                    {re.status === 'APPROVED' && (
                                        <button 
                                            onClick={() => { setSelectedReimbursement(re); setIsPayModalOpen(true); }}
                                            className="px-5 py-2.5 bg-emerald-600 text-white text-[10px] font-semibold rounded-xl shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all flex items-center gap-2"
                                        >
                                            <Wallet size={14}/> BAYAR SEKARANG
                                        </button>
                                    )}
                                    {re.status === 'PAID' && (
                                        <div className="flex items-center gap-2 text-emerald-500 bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-100">
                                            <CheckCircle size={14} />
                                            <span className="text-[9px] font-semibold uppercase tracking-wide">Dibayar</span>
                                        </div>
                                    )}
                                    {re.status === 'REJECTED' && (
                                        <div className="group relative">
                                            <div className="p-2 bg-rose-50 text-rose-500 rounded-lg cursor-help">
                                                <AlertCircle size={16} />
                                            </div>
                                            <div className="absolute bottom-full right-0 mb-2 w-48 bg-slate-900 text-white text-[10px] p-3 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-xl">
                                                <p className="font-bold border-b border-white/10 pb-1 mb-1">Alasan Penolakan:</p>
                                                <p className="italic opacity-80">{re.notes || 'No reason provided'}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </td>
                        </tr>
                    ))}
                    {reimbursements.length === 0 && (
                        <tr>
                            <td colSpan={4} className="py-24 text-center">
                                <div className="space-y-4 opacity-30">
                                    <FileText size={48} className="mx-auto" />
                                    <p className="font-semibold text-xl italic tracking-tighter">Belum ada pengajuan reimbursement.</p>
                                </div>
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
      </div>

      {/* Submission Modal */}
      <AnimatePresence>
        {isSubmitModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-6 overflow-y-auto">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setIsSubmitModalOpen(false)} />
                <motion.div 
                    initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="relative bg-white w-full max-w-4xl rounded-xl shadow-md overflow-hidden flex flex-col max-h-[90vh]"
                >
                    <div className="p-5 border-b border-slate-50 flex items-center justify-between bg-[#003366]/5/30">
                        <div className="space-y-1">
                            <h3 className="text-2xl font-semibold text-slate-900 flex items-center gap-3">
                                <Plus size={24} className="text-[#003366]" /> Pengajuan Klaim Biaya
                            </h3>
                            <p className="text-slate-400 text-sm font-medium italic">Silahkan isi detail pengeluaran yang ingin di-reimburse.</p>
                        </div>
                        <button onClick={() => setIsSubmitModalOpen(false)} className="p-3 hover:bg-white rounded-xl transition-all shadow-sm group">
                            <XOctagon size={24} className="text-slate-300 group-hover:text-rose-500 transition-colors" />
                        </button>
                    </div>

                    <div className="p-5 overflow-y-auto flex-1 space-y-10 custom-scrollbar">
                        <div className="space-y-3">
                            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide ml-4">Judul Pengajuan</label>
                            <input 
                                placeholder="Contoh: Perjalanan Dinas ke Bandung" 
                                value={description} onChange={(e) => setDescription(e.target.value)}
                                className="w-full h-20 px-8 bg-slate-50 border-2 border-transparent focus:border-[#003366]/20 outline-none rounded-[32px] text-lg font-bold text-slate-900 transition-all placeholder:text-slate-300"
                            />
                        </div>

                        <div className="space-y-6">
                            <div className="flex items-center justify-between ml-4">
                                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Detail Item Pengeluaran</label>
                                <button onClick={addItem} className="flex items-center gap-2 px-6 py-3 bg-white border-2 border-slate-100 rounded-xl text-[10px] font-semibold text-slate-600 hover:border-blue-400 hover:text-[#003366] transition-all">
                                    <Plus size={14} /> TAMBAH BARIS
                                </button>
                            </div>

                            <div className="space-y-4">
                                {items.map((it, idx) => (
                                    <motion.div key={idx} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="grid grid-cols-12 gap-4 items-end bg-slate-50/50 p-6 rounded-[32px] border border-slate-100 relative">
                                        <div className="col-span-12 md:col-span-2 space-y-2 text-[10px] font-semibold uppercase text-slate-400 tracking-wide">
                                            Tanggal
                                            <input type="date" value={it.expense_date} onChange={(e) => handleItemChange(idx, 'expense_date', e.target.value)} className="w-full bg-white border border-slate-200 p-3 rounded-xl text-slate-900 uppercase font-mono" />
                                        </div>
                                        <div className="col-span-12 md:col-span-3 space-y-2 text-[10px] font-semibold uppercase text-slate-400 tracking-wide">
                                            Kategori Biaya
                                            <SearchableSelect
                                              options={expenseAccounts}
                                              value={it.category_account_id}
                                              onChange={(val) => handleItemChange(idx, 'category_account_id', val)}
                                              placeholder="— Pilih Kategori —"
                                            />
                                        </div>
                                        <div className="col-span-12 md:col-span-4 space-y-2 text-[10px] font-semibold uppercase text-slate-400 tracking-wide">
                                            Uraian
                                            <input value={it.description} onChange={(e) => handleItemChange(idx, 'description', e.target.value)} placeholder="Misal: Taksi, Makan Siang" className="w-full bg-white border border-slate-200 p-3 rounded-xl text-slate-900" />
                                        </div>
                                        <div className="col-span-12 md:col-span-2 space-y-2 text-[10px] font-semibold uppercase text-slate-400 tracking-wide">
                                            Nominal
                                            <input type="number" value={it.amount} onChange={(e) => handleItemChange(idx, 'amount', parseFloat(e.target.value))} className="w-full bg-white border border-slate-200 p-3 rounded-xl text-slate-900 font-bold" />
                                        </div>
                                        <div className="col-span-12 space-y-2 text-[10px] font-semibold uppercase text-slate-400 tracking-wide relative">
                                            <div className="flex items-center gap-2">
                                              Foto Nota
                                              <span className="bg-violet-100 text-violet-600 text-[8px] font-semibold px-1.5 py-0.5 rounded-full tracking-wider">🤖 AI READY</span>
                                            </div>
                                            <div className="flex items-start gap-3">
                                              {/* Upload Zone */}
                                              <div className="relative flex-shrink-0">
                                                <input
                                                  type="file"
                                                  accept="image/*"
                                                  onChange={async (e) => {
                                                    const file = e.target.files?.[0]
                                                    if (file) {
                                                      const preview = URL.createObjectURL(file)

                                                      // Set preview + isUploading via functional update
                                                      setItems(prev => {
                                                        const next = [...prev]
                                                        next[idx] = { ...next[idx], receipt_file: file, receipt_preview: preview, receipt_url: '', isUploading: true }
                                                        return next
                                                      })

                                                      // Upload ke Supabase Storage
                                                      const fd = new FormData()
                                                      fd.append('file', file)
                                                      const uploadResult = await uploadReceipt(orgId, fd)

                                                      // Set receipt_url + isUploading=false via functional update
                                                      setItems(prev => {
                                                        const next = [...prev]
                                                        next[idx] = {
                                                          ...next[idx],
                                                          receipt_file: file,
                                                          receipt_preview: preview,
                                                          receipt_url: uploadResult.success ? (uploadResult.url ?? '') : '',
                                                          isUploading: false
                                                        }
                                                        return next
                                                      })

                                                      if (!uploadResult.success) {
                                                        alert(`Gagal upload foto: ${uploadResult.error}`)
                                                        return
                                                      }

                                                      handleScanReceipt(idx, file) // Trigger AI Scan
                                                    }
                                                  }}
                                                  className="opacity-0 absolute inset-0 z-10 cursor-pointer w-full h-full"
                                                />
                                                {it.receipt_preview ? (
                                                  <div className={`relative w-20 h-20 rounded-xl overflow-hidden border-2 shadow-sm ${it.isUploading ? 'border-amber-400 animate-pulse' : it.isScanning ? 'border-violet-500 animate-pulse' : it.receipt_url ? 'border-emerald-400' : 'border-rose-400'}`}>
                                                    <img src={it.receipt_preview} alt="nota" className="w-full h-full object-cover" />
                                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                                      <span className="text-white text-[8px] font-semibold">{it.isUploading ? 'UPLOADING...' : it.isScanning ? 'SCANNING...' : 'GANTI'}</span>
                                                    </div>
                                                    {it.isUploading && <div className="absolute inset-0 bg-amber-400/30 flex items-center justify-center"><span className="text-white text-[7px] font-semibold">⏫</span></div>}
                                                  </div>
                                                ) : (
                                                  <div className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-300 hover:border-blue-300 hover:text-[#003366]/60 transition-all">
                                                    <ImageIcon size={20} />
                                                    <span className="text-[7px] font-semibold mt-1">UPLOAD</span>
                                                  </div>
                                                )}
                                              </div>

                                              {/* AI Region */}
                                              {it.receipt_preview ? (
                                                it.ai_failed ? (
                                                  /* ── OCR FALLBACK: Explicit banner — tidak boleh diam ── */
                                                  <div className="flex-1 bg-rose-50 border border-rose-200 rounded-xl p-3 space-y-2">
                                                    <p className="text-[9px] font-semibold uppercase tracking-wider text-rose-600 flex items-center gap-1.5">
                                                      ⚠️ AI Gagal Membaca Nota
                                                    </p>
                                                    <p className="text-[8px] text-rose-400 leading-relaxed">
                                                      {it.ai_error || 'Foto terlalu buram atau format tidak dikenali.'}
                                                    </p>
                                                    <div className="bg-white border border-rose-100 rounded-lg p-2 space-y-1">
                                                      <p className="text-[8px] font-semibold text-slate-500 uppercase">↓ Input Manual Diperlukan:</p>
                                                      <p className="text-[8px] text-slate-400">• Isi kolom <strong>Nominal</strong> secara manual</p>
                                                      <p className="text-[8px] text-slate-400">• Isi <strong>Uraian</strong> sesuai nota</p>
                                                      <p className="text-[8px] text-slate-400">• Foto tetap tersimpan sebagai bukti</p>
                                                    </div>
                                                    <button
                                                      type="button"
                                                      onClick={() => handleScanReceipt(idx, it.receipt_file)}
                                                      className="w-full text-[8px] font-semibold text-rose-500 border border-rose-200 rounded-lg py-1 hover:bg-rose-100 transition-colors"
                                                    >
                                                      🔄 Coba Scan Ulang
                                                    </button>
                                                  </div>
                                                ) : (
                                                <div className={`flex-1 ${it.isUploading ? 'bg-amber-50 border-amber-100' : it.isScanning ? 'bg-slate-50 border-slate-100' : 'bg-violet-50 border-violet-100'} border rounded-xl p-3 space-y-1 transition-colors`}>
                                                  <p className={`text-[9px] font-semibold uppercase tracking-wider flex items-center gap-1 ${it.isUploading ? 'text-amber-500' : 'text-violet-500'}`}>
                                                    {it.isUploading ? '\u23eb Mengupload Foto...' : `\ud83e\udd16 ${it.isScanning ? 'AI Sedang Memproses...' : 'Dideteksi Oleh AI'}`}
                                                  </p>
                                                  <p className="text-[8px] text-violet-400">
                                                    {it.isUploading ? 'Harap tunggu, foto sedang diupload ke server.' : it.isScanning ? 'Tunggu sebentar, AI sedang membaca nota.' : it.amount > 0 ? 'Data berhasil diekstrak otomatis.' : 'Menunggu hasil deteksi AI...'}
                                                  </p>
                                                  {!it.isUploading && (
                                                    <div className="flex flex-col gap-2 mt-2">
                                                      <div className="flex flex-wrap gap-2">
                                                        <span className={`text-[8px] px-2 py-0.5 rounded-full font-bold ${it.isScanning ? 'bg-slate-200 text-slate-400' : 'bg-violet-100 text-violet-500'}`}>
                                                          Nominal: {it.amount > 0 ? formatRupiah(it.amount) : '\u2014'}
                                                        </span>
                                                        <span className={`text-[8px] px-2 py-0.5 rounded-full font-bold ${it.isScanning ? 'bg-slate-200 text-slate-400' : 'bg-violet-100 text-violet-500'}`}>
                                                          Tanggal: {it.expense_date || '\u2014'}
                                                        </span>
                                                      </div>
                                                      {it.ai_items && it.ai_items.length > 0 && (
                                                        <div className="flex flex-col gap-1 mt-1 bg-white/50 rounded-lg p-2 max-h-32 overflow-y-auto custom-scrollbar shadow-inner">
                                                          {it.ai_items.map((ai_item: any, i: number) => (
                                                            <div key={i} className="flex justify-between items-start gap-2 text-[8px] border-b border-violet-100/50 pb-0.5 last:border-0 last:pb-0">
                                                              <span className="text-slate-600 line-clamp-2">{ai_item.name}</span>
                                                              <span className="font-mono font-bold text-violet-600 whitespace-nowrap">{formatRupiah(ai_item.amount)}</span>
                                                            </div>
                                                          ))}
                                                          <button 
                                                            type="button" 
                                                            onClick={() => splitAiItemsToRows(idx)}
                                                            className="mt-2 w-full flex items-center justify-center gap-1 bg-violet-500 hover:bg-violet-600 text-white text-[9px] font-bold py-1.5 rounded-md transition-colors shadow-sm"
                                                          >
                                                            \u2795 Masukkan Semua Rincian ke Form
                                                          </button>
                                                        </div>
                                                      )}
                                                    </div>
                                                  )}
                                                </div>
                                                )
                                              ) : (
                                                <div className="flex-1 flex items-center justify-center text-slate-300 text-[9px] font-bold italic border border-dashed border-slate-100 rounded-xl">
                                                  Upload nota untuk deteksi AI
                                                </div>
                                              )}
                                            </div>
                                        </div>
                                        <div className="col-span-12 md:col-span-1 pb-1">
                                            <button onClick={() => removeItem(idx)} className="p-3 text-rose-300 hover:text-rose-500 transition-colors">
                                                <Trash2 size={20} />
                                            </button>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="p-5 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Total Pengajuan</span>
                            <span className="text-3xl font-semibold text-slate-900 font-mono tracking-tighter">
                                {formatRupiah(items.reduce((s, it) => s + (it.amount || 0), 0))}
                            </span>
                        </div>
                        <button 
                            disabled={isSubmitting}
                            onClick={handleSubmit} 
                            className="flex items-center gap-3 px-12 py-5 bg-[#003366] disabled:bg-slate-300 text-white rounded-xl font-semibold shadow-md shadow-[#003366]/10 transition-all active:scale-95"
                        >
                           {isSubmitting ? 'MEMPROSES...' : <><Send size={20} /> KIRIM PENGAJUAN</>}
                        </button>
                    </div>
                </motion.div>
            </div>
        )}
      </AnimatePresence>

      {/* Payment Modal */}
      <AnimatePresence>
        {isPayModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-6 overflow-y-auto">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setIsPayModalOpen(false)} />
                <motion.div 
                    initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="relative bg-white w-full max-w-lg rounded-xl shadow-md overflow-hidden"
                >
                    <div className="p-5 border-b border-slate-50 flex items-center justify-between bg-emerald-50/30">
                        <h3 className="text-xl font-semibold text-slate-900 flex items-center gap-3">
                            <Wallet size={24} className="text-emerald-500" /> Proses Pembayaran
                        </h3>
                    </div>
                    <div className="p-5 space-y-8">
                        <div className="p-6 bg-slate-50 rounded-xl space-y-4">
                            <div className="flex justify-between text-xs font-bold">
                                <span className="text-slate-400">NOMOR KLAIM</span>
                                <span className="text-slate-900 font-mono">{selectedReimbursement?.claim_number}</span>
                            </div>
                            <div className="flex justify-between text-xs font-bold">
                                <span className="text-slate-400">DESKRIPSI</span>
                                <span className="text-slate-900">{selectedReimbursement?.description}</span>
                            </div>
                            <div className="pt-4 border-t border-slate-200 flex justify-between items-end">
                                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">TOTAL KETERSEDIAAN</span>
                                <span className="text-2xl font-semibold text-emerald-600 font-mono tracking-tighter">{formatRupiah(selectedReimbursement?.total_amount)}</span>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide ml-4">Sumber Dana (Bank/Kas)</label>
                            <div className="grid grid-cols-1 gap-3">
                                {bankAccounts.map((bank) => (
                                    <button 
                                        key={bank.id} 
                                        onClick={() => setSelectedBankId(bank.id)}
                                        className={`flex items-center justify-between p-5 rounded-xl border-2 transition-all group ${selectedBankId === bank.id ? 'border-emerald-500 bg-emerald-50' : 'border-slate-100 hover:border-slate-300 bg-white'}`}
                                    >
                                        <div className="flex items-center gap-4 text-left">
                                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${selectedBankId === bank.id ? 'bg-emerald-200 text-emerald-700' : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200'}`}>
                                                <Building2 size={24} />
                                            </div>
                                            <div>
                                                <p className="font-semibold text-slate-900 text-sm italic tracking-tight">{bank.bank_name}</p>
                                                <p className="text-[10px] text-slate-400 font-bold font-mono">{bank.account_number}</p>
                                            </div>
                                        </div>
                                        {selectedBankId === bank.id && (
                                            <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-200">
                                                <CheckCircle size={16} />
                                            </div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex flex-col gap-3 pt-4">
                            <button 
                                disabled={isSubmitting}
                                onClick={handlePay}
                                className="w-full py-5 bg-emerald-600 disabled:bg-slate-300 text-white rounded-xl font-semibold text-sm shadow-xl shadow-emerald-200 flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-[0.98]"
                            >
                                {isSubmitting ? 'MEMPROSES TRANSAKSI...' : <><DollarSign size={18} /> KONFIRMASI PEMBAYARAN</>}
                            </button>
                            <button onClick={() => setIsPayModalOpen(false)} className="w-full py-5 bg-white border border-slate-200 text-slate-400 rounded-xl font-semibold text-xs hover:text-slate-600 transition-all">
                                BATALKAN
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; border: 2px solid white; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
      `}</style>
    </div>
  )
}
