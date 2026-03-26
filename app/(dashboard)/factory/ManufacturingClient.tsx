'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Plus, 
  Factory, 
  FileText, 
  Settings, 
  CheckCircle2, 
  Layers, 
  Clock, 
  MoreVertical,
  X,
  Trash2,
  Search,
  ChevronRight,
  TrendingUp,
  Package,
  Zap,
  Play,
  ClipboardList
} from 'lucide-react'
import { formatRupiah, formatDate } from '@/lib/utils'
import { createBom, updateBom, deleteBom, createWorkOrder, updateWorkOrderStatus, deleteWorkOrder, addWorkOrderCost, getFGBins } from '@/modules/factory/actions/factory.actions'

interface ManufacturingClientProps {
  orgId: string
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

export function ManufacturingClient({ orgId, boms, workOrders, products, warehouses }: ManufacturingClientProps) {
  const [activeTab, setActiveTab] = useState<'BOM' | 'SPK'>('SPK')
  const [showBomModal, setShowBomModal] = useState(false)
  const [showSpkModal, setShowSpkModal] = useState(false)
  const [showFinishModal, setShowFinishModal] = useState(false)
  const [selectedWo, setSelectedWo] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [bomItems, setBomItems] = useState<Array<{ productId: string; quantity: number; unit: string }>>([])
  const [editingBom, setEditingBom] = useState<any>(null)
  
  // Advanced Costing State
  const [overheadCosts, setOverheadCosts] = useState<Array<{ description: string; amount: number; cost_type: string }>>([])
  const [profitMargin, setProfitMargin] = useState(25) // Default 25% target margin
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('')
  const [availableBins, setAvailableBins] = useState<any[]>([])

  // Load bins when warehouse is selected
  const handleWhChange = async (whId: string) => {
    setSelectedWarehouse(whId)
    const bins = await getFGBins(orgId, whId)
    setAvailableBins(bins)
  }

  // Create/Update BoM
  const handleCreateBom = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
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
      window.location.reload()
    }
    setLoading(false)
  }

  // Create SPK
  const handleCreateSpk = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    const res = await createWorkOrder(orgId, new FormData(e.currentTarget))
    if (res.error) alert(res.error)
    else {
      setShowSpkModal(false)
      window.location.reload()
    }
    setLoading(false)
  }

  // Finish SPK with Costs
  const handleFinishSpk = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
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
      window.location.reload()
    }
    setLoading(false)
  }

  const handleRelease = async (wo: any) => {
    setLoading(true)
    // 1. Check stock of all items in BoM relative to planned quantity
    const items = wo.bom?.items || []
    const qtyPlanned = wo.quantity_planned
    let shortItems = []

    for (const bi of items) {
      const needed = bi.quantity * qtyPlanned
      const productId = bi.product?.id || bi.product_id
      const product = products.find(p => p.id === productId)
      const available = product?.stock_available || 0
      if (available < needed) {
        shortItems.push({ name: bi.product?.name || 'Bahan', needed, available })
      }
    }

    if (shortItems.length > 0) {
      const list = shortItems.map(s => `• ${s.name}: Butuh ${s.needed}, Ada ${s.available}`).join('\n')
      const msg = `⚠️ PERINGATAN STOK KURANG!\n\n${list}\n\nBahan baku tidak mencukupi untuk target produksi ini.\n\nKlik 'OK' untuk tetap Lanjut Produksi (Sistem Backorder),\natau 'Cancel' untuk batalkan dan pertimbangkan Ganti Akad Penjualan (Salam/Istisna).`
      
      if (!confirm(msg)) {
        if (confirm('Apakah Anda ingin beralih ke menu Penawaran (Quotation) untuk membuat akad Pre-Order?')) {
          window.location.href = '/sales/quotations'
        }
        setLoading(false)
        return
      }
    }

    const res = await updateWorkOrderStatus(orgId, wo.id, 'RELEASED')
    if (res.error) alert(res.error)
    else window.location.reload()
    setLoading(false)
  }

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="max-w-7xl mx-auto space-y-10">
      {/* Header */}
      <motion.div variants={item} className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Factory size={28} className="text-blue-600" />
            Nizam Manufacturing
          </h1>
          <p className="text-sm text-slate-500 font-medium">Pengelolaan Bill of Materials (BoM) dan Work Order (SPK) dengan Accurate Costing.</p>
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
              className="flex items-center gap-2 px-6 py-3 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all"
            >
              <Plus size={18} />
              Setup BoM Baru
            </button>
          ) : (
            <button
              onClick={() => setShowSpkModal(true)}
              className="flex items-center gap-2 px-6 py-3 text-sm font-bold text-white bg-emerald-500 rounded-xl hover:bg-emerald-600 shadow-lg shadow-emerald-200 transition-all"
            >
              <Zap size={18} />
              Terbitkan SPK
            </button>
          )}
        </div>
      </motion.div>

      <AnimatePresence mode="wait">
        {activeTab === 'SPK' ? (
          <motion.div key="spk" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-6">
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { label: 'SPK Aktif', value: workOrders.filter(w => w.status === 'RELEASED').length, icon: Play, color: 'text-blue-600 bg-blue-50' },
                  { label: 'Draft', value: workOrders.filter(w => w.status === 'DRAFT').length, icon: FileText, color: 'text-slate-600 bg-slate-50' },
                  { label: 'Selesai (Bulan ini)', value: workOrders.filter(w => w.status === 'COMPLETED').length, icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50' },
                  { label: 'Efisiensi Produksi', value: '94%', icon: TrendingUp, color: 'text-amber-600 bg-amber-50' },
                ].map((stat, i) => (
                  <div key={i} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
                     <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${stat.color}`}>
                        <stat.icon size={24} />
                     </div>
                     <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{stat.label}</p>
                        <p className="text-xl font-black text-slate-900">{stat.value}</p>
                     </div>
                  </div>
                ))}
             </div>

             <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
                <table className="w-full text-left">
                   <thead className="bg-slate-50 border-b border-slate-100">
                      <tr>
                         <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-widest">No. SPK & Produk</th>
                         <th className="px-6 py-5 text-xs font-black text-slate-400 uppercase tracking-widest text-right">Qty Rencana</th>
                         <th className="px-6 py-5 text-xs font-black text-slate-400 uppercase tracking-widest">Status</th>
                         <th className="px-6 py-5 text-xs font-black text-slate-400 uppercase tracking-widest">Tanggal</th>
                         <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-widest text-right">Aksi</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-50">
                      {workOrders.length === 0 ? (
                        <tr>
                           <td colSpan={5} className="px-8 py-20 text-center text-slate-400 font-bold italic">Belum ada perintah kerja yang aktif.</td>
                        </tr>
                      ) : (
                        workOrders.map((wo) => (
                          <tr key={wo.id} className="hover:bg-slate-50/50 transition">
                             <td className="px-8 py-5">
                                <p className="text-sm font-black text-slate-900">{wo.wo_number}</p>
                                <p className="text-xs text-slate-500">{wo.bom?.product?.name}</p>
                             </td>
                             <td className="px-6 py-5 text-right font-black text-slate-900">{wo.quantity_planned} Unit</td>
                             <td className="px-6 py-5">
                                <span className={`px-3 py-1 text-[10px] font-bold rounded-full uppercase tracking-tighter border ${
                                  wo.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                  wo.status === 'RELEASED' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                  'bg-slate-50 text-slate-400 border-slate-100'
                                }`}>
                                   {wo.status}
                                </span>
                             </td>
                             <td className="px-6 py-5 text-xs text-slate-500 font-medium">{formatDate(wo.created_at)}</td>
                             <td className="px-8 py-5 text-right flex justify-end gap-2">
                                 {wo.status === 'DRAFT' && (
                                   <button 
                                     disabled={loading}
                                     onClick={() => handleRelease(wo)} 
                                     className="px-4 py-2 bg-blue-600 text-white text-[10px] font-black uppercase rounded-lg disabled:opacity-50"
                                   >
                                     {loading ? 'Processing...' : 'Mulai Produksi'}
                                   </button>
                                 )}
                                {wo.status === 'RELEASED' && (
                                  <>
                                    <button 
                                      onClick={() => {
                                        setSelectedWo(wo)
                                        setShowFinishModal(true)
                                      }} 
                                      className="px-4 py-2 bg-emerald-600 text-white text-[10px] font-black uppercase rounded-lg shadow-lg shadow-emerald-100"
                                    >
                                      Selesaikan
                                    </button>
                                  </>
                                )}
                                <button
                                  onClick={async () => {
                                    if (confirm('Yakin ingin menghapus SPK ini?')) {
                                      const res = await deleteWorkOrder(orgId, wo.id)
                                      if (res.error) alert(res.error)
                                      else window.location.reload()
                                    }
                                  }}
                                  className="p-2 text-rose-300 hover:text-rose-600 transition-colors"
                                  title="Hapus SPK"
                                >
                                  <Trash2 size={16} />
                                </button>
                             </td>
                          </tr>
                        ))
                      )}
                   </tbody>
                </table>
             </div>
          </motion.div>
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
                           <span className="px-3 py-1 bg-blue-50 text-blue-600 text-[10px] font-black uppercase rounded-lg tracking-widest">{bom.code}</span>
                           <div className="flex flex-col items-end">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Est. HPP / Unit</span>
                              <span className="text-sm font-black text-rose-600">{formatRupiah(estimatedHppPerUnit)}</span>
                           </div>
                        </div>
                        <h3 className="text-xl font-bold text-slate-900">{bom.product?.name}</h3>
                        <p className="text-xs text-slate-400 font-medium leading-relaxed">{bom.description || 'Tidak ada deskripsi resep.'}</p>
                     </div>
                     
                     <div className="pt-6 border-t border-slate-50 space-y-3">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Komposisi Bahan</p>
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
                          onClick={() => {
                            setEditingBom(bom)
                            setBomItems(bom.items?.map((bi: any) => ({
                              productId: bi.product?.id,
                              quantity: bi.quantity,
                              unit: bi.unit || bi.product?.unit || 'Pcs'
                            })) || [])
                            setShowBomModal(true)
                          }}
                          className="text-[10px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-2 hover:gap-3 transition-all"
                        >
                           Edit Resep <ChevronRight size={14} />
                        </button>

                        <button 
                          onClick={async () => {
                            if (confirm('Yakin ingin menghapus resep (BoM) ini?')) {
                              setLoading(true)
                              const res = await deleteBom(orgId, bom.id)
                              if (res.error) alert(res.error)
                              else window.location.reload()
                              setLoading(false)
                            }
                          }}
                          className="flex items-center gap-2 px-3 py-1 text-[10px] font-black text-rose-400 hover:text-rose-600 transition-all uppercase tracking-widest"
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
                     <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">No SPK (Internal Number)</label>
                     <input name="wo_number" required placeholder="SPK-XXXXX" defaultValue={`SPK-${Date.now().toString().slice(-6)}`} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-blue-500 font-bold" />
                  </div>
                  <div className="space-y-2 text-left">
                     <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Pilih Resep Produksi (BoM)</label>
                     <select name="bom_id" required className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl outline-none focus:border-blue-500 font-bold">
                        <option value="">-- Pilih Produk Jadi --</option>
                        {boms.map(b => (
                           <option key={b.id} value={b.id}>{b.code} - {b.product?.name}</option>
                        ))}
                     </select>
                  </div>
                  <div className="space-y-2 text-left">
                     <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Jumlah Target Produksi</label>
                     <input name="quantity_planned" type="number" required placeholder="0" className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl outline-none focus:border-blue-500 font-bold text-xl" />
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
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Pilih Produk Jadi</label>
                        <select name="product_id" required defaultValue={editingBom?.product?.id} className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none">
                           <option value="">-- Pilih Produk --</option>
                           {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                     </div>
                     <div className="space-y-2 text-left">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Kode BoM</label>
                        <input name="code" required defaultValue={editingBom?.code} placeholder="BOM-PRD-01" className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" />
                     </div>
                  </div>
                  
                  <div className="p-6 bg-slate-50 rounded-2xl space-y-4">
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Komposisi Bahan Baku</p>
                     <div className="flex gap-2">
                        <select id="item-product" className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm" onChange={(e) => {
                           const p = products.find(prod => prod.id === e.target.value);
                           if (p && p.unit) {
                              (document.getElementById('item-unit') as HTMLSelectElement).value = p.unit;
                           }
                        }}>
                           <option value="">Pilih Bahan Baku...</option>
                           {products.map(p => <option key={p.id} value={p.id}>{p.name} {p.unit ? `(${p.unit})` : ''} — {formatRupiah(p.average_cost || p.purchase_price || 0)}</option>)}
                        </select>
                        <input id="item-qty" type="number" step="any" placeholder="Qty" className="w-20 px-3 py-3 bg-white border border-slate-200 rounded-xl text-sm" />
                        <select id="item-unit" className="w-24 px-2 py-3 bg-white border border-slate-200 rounded-xl text-[11px] font-bold text-blue-700">
                           {['Pcs', 'Unit', 'Kg', 'Gram', 'Liter', 'Ml', 'Box', 'Pack', 'Roll', 'Lembar', 'Set', 'Lusin', 'Meter', 'Cm', 'Pasang'].map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                        <button 
                          type="button" 
                          onClick={() => {
                             const pId = (document.getElementById('item-product') as HTMLSelectElement).value
                             const qty = Number((document.getElementById('item-qty') as HTMLInputElement).value)
                             const unit = (document.getElementById('item-unit') as HTMLSelectElement).value
                             if (!pId || !qty) return
                             // Auto-detect unit from product master
                             const selectedProduct = products.find(p => p.id === pId)
                             const finalUnit = selectedProduct?.unit || unit || 'Pcs'
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
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
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
                              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                           </select>
                        </div>
                        <div className="space-y-2">
                           <label className="text-[10px] font-bold text-slate-500 ml-1">Pilih Rak (Bin)</label>
                           <select name="bin_id" className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold">
                              <option value="">-- Standar --</option>
                              {availableBins.map(b => <option key={b.id} value={b.id}>{b.code}</option>)}
                           </select>
                        </div>
                     </div>
                  </div>

                  {/* Overhead Section & HPP Calculation */}
                  <div className="p-6 border border-slate-100 rounded-2xl space-y-4">
                     <div className="flex justify-between items-center">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
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
                         return sum + (item.quantity * selectedWo.quantity_planned * cost)
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
                             <span className="font-bold text-slate-800">Total HPP Produksi (Semua Unit):</span>
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
                               <span className="text-lg font-black text-emerald-600">{formatRupiah(suggestedPrice)}</span>
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
      </AnimatePresence>

    </motion.div>
  )
}
