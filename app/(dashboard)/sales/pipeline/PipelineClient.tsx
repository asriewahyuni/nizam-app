'use client'

import React, { useState } from 'react'
import { Activity, PlayCircle, CircleDashed, CheckCircle2, TrendingUp, DollarSign } from 'lucide-react'
import { PageHeader } from '@/components/ui/NizamUI'
import { formatRupiah } from '@/lib/utils'
import { updateSaleStatus } from '@/modules/sales/actions/sales.actions'
import { motion } from 'framer-motion'

const PIPELINE_STAGES = [
  { id: 'QUOTATION', title: 'Penawaran', icon: CircleDashed, col: 'border-blue-200 bg-blue-50/30' },
  { id: 'DRAFT', title: 'Negosiasi (Draft)', icon: PlayCircle, col: 'border-amber-200 bg-amber-50/30' },
  { id: 'ORDERED', title: 'Surat Jalan (Proses)', icon: TrendingUp, col: 'border-emerald-200 bg-emerald-50/30' },
  { id: 'FINISHED', title: 'Closed Won (Selesai)', icon: CheckCircle2, col: 'border-indigo-200 bg-indigo-50/30' }
]

export default function PipelineClient({ orgId, sales }: any) {
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)

  const handleDragStart = (id: string) => {
    setDraggedId(id)
  }

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

    // Don't update if same stage
    const draggedItem = sales.find((s: any) => s.id === draggedId)
    if (draggedItem.status === stageId) return

    setIsUpdating(true)
    const res = await updateSaleStatus(orgId, draggedId, stageId)
    if (res?.error) alert(res.error)
    setIsUpdating(false)
    setDraggedId(null)
  }

  return (
    <div className={`max-w-7xl mx-auto pb-24 space-y-12 h-[calc(100vh-100px)] flex flex-col transition-opacity ${isUpdating ? 'opacity-50 pointer-events-none' : ''}`}>
      <PageHeader
        icon={<Activity />}
        title="Sales Pipeline"
        subtitle="Papan KanBan progres calon pendapatan dari penawaran s/d barang dikirim lunas."
        tag="Revenue Engine"
      />

      <div className="flex-1 grid grid-cols-4 gap-6 overflow-hidden">
        {PIPELINE_STAGES.map(stage => {
           const items = sales.filter((s: any) => s.status === stage.id)
           const totalValue = items.reduce((acc: number, item: any) => acc + item.grand_total, 0)
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
                  {items.map((item: any) => (
                    <motion.div 
                      key={item.id} 
                      draggable 
                      onDragStart={() => handleDragStart(item.id)}
                      layoutId={item.id}
                      className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md cursor-grab active:cursor-grabbing transition-all hover:-translate-y-1 group"
                    >
                      <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 group-hover:text-blue-500 transition-colors">{item.sale_number || `DOC-${item.id.slice(0,5)}`}</div>
                      <div className="font-bold text-sm text-slate-800 leading-tight mb-3">{item.contacts?.name || 'Unknown Client'}</div>
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-50">
                        <span className="text-[10px] font-bold text-slate-400">{item.sale_date}</span>
                        <div className="flex items-center gap-1 text-[11px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                          <DollarSign size={10} /> {new Intl.NumberFormat('id-ID').format(item.grand_total)}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                  {items.length === 0 && (
                    <div className="h-40 flex items-center justify-center text-[10px] uppercase font-bold text-slate-400 italic">Drop di sini...</div>
                  )}
                </div>
             </div>
           )
        })}
      </div>
    </div>
  )
}
