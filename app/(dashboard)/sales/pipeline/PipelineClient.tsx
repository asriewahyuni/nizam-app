'use client'

import React, { useState, useEffect } from 'react'
import { Activity, PlayCircle, CircleDashed, CheckCircle2, TrendingUp, Maximize2, Minimize2, Plus, Phone, Mail, Bell, Edit2, Trash2, ChevronLeft, ChevronRight, LoaderCircle } from 'lucide-react'
import { PageHeader, SafeButton, useConfirm} from '@/components/ui/NizamUI'
import { formatRupiah } from '@/lib/utils'
import { updateSaleStatus, createQuickKanbanCard, deleteSalesCard, updateSalesCard } from '@/modules/sales/actions/sales.actions'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const PIPELINE_STAGES = [
  { id: 'QUOTATION', title: 'Penawaran', icon: CircleDashed, col: 'border-blue-200 bg-blue-50/30' },
  { id: 'DRAFT', title: 'Negosiasi (Draft)', icon: PlayCircle, col: 'border-amber-200 bg-amber-50/30' },
  { id: 'ORDERED', title: 'Surat Jalan (Proses)', icon: TrendingUp, col: 'border-emerald-200 bg-emerald-50/30' },
  { id: 'FINISHED', title: 'Closed Won (Selesai)', icon: CheckCircle2, col: 'border-indigo-200 bg-indigo-50/30' }
] as const

type PipelineStageId = (typeof PIPELINE_STAGES)[number]['id']

type PipelineContact = {
  name: string | null
  phone: string | null
  email: string | null
}

const EMPTY_CONTACT: PipelineContact = {
  name: null,
  phone: null,
  email: null,
}

type PipelineSale = {
  id: string
  sale_number: string | null
  sale_date: string | null
  grand_total: number
  notes: string | null
  status: PipelineStageId
  contacts: PipelineContact | null
}

type PipelineFormState = {
  id: string
  name: string
  phone: string
  email: string
  amount: number
  notes: string
  status: PipelineStageId
}

type PipelineClientProps = {
  orgId: string
  sales: PipelineSale[]
}

function getStageIndex(stageId: PipelineStageId) {
  return PIPELINE_STAGES.findIndex((stage) => stage.id === stageId)
}

