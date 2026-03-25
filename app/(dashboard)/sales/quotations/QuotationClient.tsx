'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Search, FileText, Send, CheckCircle2, AlertCircle, Trash2, Printer, ArrowRight, Settings } from 'lucide-react'
import { PageHeader, StatCard, SectionCard, SectionHeader, StatusBadge, SafeButton } from '@/components/ui/NizamUI'
import { createQuotation, convertQuotationToOrder } from '@/modules/sales/actions/sales.actions'
import { formatRupiah } from '@/lib/utils'
import { CurrencyInput } from '@/components/ui/CurrencyInput'

const PROMOS = [
   { code: 'RAMADHAN24', type: 'PERCENT', value: 10, status: 'ACTIVE' },
   { code: 'NEWCUSTOMER', type: 'FIXED', value: 50000, status: 'ACTIVE' },
   { code: 'HARBOLSALE', type: 'PERCENT', value: 15, status: 'EXPIRED' }
]

export default function QuotationClient({ orgId, quotations, customers, products }: any) {
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Form State
  const [customerId, setCustomerId] = useState('')
  const [quoteDate, setQuoteDate] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')
  const [promoCode, setPromoCode] = useState('')
  const [appliedPromo, setAppliedPromo] = useState<any>(null)

  const handleApplyPromo = () => {
     const code = promoCode.toUpperCase().trim()
     if (!code) return
     const promo = PROMOS.find(p => p.code === code)
     if (!promo) return alert('Kode kupon tidak ditemukan!')
     if (promo.status !== 'ACTIVE') return alert('Maaf, kode kupon sudah kadaluarsa/tidak aktif!')
     setAppliedPromo(promo)
     setPromoCode('')
  }

  const [lines, setLines] = useState([{
    id: Date.now(),
    product_name: '',
    product_id: '',
    quantity: 1,
    unit_price: 0,
    discount_amount: 0
  }])

  const subtotal = lines.reduce((sum, line) => sum + (line.quantity * line.unit_price), 0)
  const totalLineDiscount = lines.reduce((sum, line) => sum + (line.quantity * (line.discount_amount || 0)), 0)
  const promoDiscount = appliedPromo ? Math.round(appliedPromo.type === 'PERCENT' ? subtotal * (appliedPromo.value / 100) : appliedPromo.value) : 0
  const grandTotal = subtotal - totalLineDiscount - promoDiscount

  const handleAddLine = () => {
    setLines([...lines, { id: Date.now(), product_name: '', product_id: '', quantity: 1, unit_price: 0, discount_amount: 0 }])
  }

  const handleLineChange = (id: number, field: string, value: any) => {
    setLines(lines.map(line => {
      if (line.id !== id) return line
      const updatedLine = { ...line, [field]: value }
      if (field === 'product_name') {
        const p = products.find((p: any) => p.name === value)
        if (p) {
          updatedLine.product_id = p.id
          updatedLine.unit_price = p.selling_price
        }
      }
      return updatedLine
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const finalNotes = appliedPromo ? `${notes}\n\n[MENGGUNAKAN VOUCHER: ${appliedPromo.code} - Diskon Ekstra ${formatRupiah(promoDiscount)}]` : notes
    const res = await createQuotation(orgId, {
      customer_id: customerId,
      sale_date: quoteDate,
      notes: finalNotes,
      discount_amount: promoDiscount,
      lines: lines.map(l => ({
        product_id: l.product_id || undefined,
        product_name: l.product_name,
        quantity: l.quantity,
        unit_price: l.unit_price,
        discount_amount: l.discount_amount
      }))
    })
    if (res?.error) {
      setError(res.error)
      setLoading(false)
    }
    else {
      setSuccess('Penawaran berhasil dibuat!')
      setShowModal(false)
      setTimeout(() => window.location.reload(), 1000)
    }
  }

  const handleConvert = async (id: string) => {
    if (!confirm('Ubah penawaran ini menjadi Pesanan Penjualan (Order) resmi?')) return
    setLoading(true)
    const res = await convertQuotationToOrder(orgId, id)
    if (res?.error) setError(res.error)
    else {
      setSuccess('Berhasil dikonversi menjadi Sales Order (DRAFT)!')
      setTimeout(() => setSuccess(null), 3500)
    }
    setLoading(false)
  }

  return (
    <div className="max-w-7xl mx-auto pb-24 space-y-12">
      <PageHeader
        icon={<FileText />}
        title="Penawaran Harga"
        subtitle="Buat penawaran resmi (Quotation) untuk calon pelanggan sebelum menjadi Penjualan."
        tag="Sales Pre-Order"
        actions={
          <SafeButton variant="primary" icon={<Plus size={18} />} onClick={() => setShowModal(true)}>
            Buat Penawaran Baru
          </SafeButton>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard label="Quotation Aktif" value={`${quotations.length} Dokumen`} icon={FileText} color="blue" />
        <StatCard label="Estimasi Revenue" value={formatRupiah(quotations.reduce((acc:any, q:any) => acc + q.grand_total, 0))} icon={Send} color="emerald" />
        <StatCard label="Pipeline Rate" value="100%" icon={ArrowRight} color="amber" sub="Sent to Client" />
      </div>

      <SectionCard>
        <SectionHeader title="Daftar Quotation" subtitle="Semua dokumen penawaran yang pernah dikirimkan." />
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">No. Ref</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Customer</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Total Penawaran</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {quotations.map((q: any) => (
                <tr key={q.id} className="hover:bg-slate-50">
                  <td className="px-8 py-6 text-xs font-black text-blue-600">{q.sale_number || `SQ-${q.id.slice(0,8)}`}</td>
                  <td className="px-8 py-6 font-bold">{q.contacts?.name}</td>
                  <td className="px-8 py-6 text-right font-black">{formatRupiah(q.grand_total)}</td>
                  <td className="px-8 py-6 text-center"><StatusBadge label="Pending Quotation" variant="warning" /></td>
                  <td className="px-8 py-6 text-right space-x-2">
                    <button onClick={() => handleConvert(q.id)} className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 hover:text-white transition-all">Terima & Jadi Order</button>
                    <button className="p-2.5 bg-slate-50 text-slate-400 rounded-xl hover:bg-blue-600 hover:text-white transition-all"><Printer size={16} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowModal(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-4xl bg-white rounded-3xl p-8 max-h-[90vh] overflow-y-auto shadow-2xl">
              <h3 className="text-xl font-bold mb-6">Buat Penawaran Harga Baru</h3>
              
              {error && (
                <div className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-600 text-sm font-bold">
                  <AlertCircle size={18} />
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-6 rounded-2xl">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Customer</label>
                    <select required value={customerId} onChange={e => setCustomerId(e.target.value)} className="w-full h-12 px-4 border rounded-xl text-sm font-bold outline-none focus:border-blue-600">
                      <option value="">Pilih Customer...</option>
                      {customers.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tanggal Penawaran</label>
                    <input type="date" value={quoteDate} onChange={e => setQuoteDate(e.target.value)} className="w-full h-12 px-4 border rounded-xl text-sm font-bold outline-none focus:border-blue-600" />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center mb-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Item Penawaran</label>
                     <button type="button" onClick={handleAddLine} className="text-[10px] font-black text-blue-600 hover:text-blue-800 transition-colors"> + TAMBAH BARIS</button>
                  </div>
                  
                  {/* Judul Kolom (Table Headers) */}
                  <div className="grid grid-cols-12 gap-2 px-1 text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                     <div className="col-span-4">Nama Produk / Jasa</div>
                     <div className="col-span-2">Kuantitas</div>
                     <div className="col-span-3">Harga Satuan</div>
                     <div className="col-span-2 text-rose-400">Potongan Harga</div>
                     <div className="col-span-1 text-center">Hapus</div>
                  </div>

                  {lines.map(line => (
                     <div key={line.id} className="grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-4"><input list="prod_list" placeholder="Pilih produk..." value={line.product_name} onChange={e => handleLineChange(line.id, 'product_name', e.target.value)} className="w-full h-12 px-4 border rounded-xl text-xs outline-none focus:border-blue-600" /></div>
                        <div className="col-span-2"><input type="number" value={line.quantity} onChange={e => handleLineChange(line.id, 'quantity', parseFloat(e.target.value))} className="w-full h-12 px-4 border rounded-xl text-xs outline-none focus:border-blue-600" /></div>
                        <div className="col-span-3"><CurrencyInput label="" value={line.unit_price} onChange={val => handleLineChange(line.id, 'unit_price', val)} className="!h-12" /></div>
                        <div className="col-span-2"><CurrencyInput label="" value={line.discount_amount} onChange={val => handleLineChange(line.id, 'discount_amount', val)} className="!h-12 !text-rose-500" /></div>
                        <div className="col-span-1"><button type="button" onClick={() => setLines(lines.filter(l => l.id !== line.id))} className="text-rose-500 p-2"><Trash2 size={16}/></button></div>
                     </div>
                  ))}
                  <datalist id="prod_list">{products.map((p: any) => <option key={p.id} value={p.name} />)}</datalist>
                </div>

                <div className="space-y-4">
                   <div className="flex justify-end">
                      {!appliedPromo ? (
                         <div className="flex gap-2 w-full md:max-w-xs">
                            <input 
                               placeholder="Kode Kupon/Voucher..." 
                               value={promoCode}
                               onChange={e => setPromoCode(e.target.value)}
                               style={{ textTransform: 'uppercase' }}
                               className="flex-1 h-10 px-4 border rounded-xl text-xs font-bold outline-none focus:border-blue-500 bg-white"
                            />
                            <button type="button" onClick={handleApplyPromo} className="px-4 h-10 bg-slate-900 text-white font-black text-[10px] tracking-widest uppercase rounded-xl hover:bg-slate-800 transition-colors">Terapkan</button>
                         </div>
                      ) : (
                         <div className="flex items-center justify-between w-full md:max-w-xs bg-emerald-50 border border-emerald-100 p-3 rounded-xl text-emerald-700 text-[10px] md:text-xs">
                            <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider">
                               🎟️ Kupon: <strong>{appliedPromo.code}</strong> (-{formatRupiah(promoDiscount)})
                            </span>
                            <button type="button" onClick={() => setAppliedPromo(null)} className="text-emerald-900 font-bold hover:text-rose-500 uppercase tracking-widest text-[9px] px-2 py-1 bg-white rounded-lg shadow-sm">Hapus</button>
                         </div>
                      )}
                   </div>
                   
                   <div className="bg-blue-50 p-6 rounded-2xl flex justify-between items-center shadow-inner border border-blue-100">
                      <div className="text-[10px] md:text-xs font-black text-blue-900 uppercase tracking-widest">Total Penawaran Estimasi</div>
                      <div className="text-xl md:text-3xl font-black text-blue-600 drop-shadow-sm">{formatRupiah(grandTotal)}</div>
                   </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <button type="button" onClick={() => setShowModal(false)} className="px-6 py-3 font-bold text-slate-400">Batalkan</button>
                  <SafeButton variant="primary" isLoading={loading} type="submit" className="!px-10">Simpan & Kirim Penawaran</SafeButton>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
