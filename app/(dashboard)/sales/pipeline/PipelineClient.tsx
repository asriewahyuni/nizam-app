'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Activity, PlayCircle, CircleDashed, CheckCircle2, TrendingUp, DollarSign, Maximize2, Minimize2, Plus, Phone, Mail, ExternalLink, Bell, Edit2, Trash2 } from 'lucide-react'
import { PageHeader, SafeButton } from '@/components/ui/NizamUI'
import { formatRupiah } from '@/lib/utils'
import { updateSaleStatus, createQuickKanbanCard, deleteSalesCard, updateSalesCard } from '@/modules/sales/actions/sales.actions'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'

const PIPELINE_STAGES = [
  { id: 'QUOTATION', title: 'Penawaran', icon: CircleDashed, col: 'border-blue-200 bg-blue-50/30' },
  { id: 'DRAFT', title: 'Negosiasi (Draft)', icon: PlayCircle, col: 'border-amber-200 bg-amber-50/30' },
  { id: 'ORDERED', title: 'Surat Jalan (Proses)', icon: TrendingUp, col: 'border-emerald-200 bg-emerald-50/30' },
  { id: 'FINISHED', title: 'Closed Won (Selesai)', icon: CheckCircle2, col: 'border-indigo-200 bg-indigo-50/30' }
]

