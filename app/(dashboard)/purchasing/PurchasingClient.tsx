'use client'

import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Plus, 
  Search, 
  Truck, 
  CheckCircle2, 
  AlertCircle, 
  Trash2, 
  CheckSquare, 
  XCircle, 
  CreditCard, 
  RotateCcw, 
  ArrowRight,
  TrendingUp,
  Clock,
  Wallet,
  FileText,
  Printer,
  X
} from 'lucide-react'
import { PageHeader, StatCard, SectionCard, SectionHeader, StatusBadge, SafeButton } from '@/components/ui/NizamUI'
import { createPurchaseEntry, receivePurchase, voidPurchase, createPurchasePayment, createPurchaseReturn } from '@/modules/purchasing/actions/purchasing.actions'
import { createContact } from '@/modules/contacts/actions/contact.actions'
import type { Product } from '@/types/database.types'

import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { CurrencyInput } from '@/components/ui/CurrencyInput'
import { formatRupiah, formatDate } from '@/lib/utils'
import { QRCodeSVG } from 'qrcode.react'
import { getApprovalForSource } from '@/modules/organization/actions/approval.actions'
import { updatePurchaseRequestStatus } from '@/modules/purchasing/actions/purchasing.actions'

export default function PurchasingClient({ orgId, orgName, org, purchases, vendors, products, coa, purchaseRequests = [] }: any) {
   const [activeTab, setActiveTab] = useState<'PURCHASES' | 'REQUESTS'>('PURCHASES')
   const orgSettings = org?.settings || {}
   const logoUrl = org?.logo_url || ''
  const [showModal, setShowModal] = useState(false)
  const [showContactModal, setShowContactModal] = useState(false)
   const [loading, setLoading] = useState(false)
   const searchParams = useSearchParams()
   const payId = searchParams.get('pay')

   useEffect(() => {
     if (payId && purchases.length > 0) {
       const purchase = purchases.find((p: any) => p.id === payId)
       if (purchase) {
         handleOpenPayment(purchase)
       }
     }
   }, [payId, purchases])
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // PO Detail Modal State
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedDetailPurchase, setSelectedDetailPurchase] = useState<any>(null)
  const [approvalData, setApprovalData] = useState<any>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  // PO Form State
  const [vendorId, setVendorId] = useState('')
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')
  const [paymentTerm, setPaymentTerm] = useState<'TEMPO' | 'LUNAS'>('TEMPO')
  const [paymentAccountId, setPaymentAccountId] = useState('')
  const [dueDate, setDueDate] = useState('')

  const [customGlobalDiscount, setCustomGlobalDiscount] = useState<number | null>(null)
  const [headerTaxPercent, setHeaderTaxPercent] = useState(0)
  const [shippingAmount, setShippingAmount] = useState('0')
  const [insuranceAmount, setInsuranceAmount] = useState('0')
  const [payOverheadNow, setPayOverheadNow] = useState(false)
  const [overheadAccountId, setOverheadAccountId] = useState('')
  const [shariahMode, setShariahMode] = useState<'CASH' | 'SALAM' | 'ISTISHNA'>('CASH')
  
  // Payment Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [selectedPurchase, setSelectedPurchase] = useState<any>(null)
  const [debtAmount, setDebtAmount] = useState(0) // Full remaining debt
  const [paymentAmount, setPaymentAmount] = useState(0) // Cash paid
  const [paymentDiscount, setPaymentDiscount] = useState(0) // Discount
  const [payAccountId, setPayAccountId] = useState('')
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0])
  const [payNotes, setPayNotes] = useState('')

  // Return Modal State
  const [showReturnModal, setShowReturnModal] = useState(false)
  const [returnItems, setReturnItems] = useState<any[]>([])
  const [returnNumber, setReturnNumber] = useState('')
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split('T')[0])
  const [returnNotes, setReturnNotes] = useState('')
  const UNIT_OPTIONS = ['Pcs', 'Unit', 'Kg', 'Gram', 'Liter', 'Ml', 'Box', 'Pack', 'Roll', 'Lembar', 'Set', 'Lusin', 'Meter', 'Cm', 'Pasang', 'Rim', 'Karton', 'Botol', 'Galon', 'Lainnya']
  const [lines, setLines] = useState([{
    id: Date.now(),
    product_name: '',
    product_id: '',
    quantity: 1,
    unit: 'Pcs',
    custom_unit: '',
    unit_price: 0,
    margin: 20, 
    discount_amount: 0,
    category: 'Bahan',
    selling_price: 0,
    requestId: ''
  }])

  // Filter COA for payment accounts (Kas/Bank) if Lunas
  const paymentAccounts = coa?.filter((a: any) => a.type === 'ASSET' && (a.code.startsWith('11') || a.code.startsWith('12')))
    .map((a: any) => ({
      ...a,
      id: a.account_id || a.id // account_id from view, id from table
    })) || []

  const grossSubTotal = lines.reduce((sum, line) => sum + (line.quantity * line.unit_price), 0)
  const autoLineDiscounts = lines.reduce((sum, line) => sum + ((line.discount_amount || 0) * line.quantity), 0)
  
  const appliedDiscount = customGlobalDiscount !== null ? customGlobalDiscount : autoLineDiscounts
  const taxableAmount = Math.max(0, grossSubTotal - appliedDiscount)
  const calculatedTax = (taxableAmount * headerTaxPercent) / 100
  const grandTotal = taxableAmount + calculatedTax + (parseFloat(shippingAmount) || 0) + (parseFloat(insuranceAmount) || 0)

  const handleAddLine = () => {
    setLines([...lines, {
      id: Date.now(),
      product_name: '',
      product_id: '',
      quantity: 1,
      unit: 'Pcs',
      custom_unit: '',
      unit_price: 0,
      margin: 20,
      discount_amount: 0,
      category: 'Bahan',
      selling_price: 0,
      requestId: ''
    }])
  }

  const handleRemoveLine = (id: number) => {
    if (lines.length === 1) return
    setLines(lines.filter(l => l.id !== id))
  }

  const handleLineChange = (id: number, field: string, value: any) => {
    setLines(lines.map(line => {
      if (line.id !== id) return line
      const updatedLine = { ...line, [field]: value }

      if (field === 'product_name') {
        const foundProduct = products.find((p: Product) => p.name.toLowerCase() === String(value).toLowerCase())
        if (foundProduct) {
          updatedLine.product_id = foundProduct.id
          // Auto-fill unit from master product
          if (foundProduct.unit) {
            const matchedUnit = UNIT_OPTIONS.find(u => u.toLowerCase() === foundProduct.unit.toLowerCase())
            if (matchedUnit) {
              updatedLine.unit = matchedUnit
              updatedLine.custom_unit = ''
            } else {
              updatedLine.unit = 'Lainnya'
              updatedLine.custom_unit = foundProduct.unit
            }
          }
          if (updatedLine.unit_price === 0) {
            updatedLine.unit_price = foundProduct.purchase_price || 0
            updatedLine.category = foundProduct.category || 'Bahan'
            updatedLine.selling_price = foundProduct.selling_price || 0
            if (updatedLine.unit_price > 0 && foundProduct.selling_price) {
              const currentMargin = 100 - ((updatedLine.unit_price / foundProduct.selling_price) * 100)
              updatedLine.margin = Math.round(currentMargin)
            }
          }
        } else {
          updatedLine.product_id = '' 
        }
      }
      return updatedLine
    }))
  }

  const calculateSuggestedSellingPrice = (hpp: number, margin: number) => {
    if (margin >= 100) return 0 
    return hpp / (1 - (margin / 100))
  }

  const handleCreatePurchase = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!vendorId) return setError('Vendor harus dipilih!')
    if (paymentTerm === 'LUNAS' && !paymentAccountId) return setError('Pilih akun pembayaran untuk transaksi Lunas!')
    if (paymentTerm === 'TEMPO' && payOverheadNow && !overheadAccountId) return setError('Silakan pilih rekening Kas/Bank untuk membayar Ongkir/Asuransi yang dibayar terpisah secara tunai.')
    
    if (lines.some(l => !l.product_name || l.quantity <= 0 || l.unit_price < 0)) {
      return setError('Lengkapi detail barang, kuantitas, dan HPP untuk setiap baris.')
    }

    setLoading(true)
    
    // Inject overhead account into notes if separated
    const finalNotes = (paymentTerm === 'TEMPO' && payOverheadNow && overheadAccountId) 
      ? (notes ? notes + '\n' : '') + `[OVERHEAD_ACC: ${overheadAccountId}]` 
      : notes

    const payload = {
      vendor_id: vendorId,
      purchase_date: purchaseDate,
      due_date: paymentTerm === 'TEMPO' ? dueDate : undefined,
      notes: finalNotes,
      payment_term: paymentTerm,
      payment_account_id: paymentAccountId,
      discount_amount: appliedDiscount,
      tax_amount: calculatedTax,
      shipping_amount: parseFloat(shippingAmount) || 0,
      insurance_amount: parseFloat(insuranceAmount) || 0,
      shariah_mode: shariahMode,
      lines: lines.map(line => {
        const totalOverhead = (parseFloat(shippingAmount) || 0) + (parseFloat(insuranceAmount) || 0)
        const itemValue = (line.quantity * line.unit_price) - (line.discount_amount || 0)
        const allocatedOverheadPerUnit = grossSubTotal > 0 ? (itemValue / grossSubTotal * totalOverhead) / (line.quantity || 1) : 0
        const trueHpp = line.unit_price + allocatedOverheadPerUnit
        const effectiveUnit = line.unit === 'Lainnya' ? line.custom_unit : line.unit
        
        return {
          product_id: line.product_id || undefined,
          product_name: line.product_name,
          category: line.category,
          quantity: line.quantity,
          unit: effectiveUnit || 'Pcs',
          unit_price: line.unit_price,
          selling_price: calculateSuggestedSellingPrice(trueHpp, line.margin)
        }
      })
    }

    const res = await createPurchaseEntry(orgId, payload)

    if (res?.error) setError(res.error)
    else {
      setSuccess('PO Baru berhasil disimpan!')
      setShowModal(false)
      // Reset form
      setLines([{ id: Date.now(), product_name: '', product_id: '', quantity: 1, unit: 'Pcs', custom_unit: '', unit_price: 0, margin: 20, discount_amount: 0, category: 'Bahan', selling_price: 0, requestId: '' }])
      setVendorId('')
      setNotes('')
      setPaymentAccountId('')
      setPaymentTerm('TEMPO')
      setDueDate('')
      setCustomGlobalDiscount(null)
      setHeaderTaxPercent(0)
      setShippingAmount('0')
      setInsuranceAmount('0')
      setShariahMode('CASH')
      
      // Update linked purchase requests to ORDERED
      for (const line of lines) {
        if ((line as any).requestId) {
          await updatePurchaseRequestStatus(orgId, (line as any).requestId, 'ORDERED')
        }
      }

      setTimeout(() => setSuccess(null), 3500)
    }
    setLoading(false)
  }

  const handleCreateVendor = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    const formData = new FormData(e.currentTarget)
    formData.set('type', 'SUPPLIER')
    const res = await createContact(orgId, formData)
    if (res?.error) setError(res.error)
    else {
      setSuccess('Vendor baru berhasil ditambahkan.')
      setShowContactModal(false)
      setTimeout(() => setSuccess(null), 3500)
    }
    setLoading(false)
  }

  const handleReceivePO = async (id: string) => {
    if (!confirm('Tandai bahwa barang sudah diterima (Status -> RECEIVED)?')) return
    setLoading(true)
    const res = await receivePurchase(orgId, id)
    if (res?.error) setError(res.error)
    else {
      setSuccess('Status PO berhasil diubah menjadi RECEIVED!')
      setTimeout(() => setSuccess(null), 3500)
    }
    setLoading(false)
  }

  const handleVoidPO = async (id: string) => {
    if (!confirm('Anda yakin ingin membatalkan PO yang sedang berstatus ORDERED ini?')) return
    setLoading(true)
    const res = await voidPurchase(orgId, id)
    if (res?.error) setError(res.error)
    else {
      setSuccess('PO berhasil dibatalkan (VOIDED).')
      setTimeout(() => setSuccess(null), 3500)
    }
    setLoading(false)
  }

  const handleOpenPayment = (p: any) => {
    const paid = (p.purchase_payments || []).reduce((sum: number, pay: any) => sum + (Number(pay.amount) + Number(pay.discount_amount)), 0)
    const returned = (p.purchase_returns || []).reduce((sum: number, ret: any) => sum + Number(ret.total_amount), 0)
    const remaining = p.grand_total - paid - returned
    
    setSelectedPurchase(p)
    setDebtAmount(remaining)
    setPaymentAmount(remaining)
    setPaymentDiscount(0)
    setPayNotes(`Pelunasan ${p.purchase_number}`)
    setShowPaymentModal(true)
  }

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!payAccountId) return setError('Pilih akun pengeluaran!')
    setLoading(true)
    const res = await createPurchasePayment(orgId, {
      purchase_id: selectedPurchase.id,
      account_id: payAccountId,
      amount: paymentAmount,
      discount: paymentDiscount,
      payment_date: payDate,
      notes: payNotes
    })
    if (res?.error) setError(res.error)
    else {
      setSuccess('Pembayaran berhasil dicatat!')
      setShowPaymentModal(false)
      setTimeout(() => setSuccess(null), 3000)
    }
    setLoading(false)
  }

  const handleOpenReturn = (p: any) => {
    setSelectedPurchase(p)
    setDebtAmount(p.grand_total) 
    setReturnNumber(`RET-${p.purchase_number.split('-').slice(1).join('-')}`)
    setReturnItems(p.purchase_items.map((it: any) => ({
      ...it,
      return_qty: 0
    })))
    setShowReturnModal(true)
  }

  const handleSubmitReturn = async (e: React.FormEvent) => {
    e.preventDefault()
    const activeItems = returnItems.filter(it => it.return_qty > 0)
    if (activeItems.length === 0) return setError('Masukkan jumlah barang yang diretur!')
    
    setLoading(true)
    const res = await createPurchaseReturn(orgId, {
      purchase_id: selectedPurchase.id,
      return_number: returnNumber,
      return_date: returnDate,
      notes: returnNotes,
      items: activeItems.map(it => ({
        product_id: it.product_id,
        quantity: it.return_qty,
        unit_price: it.unit_price,
        purchase_item_id: it.id
      }))
    })
    if (res?.error) setError(res.error)
    else {
      setSuccess('Retur pembelian berhasil dicatat!')
      setShowReturnModal(false)
      setTimeout(() => setSuccess(null), 3000)
    }
    setLoading(false)
  }

  const handleOpenDetail = async (p: any) => {
    setSelectedDetailPurchase(p)
    setApprovalData(null)
    setLoadingDetail(true)
    setShowDetailModal(true)
    
    // Fetch approval history
    try {
      const res = await getApprovalForSource(orgId, p.id, 'PURCHASE_ORDER')
      if (res) {
         setApprovalData(res)
      }
    } catch (e) {
      console.error(e)
    }
    setLoadingDetail(false)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(amount)
  }

  const stats = {
    totalMonth: purchases.filter((p: any) => p.status !== 'VOIDED' && p.purchase_date.startsWith(new Date().toISOString().slice(0, 7))).reduce((sum: number, p: any) => sum + p.grand_total, 0),
    totalDebt: purchases.filter((p: any) => p.status === 'RECEIVED' && p.payment_status !== 'PAID').reduce((sum: number, p: any) => {
      const paid = (p.purchase_payments || []).reduce((s: number, pay: any) => s + (Number(pay.amount) + Number(pay.discount_amount)), 0)
      const returned = (p.purchase_returns || []).reduce((s: number, ret: any) => s + Number(ret.total_amount), 0)
      return sum + (p.grand_total - paid - returned)
    }, 0),
    pendingOrders: purchases.filter((p: any) => p.status === 'ORDERED' || p.status === 'DRAFT').length,
    vendorCount: vendors.length
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-7xl mx-auto space-y-12 pb-24">
      <PageHeader 
        icon={<Truck />}
        title="Purchasing"
        subtitle="Manage inventory procurement, vendor relations, and landing costs."
        tag="Logistics Module"
        actions={
          <>
            <SafeButton 
              variant="white"
              icon={<Truck size={16} />}
              onClick={() => setShowContactModal(true)}
            >
              Vendor Baru
            </SafeButton>
            <SafeButton 
              variant="danger"
              icon={<Plus size={18} />}
              onClick={() => setShowModal(true)}
            >
              Buat PO (Belanja)
            </SafeButton>
          </>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          label="Total Belanja (Bln Ini)" 
          value={formatRupiah(stats.totalMonth)} 
          icon={TrendingUp}
          color="indigo"
          sub="Akumulasi seluruh PO aktif bulan ini"
        />
        <StatCard 
          label="Sisa Hutang Usaha" 
          value={formatRupiah(stats.totalDebt)} 
          icon={Wallet}
          color="rose"
          alert={stats.totalDebt > 0}
          sub="Tagihan RECEIVED belum lunas"
        />
        <StatCard 
          label="Pesanan Aktif (PO)" 
          value={`${stats.pendingOrders} PO`} 
          icon={Clock}
          color="amber"
          sub="Barang dalam proses pengiriman"
        />
        <StatCard 
          label="Partner Suplier" 
          value={`${stats.vendorCount} Vendor`} 
          icon={Truck}
          color="blue"
          sub="Vendor terdaftar di database"
        />
      </div>

      <div className="flex bg-slate-100/50 p-1.5 rounded-2xl w-fit border border-slate-100">
         <button
            onClick={() => setActiveTab('PURCHASES')}
            className={`px-8 py-2.5 text-xs font-black rounded-xl transition-all uppercase tracking-widest ${activeTab === 'PURCHASES' ? 'bg-white text-rose-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
         >
            Purchase Orders
         </button>
         <button
            onClick={() => setActiveTab('REQUESTS')}
            className={`px-8 py-2.5 text-xs font-black rounded-xl transition-all uppercase tracking-widest flex items-center gap-2 ${activeTab === 'REQUESTS' ? 'bg-white text-rose-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
         >
            Permintaan Produksi
            {purchaseRequests.filter((r: any) => r.status === 'PENDING').length > 0 && (
              <span className="w-5 h-5 bg-rose-500 text-white text-[10px] flex items-center justify-center rounded-full animate-pulse">
                {purchaseRequests.filter((r: any) => r.status === 'PENDING').length}
              </span>
            )}
         </button>
      </div>

      {activeTab === 'PURCHASES' ? (
        <SectionCard>
        <SectionHeader 
          title="Histori Pembelian (Purchase Orders)"
          subtitle="Daftar seluruh transaksi belanja barang dan jasa."
          actions={
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input placeholder="Cari nomor PO atau vendor..." className="pl-9 pr-4 py-2 text-[10px] font-bold border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-100 transition-all outline-none w-64" />
            </div>
          }
        />
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">No PO</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Keterangan Transaksi</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Nilai Faktur</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Status</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Aksi Cepat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {purchases.length === 0 ? (
                <tr><td colSpan={5} className="py-24 text-center text-slate-400 font-bold text-xs uppercase italic">Belum ada data pembelian.</td></tr>
              ) : (
                purchases.map((p: any) => (
                  <tr key={p.id} className="group hover:bg-slate-50 transition-colors">
                    <td className="px-8 py-6">
                       <div className="text-xs font-black text-rose-600 tracking-tighter">{p.purchase_number}</div>
                       <div className="text-[10px] font-bold text-slate-400 mt-1">{p.purchase_date}</div>
                    </td>
                    <td className="px-8 py-6">
                       <div className="text-sm font-bold text-slate-900">{p.contacts?.name || 'Unknown Vendor'}</div>
                       <div className="flex gap-2 mt-1.5 overflow-hidden max-w-[300px]">
                          <span className="shrink-0 text-[10px] font-black px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded-md border border-slate-200 uppercase tracking-tighter">
                            {p.purchase_items?.length || 0} SKU
                          </span>
                          <span className="text-[10px] text-slate-400 truncate font-medium">
                            {p.purchase_items?.[0]?.description}{p.purchase_items?.length > 1 ? ` & ${p.purchase_items.length - 1} lainnya` : ''}
                          </span>
                       </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                       <div className="text-sm font-black text-slate-900 font-mono tracking-tighter">{formatRupiah(p.grand_total)}</div>
                       <div className={`text-[9px] font-black uppercase tracking-widest mt-1 ${p.payment_status === 'PAID' ? 'text-emerald-500' : 'text-amber-500'}`}>
                         {p.payment_status === 'PAID' ? 'Lunas' : 'Belum Lunas'}
                       </div>
                    </td>
                    <td className="px-8 py-6 text-center">
                       <StatusBadge 
                         label={p.status} 
                         variant={p.status === 'RECEIVED' ? 'success' : p.status === 'VOIDED' ? 'error' : 'warning'} 
                       />
                    </td>
                     <td className="px-8 py-6">
                       <div className="flex flex-wrap items-center justify-end gap-2">
                         <button onClick={() => handleOpenDetail(p)} className="p-2.5 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-500 hover:text-white transition-all border border-blue-100" title="Detail Dokumen PO">
                           <FileText size={16}/>
                         </button>
                         
                         {(p.status === 'DRAFT' || p.status === 'ORDERED') && (
                           <button onClick={() => handleReceivePO(p.id)} className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-500 hover:text-white transition-all shadow-sm border border-emerald-100 group/btn" title="Terima Barang">
                             <CheckSquare size={16}/>
                           </button>
                         )}
                         
                         {(p.status === 'DRAFT' || p.status === 'ORDERED' || (p.status === 'RECEIVED' && p.payment_status === 'UNPAID')) && (
                           <button onClick={() => handleVoidPO(p.id)} className="p-2.5 bg-slate-50 text-slate-400 rounded-xl hover:bg-rose-500 hover:text-white transition-all border border-slate-100" title="Batalkan PO">
                             <XCircle size={16}/>
                           </button>
                         )}

                         {p.status === 'RECEIVED' && p.payment_status !== 'PAID' && (
                           <button onClick={() => handleOpenPayment(p)} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100">
                             <CreditCard size={14}/> Bayar
                           </button>
                         )}

                         {p.status === 'RECEIVED' && (
                           <button onClick={() => handleOpenReturn(p)} className="p-2.5 bg-amber-50 text-amber-600 rounded-xl hover:bg-amber-500 hover:text-white transition-all border border-amber-100" title="Retur Barang">
                             <RotateCcw size={16}/>
                           </button>
                         )}
                       </div>
                     </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
      ) : (
        <SectionCard>
          <SectionHeader 
            title="Permintaan Pembelian (Unit Produksi)"
            subtitle="Daftar material yang dibutuhkan oleh bagian produksi/pabrik."
          />
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">No. Request</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Barang & Jumlah</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Sumber / Notes</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Status</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {purchaseRequests.length === 0 ? (
                  <tr><td colSpan={5} className="py-24 text-center text-slate-400 font-bold text-xs uppercase italic">Belum ada permintaan dari produksi.</td></tr>
                ) : (
                  purchaseRequests.map((r: any) => (
                    <tr key={r.id} className="group hover:bg-slate-50 transition-colors">
                      <td className="px-8 py-6">
                        <div className="text-xs font-black text-slate-900">{r.request_number}</div>
                        <div className="text-[10px] font-bold text-slate-400 mt-1">{formatDate(r.created_at)}</div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="text-sm font-bold text-slate-900">{r.product_name}</div>
                        <div className="text-[10px] font-black text-blue-600 uppercase tracking-widest mt-1">Butuh: {r.quantity} {r.unit}</div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="text-[10px] font-black text-rose-500 uppercase">{r.source_type}</div>
                        <div className="text-[10px] text-slate-500 italic mt-1">{r.notes || '-'}</div>
                      </td>
                      <td className="px-8 py-6 text-center">
                        <StatusBadge 
                          label={r.status} 
                          variant={r.status === 'ORDERED' ? 'success' : r.status === 'REJECTED' ? 'error' : r.status === 'PENDING' ? 'warning' : 'info'} 
                        />
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="flex justify-end gap-2">
                          {r.status === 'PENDING' && (
                            <>
                              <button 
                                onClick={() => {
                                  // Pre-fill PO form logic could be added here
                                  setLines([{
                                    id: Date.now(),
                                    product_name: r.product_name,
                                    product_id: r.product_id || '',
                                    quantity: r.quantity,
                                    unit: r.unit || 'Pcs',
                                    custom_unit: '',
                                    unit_price: 0,
                                    margin: 20,
                                    discount_amount: 0,
                                    category: 'Bahan',
                                    selling_price: 0,
                                    requestId: r.id
                                  }])
                                  setShowModal(true)
                                }}
                                className="px-3 py-1.5 bg-rose-600 text-white text-[10px] font-black uppercase rounded-lg shadow-sm"
                              >
                                Proses ke PO
                              </button>
                              <button 
                                onClick={async () => {
                                  if (confirm('Tolak permintaan ini?')) {
                                    await updatePurchaseRequestStatus(orgId, r.id, 'REJECTED')
                                  }
                                }}
                                className="px-3 py-1.5 bg-slate-100 text-slate-400 text-[10px] font-black uppercase rounded-lg hover:bg-rose-50 hover:text-rose-600 transition-all"
                              >
                                Tolak
                              </button>
                            </>
                          )}
                          {r.status === 'ORDERED' && (
                            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest italic">Sudah di-PO</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      <AnimatePresence>
        {/* MODAL BUAT PO BARU (DENGAN LINE ITEMS) */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowModal(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
             <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl p-8 overflow-hidden max-h-[90vh] overflow-y-auto">
                <div className="absolute top-0 left-0 w-2 h-full bg-rose-500" />
                <h3 className="text-xl font-bold mb-6">Buat Purchase Order (PO) & Update Master Barang</h3>
                
                <form onSubmit={handleCreatePurchase} className="space-y-6">
                  {/* HEADER PO */}
                  {/* HEADER PO & PAYMENT GUARDRAIL */}
                  <div className={`grid grid-cols-1 ${paymentTerm === 'TEMPO' ? 'md:grid-cols-5' : 'md:grid-cols-4'} gap-4 p-5 bg-slate-50 rounded-[28px] border border-slate-100 shadow-inner transition-all`}>
                    <div className="flex-1 space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block px-1">Mode Transaksi</label>
                      <select value={shariahMode} onChange={(e) => setShariahMode(e.target.value as any)} className="w-full h-[52px] px-4 py-2.5 border border-slate-200 rounded-2xl outline-none text-sm bg-white font-black text-indigo-600 shadow-sm focus:border-indigo-500 transition-all">
                         <option value="CASH">PEMBELIAN LANGSUNG (CASH)</option>
                         <option value="SALAM">PEMBELIAN SALAM (BAYAR DEPAN)</option>
                         <option value="ISTISHNA">PEMBELIAN ISTISHNA (PESANAN/DP)</option>
                      </select>
                      {shariahMode === 'SALAM' && <p className="text-[9px] font-bold text-indigo-500 italic mt-1 leading-tight px-1">* Barang diterima menyusul, pembayaran harus lunas di awal (Syariah).</p>}
                      {shariahMode === 'ISTISHNA' && <p className="text-[9px] font-bold text-indigo-500 italic mt-1 leading-tight px-1">* Barang proses manufaktur/pesanan, pembayaran boleh bertahap (Syariah).</p>}
                    </div>

                    <div className={`${paymentTerm === 'TEMPO' ? 'md:col-span-1' : 'md:col-span-2'} space-y-2`}>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block px-1">Vendor / Supplier</label>
                      <select required value={vendorId} onChange={(e) => setVendorId(e.target.value)} className="w-full h-[52px] px-4 py-2.5 border border-slate-200 rounded-2xl outline-none text-sm bg-white font-black text-slate-900 shadow-sm focus:border-rose-500 transition-all">
                         <option value="">Pilih Vendor / Supplier...</option>
                         {vendors.map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}
                      </select>
                    </div>

                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block px-1">Metode Pembayaran</label>
                       <div className="flex p-1 bg-white border border-slate-200 rounded-2xl h-[52px]">
                          <button 
                             type="button" 
                             onClick={() => setPaymentTerm('TEMPO')}
                             className={`flex-1 rounded-xl text-[10px] font-black transition-all ${paymentTerm === 'TEMPO' ? 'bg-amber-500 text-white shadow-md' : 'text-slate-400'}`}
                          >
                             TEMPO
                          </button>
                          <button 
                             type="button" 
                             onClick={() => setPaymentTerm('LUNAS')}
                             className={`flex-1 rounded-xl text-[10px] font-black transition-all ${paymentTerm === 'LUNAS' ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-400'}`}
                          >
                             LUNAS
                          </button>
                       </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block px-1">Tanggal Belanja</label>
                      <input type="date" required value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} className="w-full h-[52px] px-4 py-2.5 border border-slate-200 rounded-2xl outline-none text-sm bg-white font-bold text-slate-900 shadow-sm focus:border-rose-500 transition-all" />
                    </div>

                    {paymentTerm === 'TEMPO' && (
                      <div className="space-y-2 animate-in slide-in-from-right-2">
                        <label className="text-[10px] font-black text-amber-600 uppercase tracking-widest block px-1">Jatuh Tempo</label>
                        <input type="date" required={paymentTerm === 'TEMPO'} value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full h-[52px] px-4 py-2.5 border border-amber-200 rounded-2xl outline-none text-sm bg-white font-bold text-amber-600 shadow-sm focus:border-amber-500 transition-all" />
                      </div>
                    )}

                    {paymentTerm === 'LUNAS' && (
                      <div className="md:col-span-4 mt-2 p-4 bg-emerald-50 rounded-2xl border border-emerald-100 animate-in slide-in-from-top-2 duration-300">
                         <SearchableSelect 
                            label="Rekening Pembayaran (Cash/Bank)"
                            options={paymentAccounts}
                            value={paymentAccountId}
                            onChange={(val) => setPaymentAccountId(val)}
                            placeholder="Pilih rekening untuk pelunasan langsung..."
                         />
                         <p className="text-[9px] font-bold text-emerald-600 mt-2 italic px-1">
                               💡 Jurnal: (D) Persediaan vs (C) {paymentAccountId ? coa.find((a:any) => a.id === paymentAccountId)?.name : 'Kas/Bank'}. Tanpa melalui Hutang Usaha.
                         </p>
                      </div>
                    )}
                  </div>

                  {/* LINE ITEMS */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Detail Barang (Items)</label>
                      <button type="button" onClick={handleAddLine} className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1">
                        <Plus size={14}/> Tambah Baris
                      </button>
                    </div>

                    {/* Datalist Data Produk (Bantuan Autocomplete) */}
                    <datalist id="product_suggestions">
                      {products.map((p: Product) => (
                        <option key={p.id} value={p.name} />
                      ))}
                    </datalist>

                    <div className="hidden sm:grid grid-cols-12 gap-3 px-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">
                       <div className="col-span-2">Nama Barang</div>
                       <div className="col-span-1 text-center">Jenis</div>
                       <div className="col-span-1 text-center">Qty</div>
                       <div className="col-span-1 text-center">Unit</div>
                       <div className="col-span-2 text-center">HPP / Satuan</div>
                       <div className="col-span-1 text-center">Margin</div>
                       <div className="col-span-3 text-right">Harga Jual (Final)</div>
                       <div className="col-span-1 text-center">Aksi</div>
                    </div>

                    {lines.map((line, idx) => {
                      const totalOverhead = (parseFloat(shippingAmount) || 0) + (parseFloat(insuranceAmount) || 0)
                      const itemValue = (line.quantity * line.unit_price) - (line.discount_amount || 0)
                      const allocatedOverheadPerUnit = grossSubTotal > 0 ? (itemValue / grossSubTotal * totalOverhead) / (line.quantity || 1) : 0
                      const trueHpp = line.unit_price + allocatedOverheadPerUnit
                      const suggestedPrice = calculateSuggestedSellingPrice(trueHpp, line.margin)
                      return (
                      <div key={line.id} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center bg-white p-4 sm:p-0 border sm:border-0 border-slate-100 rounded-3xl sm:rounded-none mb-4 sm:mb-2 text-left">
                        
                        <div className="sm:col-span-2 min-h-[58px] flex flex-col justify-start">
                          <label className="sm:hidden text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Nama Barang</label>
                          <input 
                            required 
                            list="product_suggestions" 
                            placeholder="Cari..." 
                            value={line.product_name} 
                            onChange={(e) => handleLineChange(line.id, 'product_name', e.target.value)} 
                            className="w-full h-[42px] px-4 py-2 border border-slate-200 rounded-xl outline-none text-sm group-hover:border-blue-400 transition-colors" 
                          />
                          {line.product_id ? (
                            <span className="text-[9px] font-black text-emerald-600 block mt-1 px-1">✓ Terhubung Prod. Master</span>
                          ) : line.product_name ? (
                            <span className="text-[9px] font-black text-amber-500 block mt-1 px-1">+ Akan Dibuat Baru</span>
                          ) : <div className="h-[14px]" />}
                        </div>

                        <div className="col-span-1 min-h-[58px]">
                          <label className="sm:hidden text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Jenis</label>
                          <select 
                            value={line.category} 
                            onChange={(e) => handleLineChange(line.id, 'category', e.target.value)} 
                            className="w-full h-[42px] px-1 py-1 border border-slate-100 rounded-xl outline-none text-[10px] font-black bg-slate-50 text-slate-700 text-center"
                          >
                             <option value="Bahan">Bahan Baku</option>
                             <option value="Setengah Jadi">Stgh Jadi</option>
                             <option value="Pelengkap">Pelengkap / Kemasan</option>
                             <option value="Siap Jual">Barang Jadi</option>
                             <option value="Layanan">Jasa / Layanan</option>
                             <option value="Lainnya">Lain-lain</option>
                          </select>
                        </div>

                        <div className="col-span-1 min-h-[58px]">
                          <label className="sm:hidden text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Qty</label>
                          <input 
                            type="number" required min="1" step="any"
                            value={line.quantity || ''} 
                            onChange={(e) => handleLineChange(line.id, 'quantity', parseFloat(e.target.value) || 0)} 
                            className="w-full h-[42px] px-1 py-2 border border-slate-200 rounded-xl outline-none text-xs text-center font-black" 
                            placeholder="0"
                          />
                        </div>

                        <div className="col-span-1 min-h-[58px]">
                          <label className="sm:hidden text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Satuan</label>
                          <select
                            value={line.unit}
                            onChange={(e) => handleLineChange(line.id, 'unit', e.target.value)}
                            className="w-full h-[42px] px-1 py-2 border border-slate-200 rounded-xl outline-none text-[10px] font-black text-blue-700 bg-white text-center"
                          >
                            {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                          </select>
                          {line.unit === 'Lainnya' && (
                            <input
                              type="text"
                              placeholder="Tulis satuan..."
                              value={line.custom_unit}
                              onChange={(e) => handleLineChange(line.id, 'custom_unit', e.target.value)}
                              className="w-full mt-1 px-2 py-1.5 border border-amber-300 rounded-lg outline-none text-[11px] bg-amber-50 font-bold text-amber-700"
                            />
                          )}
                        </div>

                        <div className="col-span-2 min-h-[58px]">
                          <CurrencyInput 
                            label={`HPP / ${line.unit}`}
                            labelClassName="sm:hidden"
                            value={line.unit_price}
                            onChange={(val) => handleLineChange(line.id, 'unit_price', val)}
                            placeholder="0"
                            className="h-[42px] px-4 py-2 rounded-xl text-sm"
                          />
                        </div>

                        <div className="col-span-1 min-h-[58px]">
                          <label className="sm:hidden text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Margin (%)</label>
                          <div className="relative">
                            <input 
                              type="number" required min="0" max="99"
                              value={line.margin || ''} 
                              onChange={(e) => handleLineChange(line.id, 'margin', parseFloat(e.target.value) || 0)} 
                              className="w-[110%] -ml-[5%] h-[42px] px-2 py-2 border border-slate-200 rounded-xl outline-none text-xs font-black text-blue-600 text-center" 
                              placeholder="20"
                            />
                            <span className="absolute right-1 top-1/2 -translate-y-1/2 text-slate-400 text-[9px] font-black">%</span>
                          </div>
                        </div>

                        <div className="col-span-3 min-h-[58px] sm:text-right flex flex-col justify-start">
                          <label className="sm:hidden text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Final Jual</label>
                          <div className="flex items-center gap-1">
                            <CurrencyInput 
                               label="Final Jual"
                               labelClassName="hidden"
                               value={line.selling_price || suggestedPrice}
                               onChange={(val) => handleLineChange(line.id, 'selling_price', val)}
                               placeholder="0"
                               className="h-[42px] px-2 py-2 rounded-xl text-xs text-emerald-700 bg-emerald-50/50 border-emerald-100 flex-1"
                            />
                            <button 
                               type="button"
                               title="Gunakan Harga Saran"
                               onClick={() => handleLineChange(line.id, 'selling_price', suggestedPrice)}
                               className="h-[42px] w-8 flex items-center justify-center bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition shadow-sm shadow-emerald-200"
                            >
                               <TrendingUp size={14} />
                            </button>
                          </div>
                          <div className="text-[8px] text-slate-400 mt-1 max-w-[140px] truncate">Saran: {formatCurrency(suggestedPrice)}</div>
                        </div>

                        <div className="col-span-1 min-h-[58px] text-center flex items-start justify-center pt-2 sm:pt-3">
                          <button type="button" onClick={() => handleRemoveLine(line.id)} className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-colors">
                            <Trash2 size={16}/>
                          </button>
                        </div>
                      </div>
                    )})}
                  </div>
                  {/* Kalkulasi Footer */}
                  <div className="flex flex-col gap-3 bg-blue-50/50 px-6 py-4 rounded-2xl border border-blue-100">
                     <div className="flex justify-between items-center text-sm font-semibold text-blue-900">
                       <span>Total Harga Barang (Gross):</span>
                       <span>{formatCurrency(grossSubTotal)}</span>
                     </div>
                     <div className="flex justify-between items-center text-sm font-semibold text-blue-900">
                       <div className="flex flex-col">
                         <span>Diskon Global Faktur (Rp)</span>
                         <span className="text-[10px] font-normal opacity-70">Otomatis dari diskon per barang, bisa ditimpa.</span>
                       </div>
                       <CurrencyInput 
                         label="Diskon Global Faktur (Rp)"
                         value={customGlobalDiscount !== null ? customGlobalDiscount : autoLineDiscounts}
                         onChange={(val) => setCustomGlobalDiscount(val)}
                         placeholder="0"
                         highlight={true}
                       />
                     </div>
                     <div className="flex justify-between items-center text-sm font-semibold text-rose-800">
                       <div className="flex flex-col">
                         <span>Pajak Global (%)</span>
                         <span className="text-[10px] font-normal opacity-70">PPN (Dihitung dari SubTotal dikurangi Diskon)</span>
                       </div>
                       <div className="flex items-center gap-2">
                         {calculatedTax > 0 && <span className="text-xs text-rose-500 font-bold bg-white px-2 py-1 rounded-md">+{formatCurrency(calculatedTax)}</span>}
                         <input type="number" min="0" max="100" value={headerTaxPercent || ''} onChange={(e) => setHeaderTaxPercent(parseFloat(e.target.value) || 0)} className="w-20 px-3 py-1.5 border border-slate-200 rounded-lg outline-none text-right font-medium text-slate-700 bg-white" placeholder="0" />
                       </div>
                     </div>
                     <div className="bg-white rounded-2xl border border-slate-200 p-4 mt-2">
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4 gap-2 border-b border-slate-50 pb-3">
                          <div>
                            <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-widest">Landed Cost (Overhead)</h4>
                            <p className="text-[10px] font-medium text-slate-400 mt-0.5">Ongkir/Ekspedisi & Asuransi (otomatis menambah HPP / Modal barang).</p>
                          </div>
                          {paymentTerm === 'TEMPO' && (
                            <div className="flex bg-slate-100 p-1 rounded-xl">
                               <button type="button" onClick={() => setPayOverheadNow(false)} className={`text-[10px] px-3 py-1.5 font-bold rounded-lg transition-all ${!payOverheadNow ? 'bg-white shadow-sm text-slate-900 border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>Gabung Hutang</button>
                               <button type="button" onClick={() => setPayOverheadNow(true)} className={`text-[10px] px-3 py-1.5 font-bold rounded-lg transition-all ${payOverheadNow ? 'bg-amber-500 shadow-md shadow-amber-200/50 text-white' : 'text-slate-500 hover:text-slate-700'}`}>Bayar Tunai (Pisah)</button>
                            </div>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <CurrencyInput 
                            label="Biaya Kirim (Rp)"
                            value={parseFloat(shippingAmount) || 0}
                            onChange={(val) => setShippingAmount(val.toString())}
                          />
                          <CurrencyInput 
                            label="Asuransi (Rp)"
                            value={parseFloat(insuranceAmount) || 0}
                            onChange={(val) => setInsuranceAmount(val.toString())}
                          />
                        </div>

                        {paymentTerm === 'TEMPO' && payOverheadNow && (
                          <div className="mt-4 pt-4 border-t border-slate-50 animate-in fade-in slide-in-from-top-2 duration-300">
                            <SearchableSelect 
                              label="Sumber Dana (Kas/Bank) Pembayar Ongkir/Asuransi Awal"
                              options={paymentAccounts}
                              value={overheadAccountId}
                              onChange={setOverheadAccountId}
                              placeholder="Pilih rekening Kas/Bank..."
                            />
                            <p className="text-[10px] text-amber-600 mt-2 italic font-semibold">
                               ⚡ Nilai Ongkir/Asuransi akan dicatat langsung memotong Kas/Bank Anda tanpa menambah saldo Hutang Vendor (Supplier).
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="border-t border-rose-200 my-4"></div>
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-rose-900 text-lg">Grand Total Keseluruhan:</span>
                       <span className="text-xl font-bold text-rose-600 bg-white px-3 py-1 rounded-xl shadow-sm">{formatCurrency(grandTotal)}</span>
                     </div>
                  </div>

                  <div className="flex gap-3 pt-4 border-t border-slate-100">
                    <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-4 text-xs font-bold text-slate-500 bg-slate-50 hover:bg-slate-100 rounded-2xl transition">Batal</button>
                    <button type="submit" disabled={loading} className="flex-2 py-4 px-8 text-xs font-bold text-white bg-rose-500 hover:bg-rose-600 rounded-2xl shadow-lg transition">{loading ? 'Menyimpan...' : 'Simpan PO & Produk'}</button>
                  </div>
                </form>
             </motion.div>
          </div>
        )}

        {/* Modal Vendor Tambahan */}
        {showContactModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowContactModal(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
             <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl p-8">
                <h3 className="text-xl font-bold mb-8">Tambah Vendor Rekanan</h3>
                <form onSubmit={handleCreateVendor} className="space-y-6">
                   <input name="name" required placeholder="Nama Perusahaan / Supplier" className="w-full px-5 py-3.5 border border-slate-200 rounded-xl outline-none text-sm font-medium" />
                   <textarea name="address" placeholder="Alamat Gudang / Kantor" className="w-full px-5 py-3.5 border border-slate-200 rounded-xl outline-none text-sm min-h-[100px]" />
                   <div className="flex gap-3 pt-4">
                    <button type="button" onClick={() => setShowContactModal(false)} className="flex-1 py-4 text-xs font-bold text-slate-500 bg-slate-50 rounded-2xl">Batal</button>
                    <button type="submit" disabled={loading} className="flex-2 py-4 px-8 text-xs font-bold text-white bg-rose-500 hover:bg-rose-600 rounded-2xl shadow-lg shadow-rose-100">{loading ? 'Menyimpan...' : 'Simpan Vendor'}</button>
                  </div>
                </form>
              </motion.div>
          </div>
        )}

        {/* MODAL PEMBAYARAN HUTANG */}
        {showPaymentModal && selectedPurchase && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowPaymentModal(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-lg bg-white rounded-[40px] shadow-2xl p-10 overflow-hidden">
               <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl -mr-16 -mt-16" />
               <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-200">
                    <CreditCard size={24}/>
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 leading-none">Bayar Tagihan Vendor</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1.5">{selectedPurchase.purchase_number} • {selectedPurchase.contacts?.name}</p>
                  </div>
               </div>

               <form onSubmit={handleSubmitPayment} className="space-y-6">
                 <div className="p-6 bg-slate-50 rounded-[32px] border border-slate-100 space-y-4">
                    <div className="flex justify-between items-center px-2 py-3 bg-white rounded-2xl border border-slate-100 shadow-sm mb-4">
                       <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sisa Hutang Tagihan:</span>
                       <span className="text-sm font-black text-rose-600">{formatCurrency(debtAmount)}</span>
                    </div>

                    <SearchableSelect 
                       label="Rekening Pengeluaran (Kas/Bank)"
                       options={paymentAccounts}
                       value={payAccountId}
                       onChange={setPayAccountId}
                       placeholder="Pilih rekening..."
                    />
                    
                    <div className="grid grid-cols-2 gap-4">
                      <CurrencyInput 
                        label="Jumlah Bayar (Tunai/Transfer)"
                        value={paymentAmount}
                        onChange={(val) => {
                          setPaymentAmount(val)
                          if (val + paymentDiscount > debtAmount) {
                            // User set payment, if it exceeds debt, we can keep it but warn? 
                            // Or just clamp it. Let's keep it for now but the total will show.
                          }
                        }}
                        placeholder="0"
                      />
                      <CurrencyInput 
                        label="Potongan / Cashback"
                        labelClassName="text-emerald-600"
                        value={paymentDiscount}
                        onChange={(val) => {
                          setPaymentDiscount(val)
                          // If I have a discount, usually it reduces my cash payment
                          if (val > 0 && val <= debtAmount) {
                             setPaymentAmount(debtAmount - val)
                          }
                        }}
                        placeholder="0"
                        highlight={true}
                      />
                    </div>

                    <div className="pt-2 px-1">
                       <div className="flex justify-between items-center py-3 border-t border-slate-200">
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Total Pelunasan Hutang</span>
                            <span className="text-[10px] font-bold text-slate-400 opacity-60 italic leading-none">(Bayar + Potongan)</span>
                          </div>
                          <span className={`text-xl font-black ${paymentAmount + paymentDiscount > debtAmount ? 'text-rose-500' : 'text-slate-900'}`}>
                            {formatCurrency(paymentAmount + paymentDiscount)}
                          </span>
                       </div>

                       {paymentAmount + paymentDiscount > debtAmount && (
                         <div className="p-3 bg-rose-50 rounded-xl border border-rose-100 mt-2 flex items-center gap-2 text-rose-600">
                            <AlertCircle size={14}/>
                            <p className="text-[10px] font-bold">Jumlah Bayar + Potongan melebih sisa hutang!</p>
                         </div>
                       )}
                       
                       <div className="p-3 bg-white/50 rounded-xl border border-slate-100 mt-2">
                          <p className="text-[9px] font-medium text-slate-500 leading-relaxed italic">
                             💡 Tips: Jika Anda memasukkan **Potongan**, sistem akan otomatis mengurangi **Jumlah Bayar** agar pas melunasi sisa hutang.
                          </p>
                       </div>
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Tanggal</label>
                       <input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} className="w-full px-5 py-3 border border-slate-200 rounded-2xl outline-none text-sm font-bold" />
                    </div>
                    <div className="space-y-1.5">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Catatan</label>
                       <input value={payNotes} onChange={(e) => setPayNotes(e.target.value)} className="w-full px-5 py-3 border border-slate-200 rounded-2xl outline-none text-sm font-bold" />
                    </div>
                 </div>

                 <div className="flex gap-3 pt-4">
                    <button type="button" onClick={() => setShowPaymentModal(false)} className="flex-1 py-4 text-xs font-black text-slate-400 hover:bg-slate-50 rounded-2xl transition-colors uppercase tracking-widest">Batal</button>
                    <button type="submit" disabled={loading} className="flex-2 py-4 px-8 text-xs font-black text-white bg-blue-600 hover:bg-blue-700 rounded-2xl shadow-xl shadow-blue-100 transition-all uppercase tracking-widest">
                       {loading ? 'Proses...' : 'Konfirmasi Bayar'}
                    </button>
                 </div>
               </form>
            </motion.div>
          </div>
        )}

        {/* MODAL RETUR PEMBELIAN */}
        {showReturnModal && selectedPurchase && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowReturnModal(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
             <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-2xl bg-white rounded-[40px] shadow-2xl p-10 overflow-hidden max-h-[90vh] overflow-y-auto">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-200">
                    <RotateCcw size={24}/>
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 leading-none">Retur Pembelian Barang</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1.5">{selectedPurchase.purchase_number} • {selectedPurchase.contacts?.name}</p>
                  </div>
                </div>

                <form onSubmit={handleSubmitReturn} className="space-y-6">
                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">No. Retur</label>
                        <input value={returnNumber} onChange={(e) => setReturnNumber(e.target.value)} className="w-full px-5 py-3 border border-slate-200 rounded-2xl outline-none text-sm font-bold bg-slate-50" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Tanggal Retur</label>
                        <input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} className="w-full px-5 py-3 border border-slate-200 rounded-2xl outline-none text-sm font-bold bg-white" />
                      </div>
                   </div>

                   <div className="bg-slate-50 rounded-[32px] border border-slate-100 p-6 space-y-3">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Pilih Barang yang Dikembalikan</label>
                      <div className="space-y-2">
                         {returnItems.map((it, idx) => (
                           <div key={it.id} className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 transition-all hover:border-amber-200 group">
                              <div className="flex-1">
                                 <p className="text-xs font-black text-slate-900">{it.description}</p>
                                 <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">Diterima: {it.quantity} {it.products?.unit || 'Pcs'} • {formatCurrency(it.unit_price)}</p>
                              </div>
                              <div className="flex items-center gap-3">
                                 <div className="text-right">
                                    <label className="text-[8px] font-black text-slate-400 block mb-1">JML RETUR</label>
                                    <input 
                                      type="number" 
                                      min="0" 
                                      max={it.quantity} 
                                      value={it.return_qty} 
                                      onChange={(e) => {
                                        const val = Math.min(it.quantity, parseFloat(e.target.value) || 0)
                                        setReturnItems(returnItems.map((ri, ridx) => ridx === idx ? { ...ri, return_qty: val } : ri))
                                      }}
                                      className="w-20 px-3 py-1.5 border-2 border-slate-100 rounded-xl outline-none text-center text-sm font-black focus:border-amber-500 transition-all"
                                    />
                                 </div>
                                 <div className="w-24 text-right">
                                    <p className="text-[8px] font-black text-slate-400 mb-1">VALUE</p>
                                    <p className="text-xs font-black text-slate-900">{formatCurrency(it.return_qty * it.unit_price)}</p>
                                 </div>
                              </div>
                           </div>
                         ))}
                      </div>
                      <div className="pt-4 flex justify-between items-center border-t border-slate-200">
                         <span className="text-[10px] font-black text-slate-400 uppercase">Total Estimasi Kredit AP</span>
                         <span className="text-lg font-black text-rose-600">{formatCurrency(returnItems.reduce((s, x) => s + (x.return_qty * x.unit_price * 1.11), 0))}</span>
                      </div>
                   </div>

                   <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Alasan Retur / Catatan</label>
                      <textarea value={returnNotes} onChange={(e) => setReturnNotes(e.target.value)} placeholder="Contoh: Barang rusak atau tidak sesuai spek..." className="w-full px-5 py-4 border border-slate-200 rounded-2xl outline-none text-sm font-medium min-h-[80px]" />
                   </div>

                   <div className="flex gap-3 pt-4">
                      <button type="button" onClick={() => setShowReturnModal(false)} className="flex-1 py-4 text-xs font-black text-slate-400 hover:bg-slate-50 rounded-2xl transition-colors uppercase tracking-widest">Batal</button>
                      <button type="submit" disabled={loading} className="flex-2 py-4 px-8 text-xs font-black text-white bg-amber-500 hover:bg-amber-600 rounded-2xl shadow-xl shadow-amber-100 transition-all uppercase tracking-widest">
                         {loading ? 'Memproses...' : 'Konfirmasi Retur'}
                      </button>
                   </div>
                </form>
             </motion.div>
          </div>
        )}
        
         {/* MODAL DETAIL DOKUMEN PO INCLUDE QR */}
         {showDetailModal && selectedDetailPurchase && (
           <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowDetailModal(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
             <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
                
                {/* Print Styles for PO */}
                <style>{`
                  @media print {
                    body * { visibility: hidden; }
                    #po-print-area, #po-print-area * { visibility: visible; }
                    #po-print-area { position: absolute; left: 0; top: 0; width: 100%; }
                    .no-print { display: none !important; }
                  }
                `}</style>

                <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center no-print shrink-0">
                   <div>
                     <h3 className="text-xl font-bold tracking-tight text-slate-900">Purchase Order Detail</h3>
                     <p className="text-xs text-slate-500 font-medium">Preview & Cetak Dokumen PO Resmi</p>
                   </div>
                   <div className="flex gap-3">
                      <button onClick={() => window.print()} className="px-5 py-2.5 bg-white text-slate-600 font-bold text-sm border border-slate-200 rounded-xl hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm">
                        <Printer size={16}/> Cetak PDF
                      </button>
                      <button onClick={() => setShowDetailModal(false)} className="w-10 h-10 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-rose-50 hover:text-rose-600 hover:border-rose-100 transition-all flex items-center justify-center shadow-sm">
                        <X size={18}/>
                      </button>
                   </div>
                </div>

                <div className="flex-1 overflow-y-auto p-12 relative bg-white" id="po-print-area">
                   {/* Watermark/Status Background */}
                   {selectedDetailPurchase.status === 'VOIDED' && (
                     <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-0 opacity-10">
                       <span className="text-[120px] font-black text-rose-600 rotate-[-30deg] uppercase">VOIDED</span>
                     </div>
                   )}

                   {/* Header */}
                   <div className="flex justify-between items-start border-b-2 border-slate-900 pb-8 mb-8 relative z-10">
                      <div className="flex items-start gap-5">
                        {logoUrl && (
                          <img src={logoUrl} alt="Logo" className="w-16 h-16 object-contain" />
                        )}
                        <div>
                          <h1 className="text-4xl font-black tracking-tighter text-slate-900 mb-1">{orgSettings.brand_name || orgName}</h1>
                          <p className="text-sm text-slate-500 max-w-sm">{orgSettings.company_address || 'Alamat perusahaan belum diatur (Update di Pengaturan Bisnis).'}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <h2 className="text-2xl font-black text-blue-600 uppercase tracking-widest mb-1">PURCHASE ORDER</h2>
                        <p className="text-sm font-bold text-slate-900 font-mono">{selectedDetailPurchase.purchase_number}</p>
                        <div className="mt-4 inline-block px-3 py-1 bg-slate-100 rounded-md">
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-0.5">Tanggal Terbit</span>
                          <span className="text-sm font-bold text-slate-900">{formatDate(selectedDetailPurchase.purchase_date, 'long')}</span>
                        </div>
                      </div>
                   </div>

                   {/* Info Grid */}
                   <div className="grid grid-cols-2 gap-12 mb-10 relative z-10">
                      <div className="space-y-4">
                         <div className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-6">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 border-b border-slate-200 pb-2">Ditujukan Kepada (Vendor):</h4>
                            <p className="text-lg font-bold text-slate-900">{selectedDetailPurchase.contacts?.name || 'Unknown Vendor'}</p>
                            {selectedDetailPurchase.contacts?.address && (
                              <p className="text-sm text-slate-500 mt-2 whitespace-pre-wrap">{selectedDetailPurchase.contacts.address}</p>
                            )}
                         </div>
                      </div>
                      <div className="space-y-4">
                         <div className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-6 h-full flex flex-col justify-center">
                            <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-sm">
                              <div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Jatuh Tempo</span>
                                <span className="font-bold text-slate-900">{selectedDetailPurchase.due_date ? formatDate(selectedDetailPurchase.due_date, 'long') : 'Pembayaran Lunas (Tunai)'}</span>
                              </div>
                              <div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Metode Pembayaran</span>
                                <span className="font-bold text-slate-900">{selectedDetailPurchase.payment_term}</span>
                              </div>
                              <div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Mode Syariah</span>
                                <span className="font-bold text-indigo-600">{selectedDetailPurchase.shariah_mode || 'CASH'}</span>
                              </div>
                              <div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Status Eksekusi</span>
                                <span className="font-bold text-slate-900">{selectedDetailPurchase.status}</span>
                              </div>
                            </div>
                         </div>
                      </div>
                   </div>

                   {/* Details Table */}
                   <div className="border border-slate-200 rounded-2xl overflow-hidden mb-8 relative z-10 font-mono text-sm">
                      <table className="w-full text-left bg-white">
                        <thead className="bg-slate-100">
                           <tr>
                             <th className="py-3 px-4 font-bold text-slate-700 w-12 text-center">NO</th>
                             <th className="py-3 px-4 font-bold text-slate-700">DESKRIPSI BARANG</th>
                             <th className="py-3 px-4 font-bold text-slate-700 text-center">QTY</th>
                             <th className="py-3 px-4 font-bold text-slate-700 text-right">HARGA SATUAN</th>
                             <th className="py-3 px-4 font-bold text-slate-700 text-right">TOTAL</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                           {selectedDetailPurchase.purchase_items?.map((item: any, i: number) => (
                             <tr key={item.id} className="hover:bg-slate-50/50">
                               <td className="py-3 px-4 text-slate-500 text-center">{i + 1}</td>
                               <td className="py-3 px-4 font-semibold text-slate-900">{item.description}</td>
                               <td className="py-3 px-4 text-center text-slate-700">{item.quantity} {item.products?.unit || 'Pcs'}</td>
                               <td className="py-3 px-4 text-right text-slate-700">{formatRupiah(item.unit_price)}</td>
                               <td className="py-3 px-4 text-right font-semibold text-slate-900">{formatRupiah(item.total_amount)}</td>
                             </tr>
                           ))}
                        </tbody>
                      </table>
                   </div>

                   {/* Calculations */}
                   <div className="flex justify-end relative z-10 font-mono text-sm mb-16">
                      <div className="w-80 space-y-3">
                         <div className="flex justify-between items-center text-slate-600">
                           <span>SubTotal</span>
                           <span>{formatRupiah(selectedDetailPurchase.grand_total - selectedDetailPurchase.tax_amount - selectedDetailPurchase.shipping_amount - selectedDetailPurchase.insurance_amount)}</span>
                         </div>
                         {(selectedDetailPurchase.tax_amount > 0) && (
                           <div className="flex justify-between items-center text-slate-600">
                             <span>Pajak (Tax)</span>
                             <span>{formatRupiah(selectedDetailPurchase.tax_amount)}</span>
                           </div>
                         )}
                         {((selectedDetailPurchase.shipping_amount || 0) + (selectedDetailPurchase.insurance_amount || 0) > 0) && (
                           <div className="flex justify-between items-center text-slate-600 border-b border-slate-200 pb-2">
                             <span>Landed Cost (Ship/Ins)</span>
                             <span>{formatRupiah((selectedDetailPurchase.shipping_amount || 0) + (selectedDetailPurchase.insurance_amount || 0))}</span>
                           </div>
                         )}
                         <div className="flex justify-between items-center font-bold text-lg pt-2 text-slate-900">
                           <span>Grand Total</span>
                           <span className="text-blue-600">{formatRupiah(selectedDetailPurchase.grand_total)}</span>
                         </div>
                      </div>
                   </div>

                   {/* Signatures & Approvals */}
                   <div className="grid grid-cols-2 mt-20 relative z-10">
                      <div className="text-center">
                         <p className="font-bold text-slate-900 mb-20">{selectedDetailPurchase.contacts?.name || 'Vendor'}</p>
                         <div className="w-48 border-b-2 border-slate-400 mx-auto"></div>
                         <p className="text-xs text-slate-500 mt-2">Tanda Tangan & Cap Perusahaan</p>
                      </div>
                      <div className="text-center relative">
                         <p className="font-bold text-slate-900 mb-6">{orgName}</p>
                         
                         <div className="h-32 flex flex-col items-center justify-center">
                            {loadingDetail ? (
                              <p className="text-xs text-slate-400 animate-pulse">Memuat data approval...</p>
                            ) : approvalData?.status === 'APPROVED' ? (
                              <div className="flex flex-col items-center">
                                <QRCodeSVG 
                                  value={`Verified Signature: ${approvalData.approver_id}\nDate: ${approvalData.decided_at}\nDoc: ${selectedDetailPurchase.id}\nOrg: ${orgId}`} 
                                  size={80} 
                                  level="L" 
                                  includeMargin={false} 
                                  fgColor="#0f172a" 
                                />
                                <p className="text-[8px] font-mono text-emerald-600 font-bold mt-2 uppercase tracking-widest bg-emerald-50 px-2 py-0.5 rounded">e-Signed Verified</p>
                              </div>
                            ) : approvalData?.status === 'REJECTED' ? (
                              <div className="text-rose-500 font-black border-4 border-rose-500 rounded-lg px-4 py-2 rotate-[-10deg] opacity-60">REJECTED</div>
                            ) : (
                              <span className="text-xs text-slate-400 italic">Dokumen Belum Disetujui (Draft)</span>
                            )}
                         </div>

                         <div className="w-48 border-b-2 border-slate-400 mx-auto mt-2"></div>
                         <p className="text-xs text-slate-500 mt-2">Otorisasi Pembelian</p>
                         {approvalData?.decided_at && approvalData.status === 'APPROVED' && (
                           <p className="text-[10px] text-slate-400 mt-1">TS: {formatDate(approvalData.decided_at, 'long')}</p>
                         )}
                      </div>
                   </div>
                   
                   <div className="mt-16 text-center border-t border-slate-200 pt-8 no-print pb-12">
                     <p className="text-[10px] text-slate-400 max-w-4xl mx-auto leading-relaxed text-justify">
                       <strong>Pernyataan Legal & Dokumen Elektronik Sah:</strong> Dokumen ini diterbitkan oleh Engine Nizam ERP dan telah disahkan penggunaannya secara internal. Tanda Tangan Elektronik (e-Sign) atau segel validasi digital berupa QR Code pada dokumen ini memiliki kekuatan penuh dan akibat hukum yang sah serta dapat dibuktikan keasliannya mengikat para pihak sebagaimana diatur dalam <strong>Pasal 11 ayat (1) UU RI No. 11 Tahun 2008 & disempurnakan UU No. 19 Tahun 2016 tentang Informasi dan Transaksi Elektronik (UU ITE)</strong>, serta <strong>Pasal 60 Peraturan Pemerintah No. 71 Tahun 2019</strong> tentang Penyelenggaraan Sistem dan Transaksi Elektronik.
                     </p>
                   </div>
                </div>
             </motion.div>
           </div>
         )}
      </AnimatePresence>

      {/* Floating Notifications */}
      <div className="fixed bottom-8 right-8 z-[100] flex flex-col gap-2">
        <AnimatePresence>
          {error && (
            <motion.div initial={{ x: 100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 100, opacity: 0 }} className="bg-red-50 border border-red-100 px-6 py-4 rounded-2xl shadow-xl flex items-center gap-3 text-red-600 text-sm font-bold">
              <AlertCircle size={18} /> {error}
            </motion.div>
          )}
          {success && (
            <motion.div initial={{ x: 100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 100, opacity: 0 }} className="bg-emerald-50 border border-emerald-100 px-6 py-4 rounded-2xl shadow-xl flex items-center gap-3 text-emerald-600 text-sm font-bold">
              <CheckCircle2 size={18} /> {success}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
