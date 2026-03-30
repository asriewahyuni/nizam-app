'use client'

import { useState } from 'react'
import { 
  History, 
  Search, 
  Filter, 
  Calendar,
  Clock,
  ExternalLink,
  Table,
  Trash2,
  Building2,
  ShieldCheck,
  Activity,
  Zap,
  Eye,
  FileCode,
  AlertTriangle,
  X
} from 'lucide-react'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { resetOrganizationData } from '@/modules/settings/actions/audit.actions'
import { destroyOrganization } from '@/modules/organization/actions/org.actions'
import { motion, AnimatePresence } from 'framer-motion'

interface AuditLog {
  id: string
  created_at: string
  user_email: string
  user_name: string
  action: string
  table_name: string
  description: string
  old_data?: unknown
  new_data?: unknown
  record_id: string
}

function formatAuditJson(value: unknown) {
  const serialized = JSON.stringify(value, null, 2)
  return typeof serialized === 'string' ? serialized : ''
}

export function AuditClient({ logs, orgName, orgId }: { logs: AuditLog[], orgName: string, orgId: string }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('ALL')
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null)

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.user_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.user_email?.toLowerCase().includes(searchTerm.toLowerCase())
    
    if (filterType === 'ALL') return matchesSearch
    return matchesSearch && log.action === filterType
  })

  const getActionStyles = (action: string) => {
    switch(action) {
      case 'CREATE': return 'bg-emerald-50 text-emerald-700 border-emerald-100'
      case 'UPDATE': return 'bg-blue-50 text-blue-700 border-blue-100'
      case 'DELETE': return 'bg-rose-50 text-rose-700 border-rose-100'
      case 'VOID': return 'bg-slate-100 text-slate-700 border-slate-200'
      default: return 'bg-slate-50 text-slate-600 border-slate-100'
    }
  }

  return (
    <div className="space-y-6">
      {/* Executive Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <div className="p-3 bg-[#003366] text-white rounded-2xl shadow-lg shadow-blue-900/20">
              <ShieldCheck size={28} strokeWidth={2.5} />
            </div>
            DASHBOARD AUDIT SISTEM
          </h1>
          <p className="text-sm text-slate-500 font-medium ml-16 mt-1">
            Log Forensik Real-time & Metadata Transaksi <span className="text-blue-600 font-black uppercase">{orgName}</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
            <button 
              onClick={async () => {
                if (confirm('⚠️ PERHATIAN: Semua transaksi untuk organisasi ini akan dihapus permanen. Data master utama tetap dipertahankan.')) {
                   const check = prompt('Ketik "RESET TRANSAKSI" untuk konfirmasi:')
                   if (check === 'RESET TRANSAKSI') {
                      const res = await resetOrganizationData(orgId, { mode: 'transactions', confirmationText: check })
                      if (res.success) {
                         alert('Data telah dibersihkan. Memuat ulang sistem...')
                         window.location.reload()
                      } else {
                         alert('Gagal reset: ' + res.error)
                      }
                   }
                }
              }}
              className="px-6 py-4 bg-rose-50 hover:bg-rose-100 text-rose-600 font-black rounded-3xl transition-all flex items-center gap-2 border border-rose-200"
            >
              <Zap size={20} />
              RESET TRANSAKSI
            </button>

            <button 
              onClick={async () => {
                if (confirm('💣 NUCLEAR OPTION: Ini akan menghapus SELURUH ORGANISASI.\n\nLanjutkan?')) {
                   const check = prompt('Ketik "HAPUS" (huruf besar) untuk menghapus total organisasi:')
                   if (check === 'HAPUS') {
                      const res = await destroyOrganization(orgId)
                      if (res.success) {
                         alert('Organisasi telah dihapus. Mengarahkan ke Pendaftaran...')
                         window.location.href = '/onboarding'
                      } else {
                         alert('Gagal: ' + res.error)
                      }
                   }
                }
              }}
              className="px-6 py-4 bg-slate-900 hover:bg-black text-white font-black rounded-3xl transition-all shadow-xl active:scale-95 flex items-center gap-2"
            >
              <Building2 size={20} />
              WIPE ALL
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[#003366] rounded-3xl p-6 text-white shadow-xl shadow-blue-900/20 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-10 transform translate-x-4 -translate-y-4 group-hover:scale-110 transition-transform">
            <Activity size={100} />
          </div>
          <p className="text-[10px] font-black text-blue-300 uppercase tracking-widest mb-1">TOTAL AKTIVITAS</p>
          <h2 className="text-4xl font-black tracking-tighter mb-4">{logs.length}+</h2>
          <div className="inline-flex items-center gap-2 bg-white/10 px-3 py-1 rounded-full border border-white/20">
            <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
            <span className="text-[9px] font-black tracking-widest">LIVE CCTV ACTIVE</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
             <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl"><ShieldCheck size={20} /></div>
             <span className="text-[10px] font-black text-emerald-500 uppercase">ISO:27001 Compliant</span>
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-800 tracking-tight uppercase">Immutable Logs</h3>
            <p className="text-[11px] text-slate-500 mt-1 font-medium italic">Semua perubahan terekam dan tidak bisa dihapus oleh siapapun.</p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
             <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl"><Eye size={20} /></div>
             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Level 1 Awareness</span>
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-800 tracking-tight uppercase">Cyber Forensic Ready</h3>
            <p className="text-[11px] text-slate-500 mt-1 font-medium italic">Sistem memonitor perubahan JSON biner per transaksi.</p>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Feed */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-[32px] overflow-hidden flex flex-col shadow-sm h-[600px]">
          <div className="p-6 bg-slate-50/50 border-b border-slate-100 flex flex-col md:flex-row md:items-center gap-4">
             <div className="relative flex-1">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Cari aksi, tabel, atau user..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-2xl py-3 pl-12 pr-4 text-xs font-bold focus:ring-2 focus:ring-[#003366] focus:border-transparent outline-none shadow-sm"
                />
             </div>
             <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {['ALL', 'CREATE', 'UPDATE', 'DELETE', 'VOID'].map(t => (
                  <button key={t} onClick={() => setFilterType(t)} className={cn("px-3 py-2 rounded-xl text-[9px] font-black tracking-widest uppercase border transition-all shrink-0", filterType === t ? "bg-[#003366] text-white border-transparent" : "bg-white text-slate-400 border-slate-200")}>
                    {t}
                  </button>
                ))}
             </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {filteredLogs.map(log => (
              <div 
                key={log.id} 
                onClick={() => setSelectedLog(log)}
                className={cn(
                  "p-4 rounded-2xl border transition-all cursor-pointer group flex items-start gap-4 h-fit",
                  selectedLog?.id === log.id ? "bg-blue-50/50 border-blue-200 shadow-inner" : "bg-transparent border-slate-100 hover:border-blue-200"
                )}
              >
                <div className={cn("mt-1 w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors", selectedLog?.id === log.id ? "bg-blue-500 text-white" : "bg-slate-100 text-slate-400 group-hover:bg-blue-100 group-hover:text-blue-500")}>
                  <Clock size={16} />
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn("text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border", getActionStyles(log.action))}>{log.action}</span>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-1.5 py-0.5 rounded">{log.table_name}</span>
                    <span className="text-[9px] font-bold text-slate-400 ml-auto flex items-center gap-1"><Calendar size={10}/> {format(new Date(log.created_at), "dd MMM, HH:mm", { locale: id })}</span>
                  </div>
                  <p className="text-xs font-black text-slate-800 tracking-tight leading-relaxed">{log.description}</p>
                  <p className="text-[10px] font-bold text-blue-500">{log.user_name || log.user_email}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Forensic Details */}
        <AnimatePresence mode="wait">
          {selectedLog ? (
            <motion.div 
              key={selectedLog.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="lg:col-span-5 bg-slate-900 rounded-[32px] p-8 text-white h-[600px] flex flex-col shadow-2xl overflow-hidden border border-slate-800 relative"
            >
              <div className="flex items-center justify-between mb-8">
                 <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-blue-400 border border-white/10">
                       <FileCode size={24} />
                    </div>
                    <div>
                       <h3 className="text-lg font-black tracking-tight uppercase">Forensic Report</h3>
                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Metadata Breakdown</p>
                    </div>
                 </div>
                 <button onClick={() => setSelectedLog(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={20}/></button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-6 pr-2 custom-scrollbar-dark">
                 <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                       <div className="bg-white/5 p-4 rounded-2xl border border-white/5 shadow-inner">
                          <p className="text-[9px] font-black text-slate-500 uppercase mb-2">Operation ID</p>
                          <p className="text-[10px] font-mono font-bold text-blue-300 break-all">{selectedLog.id}</p>
                       </div>
                       <div className="bg-white/5 p-4 rounded-2xl border border-white/5 shadow-inner">
                          <p className="text-[9px] font-black text-slate-500 uppercase mb-2">Record Target</p>
                          <p className="text-[10px] font-mono font-bold text-blue-300 break-all">{selectedLog.record_id}</p>
                       </div>
                    </div>

                    <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                        <p className="text-[9px] font-black text-slate-500 uppercase mb-2">User Context</p>
                        <p className="text-xs font-black text-white">{String(selectedLog.user_name ?? '')}</p>
                        <p className="text-[10px] font-mono font-bold text-slate-400 mt-0.5">{String(selectedLog.user_email ?? '')}</p>
                    </div>

                    {selectedLog.old_data != null && (
                      <div className="space-y-2">
                        <p className="text-[10px] font-black text-rose-500 uppercase flex items-center gap-2"><AlertTriangle size={12}/> Original State (OLD)</p>
                        <pre className="text-[10px] font-mono p-4 bg-rose-950/50 rounded-2xl border border-rose-900/30 overflow-x-auto leading-relaxed shadow-inner max-h-48 text-rose-100">
                          {formatAuditJson(selectedLog.old_data)}
                        </pre>
                      </div>
                    )}

                    {selectedLog.new_data != null && (
                      <div className="space-y-2">
                        <p className="text-[10px] font-black text-emerald-500 uppercase flex items-center gap-2"><ShieldCheck size={12}/> Updated State (NEW)</p>
                        <pre className="text-[10px] font-mono p-4 bg-emerald-950/50 rounded-2xl border border-emerald-900/30 overflow-x-auto leading-relaxed shadow-inner max-h-48 text-emerald-100">
                          {formatAuditJson(selectedLog.new_data)}
                        </pre>
                      </div>
                    )}
                 </div>
              </div>

              <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between">
                 <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <History size={12}/> Full History Available
                 </span>
                 <button className="text-[10px] font-black text-blue-400 uppercase tracking-widest hover:text-blue-300 transition-all flex items-center gap-2 group">
                    View Associated Entry <ExternalLink size={12} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                 </button>
              </div>
            </motion.div>
          ) : (
            <div className="lg:col-span-5 hidden lg:flex flex-col items-center justify-center p-12 bg-slate-50 rounded-[32px] border border-dashed border-slate-300 text-slate-300 space-y-4">
               <div className="w-24 h-24 rounded-full border-4 border-slate-100 flex items-center justify-center animate-pulse">
                  <ShieldCheck size={48} strokeWidth={1} />
               </div>
               <div className="text-center">
                  <p className="font-black uppercase text-xs tracking-[0.2em]">Inspektor Forensik</p>
                  <p className="text-[11px] font-medium leading-relaxed max-w-[240px] mt-2">Pilih log aktivitas untuk membongkar detail payload JSON dari database.</p>
               </div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
