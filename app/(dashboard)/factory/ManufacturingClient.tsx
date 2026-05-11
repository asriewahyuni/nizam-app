'use client'

// Halaman manufaktur untuk mengelola resep produksi, SPK, dan cetak dokumen per SPK.
import React, { startTransition, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Plus, 
  Factory, 
  FileText, 
  Settings, 
  CheckCircle2, 
  Layers, 
  Clock, 
  X,
  Trash2,
  ChevronRight,
  TrendingUp,
  Package,
  Zap,
  Play,
  Printer,
  AlertTriangle,
  Truck
} from 'lucide-react'
import { formatRupiah, formatDate } from '@/lib/utils'
import { createBom, updateBom, deleteBom, createWorkOrder, updateWorkOrderStatus, deleteWorkOrder, addWorkOrderCost, getFGBins, createPurchaseRequests } from '@/modules/factory/actions/factory.actions'
import { convertQuantityBetweenUnits } from '@/modules/factory/lib/unit-conversion'

interface ManufacturingClientProps {
  orgId: string
  orgName?: string | null
  activeBranchId?: string | null
  activeBranchName?: string | null
  boms: any[]
  workOrders: any[]
  products: any[]
  warehouses: any[]
}

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } }
}

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
}

function createSpkDraftNumber() {
  return `SPK-${Date.now().toString().slice(-6)}`
}

function createPrintTimestamp() {
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(new Date())
}

function formatQty(value: number | string | null | undefined) {
  const safeValue = Number(value ?? 0)
  if (!Number.isFinite(safeValue)) return '0'

  return new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: Number.isInteger(safeValue) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(safeValue)
}

type PrintableBomItem = {
  product_id?: string | null
  quantity?: number | string | null
  unit?: string | null
  product?: {
    name?: string | null
    unit?: string | null
  } | null
}

type PrintableWorkOrder = {
  wo_number?: string | null
  quantity_planned?: number | string | null
  status?: string | null
  created_at?: string | null
  deadline_date?: string | null
  notes?: string | null
  branch?: {
    name?: string | null
  } | null
  bom?: {
    code?: string | null
    product?: {
      name?: string | null
    } | null
    items?: PrintableBomItem[] | null
  } | null
}