export default function PipelineClient({ orgId, sales }: any) {
  const router = useRouter()
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  
  // Toast State
  const [toast, setToast] = useState<{ message: string; type: 'info' | 'success' } | null>(null)
  
  const showToast = useCallback((message: string, type: 'info' | 'success' = 'info') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }, [])

  const previousSalesCount = useRef(sales.length)

  useEffect(() => {
    if (sales.length > previousSalesCount.current) {
      showToast('Lead Baru / Penawaran masuk ke Pipeline!', 'success')
    }

    previousSalesCount.current = sales.length
  }, [sales.length, showToast])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      router.refresh()
    }, 30000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [router])

  // Add / Edit Card Form State
  const [formState, setFormState] = useState({ id: '', name: '', phone: '', email: '', amount: 0, notes: '', status: 'QUOTATION' })

  const handleDragStart = (id: string) => setDraggedId(id)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.currentTarget.classList.add('bg-black/5')
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.currentTarget.classList.remove('bg-black/5')
  }

  const handleDrop = async (stageId: string, e: React.DragEvent) => {
    e.preventDefault()
    e.currentTarget.classList.remove('bg-black/5')
    if (!draggedId) return

    const draggedItem = sales.find((s: any) => s.id === draggedId)
    if (draggedItem.status === stageId) return

    setIsUpdating(true)
    const res = await updateSaleStatus(orgId, draggedId, stageId)
    if (res?.error) showToast(res.error, 'info')
    setIsUpdating(false)
    setDraggedId(null)
  }

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsUpdating(true)
    let res: { error?: string } | undefined
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

  const handleEditClick = (item: any) => {
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
    if (!confirm('Hapus card ink permanen?')) return
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
            <h1 className="text-2xl font-black text-slate-900">Pipeline Fullscreen</h1>
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
           const items = sales.filter((s: any) => s.status === stage.id)
           const totalValue = items.reduce((acc: number, item: any) => acc + item.grand_total, 0)
           const Icon = stage.icon

           return (
             <div 
               key={stage.id} 
               role="listbox"
               aria-label={`Kolom pipeline ${stage.title}`}
               onDragOver={handleDragOver}
               onDragLeave={handleDragLeave}
               onDrop={(e) => handleDrop(stage.id, e)}
               className={`flex flex-col h-full rounded-[30px] border-2 ${stage.col} overflow-hidden transition-colors border-dashed`}
             >
                <div className="p-5 border-b border-black/5 flex justify-between items-center bg-white/50 backdrop-blur-sm">
                   <div className="flex items-center gap-2">
                     <Icon size={18} className="text-slate-500" />
                     <h3 className="text-xs font-black uppercase tracking-widest text-slate-700">{stage.title}</h3>
                   </div>
                   <span className="text-[10px] font-black bg-white px-2 py-1 rounded-full shadow-sm">
                     {items.length}
                   </span>
                </div>
                
                <div className="px-5 py-3 border-b border-black/5 bg-white/30 flex items-center justify-between text-slate-600">
                   <span className="text-[10px] uppercase font-black tracking-widest">Total Value:</span>
                   <span className="text-sm font-black">{formatRupiah(totalValue)}</span>
                </div>

                <div className="flex-1 p-4 space-y-4 overflow-y-auto no-scrollbar">
                  {items.map((item: any) => {
                    const contacts = item.contacts || {}
                    const waPhone = contacts.phone ? contacts.phone.replace(/[^0-9]/g, '') : ''
                    const isSalesPage = String(item.notes || '').toLowerCase().includes('salespage')
                    
                    return (
                      <motion.div 
                        key={item.id} 
                        draggable 
                        onDragStart={() => handleDragStart(item.id)}
                        layoutId={item.id}
                        className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md cursor-grab active:cursor-grabbing transition-all hover:-translate-y-1 group relative"
                      >
                        <div className="flex justify-between items-start mb-1.5">
                          <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest group-hover:text-blue-500 transition-colors">
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
                        
                        {(contacts.phone || contacts.email) && (
                          <div className="flex gap-2 mb-3">
                            {contacts.phone && (
                              <a 
                                href={`https://wa.me/${waPhone}?text=Halo%20${encodeURIComponent(contacts.name)}%2C%20saya%20menghubungi%20terkait%20penawaran%20kami...`} 
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
                          <div className="flex items-center gap-1 text-[11px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                            <DollarSign size={10} /> {new Intl.NumberFormat('id-ID').format(item.grand_total)}
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
          <button type="button" aria-label="Tutup modal" className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowAddModal(false)} />
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b">
              <h3 className="text-xl font-black text-slate-900">Tambah Card Cepat</h3>
            </div>
            <form onSubmit={handleAddSubmit} className="p-6 space-y-4">
              <div>
                <label htmlFor="pipeline-name" className="text-xs font-bold text-slate-500">Nama Pelanggan/Lead *</label>
                <input id="pipeline-name" required type="text" className="w-full border rounded-xl px-4 py-2 mt-1 text-sm outline-none focus:border-blue-500" value={formState.name} onChange={e => setFormState({...formState, name: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="pipeline-status" className="text-xs font-bold text-slate-500">Grup / Status</label>
                  <select id="pipeline-status" className="w-full border rounded-xl px-4 py-2 mt-1 text-sm outline-none focus:border-blue-500 bg-white" value={formState.status} onChange={e => setFormState({...formState, status: e.target.value})}>
                    {PIPELINE_STAGES.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="pipeline-amount" className="text-xs font-bold text-slate-500">Nilai Prospek (Rp)</label>
                  <input id="pipeline-amount" type="number" className="w-full border rounded-xl px-4 py-2 mt-1 text-sm outline-none focus:border-blue-500" value={formState.amount} onChange={e => setFormState({...formState, amount: Number(e.target.value)})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="pipeline-phone" className="text-xs font-bold text-slate-500">Nomor WA</label>
                  <input id="pipeline-phone" type="text" placeholder="0812..." className="w-full border rounded-xl px-4 py-2 mt-1 text-sm outline-none focus:border-blue-500" value={formState.phone} onChange={e => setFormState({...formState, phone: e.target.value})} />
                </div>
                <div>
                  <label htmlFor="pipeline-email" className="text-xs font-bold text-slate-500">Email</label>
                  <input id="pipeline-email" type="email" placeholder="nama@email.com" className="w-full border rounded-xl px-4 py-2 mt-1 text-sm outline-none focus:border-blue-500" value={formState.email} onChange={e => setFormState({...formState, email: e.target.value})} />
                </div>
              </div>
              <div>
                <label htmlFor="pipeline-notes" className="text-xs font-bold text-slate-500">Catatan / Sumber</label>
                <input id="pipeline-notes" type="text" placeholder="Misal: Dari Web, IG, atau Salespage" className="w-full border rounded-xl px-4 py-2 mt-1 text-sm outline-none focus:border-blue-500" value={formState.notes} onChange={e => setFormState({...formState, notes: e.target.value})} />
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
            className={`fixed bottom-8 right-8 z-[200] px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 border ${
              toast.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-blue-50 border-blue-100 text-blue-800'
            }`}
          >
            {toast.type === 'success' ? <CheckCircle2 size={24} className="text-emerald-500 shrink-0" /> : <Bell size={24} className="text-blue-500 shrink-0" />}
            <p className="font-bold text-sm tracking-tight">{toast.message}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