export default function PipelineClient({ orgId, sales }: PipelineClientProps) {
  const router = useRouter()
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const { confirm, ConfirmUI } = useConfirm()
  const [isUpdating, setIsUpdating] = useState(false)
  const [movingSaleId, setMovingSaleId] = useState<string | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [localSales, setLocalSales] = useState<PipelineSale[]>(sales)
  
  // Toast State
  const [toast, setToast] = useState<{ message: string; type: 'info' | 'success' } | null>(null)
  
  const showToast = (message: string, type: 'info' | 'success' = 'info') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  // Realtime notification for new leads entering pipeline
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase.channel('realtime_sales_pipeline')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'sales', filter: `org_id=eq.${orgId}` },
        () => {
           showToast('Lead Baru / Penawaran masuk ke Pipeline!', 'success')
           // User must manually refresh to see it to avoid Next.js dev loops
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [orgId])

  useEffect(() => {
    setLocalSales(sales)
  }, [sales])

  // Add / Edit Card Form State
  const [formState, setFormState] = useState<PipelineFormState>({
    id: '',
    name: '',
    phone: '',
    email: '',
    amount: 0,
    notes: '',
    status: 'QUOTATION',
  })

  const handleDragStart = (id: string) => setDraggedId(id)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.currentTarget.classList.add('bg-black/5')
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.currentTarget.classList.remove('bg-black/5')
  }

  const moveSaleToStage = async (saleId: string, currentStatus: PipelineStageId, nextStatus: PipelineStageId) => {
    if (currentStatus === nextStatus) {
      setDraggedId(null)
      return
    }

    const targetStage = PIPELINE_STAGES.find((stage) => stage.id === nextStatus)

    setMovingSaleId(saleId)
    setLocalSales((currentSales) =>
      currentSales.map((sale) => (sale.id === saleId ? { ...sale, status: nextStatus } : sale))
    )

    try {
      const res = await updateSaleStatus(orgId, saleId, nextStatus)
      if (res?.error) {
        setLocalSales((currentSales) =>
          currentSales.map((sale) => (sale.id === saleId ? { ...sale, status: currentStatus } : sale))
        )
        showToast(res.error, 'info')
        return
      }

      showToast(
        targetStage ? `Card dipindah ke ${targetStage.title}` : 'Card berhasil dipindah',
        'success'
      )
      router.refresh()
    } finally {
      setMovingSaleId(null)
      setDraggedId(null)
    }
  }

  const handleDrop = async (stageId: PipelineStageId, e: React.DragEvent) => {
    e.preventDefault()
    e.currentTarget.classList.remove('bg-black/5')
    if (!draggedId) return

    const draggedItem = localSales.find((sale) => sale.id === draggedId)
    if (!draggedItem) {
      setDraggedId(null)
      return
    }

    await moveSaleToStage(draggedId, draggedItem.status, stageId)
  }

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsUpdating(true)
    let res;
    if (formState.id) {
      res = await updateSalesCard(orgId, formState.id, formState)
    } else {
      res = await createQuickKanbanCard(orgId, formState)
    }
    
    if (res?.error) showToast(res.error, 'info')
    else {
      setShowAddModal(false)
      showToast(formState.id ? 'Card berhasil diubah' : 'Card berhasil dibuat', 'success')
      setFormState({ id: '', name: '', phone: '', email: '', amount: 0, notes: '', status: 'QUOTATION' })
    }
    setIsUpdating(false)
  }

  const handleEditClick = (item: PipelineSale) => {
    setFormState({
      id: item.id,
      name: item.contacts?.name || '',
      phone: item.contacts?.phone || '',
      email: item.contacts?.email || '',
      amount: item.grand_total,
      notes: item.notes || '',
      status: item.status
    })
    setShowAddModal(true)
  }

  const handleDeleteCard = async (id: string) => {
    if (!await confirm('Hapus card ink permanen?')) return
    setIsUpdating(true)
    const res = await deleteSalesCard(orgId, id)
    if (res?.error) showToast(res.error, 'info')
    else showToast('Card dibuang', 'success')
    setIsUpdating(false)
  }

  return (
    <div className={`transition-all duration-300 flex flex-col ${isFullscreen ? 'fixed inset-0 z-50 bg-slate-50 p-6 overscroll-none' : 'max-w-7xl mx-auto pb-24 h-[calc(100vh-100px)] space-y-12'}`}>
      
      {!isFullscreen ? (
        <PageHeader
          icon={<Activity />}
          title="Sales Pipeline"
          subtitle="Papan KanBan progres calon pendapatan dari penawaran s/d barang dikirim lunas."
          tag="Revenue Engine"
          actions={
            <div className="flex gap-2">
              <SafeButton variant="white" icon={<Plus size={16} />} onClick={() => setShowAddModal(true)}>
                Tambah Card
              </SafeButton>
              <SafeButton variant="ghost" icon={<Maximize2 size={16} />} onClick={() => setIsFullscreen(true)}>
                Fullscreen
              </SafeButton>
            </div>
          }
        />
      ) : (
        <div className="flex items-center justify-between mb-6 pb-4 border-b">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Pipeline Fullscreen</h1>
            <p className="text-slate-500 text-sm font-medium">Kelola drag-and-drop prospek dengan lebih leluasa.</p>
          </div>
          <div className="flex gap-2">
            <SafeButton variant="primary" icon={<Plus size={16} />} onClick={() => setShowAddModal(true)}>
              Tambah Card
            </SafeButton>
            <SafeButton variant="ghost" icon={<Minimize2 size={16} />} onClick={() => setIsFullscreen(false)}>
              Tutup Fullscreen
            </SafeButton>
          </div>
        </div>
      )}

      <div className={`flex-1 grid grid-cols-4 gap-6 overflow-hidden ${isUpdating ? 'opacity-50 pointer-events-none' : ''}`}>
        {PIPELINE_STAGES.map(stage => {
           const items = localSales.filter((sale) => sale.status === stage.id)
           const totalValue = items.reduce((acc, item) => acc + item.grand_total, 0)
           const Icon = stage.icon

           return (
             <div 
               key={stage.id} 
               onDragOver={handleDragOver}
               onDragLeave={handleDragLeave}
               onDrop={(e) => handleDrop(stage.id, e)}
               className={`flex flex-col h-full rounded-[30px] border-2 ${stage.col} overflow-hidden transition-colors border-dashed`}
             >
                <div className="p-5 border-b border-black/5 flex justify-between items-center bg-white/50 backdrop-blur-sm">
                   <div className="flex items-center gap-2">
                     <Icon size={18} className="text-slate-500" />
                     <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-700">{stage.title}</h3>
                   </div>
                   <span className="text-[10px] font-semibold bg-white px-2 py-1 rounded-full shadow-sm">
                     {items.length}
                   </span>
                </div>
                
                <div className="px-5 py-3 border-b border-black/5 bg-white/30 flex items-center justify-between text-slate-600">
                   <span className="text-[10px] uppercase font-semibold tracking-wide">Total Value:</span>
                   <span className="text-sm font-semibold">{formatRupiah(totalValue)}</span>
                </div>

                <div className="flex-1 p-4 space-y-4 overflow-y-auto no-scrollbar">
                  {items.map((item) => {
                    const contacts: PipelineContact = item.contacts ?? EMPTY_CONTACT
                    const waPhone = contacts.phone ? contacts.phone.replace(/[^0-9]/g, '') : ''
                    const isSalesPage = String(item.notes || '').toLowerCase().includes('salespage')
                    const isMovingThisSale = movingSaleId === item.id
                    const currentStageIndex = getStageIndex(item.status)
                    const previousStage = currentStageIndex > 0 ? PIPELINE_STAGES[currentStageIndex - 1] : null
                    const nextStage =
                      currentStageIndex >= 0 && currentStageIndex < PIPELINE_STAGES.length - 1
                        ? PIPELINE_STAGES[currentStageIndex + 1]
                        : null
                    
                    return (
                      <motion.div 
                        key={item.id} 
                        draggable={!isUpdating && movingSaleId === null}
                        onDragStart={() => handleDragStart(item.id)}
                        layoutId={item.id}
                        className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 hover:shadow-md cursor-grab active:cursor-grabbing transition-all hover:-translate-y-1 group relative"
                      >
                        <div className="flex justify-between items-start mb-1.5">
                          <div className="text-[9px] font-semibold text-slate-400 uppercase tracking-wide group-hover:text-blue-500 transition-colors">
                            {item.sale_number || `DOC-${item.id.slice(0,5)}`}
                          </div>
                          <div className="flex items-center gap-1 group/actions">
                            {isSalesPage ? (
                              <span className="bg-amber-100 text-amber-700 text-[8px] px-2 py-0.5 rounded-full font-bold">Sales Page</span>
                            ) : (
                              <span className="bg-blue-100 text-blue-700 text-[8px] px-2 py-0.5 rounded-full font-bold">Quotation</span>
                            )}
                            <button type="button" onClick={() => handleEditClick(item)} className="p-1 text-slate-300 hover:text-blue-500 transition-colors opacity-0 group-hover:opacity-100">
                              <Edit2 size={12} />
                            </button>
                            <button type="button" onClick={() => handleDeleteCard(item.id)} className="p-1 text-slate-300 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                        
                        <div className="font-bold text-sm text-slate-800 leading-tight mb-3">
                          {contacts.name || 'Unknown Client'}
                        </div>
                                                    <div
                              className={`inline-flex items-center rounded-full border border-slate-200 bg-slate-50 transition-all ${
                                isMovingThisSale
                                  ? 'px-2 py-1 opacity-100'
                                  : 'p-1 opacity-0 translate-y-1 pointer-events-none group-hover:translate-y-0 group-hover:opacity-100 group-hover:pointer-events-auto'
                              }`}
                            >
                              {isMovingThisSale ? (
                                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-slate-600">
                                  <LoaderCircle size={11} className="animate-spin" />
                                  Memindahkan...
                                </span>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    draggable={false}
                                    disabled={!previousStage || isUpdating || movingSaleId !== null}
                                    onClick={() => previousStage && moveSaleToStage(item.id, item.status, previousStage.id)}
                                    title={previousStage ? `Pindah ke ${previousStage.title}` : 'Sudah di tahap pertama'}
                                    aria-label={previousStage ? `Pindah ke ${previousStage.title}` : 'Sudah di tahap pertama'}
                                    className="inline-flex h-6 w-6 items-center justify-center rounded-full text-slate-500 transition hover:bg-white hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-30"
                                  >
                                    <ChevronLeft size={12} />
                                  </button>
                                  <button
                                    type="button"
                                    draggable={false}
                                    disabled={!nextStage || isUpdating || movingSaleId !== null}
                                    onClick={() => nextStage && moveSaleToStage(item.id, item.status, nextStage.id)}
                                    title={nextStage ? `Pindah ke ${nextStage.title}` : 'Sudah di tahap terakhir'}
                                    aria-label={nextStage ? `Pindah ke ${nextStage.title}` : 'Sudah di tahap terakhir'}
                                    className="inline-flex h-6 w-6 items-center justify-center rounded-full text-slate-500 transition hover:bg-white hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-30"
                                  >
                                    <ChevronRight size={12} />
                                  </button>
                                </>
                              )}
                            </div>
                        {(contacts.phone || contacts.email) && (
                          <div className="flex gap-2 mb-3">
                            {contacts.phone && (
                              <a 
                                href={`https://wa.me/${waPhone}?text=Halo%20${encodeURIComponent(contacts.name || 'Pelanggan')}%2C%20saya%20menghubungi%20terkait%20penawaran%20kami...`} 
                                target="_blank" rel="noreferrer"
                                className="flex-1 inline-flex justify-center items-center gap-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 px-2 py-1.5 rounded-lg text-[10px] font-bold transition-colors"
                              >
                                <Phone size={12} /> WhatsApp
                              </a>
                            )}
                            {contacts.email && (
                              <a 
                                href={`mailto:${contacts.email}?subject=Follow%20Up%20Penawaran`} 
                                className="flex-1 inline-flex justify-center items-center gap-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 px-2 py-1.5 rounded-lg text-[10px] font-bold transition-colors"
                              >
                                <Mail size={12} /> Email
                              </a>
                            )}
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                          <span className="text-[10px] font-bold text-slate-400">{item.sale_date}</span>
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                               {formatRupiah(item.grand_total)}
                            </div>
                          </div>
                        </div>
                        
                      </motion.div>
                    )
                  })}
                  {items.length === 0 && (
                    <div className="h-40 flex items-center justify-center text-[10px] uppercase font-bold text-slate-400 italic">Drop di sini...</div>
                  )}
                </div>
             </div>
           )
        })}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowAddModal(false)} />
          <div className="relative w-full max-w-md bg-white rounded-xl shadow-md overflow-hidden">
            <div className="p-6 border-b">
              <h3 className="text-xl font-semibold text-slate-900">Tambah Card Cepat</h3>
            </div>
            <form onSubmit={handleAddSubmit} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500">Nama Pelanggan/Lead *</label>
                <input required type="text" className="w-full border rounded-xl px-4 py-2 mt-1 text-sm outline-none focus:border-blue-500" value={formState.name} onChange={e => setFormState({...formState, name: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500">Grup / Status</label>
                  <select className="w-full border rounded-xl px-4 py-2 mt-1 text-sm outline-none focus:border-blue-500 bg-white" value={formState.status} onChange={e => setFormState({...formState, status: e.target.value as PipelineStageId})}>
                    {PIPELINE_STAGES.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500">Nilai Prospek (Rp)</label>
                  <input type="number" className="w-full border rounded-xl px-4 py-2 mt-1 text-sm outline-none focus:border-blue-500" value={formState.amount} onChange={e => setFormState({...formState, amount: Number(e.target.value)})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500">Nomor WA</label>
                  <input type="text" placeholder="0812..." className="w-full border rounded-xl px-4 py-2 mt-1 text-sm outline-none focus:border-blue-500" value={formState.phone} onChange={e => setFormState({...formState, phone: e.target.value})} />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500">Email</label>
                  <input type="email" placeholder="nama@email.com" className="w-full border rounded-xl px-4 py-2 mt-1 text-sm outline-none focus:border-blue-500" value={formState.email} onChange={e => setFormState({...formState, email: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500">Catatan / Sumber</label>
                <input type="text" placeholder="Misal: Dari Web, IG, atau Salespage" className="w-full border rounded-xl px-4 py-2 mt-1 text-sm outline-none focus:border-blue-500" value={formState.notes} onChange={e => setFormState({...formState, notes: e.target.value})} />
              </div>
              
              <div className="pt-4 flex justify-end gap-2">
                <SafeButton variant="ghost" onClick={() => setShowAddModal(false)}>Batal</SafeButton>
                <SafeButton variant="primary" type="submit" isLoading={isUpdating}>Simpan Card</SafeButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ y: 50, opacity: 0 }} 
            animate={{ y: 0, opacity: 1 }} 
            exit={{ y: 50, opacity: 0 }}
            className={`fixed bottom-8 right-8 z-[200] px-6 py-4 rounded-xl shadow-md flex items-center gap-4 border ${
              toast.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-blue-50 border-blue-100 text-blue-800'
            }`}
          >
            {toast.type === 'success' ? <CheckCircle2 size={24} className="text-emerald-500 shrink-0" /> : <Bell size={24} className="text-blue-500 shrink-0" />}
            <p className="font-bold text-sm tracking-tight">{toast.message}</p>
          </motion.div>
        )}
      </AnimatePresence>
      {ConfirmUI}
    </div>
  )
}
