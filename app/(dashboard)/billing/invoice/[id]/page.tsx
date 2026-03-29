'use client'

import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Printer, Download, ArrowLeft, ShieldCheck, Mail, Phone, MapPin, Building2, CreditCard } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatRupiah } from '@/lib/utils'
import { useParams, useRouter } from 'next/navigation'

const db = createClient() as any

export default function InvoicePrintPage() {
  const params = useParams()
  const router = useRouter()
  const [invoice, setInvoice] = useState<any>(null)
  const [saasConfig, setSaasConfig] = useState<any>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      // 1. Fetch Invoice
      const { data: inv } = await db.from('saas_invoices')
        .select('*, organization:organizations(*)')
        .eq('id', params.id)
        .single()
      
      if (inv) setInvoice(inv)

      // 2. Fetch SaaS Global Config for Bank Info
      const { data: config } = await db.from('saas_config').select('*')
      if (config) {
        const mapped: any = {}
        config.forEach((c: any) => mapped[c.key] = c.value)
        setSaasConfig(mapped)
      }
      setLoading(false)
    }
    fetchData()
  }, [params.id])

  const handlePrint = () => {
    window.print()
  }

  if (loading) return <div className="p-12 text-center text-slate-400 font-bold animate-pulse">Memuat Invoice...</div>
  if (!invoice) return <div className="p-12 text-center text-rose-500 font-bold italic">Invoice Tidak Ditemukan.</div>

  const bank = saasConfig.bank_info || {}

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 print:bg-white print:py-0 print:px-0">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Actions Bar */}
        <div className="flex items-center justify-between print:hidden">
           <button onClick={() => router.back()} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-bold transition-all">
             <ArrowLeft size={18} /> Kembali
           </button>
           <div className="flex gap-3">
              <button onClick={handlePrint} className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-slate-800 transition-all">
                <Printer size={16} /> Print / PDF
              </button>
           </div>
        </div>

        {/* Invoice Area */}
        <div id="invoice-card" className="bg-white rounded-[48px] shadow-2xl border border-slate-100 overflow-hidden print:shadow-none print:border-none print:rounded-none">
           {/* Header / Brand */}
           <div className="bg-slate-900 px-12 py-10 flex items-start justify-between text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2" />
              <div className="relative z-10 space-y-4">
                 <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-2xl ring-4 ring-indigo-500/20">
                       <ShieldCheck className="text-slate-900" size={32} />
                    </div>
                    <h1 className="text-3xl font-black tracking-tighter uppercase italic">NIZAM <span className="text-indigo-400">ERP</span></h1>
                 </div>
                 <div className="space-y-1 opacity-70">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2">
                       <MapPin size={10} className="text-indigo-400" /> PT NIZAM TEKNOLOGI BERKAH
                    </p>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2">
                       <Mail size={10} className="text-indigo-400" /> billing@nizam.com
                    </p>
                 </div>
              </div>
              <div className="relative z-10 text-right space-y-2">
                 <h2 className="text-5xl font-black tracking-tighter uppercase mb-6 opacity-30">INVOICE</h2>
                 <p className="text-sm font-black text-indigo-400 font-mono tracking-widest">#{invoice.invoice_number}</p>
                 <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                    Tanggal: {new Date(invoice.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                 </p>
              </div>
           </div>

           {/* Client & Billing Info */}
           <div className="p-12 grid grid-cols-2 gap-12 border-b border-slate-100">
              <div className="space-y-4">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-2">Tagihan Untuk:</p>
                 <div className="space-y-2">
                    <h3 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter">{invoice.organization?.name}</h3>
                    <p className="text-xs font-bold text-slate-500 max-w-[280px]">
                       Organisasi Terdaftar di Platform NIZAM SaaS
                    </p>
                 </div>
              </div>
              <div className="space-y-4 text-right">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-2">Status Pembayaran:</p>
                 <div className="space-y-1">
                    <span className={`inline-block px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${invoice.status === 'PAID' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                       {invoice.status === 'PAID' ? 'LUNAS / VERIFIED' : 'MENUNGGU PEMBAYARAN'}
                    </span>
                    <p className="text-[9px] font-bold text-slate-400 mt-2">Batas Waktu: {new Date(invoice.due_date).toLocaleDateString()}</p>
                 </div>
              </div>
           </div>

           {/* Items Table */}
           <div className="px-12 py-8">
              <table className="w-full text-left">
                 <thead>
                    <tr className="border-b-2 border-slate-900">
                       <th className="py-4 text-[10px] font-black text-slate-900 uppercase tracking-[0.2em]">Deskripsi Item / Layanan</th>
                       <th className="py-4 text-right text-[10px] font-black text-slate-900 uppercase tracking-[0.2em] w-32">Qty</th>
                       <th className="py-4 text-right text-[10px] font-black text-slate-900 uppercase tracking-[0.2em] w-48">Total Harga</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100">
                    <tr>
                       <td className="py-6">
                          <div className="flex items-center gap-3">
                             <div className="p-2.5 bg-slate-900 text-white rounded-xl"><Building2 size={24} /></div>
                             <div className="space-y-0.5">
                                <p className="text-lg font-black text-slate-900 uppercase tracking-tight">{invoice.item_name || 'Paket NIZAM Enterprise'}</p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">SaaS Subscription - Cloud License</p>
                             </div>
                          </div>
                       </td>
                       <td className="py-6 text-right font-black text-slate-900">1</td>
                       <td className="py-6 text-right font-black text-2xl text-slate-900 font-mono italic tracking-tighter">
                          {formatRupiah(invoice.amount)}
                       </td>
                    </tr>
                 </tbody>
              </table>
           </div>

           {/* Totals & Bank Info */}
           <div className="p-12 bg-slate-50 flex flex-col md:flex-row items-end justify-between gap-12">
              <div className="w-full md:w-fit space-y-6">
                 <div className="space-y-3">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                       <CreditCard size={12} className="text-indigo-600" /> Metode Pembayaran (Transfer Bank)
                    </p>
                    <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm space-y-2 min-w-[300px]">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{bank.bank}</p>
                       <p className="text-2xl font-black text-slate-900 font-mono tracking-widest">{bank.account}</p>
                       <p className="text-xs font-bold text-slate-500 uppercase tracking-tight">a.n {bank.name}</p>
                    </div>
                 </div>
              </div>

              <div className="w-full md:w-64 space-y-4">
                 <div className="flex justify-between items-center px-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase italic">Subtotal</span>
                    <span className="text-sm font-bold text-slate-700">{formatRupiah(invoice.amount)}</span>
                 </div>
                 <div className="flex justify-between items-center px-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase italic">Tax/PPN (0%)</span>
                    <span className="text-sm font-bold text-slate-700">Rp 0</span>
                 </div>
                 <div className="pt-4 border-t-2 border-slate-900 flex justify-between items-center">
                    <span className="text-xs font-black text-slate-900 uppercase tracking-widest">Total Grand</span>
                    <span className="text-2xl font-black text-slate-900 font-mono italic">{formatRupiah(invoice.amount)}</span>
                 </div>
              </div>
           </div>

           {/* Footer Note */}
           <div className="p-12 pt-0 text-center">
              <p className="text-[10px] font-bold text-slate-400 leading-relaxed uppercase tracking-widest max-w-lg mx-auto italic">
                 Invoice ini diterbitkan secara otomatis oleh sistem NIZAM ERP dan sah tanpa tanda tangan basah. Simpan sebagai bukti transaksi resmi.
              </p>
           </div>
        </div>
      </div>
    </div>
  )
}
