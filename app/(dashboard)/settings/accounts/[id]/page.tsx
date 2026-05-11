'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  ArrowLeft, 
  Save, 
  AlertCircle, 
  CheckCircle2, 
  Layers, 
  Tag, 
  FileText,
  Activity,
  ChevronDown
} from 'lucide-react'
import { updateAccount, getChartOfAccounts } from '@/modules/accounting/actions/coa.actions'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import type { Account, AccountType, NormalBalance } from '@/types/database.types'

const ACCOUNT_TYPES: { value: AccountType; label: string; normal: NormalBalance; color: string }[] = [
  { value: 'ASSET', label: 'Aset (Asset)', normal: 'DEBIT', color: '#1d4ed8' },
  { value: 'LIABILITY', label: 'Liabilitas (Liability)', normal: 'CREDIT', color: '#b45309' },
  { value: 'EQUITY', label: 'Ekuitas (Equity)', normal: 'CREDIT', color: '#6d28d9' },
  { value: 'REVENUE', label: 'Pendapatan (Revenue)', normal: 'CREDIT', color: '#065f46' },
  { value: 'EXPENSE', label: 'Beban (Expense)', normal: 'DEBIT', color: '#be185d' },
]

export default function EditAccountPage() {
  const router = useRouter()
  const params = useParams()
  const accountId = params.id as string

  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [orgId, setOrgId] = useState<string | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    type: 'EXPENSE' as AccountType,
    normal_balance: 'DEBIT' as NormalBalance,
    parent_id: '',
    description: '',
    is_active: true,
    is_system: false 
  })

  useEffect(() => {
    async function init() {
      const data = await getActiveOrg()
      if (data) {
        setOrgId(data.org.id)
        const coa = await getChartOfAccounts(data.org.id)
        setAccounts(coa)
        
        const acc = coa.find(a => a.id === accountId)
        if (acc) {
          setFormData({
            code: acc.code,
            name: acc.name,
            type: acc.type,
            normal_balance: acc.normal_balance,
            parent_id: acc.parent_id || '',
            description: acc.description || '',
            is_active: acc.is_active,
            is_system: acc.is_system
          })
        } else {
          setError('Akun tidak ditemukan.')
        }
      }
      setFetching(false)
    }
    init()
  }, [accountId])

  // Smart code auto-type logic (same as create page)
  useEffect(() => {
    if (formData.code.length > 0 && !formData.is_system) {
       const digit = formData.code[0]
       if (digit === '1') handleTypeSync('ASSET')
       else if (digit === '2') handleTypeSync('LIABILITY')
       else if (digit === '3') handleTypeSync('EQUITY')
       else if (digit === '4') handleTypeSync('REVENUE')
       else if (digit === '5' || digit === '6') handleTypeSync('EXPENSE')
    }
  }, [formData.code])

  const handleTypeSync = (type: AccountType) => {
    const config = ACCOUNT_TYPES.find(t => t.value === type)
    if (config && formData.type !== type) {
       setFormData(p => ({ ...p, type, normal_balance: config.normal }))
    }
  }

  const handleTypeManualChange = (type: AccountType) => {
    const config = ACCOUNT_TYPES.find(t => t.value === type)
    setFormData(prev => ({ 
      ...prev, 
      type, 
      normal_balance: config?.normal || 'DEBIT' 
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!orgId) return

    setLoading(true)
    setError(null)

    const res = await updateAccount(accountId, orgId, {
      code: formData.code,
      name: formData.name,
      type: formData.type,
      normal_balance: formData.normal_balance,
      parent_id: formData.parent_id || null,
      description: formData.description,
      is_active: formData.is_active,
    })
    
    setLoading(false)

    if (res.error) {
      setError(res.error)
    } else {
      setSuccess(true)
      setTimeout(() => {
        router.push('/settings/accounts')
        router.refresh()
      }, 1500)
    }
  }

  if (fetching) return (
    <div className="p-20 flex flex-col items-center justify-center gap-4">
      <Loader2 className="animate-spin text-blue-600" size={40} />
      <p className="text-slate-400 font-bold tracking-widest uppercase text-xs">Memuat Data Akun...</p>
    </div>
  )

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => router.back()}
            className="p-2.5 rounded-2xl bg-white border border-slate-200 text-slate-500 hover:text-slate-900 shadow-sm"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Edit Akun: {formData.code}</h1>
            <p className="text-sm text-slate-500 font-medium font-mono uppercase">Update Identitas & Hierarki Akun</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Form */}
        <div className="lg:col-span-2">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden">
            <form onSubmit={handleSubmit} className="p-8 space-y-8">
              
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                   <div className="flex items-center gap-2">
                      <Tag size={16} className="text-blue-600" />
                      <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-tight">Identitas Akun</h3>
                   </div>
                   {formData.is_system && (
                      <span className="px-3 py-1 bg-slate-900 text-white text-[10px] font-semibold rounded-full uppercase tracking-tight">AKUN SISTEM (TERKUNCI)</span>
                   )}
                </div>

                <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 ${formData.is_system ? 'opacity-50 pointer-events-none' : ''}`}>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700 ml-1">Kode Akun *</label>
                    <input 
                      type="text"
                      required
                      value={formData.code}
                      onChange={e => setFormData(p => ({ ...p, code: e.target.value }))}
                      className="w-full px-5 py-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-sm font-bold outline-none focus:bg-white focus:border-blue-500 transition-all font-mono"
                      readOnly={formData.is_system}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700 ml-1">Nama Akun *</label>
                    <input 
                      type="text"
                      required
                      value={formData.name}
                      onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                      className="w-full px-5 py-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-sm font-bold outline-none focus:bg-white focus:border-blue-500 transition-all"
                    />
                  </div>
                </div>

                <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 ${formData.is_system ? 'opacity-50 pointer-events-none' : ''}`}>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700 ml-1">Tipe Akun</label>
                    <div className="relative">
                      <select 
                        value={formData.type}
                        onChange={e => handleTypeManualChange(e.target.value as AccountType)}
                        className="w-full px-5 py-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-sm font-bold text-slate-800 outline-none appearance-none focus:bg-white focus:border-blue-500 transition-all cursor-pointer"
                        disabled={formData.is_system}
                      >
                        {ACCOUNT_TYPES.map(t => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                      <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700 ml-1">Saldo Normal</label>
                    <div className="flex p-1.5 bg-slate-100 rounded-2xl gap-1">
                      <button 
                        type="button"
                        onClick={() => setFormData(p => ({ ...p, normal_balance: 'DEBIT' }))}
                        disabled={formData.is_system}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${formData.normal_balance === 'DEBIT' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}
                      >
                        DEBIT
                      </button>
                      <button 
                        type="button"
                        onClick={() => setFormData(p => ({ ...p, normal_balance: 'CREDIT' }))}
                        disabled={formData.is_system}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${formData.normal_balance === 'CREDIT' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}
                      >
                        KREDIT
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-6 pt-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-50">
                  <Layers size={16} className="text-blue-600" />
                  <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-tight">Hierarki & Struktur</h3>
                </div>

                <div className={`space-y-2 ${formData.is_system ? 'opacity-50 pointer-events-none' : ''}`}>
                  <label className="text-xs font-bold text-slate-700 ml-1">Akun Induk (Parent Account)</label>
                  <div className="relative">
                    <select 
                      value={formData.parent_id}
                      onChange={e => setFormData(p => ({ ...p, parent_id: e.target.value }))}
                      className="w-full px-5 py-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-sm font-medium text-slate-800 outline-none appearance-none focus:bg-white focus:border-blue-500 transition-all cursor-pointer"
                      disabled={formData.is_system}
                    >
                      <option value="">-- Tidak Ada (Header Utama) --</option>
                      {accounts.filter(a => a.id !== accountId).map(acc => (
                        <option key={acc.id} value={acc.id}>[{acc.code}] {acc.name}</option>
                      ))}
                    </select>
                    <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              <div className="space-y-6 pt-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-50">
                  <FileText size={16} className="text-blue-600" />
                  <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-tight">Detail & Status</h3>
                </div>
                <textarea 
                  value={formData.description}
                  onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
                  className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-200 text-sm outline-none focus:bg-white focus:border-blue-500 transition-all h-32 resize-none"
                  placeholder="Keterangan fungsi akun..."
                />
                <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl">
                   <input type="checkbox" id="is_active" checked={formData.is_active} onChange={e => setFormData(p => ({ ...p, is_active: e.target.checked }))} className="w-4 h-4 text-blue-600" />
                   <label htmlFor="is_active" className="text-xs font-bold text-slate-700">Akun ini Aktif (Bisa dipilih di transaksi)</label>
                </div>
              </div>

              <AnimatePresence>
                {(error || success) && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className={`p-4 rounded-2xl flex items-center gap-3 overflow-hidden ${error ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
                    {error ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
                    <p className="text-sm font-bold">{error || 'Perubahan berhasil disimpan!'}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="pt-6">
                <button type="submit" disabled={loading || success} className="w-full py-4 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-700 shadow-xl transition disabled:opacity-50">
                   {loading ? 'Menyimpan...' : 'Simpan Perubahan Akun'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
           <div className="bg-slate-900 rounded-3xl p-8 text-white relative overflow-hidden">
             <Activity className="absolute -right-4 -top-4 text-white/5" size={120} />
             <h4 className="text-lg font-bold mb-4 flex items-center gap-2"><Activity size={18} className="text-blue-400" /> Integrasi Keuangan</h4>
             <p className="text-xs text-slate-300 leading-relaxed font-medium">
               Mengubah **Kode** atau **Tipe** akun yang sudah memiliki transaksi jurnal sangat berisiko. Pastikan Anda melakukan rekonsiliasi ulang jika terjadi perubahan saldo yang tidak sinkron.
             </p>
           </div>
        </div>
      </div>
    </div>
  )
}

function Loader2({size, className}: {size: number, className: string}) {
   return <div className={`border-2 border-slate-200 border-t-blue-600 rounded-full animate-spin`} style={{width: size, height: size}} />
}