export function ManufacturingClient({
  orgId,
  orgName = null,
  activeBranchId = null,
  activeBranchName = null,
  boms,
  workOrders,
  products,
  warehouses,
}: ManufacturingClientProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'BOM' | 'SPK'>('SPK')
  const [showBomModal, setShowBomModal] = useState(false)
  const [showSpkModal, setShowSpkModal] = useState(false)
  const [showFinishModal, setShowFinishModal] = useState(false)
  const [selectedWo, setSelectedWo] = useState<any>(null)
  const [selectedPrintWo, setSelectedPrintWo] = useState<PrintableWorkOrder | null>(null)
  const [loading, setLoading] = useState(false)
  const [draftSpkNumber, setDraftSpkNumber] = useState('')
  const [printIssuedAt, setPrintIssuedAt] = useState('')
  const [bomItems, setBomItems] = useState<Array<{ productId: string; quantity: number; unit: string }>>([])
  const [editingBom, setEditingBom] = useState<any>(null)
  
  // Advanced Costing State
  const [overheadCosts, setOverheadCosts] = useState<Array<{ description: string; amount: number; cost_type: string }>>([])
  const [profitMargin, setProfitMargin] = useState(25) // Default 25% target margin
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('')
  const [availableBins, setAvailableBins] = useState<any[]>([])
  
  // Custom Modal States
  const [showStockWarningModal, setShowStockWarningModal] = useState(false)
  const [shortItems, setShortItems] = useState<any[]>([])
  const [pendingWo, setPendingWo] = useState<any>(null)
  const [showQuotationPrompt, setShowQuotationPrompt] = useState(false)
  const branchGuardMessage = 'Pilih satu unit aktif terlebih dahulu untuk memakai modul manufaktur.'
  const spkStats = [
    { label: 'SPK Aktif', value: workOrders.filter(w => w.status === 'RELEASED').length, icon: Play, color: 'text-blue-600 bg-blue-50' },
    { label: 'Draft', value: workOrders.filter(w => w.status === 'DRAFT').length, icon: FileText, color: 'text-slate-600 bg-slate-50' },
    { label: 'Selesai (Bulan ini)', value: workOrders.filter(w => w.status === 'COMPLETED').length, icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50' },
    { label: 'Efisiensi Produksi', value: '94%', icon: TrendingUp, color: 'text-amber-600 bg-amber-50' },
  ]
  const companyName = orgName || 'Nizam Manufacturing'

  const refreshFactoryPage = () => {
    startTransition(() => {
      router.refresh()
    })
  }

  const handleOpenPrintPreview = (wo: PrintableWorkOrder) => {
    setSelectedPrintWo(wo)
    setPrintIssuedAt(createPrintTimestamp())
  }

  const handlePrintCurrentWo = () => {
    if (typeof window === 'undefined' || !selectedPrintWo) return
    window.setTimeout(() => window.print(), 100)
  }

  // Load bins when warehouse is selected
  const handleWhChange = async (whId: string) => {
    if (!activeBranchId) {
      alert(branchGuardMessage)
      return
    }
    setSelectedWarehouse(whId)
    if (!whId) {
      setAvailableBins([])
      return
    }
    const bins = await getFGBins(orgId, whId)
    setAvailableBins(bins)
  }

  // Create/Update BoM
  const handleCreateBom = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!activeBranchId) {
      alert(branchGuardMessage)
      return
    }
    setLoading(true)
    const formData = new FormData(e.currentTarget)
    const payload = {
      productId: formData.get('product_id') as string,
      code: formData.get('code') as string,
      description: formData.get('description') as string,
      items: bomItems
    }
    
    const res = editingBom 
      ? await updateBom(orgId, editingBom.id, payload)
      : await createBom(orgId, payload)

    if (res.error) alert(res.error)
    else {
      setShowBomModal(false)
      setEditingBom(null)
      setBomItems([])
      refreshFactoryPage()
    }
    setLoading(false)
  }

  // Create SPK
  const handleCreateSpk = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!activeBranchId) {
      alert(branchGuardMessage)
      return
    }
    setLoading(true)
    const res = await createWorkOrder(orgId, new FormData(e.currentTarget))
    if (res.error) alert(res.error)
    else {
      setShowSpkModal(false)
      refreshFactoryPage()
    }
    setLoading(false)
  }

  // Finish SPK with Costs
  const handleFinishSpk = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!activeBranchId) {
      alert(branchGuardMessage)
      return
    }
    setLoading(true)
    
    const formData = new FormData(e.currentTarget)
    const binId = formData.get('bin_id') as string

    // 1. Save all overhead costs first
    for (const cost of overheadCosts) {
      await addWorkOrderCost(orgId, selectedWo.id, cost)
    }

    // 2. Process Completion
    const res = await updateWorkOrderStatus(orgId, selectedWo.id, 'COMPLETED', {
      warehouseId: selectedWarehouse,
      binId: binId
    })

    if (res.error) alert(res.error)
    else {
      setShowFinishModal(false)
      refreshFactoryPage()
    }
    setLoading(false)
  }

  const handleRelease = async (wo: any) => {
    if (!activeBranchId) {
      alert(branchGuardMessage)
      return
    }
    setLoading(true)
    const items = wo.bom?.items || []
    const qtyPlanned = wo.quantity_planned
    const shortItemsList = []

    for (const bi of items) {
      const productId = bi.product?.id || bi.product_id
      const product = products.find(p => p.id === productId)
      let needed = Number(bi.quantity || 0) * Number(qtyPlanned || 0)
      try {
        const qtyPerUnitInProductBase = convertQuantityBetweenUnits(
          Number(bi.quantity || 0),
          bi.unit || bi.product?.unit || product?.unit,
          bi.product?.unit || product?.unit
        )
        needed = qtyPerUnitInProductBase * Number(qtyPlanned || 0)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Konversi satuan bahan gagal.'
        alert(`BoM "${wo?.bom?.code || wo?.wo_number || ''}" bermasalah untuk bahan "${bi.product?.name || 'Bahan'}": ${message}`)
        setLoading(false)
        return
      }
      const available = product?.stock_available || 0
      if (available < needed) {
        shortItemsList.push({ 
          name: bi.product?.name || 'Bahan', 
          productId: productId,
          needed, 
          available,
          unit: bi.product?.unit || bi.unit
        })
      }
    }

    if (shortItemsList.length > 0) {
      setShortItems(shortItemsList)
      setPendingWo(wo)
      setShowStockWarningModal(true)
      setLoading(false)
      return
    }

    await proceedWithRelease(wo.id)
  }

  const proceedWithRelease = async (woId: string) => {
    if (!activeBranchId) {
      alert(branchGuardMessage)
      return
    }
    setLoading(true)
    const res = await updateWorkOrderStatus(orgId, woId, 'RELEASED')
    if (res.error) alert(res.error)
    else refreshFactoryPage()
    setLoading(false)
  }

  const handleRequestToPurchasing = async () => {
    if (!activeBranchId) {
      alert(branchGuardMessage)
      return
    }
    setLoading(true)
    const requests = shortItems.map(item => ({
      productId: item.productId,
      productName: item.name,
      quantity: item.needed - item.available,
      unit: item.unit,
      notes: `Permintaan otomatis dari SPK: ${pendingWo?.wo_number}`,
      sourceId: pendingWo?.id
    }))

    const res = await createPurchaseRequests(orgId, requests)
    if (res.error) alert(res.error)
    else {
      alert(`Berhasil mengirim ${res.count} permintaan ke Purchasing.`)
      setShowStockWarningModal(false)
    }
    setLoading(false)
  }

  return (
    <>
      <div className="max-w-7xl mx-auto space-y-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold text-slate-900 tracking-tight flex items-center gap-3">
            <Factory size={28} className="text-blue-600" />
            Nizam Manufacturing
          </h1>
          <p className="text-sm text-slate-500 font-medium">
            Pengelolaan Bill of Materials (BoM) dan Work Order (SPK) dengan Accurate Costing.
            {activeBranchName ? ` Scope aktif: ${activeBranchName}.` : ' Mode semua unit hanya baca.'}
          </p>
        </div>

        <div className="flex bg-slate-100/50 p-1 rounded-2xl border border-slate-100">
           <button
              onClick={() => setActiveTab('SPK')}
              className={`px-6 py-2 text-sm font-bold rounded-xl transition-all ${activeTab === 'SPK' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
           >
              Work Order (SPK)
           </button>
           <button
              onClick={() => setActiveTab('BOM')}
              className={`px-6 py-2 text-sm font-bold rounded-xl transition-all ${activeTab === 'BOM' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
           >
              Resep (BoM)
           </button>
        </div>

        <div className="flex items-center gap-3">
          {activeTab === 'BOM' ? (
            <button
              onClick={() => setShowBomModal(true)}
              disabled={!activeBranchId}
              className="flex items-center gap-2 px-6 py-3 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus size={18} />
              Setup BoM Baru
            </button>
          ) : (
            <button
              onClick={() => {
                setDraftSpkNumber(createSpkDraftNumber())
                setShowSpkModal(true)
              }}
              disabled={!activeBranchId}
              className="flex items-center gap-2 px-6 py-3 text-sm font-bold text-white bg-emerald-500 rounded-xl hover:bg-emerald-600 shadow-lg shadow-emerald-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Zap size={18} />
              Terbitkan SPK
            </button>
          )}
        </div>
      </div>

      {!activeBranchId && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-6 py-5 flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white text-amber-500 border border-amber-100 flex items-center justify-center shrink-0">
            <AlertTriangle size={22} />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-amber-900 uppercase tracking-tight">Pilih Unit Aktif</h3>
            <p className="text-sm font-medium text-amber-800/80">
              Anda sedang melihat data lintas unit. Pilih satu unit dari header untuk membuat BoM, menerbitkan SPK, mencatat biaya produksi, atau menyelesaikan produksi.
            </p>
          </div>
        </div>
      )}

      <AnimatePresence initial={false} mode="wait">
        {activeTab === 'SPK' ? (
          <div key="spk" className="space-y-6">
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {spkStats.map((stat, i) => (
                  <div key={i} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
                     <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${stat.color}`}>
                        <stat.icon size={24} />
                     </div>
                     <div>
                        <p className="text-[10px] font-bold text-slate-400 tracking-tight">{stat.label}</p>
                        <p className="text-xl font-semibold text-slate-900">{stat.value}</p>
                     </div>
                  </div>
                ))}
             </div>

             <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                <table className="w-full text-left">
                   <thead className="bg-slate-50 border-b border-slate-100">
                      <tr>
                         <th className="px-8 py-5 text-xs font-semibold text-slate-400 uppercase tracking-tight">No. SPK & Produk</th>
                         <th className="px-6 py-5 text-xs font-semibold text-slate-400 uppercase tracking-tight text-right">Qty Rencana</th>
                         <th className="px-6 py-5 text-xs font-semibold text-slate-400 uppercase tracking-tight">Status</th>
                         <th className="px-6 py-5 text-xs font-semibold text-slate-400 uppercase tracking-tight">Waktu & Dateline</th>
                         <th className="px-8 py-5 text-xs font-semibold text-slate-400 uppercase tracking-tight text-right">Aksi</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-50">
                      {workOrders.length === 0 ? (
                        <tr>
                           <td colSpan={5} className="px-8 py-20 text-center text-slate-400 font-bold italic">Belum ada perintah kerja yang aktif.</td>
                        </tr>
                      ) : (
                        workOrders.map((wo) => {
                          const isUrgent = wo.status !== 'COMPLETED' && wo.deadline_date && new Date(wo.deadline_date) <= new Date(new Date().getTime() + 3 * 24 * 60 * 60 * 1000);
                          const isOverdue = wo.status !== 'COMPLETED' && wo.deadline_date && new Date(wo.deadline_date) < new Date();
                          return (
                          <tr key={wo.id} className={`hover:bg-slate-50/50 transition ${isOverdue ? 'bg-rose-50/30' : isUrgent ? 'bg-amber-50/30' : ''}`}>
                             <td className="px-8 py-5">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-black text-slate-900">{wo.wo_number}</p>
                                  {isOverdue && <span className="px-2 py-0.5 bg-rose-100 text-rose-700 text-[9px] font-semibold uppercase rounded-full tracking-tight flex items-center gap-1"><AlertTriangle size={10}/> Terlambat</span>}
                                  {!isOverdue && isUrgent && <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[9px] font-semibold uppercase rounded-full tracking-tight flex items-center gap-1"><Clock size={10}/> Segera</span>}
                                </div>
                                <p className="text-xs text-slate-500">{wo.bom?.product?.name}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 text-[9px] font-black uppercase tracking-[0.18em] border border-blue-100">
                                    {wo.branch?.name || 'Semua Unit'}
                                  </span>
                                  {wo.bom?.branch?.name && (
                                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[9px] font-black uppercase tracking-[0.18em] border border-slate-200">
                                      BOM {wo.bom.branch.name}
                                    </span>
                                  )}
                                </div>
                             </td>
                             <td className="px-6 py-5 text-right font-black text-slate-900">{formatQty(wo.quantity_planned)} Unit</td>
                             <td className="px-6 py-5">
                                <span className={`px-3 py-1 text-[10px] font-bold rounded-full uppercase tracking-tighter border ${
                                  wo.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                  wo.status === 'RELEASED' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                  'bg-slate-50 text-slate-400 border-slate-100'
                                }`}>
                                   {wo.status}
                                </span>
                             </td>
                             <td className="px-6 py-5">
                               <p className="text-xs text-slate-500 font-medium">Buat: {formatDate(wo.created_at)}</p>
                               {wo.deadline_date && (
                                 <p className={`text-xs font-bold mt-0.5 ${isOverdue ? 'text-rose-600' : isUrgent ? 'text-amber-600' : 'text-slate-600'}`}>
                                   Batas: {formatDate(wo.deadline_date)}
                                 </p>
                               )}
                             </td>
                             <td className="px-8 py-5">
                                 <div className="flex justify-end gap-2">
                                 <button
                                   onClick={() => handleOpenPrintPreview(wo)}
                                   className="px-4 py-2 bg-white text-slate-700 text-[10px] font-black uppercase rounded-lg border border-slate-200 hover:bg-slate-50 flex items-center gap-2"
                                 >
                                   <Printer size={14} />
                                   Cetak SPK
                                 </button>
                                 {wo.status === 'DRAFT' && (
                                   <button 
                                     disabled={!activeBranchId || loading}
                                     onClick={() => handleRelease(wo)} 
                                     className="px-4 py-2 bg-blue-600 text-white text-[10px] font-black uppercase rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                                   >
                                     {loading ? 'Processing...' : 'Mulai Produksi'}
                                   </button>
                                 )}
                                {wo.status === 'RELEASED' && (
                                  <>
                                    <button 
                                      disabled={!activeBranchId}
                                      onClick={() => {
                                        setSelectedWo(wo)
                                        setShowFinishModal(true)
                                      }} 
                                      className="px-4 py-2 bg-emerald-600 text-white text-[10px] font-black uppercase rounded-lg shadow-lg shadow-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      Selesaikan
                                    </button>
                                  </>
                                )}
                                <button
                                  disabled={!activeBranchId}
                                  onClick={async () => {
                                    if (confirm('Yakin ingin menghapus SPK ini?')) {
                                      const res = await deleteWorkOrder(orgId, wo.id)
                                      if (res.error) alert(res.error)
                                      else refreshFactoryPage()
                                    }
                                  }}
                                  className="p-2 text-rose-300 hover:text-rose-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="Hapus SPK"
                                >
                                  <Trash2 size={16} />
                                </button>
                                </div>
                             </td>
                          </tr>
                          )
                        })
                      )}
                   </tbody>
                </table>
                </div>
             </div>
          </div>
        ) : (
          <motion.div key="bom" variants={container} initial="hidden" animate="show" exit="hidden" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
             {boms.length === 0 ? (
                <div className="col-span-full py-20 bg-white rounded-3xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-center space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-300">
                    <Layers size={32} />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-bold text-slate-900">Belum ada Resep (BoM)</h3>
                    <p className="text-sm text-slate-400 max-w-xs mx-auto">Definisikan komposisi bahan baku untuk produk jadi Anda.</p>
                  </div>
                </div>
             ) : (
               boms.map((bom) => {
                 // Calculate Estimated RM Cost for the BoM
                 const estimatedHppPerUnit = bom.items?.reduce((sum: number, bi: any) => {
                   const cost = bi.product?.average_cost || bi.product?.purchase_price || 0;
                   return sum + (bi.quantity * cost);
                 }, 0) || 0;

                 return (
                  <motion.div key={bom.id} variants={item} className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm space-y-6 relative group overflow-hidden">
                     <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-all">
                        <FileText size={80} strokeWidth={1} />
                     </div>
                     <div className="space-y-2">
                        <div className="flex items-center justify-between">
                           <span className="px-3 py-1 bg-blue-50 text-blue-600 text-[10px] font-semibold uppercase rounded-lg tracking-tight">{bom.code}</span>
                           <div className="flex flex-col items-end">
                              <span className="text-[10px] font-bold text-slate-400 tracking-tight">Est. HPP / Unit</span>
                              <span className="text-sm font-black text-rose-600">{formatRupiah(estimatedHppPerUnit)}</span>
                           </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 text-[9px] font-black uppercase tracking-[0.18em] border border-indigo-100">
                            {bom.branch?.name || 'Shared / Semua Unit'}
                          </span>
                        </div>
                        <h3 className="text-xl font-bold text-slate-900">{bom.product?.name}</h3>
                        <p className="text-xs text-slate-400 font-medium leading-relaxed">{bom.description || 'Tidak ada deskripsi resep.'}</p>
                     </div>
                     
                     <div className="pt-6 border-t border-slate-50 space-y-3">
                        <p className="text-[10px] font-bold text-slate-400 tracking-tight">Komposisi Bahan</p>
                        <div className="space-y-2">
                           {bom.items && bom.items.length > 0 ? (
                             bom.items.map((bi: any, idx: number) => (
                               <div key={idx} className="flex justify-between items-center text-xs font-bold text-slate-600 p-2 bg-slate-50 rounded-xl">
                                  <span>{bi.product?.name || 'Unknown Product'}</span>
                                  <span className="text-blue-600 font-black">{bi.quantity} <span className="text-[10px] text-slate-400 font-bold uppercase">{bi.unit || bi.product?.unit}</span></span>
                               </div>
                             ))
                           ) : (
                             <p className="text-[10px] text-slate-400 italic">Belum ada bahan baku yang didaftarkan.</p>
                           )}
                        </div>
                     </div>

                     <div className="pt-4 flex items-center justify-between">
                        <button 
                          disabled={!activeBranchId}
                          onClick={() => {
                            setEditingBom(bom)
                            setBomItems(bom.items?.map((bi: any) => ({
                              productId: bi.product?.id,
                              quantity: bi.quantity,
                              unit: bi.unit || bi.product?.unit || 'Pcs'
                            })) || [])
                            setShowBomModal(true)
                          }}
                          className="text-[10px] font-semibold text-blue-600 uppercase tracking-tight flex items-center gap-2 hover:gap-3 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                           Edit Resep <ChevronRight size={14} />
                        </button>

                        <button 
                          disabled={!activeBranchId}
                          onClick={async () => {
                            if (confirm('Yakin ingin menghapus resep (BoM) ini?')) {
                              setLoading(true)
                              const res = await deleteBom(orgId, bom.id)
                              if (res.error) alert(res.error)
                              else refreshFactoryPage()
                              setLoading(false)
                            }
                          }}
                          className="flex items-center gap-2 px-3 py-1 text-[10px] font-semibold text-rose-400 hover:text-rose-600 transition-all uppercase tracking-tight disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Trash2 size={12} /> Hapus
                        </button>
                     </div>
                  </motion.div>
                 )
               })
             )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* NEW SPK MODAL */}
      <AnimatePresence>
        {selectedPrintWo && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 print:static print:block print:p-0">
            <style>{`
              @media print {
                @page { size: A4 portrait; margin: 12mm; }
                body {
                  background: #fff !important;
                  -webkit-print-color-adjust: exact;
                  print-color-adjust: exact;
                }
                body * { visibility: hidden !important; }
                #wo-print-area, #wo-print-area * { visibility: visible !important; }
                #wo-print-area {
                  position: absolute;
                  left: 0;
                  top: 0;
                  width: 100%;
                  max-width: none;
                  margin: 0;
                  padding: 0;
                  border: none;
                  box-shadow: none;
                  overflow: visible;
                  background: #fff;
                }
                #wo-print-area table {
                  width: 100%;
                  border-collapse: collapse;
                }
                #wo-print-area thead {
                  display: table-header-group;
                }
                #wo-print-area tr {
                  break-inside: avoid;
                  page-break-inside: avoid;
                }
                .wo-print-no-print { display: none !important; }
              }
            `}</style>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedPrintWo(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm print:hidden wo-print-no-print"
            />

            <motion.div
              id="wo-print-area"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col print:shadow-none print:max-h-none print:h-auto print:max-w-none print:w-full print:mx-auto print:rounded-none print:text-[11px] print:leading-relaxed"
            >
              <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between gap-4 wo-print-no-print print:hidden">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Preview SPK</h3>
                  <p className="text-xs text-slate-500 font-medium">Cetak satu dokumen untuk satu SPK.</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handlePrintCurrentWo}
                    className="px-5 py-2.5 bg-white text-slate-700 font-bold text-sm border border-slate-200 rounded-xl hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm"
                  >
                    <Printer size={16} />
                    Cetak SPK
                  </button>
                  <button
                    onClick={() => setSelectedPrintWo(null)}
                    className="w-10 h-10 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-rose-50 hover:text-rose-600 hover:border-rose-100 transition-all flex items-center justify-center shadow-sm"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-8 bg-white print:overflow-visible print:p-0">
                <div className="border-b-2 border-slate-900 pb-6 mb-6">
                  <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-500">{companyName}</p>
                      <h2 className="text-3xl font-semibold text-slate-900 tracking-tight mt-2">Surat Perintah Kerja</h2>
                      <p className="text-sm font-bold text-blue-600 mt-1">{selectedPrintWo.wo_number}</p>
                      <p className="text-xs text-slate-500 mt-3 max-w-xl">
                        Dokumen operasional untuk pelaksanaan produksi berdasarkan resep dan target output yang sudah ditetapkan.
                      </p>
                    </div>
                    <div className="text-sm text-slate-600 font-medium space-y-1 md:text-right">
                      <p>Unit: {selectedPrintWo.branch?.name || activeBranchName || 'Semua Unit'}</p>
                      <p>BOM: {selectedPrintWo.bom?.code || '-'}</p>
                      <p>Dicetak: {printIssuedAt || '-'}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
                  <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50/60">
                    <p className="text-[10px] font-semibold tracking-tight text-slate-400">Produk Jadi</p>
                    <p className="text-lg font-semibold text-slate-900 mt-2">{selectedPrintWo.bom?.product?.name || '-'}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50/60">
                    <p className="text-[10px] font-semibold tracking-tight text-slate-400">Qty Target</p>
                    <p className="text-lg font-semibold text-slate-900 mt-2">{formatQty(selectedPrintWo.quantity_planned)} Unit</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50/60">
                    <p className="text-[10px] font-semibold tracking-tight text-slate-400">Status</p>
                    <div className="mt-2">
                      <span className={`px-3 py-1 text-[10px] font-bold rounded-full uppercase tracking-tighter border ${
                        selectedPrintWo.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                        selectedPrintWo.status === 'RELEASED' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                        'bg-slate-50 text-slate-500 border-slate-200'
                      }`}>
                        {selectedPrintWo.status}
                      </span>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 p-4 bg-white">
                    <p className="text-[10px] font-semibold tracking-tight text-slate-400">Tanggal Dibuat</p>
                    <p className="text-sm font-bold text-slate-900 mt-2">{formatDate(selectedPrintWo.created_at)}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 p-4 bg-white">
                    <p className="text-[10px] font-semibold tracking-tight text-slate-400">Batas Selesai</p>
                    <p className="text-sm font-bold text-slate-900 mt-2">{selectedPrintWo.deadline_date ? formatDate(selectedPrintWo.deadline_date) : '-'}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 p-4 bg-white">
                    <p className="text-[10px] font-semibold tracking-tight text-slate-400">Resep Produksi</p>
                    <p className="text-sm font-bold text-slate-900 mt-2">{selectedPrintWo.bom?.code || '-'}</p>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 overflow-hidden mb-6">
                  <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
                    <h4 className="text-sm font-semibold text-slate-900 uppercase tracking-tight">Komposisi Bahan Produksi</h4>
                    <p className="text-xs text-slate-500 mt-1">Total kebutuhan mengikuti satuan yang dipasang di resep.</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead className="bg-white">
                        <tr>
                          <th className="px-6 py-4 text-left text-[10px] font-semibold tracking-tight text-slate-400 border-b border-slate-200">Bahan</th>
                          <th className="px-4 py-4 text-right text-[10px] font-semibold tracking-tight text-slate-400 border-b border-slate-200">Qty per Unit</th>
                          <th className="px-4 py-4 text-right text-[10px] font-semibold tracking-tight text-slate-400 border-b border-slate-200">Total Kebutuhan</th>
                          <th className="px-6 py-4 text-left text-[10px] font-semibold tracking-tight text-slate-400 border-b border-slate-200">Satuan</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedPrintWo.bom?.items?.length ? (
                          selectedPrintWo.bom.items.map((bi, idx) => {
                            const qtyPerUnit = Number(bi.quantity || 0)
                            const totalNeed = qtyPerUnit * Number(selectedPrintWo.quantity_planned || 0)
                            const unitLabel = bi.unit || bi.product?.unit || '-'

                            return (
                              <tr key={`${bi.product_id || idx}-${idx}`} className="odd:bg-slate-50/40">
                                <td className="px-6 py-4 text-sm font-bold text-slate-900 border-b border-slate-100">{bi.product?.name || 'Bahan produksi'}</td>
                                <td className="px-4 py-4 text-sm text-right text-slate-700 border-b border-slate-100">{formatQty(qtyPerUnit)}</td>
                                <td className="px-4 py-4 text-sm text-right font-black text-slate-900 border-b border-slate-100">{formatQty(totalNeed)}</td>
                                <td className="px-6 py-4 text-sm text-slate-700 border-b border-slate-100">{unitLabel}</td>
                              </tr>
                            )
                          })
                        ) : (
                          <tr>
                            <td colSpan={4} className="px-6 py-10 text-center text-sm font-medium text-slate-400 italic">
                              Resep belum memiliki detail bahan.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-6">
                  <div className="rounded-xl border border-slate-200 p-6">
                    <p className="text-[10px] font-semibold tracking-tight text-slate-400">Catatan Produksi</p>
                    <p className="text-sm text-slate-700 leading-relaxed mt-3">
                      {selectedPrintWo.notes?.trim() || 'Tidak ada catatan tambahan pada SPK ini.'}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 p-6">
                    <p className="text-[10px] font-semibold tracking-tight text-slate-400 mb-8">Paraf Operasional</p>
                    <div className="space-y-8">
                      <div>
                        <p className="text-xs text-slate-500 mb-8">Pelaksana Produksi</p>
                        <div className="border-b border-slate-300" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-8">Supervisor / PIC</p>
                        <div className="border-b border-slate-300" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-8">Gudang / QC</p>
                        <div className="border-b border-slate-300" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {showSpkModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowSpkModal(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl p-8">
               <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xl font-bold text-slate-900 flex items-center gap-3">
                     <Zap size={20} className="text-emerald-500" /> Terbitkan SPK Baru
                  </h3>
                  <button onClick={() => setShowSpkModal(false)} className="text-slate-400 hover:text-slate-900"><X size={20} /></button>
               </div>
               <form onSubmit={handleCreateSpk} className="space-y-6">
                  <div className="space-y-2 text-left">
                     <label className="text-[10px] font-bold text-slate-400 tracking-tight ml-1">No SPK (Internal Number)</label>
                     <input name="wo_number" required placeholder="SPK-XXXXX" defaultValue={draftSpkNumber} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-blue-500 font-bold" />
                  </div>
                  <div className="space-y-2 text-left">
                     <label className="text-[10px] font-bold text-slate-400 tracking-tight ml-1">Pilih Resep Produksi (BoM)</label>
                     <select name="bom_id" required className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl outline-none focus:border-blue-500 font-bold">
                        <option value="">-- Pilih Produk Jadi --</option>
                        {boms.map(b => (
                           <option key={b.id} value={b.id}>{b.code} - {b.product?.name}</option>
                        ))}
                     </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2 text-left">
                       <label className="text-[10px] font-bold text-slate-400 tracking-tight ml-1">Jumlah Target Produksi</label>
                       <input name="quantity_planned" type="number" required placeholder="0" className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl outline-none focus:border-blue-500 font-bold text-xl" />
                    </div>
                    <div className="space-y-2 text-left">
                       <label className="text-[10px] font-bold text-slate-400 tracking-tight ml-1">Batas Selesai (Dateline)</label>
                       <input name="deadline_date" type="date" required className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl outline-none focus:border-rose-500 font-bold text-slate-700" />
                    </div>
                  </div>
                  <button type="submit" disabled={loading} className="w-full py-5 bg-emerald-500 text-white font-black rounded-2xl shadow-xl shadow-emerald-100">
                     {loading ? 'Processing...' : 'Terbitkan Sekarang'}
                  </button>
               </form>
            </motion.div>
          </div>
        )}

        {showBomModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowBomModal(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl p-8 flex flex-col max-h-[90vh]">
               <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xl font-bold text-slate-900 flex items-center gap-3">
                     <Settings size={20} className="text-blue-500" /> {editingBom ? 'Edit Bill of Materials' : 'Setup Bill of Materials'}
                  </h3>
                  <button onClick={() => { setShowBomModal(false); setEditingBom(null); setBomItems([]); }} className="text-slate-400 hover:text-slate-900"><X size={20} /></button>
               </div>
               <form onSubmit={handleCreateBom} className="space-y-6 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-2 text-left">
                        <label className="text-[10px] font-bold text-slate-400 tracking-tight ml-1">Pilih Produk Jadi</label>
                        <select name="product_id" required defaultValue={editingBom?.product?.id} className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none">
                           <option value="">-- Pilih Produk --</option>
                           {products.filter(p => ['Siap Jual', 'Layanan'].includes(p.category) || !p.category).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                     </div>
                     <div className="space-y-2 text-left">
                        <label className="text-[10px] font-bold text-slate-400 tracking-tight ml-1">Kode BoM</label>
                        <input name="code" required defaultValue={editingBom?.code} placeholder="BOM-PRD-01" className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" />
                     </div>
                  </div>
                  
                  <div className="p-6 bg-slate-50 rounded-2xl space-y-4">
                     <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-tight">Komposisi Bahan Baku</p>
                     <div className="flex gap-2">
                        <select id="item-product" className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm" onChange={(e) => {
                           const p = products.find(prod => prod.id === e.target.value);
                           if (p && p.unit) {
                              (document.getElementById('item-unit') as HTMLSelectElement).value = p.unit;
                           }
                        }}>
                           <option value="">Pilih Elemen Produksi...</option>
                           {products.filter(p => ['Bahan', 'Setengah Jadi', 'Pelengkap', 'Layanan', 'Lainnya'].includes(p.category) || !p.category).map(p => (
                             <option key={p.id} value={p.id}>
                               {p.name} {p.unit ? `(${p.unit})` : ''} — {formatRupiah(p.average_cost || p.purchase_price || 0)}
                             </option>
                           ))}
                           <optgroup label="Sbg Komponen (Produk Jadi)">
                             {products.filter(p => p.category === 'Siap Jual').map(p => (
                               <option key={p.id} value={p.id}>{p.name} (Hasil Produksi)</option>
                             ))}
                           </optgroup>
                        </select>
                        <input id="item-qty" type="number" step="any" placeholder="Qty" className="w-20 px-3 py-3 bg-white border border-slate-200 rounded-xl text-sm" />
                        <select id="item-unit" className="w-24 px-2 py-3 bg-white border border-slate-200 rounded-xl text-[11px] font-bold text-blue-700">
                           {['Pcs', 'Unit', 'Kg', 'Gram', 'Liter', 'Ml', 'Box', 'Pack', 'Roll', 'Lembar', 'Set', 'Lusin', 'Meter', 'Cm', 'Pasang', 'Ekor'].map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                        <button 
                          type="button" 
                          onClick={() => {
                             const pId = (document.getElementById('item-product') as HTMLSelectElement).value
                             const qty = Number((document.getElementById('item-qty') as HTMLInputElement).value)
                             const unit = (document.getElementById('item-unit') as HTMLSelectElement).value
                             if (!pId || !qty) return
                             // Default unit follows product master, but can be overridden by user.
                             const selectedProduct = products.find(p => p.id === pId)
                             const finalUnit = unit || selectedProduct?.unit || 'Pcs'
                             setBomItems([...bomItems, { productId: pId, quantity: qty, unit: finalUnit }])
                          }}
                          className="px-4 bg-blue-600 text-white rounded-xl"
                        >
                           <Plus size={18} />
                        </button>
                     </div>

                     <div className="space-y-2">
                        {bomItems.map((item, idx) => {
                           const p = products.find(p => p.id === item.productId)
                           return (
                             <div key={idx} className="flex justify-between items-center p-3 bg-white rounded-xl border border-slate-100 text-sm">
                                <span className="font-bold text-slate-700">{p?.name}</span>
                                <div className="flex items-center gap-4">
                                   <span className="font-black text-blue-600">{item.quantity} <span className="text-blue-400 font-bold text-xs">{(item as any).unit || p?.unit || 'Pcs'}</span></span>
                                   <button type="button" onClick={() => setBomItems(bomItems.filter((_, i) => i !== idx))} className="text-rose-500"><X size={14} /></button>
                                </div>
                             </div>
                           )
                        })}
                     </div>
                  </div>

                  <button type="submit" disabled={loading} className="w-full py-4 bg-slate-900 text-white font-bold rounded-2xl shadow-xl hover:bg-black">
                     {loading ? 'Processing...' : (editingBom ? 'Update Resep' : 'Simpan Resep')}
                  </button>
               </form>
            </motion.div>
          </div>
        )}

        {/* FINISH SPK MODAL */}
        {showFinishModal && selectedWo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowFinishModal(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl p-8 flex flex-col max-h-[90vh]">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-slate-900 flex items-center gap-3">
                    <CheckCircle2 size={24} className="text-emerald-500" /> Selesaikan Produksi
                  </h3>
                  <p className="text-xs text-slate-400 font-medium">{selectedWo.wo_number} - {selectedWo.bom?.product?.name}</p>
                </div>
                <button onClick={() => setShowFinishModal(false)} className="text-slate-400 hover:text-slate-900"><X size={20} /></button>
              </div>

              <form onSubmit={handleFinishSpk} className="space-y-6 flex-1 overflow-y-auto pr-2 custom-scrollbar text-left">
                {/* Inventory Section */}
                <div className="p-6 bg-slate-50 rounded-2xl space-y-4">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-tight flex items-center gap-2">
                    <Package size={12} /> Tujuan Penyimpanan Stok
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 ml-1">Pilih Gudang</label>
                      <select
                        required
                        onChange={(e) => handleWhChange(e.target.value)}
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold"
                      >
                        <option value="">-- Pilih --</option>
                        {warehouses.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 ml-1">Pilih Rak (Bin)</label>
                      <select name="bin_id" className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold">
                        <option value="">-- Standar --</option>
                        {availableBins.map((b: any) => <option key={b.id} value={b.id}>{b.code}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Overhead Section & HPP Calculation */}
                <div className="p-6 border border-slate-100 rounded-2xl space-y-4">
                  <div className="flex justify-between items-center">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-tight flex items-center gap-2">
                      <Zap size={12} /> Biaya Tambahan (Labor/Overhead)
                    </p>
                    <button
                      type="button"
                      onClick={() => setOverheadCosts([...overheadCosts, { description: '', amount: 0, cost_type: 'LABOR' }])}
                      className="text-[10px] font-black text-blue-600 uppercase"
                    >
                      + Tambah Biaya
                    </button>
                  </div>

                  <div className="space-y-3">
                    {overheadCosts.map((cost, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <input
                          placeholder="Ket: Listrik, Gaji, dll"
                          className="flex-1 px-4 py-2 bg-slate-50 border border-slate-100 rounded-lg text-xs"
                          value={cost.description}
                          onChange={(e) => {
                            const newCosts = [...overheadCosts]
                            newCosts[idx].description = e.target.value
                            setOverheadCosts(newCosts)
                          }}
                        />
                        <input
                          type="number"
                          placeholder="Rp 0"
                          className="w-32 px-4 py-2 bg-slate-50 border border-slate-100 rounded-lg text-xs font-bold"
                          value={cost.amount || ''}
                          onChange={(e) => {
                            const newCosts = [...overheadCosts]
                            newCosts[idx].amount = Number(e.target.value)
                            setOverheadCosts(newCosts)
                          }}
                        />
                        <button type="button" onClick={() => setOverheadCosts(overheadCosts.filter((_, i) => i !== idx))} className="text-rose-500"><X size={14} /></button>
                      </div>
                    ))}
                    {overheadCosts.length === 0 && (
                      <p className="text-[10px] text-slate-400 italic text-center py-2">Tidak ada biaya tambahan yang dicatat.</p>
                    )}
                  </div>

                  {(() => {
                    const rawMaterialCost = selectedWo?.bom?.items?.reduce((sum: number, item: any) => {
                      const cost = item.product?.average_cost || item.product?.purchase_price || 0;
                      let qtyPerUnit = Number(item.quantity || 0)
                      try {
                        qtyPerUnit = convertQuantityBetweenUnits(
                          Number(item.quantity || 0),
                          item.unit || item.product?.unit,
                          item.product?.unit
                        )
                      } catch {
                        qtyPerUnit = Number(item.quantity || 0)
                      }
                      return sum + (qtyPerUnit * selectedWo.quantity_planned * cost)
                    }, 0) || 0
                    const totalOverhead = overheadCosts.reduce((s, c) => s + c.amount, 0)
                    const grandTotalHPP = rawMaterialCost + totalOverhead
                    const qtyPlanned = selectedWo?.quantity_planned || 1
                    const hppPerUnit = grandTotalHPP / qtyPlanned
                    // safe divide by zero if user enters 100% margin
                    const profitMarginDecimal = Math.max(0.01, (100 - (profitMargin || 0)) / 100)
                    const suggestedPrice = hppPerUnit / profitMarginDecimal

                    return (
                      <div className="pt-4 border-t border-slate-100 space-y-3">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-500">Total Biaya Tambahan:</span>
                          <span className="font-bold text-slate-700">{formatRupiah(totalOverhead)}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-500">Estimasi Biaya Bahan (Sistem):</span>
                          <span className="font-bold text-slate-700">{formatRupiah(rawMaterialCost)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm pt-2 border-t border-slate-100">
                          <span className="font-bold text-slate-800">Total HPP Produksi:</span>
                          <span className="font-black text-rose-600">{formatRupiah(grandTotalHPP)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="font-bold text-slate-800">HPP per Unit (Modal Bersih):</span>
                          <span className="font-black text-rose-600">{formatRupiah(hppPerUnit)}</span>
                        </div>

                        <div className="mt-6 p-4 bg-emerald-50 border border-emerald-100 rounded-xl space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-emerald-800 uppercase tracking-wide">Target Margin (%)</span>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                value={profitMargin}
                                onChange={e => setProfitMargin(Number(e.target.value))}
                                className="w-16 px-2 py-1 text-center font-bold text-emerald-700 bg-white border border-emerald-200 rounded-lg outline-none"
                              />
                              <span className="text-sm font-bold text-emerald-700">%</span>
                            </div>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-bold text-emerald-900">Rekomendasi Harga Jual:</span>
                            <span className="text-lg font-semibold text-emerald-600">{formatRupiah(suggestedPrice)}</span>
                          </div>
                          <p className="text-[10px] text-emerald-600/80 leading-snug">Formula: HPP / (100% - Margin%). Harga yang dioptimalkan untuk melindungi margin bersih Anda.</p>
                        </div>
                      </div>
                    )
                  })()}
                </div>

                <div className="pt-4">
                  <button type="submit" disabled={loading} className="w-full py-5 bg-emerald-600 text-white font-black rounded-2xl shadow-xl shadow-emerald-100 flex items-center justify-center gap-3">
                    {loading ? 'Processing...' : <><CheckCircle2 size={20} /> Konfirmasi & Selesaikan Produksi</>}
                  </button>
                  <p className="text-[10px] text-center text-slate-400 mt-4 px-8">Menyelesaikan SPK akan otomatis memotong stok bahan baku dan menambah stok produk jadi sesuai resep.</p>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* BEAUTIFIED STOCK WARNING MODAL */}
        {showStockWarningModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowStockWarningModal(false)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden border border-rose-100"
            >
              <div className="bg-rose-50 p-8 flex flex-col items-center text-center space-y-4">
                <div className="w-20 h-20 bg-white rounded-full shadow-xl shadow-rose-200/50 flex items-center justify-center relative overflow-hidden">
                  <motion.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="text-rose-500"
                  >
                    <AlertTriangle size={40} />
                  </motion.div>
                  <div className="absolute inset-0 bg-rose-500/5 animate-pulse" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-2xl font-semibold text-rose-900 leading-tight uppercase tracking-tight">Kekurangan Stok Bahan!</h2>
                  <p className="text-rose-600/70 font-bold text-xs tracking-tight">Peringatan Ketersediaan Inventory</p>
                </div>
              </div>

              <div className="p-8 space-y-6">
                <div className="space-y-3">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-tight ml-1">Daftar Bahan Kurang:</p>
                  <div className="space-y-2">
                    {shortItems.map((item, i) => (
                      <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 transition hover:border-rose-200 group">
                        <div className="flex flex-col">
                          <span className="text-sm font-black text-slate-800">{item.name}</span>
                          <span className="text-[10px] font-bold text-slate-400">Inventory saat ini: {item.available}</span>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="text-xs font-black text-rose-600">Butuh {item.needed}</span>
                          <span className="text-[10px] font-bold text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full mt-1">-{item.needed - item.available}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-amber-50 rounded-2xl p-5 border border-amber-100 relative overflow-hidden">
                  <div className="relative z-10 flex gap-4">
                    <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center shrink-0">
                      <Layers size={20} className="text-amber-500" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-black text-amber-900">Bahan baku tidak mencukupi.</p>
                      <p className="text-[10px] font-medium text-amber-700/80 leading-relaxed italic">
                        Klik <span className="font-black">Lanjut Produksi</span> untuk sistem Backorder (Stok Minus), atau <span className="font-black text-blue-600">Ganti Akad</span> untuk beralih ke Pre-Order (Salam/Istisna).
                      </p>
                    </div>
                  </div>
                  <div className="absolute top-0 right-0 p-2 opacity-[0.03]">
                    <Clock size={60} />
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => {
                      setShowStockWarningModal(false)
                      if (pendingWo) {
                        proceedWithRelease(pendingWo.id)
                      }
                    }}
                    className="w-full py-5 bg-slate-900 text-white font-semibold rounded-xl shadow-xl hover:bg-black transition-all transform hover:-translate-y-1 active:scale-95 text-xs tracking-tight uppercase"
                  >
                    Bypass & Lanjut Produksi
                  </button>
                  
                  <button
                    disabled={loading}
                    onClick={handleRequestToPurchasing}
                    className="w-full py-5 bg-blue-600 text-white font-semibold rounded-xl shadow-xl hover:bg-blue-700 transition-all transform hover:-translate-y-1 active:scale-95 text-xs tracking-tight uppercase flex items-center justify-center gap-2"
                  >
                    <Truck size={14} /> {loading ? 'Mengirim...' : 'Kirim Rikues ke Purchasing'}
                  </button>

                  <button
                    onClick={() => {
                      setShowStockWarningModal(false)
                      setShowQuotationPrompt(true)
                    }}
                    className="w-full py-4 bg-rose-50 text-rose-600 font-bold rounded-xl hover:bg-rose-100 transition-all text-[10px] tracking-widest uppercase border border-rose-100"
                  >
                    Batalkan SPK Ini
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* QUOTATION PROMPT MODAL */}
        {showQuotationPrompt && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowQuotationPrompt(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-10 text-center space-y-8"
            >
              <div className="w-24 h-24 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto shadow-inner border-4 border-white">
                <TrendingUp size={44} />
              </div>
              <div className="space-y-4">
                <h3 className="text-2xl font-semibold text-slate-900 tracking-tight leading-tight">Alihkan ke Akad Pre-Order?</h3>
                <p className="text-sm font-medium text-slate-500 px-4">
                  Produksi tertunda karena stok kurang. Ingin beralih ke menu <span className="font-bold text-blue-600 italic">Penawaran (Quotation)</span> untuk mencatat akad Salam/Istisna agar operasional tetap aman?
                </p>
              </div>
              <div className="flex gap-4">
                <button
                  onClick={() => setShowQuotationPrompt(false)}
                  className="flex-1 py-5 bg-slate-100 text-slate-600 font-bold rounded-3xl hover:bg-slate-200 transition text-[11px] tracking-tight"
                >
                  Nanti Saja
                </button>
                <button
                  onClick={() => router.push('/sales/quotations')}
                  className="flex-1 py-5 bg-blue-600 text-white font-semibold rounded-3xl hover:bg-blue-500 shadow-xl shadow-blue-100 transition text-[11px] uppercase tracking-tight"
                >
                  Ya, Alihkan
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      </div>
    </>
  )
}
