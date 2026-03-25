'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
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
import { createAccount, getChartOfAccounts } from '@/modules/accounting/actions/coa.actions'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import type { Account, AccountType, NormalBalance } from '@/types/database.types'

const ACCOUNT_TYPES: { value: AccountType; label: string; normal: NormalBalance; color: string }[] = [
  { value: 'ASSET', label: 'Aset (Asset)', normal: 'DEBIT', color: '#1d4ed8' },
  { value: 'LIABILITY', label: 'Liabilitas (Liability)', normal: 'CREDIT', color: '#b45309' },
  { value: 'EQUITY', label: 'Ekuitas (Equity)', normal: 'CREDIT', color: '#6d28d9' },
  { value: 'REVENUE', label: 'Pendapatan (Revenue)', normal: 'CREDIT', color: '#065f46' },
  { value: 'EXPENSE', label: 'Beban (Expense)', normal: 'DEBIT', color: '#be185d' },
]

export default function NewAccountPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
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
    cash_flow_category: 'OPERATING'
  })

  useEffect(() => {
    async function init() {
      const data = await getActiveOrg()
      if (data) {
        setOrgId(data.org.id)
        const coa = await getChartOfAccounts(data.org.id)
        setAccounts(coa)
      }
    }
    init()
  }, [])

  const handleTypeChange = (type: AccountType) => {
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

    const fd = new FormData()
    fd.append('code', formData.code)
    fd.append('name', formData.name)
    fd.append('type', formData.type)
    fd.append('normal_balance', formData.normal_balance)
    if (formData.parent_id) fd.append('parent_id', formData.parent_id)
    if (formData.description) fd.append('description', formData.description)

    const res = await createAccount(orgId, fd)
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

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => router.back()}
            className="p-2.5 rounded-2xl bg-white border border-slate-200 text-slate-500 hover:text-slate-900 hover:border-slate-300 transition shadow-sm"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Tambah Akun Baru</h1>
            <p className="text-sm text-slate-500 font-medium">Buat Chart of Account baru untuk pelaporan keuangan.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Form */}
        <div className="lg:col-span-2">
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/50 overflow-hidden"
          >
            <form onSubmit={handleSubmit} className="p-8 space-y-8">
              {/* Basic Info Group */}
              <div className="space-y-6">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-50">
                  <Tag size={16} className="text-blue-600" />
                  <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Identitas Akun</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700 ml-1">Kode Akun *</label>
                    <input 
                      type="text"
                      required
                      placeholder="Cth: 6001.05"
                      value={formData.code}
                      onChange={e => setFormData(p => ({ ...p, code: e.target.value }))}
                      className="w-full px-5 py-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-sm font-semibold outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700 ml-1">Nama Akun *</label>
                    <input 
                      type="text"
                      required
                      placeholder="Cth: Biaya Lembur Lapangan"
                      value={formData.name}
                      onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                      className="w-full px-5 py-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-sm font-semibold outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700 ml-1">Tipe Akun</label>
                    <div className="relative">
                      <select 
                        value={formData.type}
                        onChange={e => handleTypeChange(e.target.value as AccountType)}
                        className="w-full px-5 py-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-sm font-bold text-slate-800 outline-none appearance-none focus:bg-white focus:border-blue-500 transition-all cursor-pointer"
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
                        className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${formData.normal_balance === 'DEBIT' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        DEBIT
                      </button>
                      <button 
                        type="button"
                        onClick={() => setFormData(p => ({ ...p, normal_balance: 'CREDIT' }))}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${formData.normal_balance === 'CREDIT' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        KREDIT
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Hierarchy Group */}
              <div className="space-y-6 pt-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-50">
                  <Layers size={16} className="text-blue-600" />
                  <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Hierarki & Struktur</h3>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 ml-1">Akun Induk (Parent Account)</label>
                  <div className="relative">
                    <select 
                      value={formData.parent_id}
                      onChange={e => setFormData(p => ({ ...p, parent_id: e.target.value }))}
                      className="w-full px-5 py-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-sm font-medium text-slate-800 outline-none appearance-none focus:bg-white focus:border-blue-500 transition-all cursor-pointer"
                    >
                      <option value="">-- Tidak Ada (Header Utama) --</option>
                      {accounts.map(acc => (
                        <option key={acc.id} value={acc.id}>[{acc.code}] {acc.name}</option>
                      ))}
                    </select>
                    <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                  <p className="text-[10px] text-slate-400 ml-1 italic">* Akun induk digunakan untuk pengelompokan laporan laba rugi / neraca.</p>
                </div>
              </div>

              {/* Extras */}
              <div className="space-y-2 pt-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-50">
                  <FileText size={16} className="text-blue-600" />
                  <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Keterangan Opsional</h3>
                </div>
                <textarea 
                  placeholder="Berikan catatan detail tentang fungsi akun ini..."
                  value={formData.description}
                  onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
                  className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-200 text-sm outline-none focus:bg-white focus:border-blue-500 transition-all h-32 resize-none"
                />
              </div>

              {/* Message Banner */}
              <AnimatePresence>
                {/* Status Message */}
                {(error || success) && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className={`p-4 rounded-2xl flex items-center gap-3 overflow-hidden ${error ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}
                  >
                    {error ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
                    <p className="text-sm font-bold">{error || 'Akun berhasil ditambahkan! Mengalihkan...'}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Submit */}
              <div className="pt-6">
                <button 
                  type="submit"
                  disabled={loading || success}
                  className="w-full py-4 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 shadow-xl shadow-blue-200 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  ) : (
                    <><Save size={20}/> Simpan Akun Baru</>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>

        {/* Sidebar Help */}
        <div className="space-y-6">
          <div className="bg-slate-900 rounded-3xl p-8 text-white relative overflow-hidden">
            <Activity className="absolute -right-4 -top-4 text-white/5" size={120} />
            <h4 className="text-lg font-bold mb-4 flex items-center gap-2">
               <Activity size={18} className="text-blue-400" />
               Prinsip Akuntansi
            </h4>
            <div className="space-y-4 text-xs leading-relaxed text-slate-300">
               <p>
                 <strong className="text-white">Normal Balance Debit:</strong> Biasanya digunakan untuk kelompok <span className="text-blue-400">Aset</span> dan <span className="text-blue-400">Beban</span>.
               </p>
               <p>
                 <strong className="text-white">Normal Balance Kredit:</strong> Biasanya digunakan untuk kelompok <span className="text-blue-400">Liabilitas</span>, <span className="text-blue-400">Ekuitas</span>, dan <span className="text-blue-400">Pendapatan</span>.
               </p>
               <div className="pt-4 border-t border-white/10 mt-4">
                  <p className="italic text-[10px] text-slate-400 font-medium">
                    Pastikan kode akun tidak beradu dengan sistem yang sudah ada agar integrasi HRIS berjalan lancar.
                  </p>
               </div>
            </div>
          </div>

          <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
             <h4 className="text-sm font-bold text-slate-900 mb-4">Tips Cepat</h4>
             <ul className="space-y-3">
               {[
                 'Gunakan sub-kode (cth: 6001.01) untuk rincian.',
                 'Mapping HRIS biasanya butuh akun 6xxx.',
                 'Akun sitem tidak bisa dihapus.',
                 'Parent account tidak boleh tipe yang berbeda.'
               ].map((tip, i) => (
                 <li key={i} className="flex items-start gap-2 text-[11px] text-slate-500 font-medium">
                   <div className="w-1 h-1 bg-blue-500 rounded-full mt-1.5 shrink-0" />
                   {tip}
                 </li>
               ))}
             </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
