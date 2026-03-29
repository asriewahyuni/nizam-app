'use client'

import { useState } from 'react'
import { 
  History, 
  Search, 
  Filter, 
  Calendar,
  AlertCircle,
  Clock,
  ExternalLink,
  Table,
} from 'lucide-react'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import { cn } from '@/lib/utils'

interface AuditLog {
  id: string
  created_at: string
  user_email: string
  user_name: string
  action: string
  table_name: string
  description: string
  record_id?: string | null
  old_data?: any
  new_data?: any
}

export function AuditTrailClient({ initialLogs }: { initialLogs: AuditLog[] }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('ALL')

  const filteredLogs = initialLogs.filter(log => {
    const matchesSearch = 
      log.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.user_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.user_email?.toLowerCase().includes(searchTerm.toLowerCase())
    
    if (filterType === 'ALL') return matchesSearch
    return matchesSearch && log.action === filterType
  })

  // Table action badge colors
  const getActionStyles = (action: string) => {
    switch(action) {
      case 'CREATE': return 'bg-emerald-50 text-emerald-700 border-emerald-100'
      case 'UPDATE': return 'bg-amber-50 text-amber-700 border-amber-100'
      case 'DELETE': return 'bg-rose-50 text-rose-700 border-rose-100'
      case 'VOID': return 'bg-slate-100 text-slate-700 border-slate-200'
      default: return 'bg-slate-50 text-slate-600 border-slate-100'
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden flex flex-col h-[600px]">
      {/* Search & Filters */}
      <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Cari aksi, tabel, atau user..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-2xl py-3 pl-12 pr-4 text-sm font-medium focus:ring-2 focus:ring-[#003366] focus:border-transparent transition-all outline-none shadow-sm"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
          {['ALL', 'CREATE', 'UPDATE', 'DELETE', 'VOID'].map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={cn(
                "px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all border shrink-0",
                filterType === type 
                  ? "bg-[#003366] text-white border-transparent shadow-lg shadow-blue-900/20 scale-105" 
                  : "bg-white text-slate-400 border-slate-200 hover:border-slate-300 hover:text-slate-600"
              )}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Feed Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4">
        {filteredLogs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-300 space-y-4">
            <History size={64} strokeWidth={1} className="opacity-20 translate-y-4 animate-pulse" />
            <p className="font-bold tracking-tight uppercase text-xs italic">Belum ada rekaman audit yang sesuai...</p>
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div 
              key={log.id} 
              className="group relative flex items-start gap-4 p-4 rounded-2xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/20 transition-all shadow-sm hover:shadow-md h-fit"
            >
              {/* Timeline dot */}
              <div className="hidden md:flex flex-col items-center gap-1 shrink-0 pt-1">
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                  <Clock size={20} />
                </div>
                <div className="w-px h-full bg-slate-50 group-last:hidden" />
              </div>

              {/* Log Content */}
              <div className="flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn(
                    "px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border",
                    getActionStyles(log.action)
                  )}>
                    {log.action}
                  </span>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                    <Table size={10} />
                    {log.table_name}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 ml-auto flex items-center gap-1 group-hover:text-blue-500 transition-colors">
                    <Calendar size={10} />
                    {format(new Date(log.created_at), "dd MMM yyyy, HH:mm", { locale: id })}
                  </span>
                </div>

                <p className="text-sm font-black text-slate-800 tracking-tight leading-relaxed py-1">
                  {log.description}
                </p>

                <div className="flex items-center gap-4 text-[11px] font-medium text-slate-500">
                  <div className="flex items-center gap-1.5 p-1 px-2 bg-slate-50 rounded-lg group-hover:bg-white transition-colors border border-transparent group-hover:border-slate-100">
                    <div className="w-4 h-4 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[8px] font-bold uppercase">
                      {log.user_name?.[0] || 'U'}
                    </div>
                    {log.user_name || log.user_email}
                  </div>
                  <div className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-lg">
                    <Clock size={12} className="text-slate-300" />
                    ID: {log.record_id?.slice(0, 8) || 'N/A'}...
                  </div>
                  <button className="flex items-center gap-1 text-blue-600 font-bold hover:underline ml-auto">
                    Detil Data <ExternalLink size={12} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
           Sistem Monitoring NIZAM Terenkripsi & Immutable
        </p>
      </div>
    </div>
  )
}
