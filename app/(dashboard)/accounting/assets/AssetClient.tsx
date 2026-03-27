'use client'

import React, { useState } from 'react'
import { Landmark, Building2, CarFront, Monitor, Plus, Calculator, History, Trash2, Calendar, FileText, X, Printer, QrCode, Pencil, DollarSign, AlertTriangle } from 'lucide-react'
import Barcode from 'react-barcode'
import { QRCodeCanvas } from 'qrcode.react'
import { createFixedAsset, runOrganizationDepreciation, updateFixedAsset, deleteFixedAsset, previewOrganizationDepreciation, disposeFixedAsset } from '@/modules/accounting/actions/assets.actions'
import { formatDate } from '@/lib/utils'

interface AssetClientProps {
  orgId: string
  orgName: string
  initialAssets: any[]
  coa: any[]
}

// Sub-component for Searchable Select
function SearchableSelect({ label, options, value, onChange, placeholder, required = false }: any) {
  const [searchTerm, setSearchTerm] = useState('')
  const [isOpen, setIsOpen] = useState(false)

  const filtered = options.filter((o: any) => 
    o.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    o.code.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const selectedOption = options.find((o: any) => o.id === value)

  return (
    <div className="space-y-2 relative">
      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">{label}</label>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-slate-50/50 border-2 border-slate-100 rounded-2xl px-4 py-3 font-bold text-slate-900 text-[11px] cursor-pointer hover:border-blue-200 transition-all flex justify-between items-center h-[52px]"
      >
        <span className={selectedOption ? 'text-slate-900 truncate pr-2' : 'text-slate-400'}>
          {selectedOption ? `${selectedOption.code} - ${selectedOption.name}` : placeholder}
        </span>
        <div className="text-slate-400 text-[8px]">▼</div>
      </div>

      {isOpen && (
        <div className="absolute z-[120] top-full mt-2 w-full bg-white border border-slate-200 rounded-2xl shadow-2xl p-2 animate-in fade-in slide-in-from-top-2 duration-200 min-w-[280px]">
          <input 
            autoFocus
            className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs outline-none focus:border-blue-500 mb-2"
            placeholder="Cari kode atau nama akun..."
            value={searchTerm}
            onChange={(e: any) => setSearchTerm(e.target.value)}
          />
          <div className="max-h-48 overflow-y-auto space-y-1 custom-scrollbar">
             {filtered.length === 0 && <p className="p-3 text-xs text-slate-400 text-center">Tidak ditemukan.</p>}
             {filtered.map((o: any) => (
                <div 
                  key={o.id}
                  onClick={() => {
                    onChange(o.id)
                    setIsOpen(false)
                    setSearchTerm('')
                  }}
                  className="p-3 hover:bg-blue-50 rounded-xl cursor-pointer text-xs font-bold text-slate-700 transition-colors border-b border-slate-50 last:border-0"
                >
                  {o.code} - {o.name}
                </div>
             ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function AssetClient({ orgId, orgName, initialAssets, coa }: AssetClientProps) {
  const [assets, setAssets] = useState(initialAssets)
  const [showModal, setShowModal] = useState(false)
  const [showLabelModal, setShowLabelModal] = useState(false)
  const [selectedAsset, setSelectedAsset] = useState<any>(null)
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [depProcessing, setDepProcessing] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [projections, setProjections] = useState<any[]>([])

  // Disposal State
  const [showDisposeModal, setShowDisposeModal] = useState(false)
  const [selectedAssetForDisposal, setSelectedAssetForDisposal] = useState<any>(null)
  const [disposalForm, setDisposalForm] = useState({
    salePrice: '0',
    saleDate: new Date().toISOString().split('T')[0],
    cashAccountId: '',
    notes: ''
  })
  const [disposeLoading, setDisposeLoading] = useState(false)
  const [disposeResult, setDisposeResult] = useState<any>(null)

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    category: 'Peralatan & Mesin',
    purchase_date: new Date().toISOString().split('T')[0],
    purchase_price: '0',
    salvage_value: '0',
    useful_life_months: '48',
    asset_account_id: '',
    accum_dep_account_id: '',
    dep_expense_account_id: '',
    source_account_id: '',
    payment_method: 'LUNAS' as 'LUNAS' | 'KREDIT' | 'SPLIT',
    cash_amount: '0',
    liability_amount: '0',
    cash_account_id: '',
    liability_account_id: '',
    tax_percent: 0,
    tax_account_id: '',
    should_capitalize_tax: false,
  })

  // Auto Code logic
  React.useEffect(() => {
    if (showModal && !editingAssetId) {
       const year = new Date().getFullYear()
       const count = assets.length + 1
       const paddedCount = count.toString().padStart(4, '0')
       setFormData(prev => ({ ...prev, code: `AST-${year}-${paddedCount}` }))
    }
  }, [showModal, editingAssetId, assets.length])

  // Filters
  const assetAccounts = coa.filter(a => a.type === 'ASSET' && a.normal_balance === 'DEBIT' && a.code.startsWith('15'))
  const accumAccounts = coa.filter(a => a.type === 'ASSET' && a.normal_balance === 'CREDIT' && a.code.startsWith('15'))
  const expenseAccounts = coa.filter(a => a.type === 'EXPENSE' && a.code.startsWith('6'))
  const taxAccounts = coa.filter(a => a.is_active && a.type === 'ASSET' && a.code.startsWith('1')) 
  const cashAccounts = coa.filter(a => a.is_active && a.type === 'ASSET' && (a.code.startsWith('11') || a.code.startsWith('12')))
  const liabilityAccounts = coa.filter(a => a.is_active && a.type === 'LIABILITY')

  const totalBasePrice = parseFloat(formData.purchase_price) || 0
  const taxAmount = (totalBasePrice * (formData.tax_percent || 0)) / 100
  const totalWithTax = totalBasePrice + taxAmount

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    if (!formData.asset_account_id || !formData.accum_dep_account_id || !formData.dep_expense_account_id) {
      alert("Harap pilih semua akun pemetaan (Akun Biaya, Aset, dan Akumulasi)!")
      setLoading(false)
      return
    }

    if (formData.payment_method !== 'SPLIT' && !formData.source_account_id) {
      alert("Harap pilih akun sumber dana / rekening pembayaran!")
      setLoading(false)
      return
    }

    if (formData.payment_method === 'SPLIT' && (!formData.cash_account_id || !formData.liability_account_id)) {
      alert("Harap pilih akun Kas dan Hutang untuk metode pembayaran SPLIT!")
      setLoading(false)
      return
    }

    const source_lines = []
    if (formData.payment_method === 'SPLIT') {
      if (formData.cash_account_id && parseFloat(formData.cash_amount) > 0) {
        source_lines.push({ account_id: formData.cash_account_id, amount: parseFloat(formData.cash_amount) })
      }
      if (formData.liability_account_id && parseFloat(formData.liability_amount) > 0) {
        source_lines.push({ account_id: formData.liability_account_id, amount: parseFloat(formData.liability_amount) })
      }
    }

    const payload = {
      ...formData,
      salvage_value: parseFloat(formData.salvage_value) || 0,
      useful_life_months: parseInt(formData.useful_life_months) || 0,
      purchase_price: formData.should_capitalize_tax ? totalWithTax : totalBasePrice,
      current_book_value: formData.should_capitalize_tax ? totalWithTax : totalBasePrice,
      tax_amount: formData.should_capitalize_tax ? 0 : taxAmount, // Case capitalized: tax is 0 in DB, but included in price
      source_lines: formData.payment_method === 'SPLIT' ? source_lines : undefined,
      source_account_id: formData.payment_method !== 'SPLIT' ? formData.source_account_id : undefined,
      should_capitalize_tax: formData.should_capitalize_tax
    }

    let res;
    if (editingAssetId) {
      const { source_account_id, source_lines: sl, tax_amount, ...updatePayload } = payload as any
      res = await updateFixedAsset(editingAssetId, orgId, updatePayload as any)
    } else {
      res = await createFixedAsset(orgId, payload as any)
    }

    if (res.error) {
       alert("Gagal: " + res.error)
    } else {
       if (editingAssetId) {
         setAssets(assets.map(a => a.id === editingAssetId ? res.data : a))
       } else {
         setAssets([res.data, ...assets])
       }
       setShowModal(false)
       setEditingAssetId(null)
       setFormData({
         code: '', name: '', category: 'Peralatan & Mesin',
         purchase_date: new Date().toISOString().split('T')[0],
         purchase_price: '0', salvage_value: '0', useful_life_months: '48',
         asset_account_id: '', accum_dep_account_id: '', dep_expense_account_id: '',
         source_account_id: '', payment_method: 'LUNAS',
         cash_amount: '0', liability_amount: '0', cash_account_id: '', liability_account_id: '',
         tax_percent: 0, tax_account_id: '', should_capitalize_tax: false
        })
    }
    setLoading(false)
  }

  const handleEdit = (asset: any) => {
    setFormData({
      code: asset.code,
      name: asset.name,
      category: asset.category,
      purchase_date: asset.purchase_date,
      purchase_price: asset.purchase_price.toString(),
      salvage_value: (asset.salvage_value || 0).toString(),
      useful_life_months: (asset.useful_life_months || 48).toString(),
      asset_account_id: asset.asset_account_id || '',
      accum_dep_account_id: asset.accum_dep_account_id || '',
      dep_expense_account_id: asset.dep_expense_account_id || '',
      source_account_id: '',
      payment_method: 'LUNAS',
      cash_amount: '0',
      liability_amount: '0',
      cash_account_id: '',
      liability_account_id: '',
      tax_percent: 0,
      tax_account_id: '',
      should_capitalize_tax: asset.should_capitalize_tax || false,
    })
    setEditingAssetId(asset.id)
    setShowModal(true)
  }

  const handleDelete = async (asset: any) => {
     if (!confirm(`Hapus aset "${asset.name}"? Data ini tidak bisa dikembalikan.`)) return
     const res = await deleteFixedAsset(asset.id, orgId)
     if (res.error) alert(res.error)
     else setAssets(assets.filter(a => a.id !== asset.id))
  }

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val)
  }

  const formatThousand = (val: string) => {
    if (!val) return ''
    const num = val.replace(/\D/g, '')
    return new Intl.NumberFormat('id-ID').format(parseInt(num) || 0)
  }

  const parseNumber = (val: string) => {
    return val.replace(/\./g, '')
  }

  const getAssetIcon = (category: string) => {
    if (category.includes('Kendaraan')) return <CarFront size={24} className="text-blue-500" />
    if (category.includes('Bangunan')) return <Building2 size={24} className="text-amber-600" />
    if (category.includes('Peralatan')) return <Monitor size={24} className="text-emerald-500" />
    return <Landmark size={24} className="text-slate-500" />
  }

  const handlePreview = async () => {
    setDepProcessing(true)
    const res = await previewOrganizationDepreciation(orgId)
    setDepProcessing(false)
    if (res.projections) {
      setProjections(res.projections)
      setShowPreview(true)
    } else {
      alert("Gagal memuat preview")
    }
  }

  const handleOpenDisposal = (asset: any) => {
    setSelectedAssetForDisposal(asset)
    setDisposeResult(null)
    setDisposalForm({
      salePrice: '0',
      saleDate: new Date().toISOString().split('T')[0],
      cashAccountId: '',
      notes: `Penjualan / Pelepasan: ${asset.name}`
    })
    setShowDisposeModal(true)
  }

  const handleDispose = async () => {
    if (!disposalForm.cashAccountId) return alert('Pilih Akun Penerimaan Kas/Bank terlebih dahulu!')
    if (!confirm(`Konfirmasi Jual/Lepas Aset "${selectedAssetForDisposal?.name}"?\nTindakan ini tidak bisa dibatalkan, status aset akan berubah ke SOLD.`)) return

    setDisposeLoading(true)
    const res = await disposeFixedAsset(orgId, {
      assetId: selectedAssetForDisposal.id,
      salePrice: parseFloat(disposalForm.salePrice.replace(/\./g, '')) || 0,
      saleDate: disposalForm.saleDate,
      cashAccountId: disposalForm.cashAccountId,
      notes: disposalForm.notes
    })
    setDisposeLoading(false)

    if (res.error) {
      alert('Gagal: ' + res.error)
    } else {
      setDisposeResult(res)
      setAssets(assets.map(a => a.id === selectedAssetForDisposal.id ? { ...a, status: 'SOLD', current_book_value: 0 } : a))
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-10 animate-in fade-in duration-500 pb-20">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-4">
            <Landmark className="text-blue-600" size={40} />
            Manajemen Aset Tetap
          </h1>
          <p className="text-slate-500 font-medium text-lg mt-2">Inventory Aset, Kapitalisasi, dan Kalkulasi Penyusutan Berjalan.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            disabled={depProcessing}
            onClick={handlePreview}
            className="flex items-center gap-2 px-6 py-4 bg-white border-2 border-slate-100 hover:border-blue-200 hover:bg-blue-50 text-blue-600 font-black rounded-3xl transition-all shadow-sm active:scale-95 disabled:opacity-50"
          >
            <History size={20} />
            Preview Jurnal
          </button>

          <button 
            disabled={depProcessing}
            onClick={async () => {
              if (!confirm("Jalankan Posting Jurnal Penyusutan Otomatis sekarang?")) return
              setDepProcessing(true)
              const res = await runOrganizationDepreciation(orgId)
              setDepProcessing(false)
              if (res.success) {
                alert(`Penyusutan Selesai! ${res.processed} Jurnal Otomatis telah diterbitkan.`)
                window.location.reload()
              } else {
                alert("Gagal: " + res.error)
              }
            }}
            className="flex items-center gap-2 px-6 py-4 bg-white border-2 border-slate-100 hover:border-emerald-200 hover:bg-emerald-50 text-emerald-600 font-black rounded-3xl transition-all shadow-sm active:scale-95 disabled:opacity-50"
          >
            <Calculator size={20} className={depProcessing ? 'animate-spin' : ''} />
            {depProcessing ? 'Sedang Memproses...' : 'Jalankan Penyusutan'}
          </button>

          <button 
            onClick={() => { setEditingAssetId(null); setShowModal(true); }}
            className="flex items-center gap-2 px-8 py-4 bg-blue-600 hover:bg-indigo-700 text-white font-black rounded-3xl transition-all shadow-xl shadow-blue-200 active:scale-95"
          >
            <Plus size={24} />
            Registrasi Aset Baru
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
         <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm transition-all hover:shadow-md">
            <div className="flex items-center justify-between mb-4">
               <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                 <Landmark size={24} />
               </div>
               <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Aset</span>
            </div>
            <p className="text-2xl font-black text-slate-900">{formatCurrency(assets.reduce((acc: number, a: any) => acc + (a.purchase_price || 0), 0))}</p>
         </div>

         <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm transition-all hover:shadow-md">
            <div className="flex items-center justify-between mb-4">
               <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl">
                 <Calculator size={24} />
               </div>
               <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Akumulasi Penyusutan</span>
            </div>
            <p className="text-2xl font-black text-rose-600">{formatCurrency(assets.reduce((acc: number, a: any) => acc + (a.accumulated_depreciation || 0), 0))}</p>
         </div>

         <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm transition-all hover:shadow-md">
            <div className="flex items-center justify-between mb-4">
               <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
                 <Building2 size={24} />
               </div>
               <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Nilai Buku (Net)</span>
            </div>
            <p className="text-2xl font-black text-emerald-600">{formatCurrency(assets.reduce((acc: number, a: any) => acc + (a.current_book_value || 0), 0))}</p>
         </div>

         <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm transition-all hover:shadow-md bg-gradient-to-br from-indigo-50/50 to-white overflow-hidden relative group">
            <div className="flex items-center justify-between mb-4">
               <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg ring-4 ring-blue-50">
                 <History size={24} />
               </div>
               <span className="text-xs font-bold text-blue-400 uppercase tracking-widest">Next Run</span>
            </div>
            <p className="text-lg font-bold text-slate-900 italic">Penyusutan Otomatis: <br/> <span className="text-sm font-normal text-slate-500">Setiap Akhir Bulan</span></p>
         </div>
      </div>

      {/* Asset Table */}
      <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
         <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
            <h3 className="font-black text-slate-900 text-xl flex items-center gap-3">
               Daftar Inventaris Aset Tetap
               <span className="px-3 py-1 bg-white border border-slate-200 text-slate-400 rounded-full text-xs font-bold">{assets.length} Aset</span>
            </h3>
         </div>

         <div className="overflow-x-auto">
            <table className="w-full text-left">
               <thead className="bg-slate-50/50 text-[10px] uppercase font-black tracking-[0.1em] text-slate-400 border-b border-slate-100">
                  <tr>
                    <th className="px-8 py-5">Identitas Aset</th>
                    <th className="px-6 py-5">Informasi Pembelian</th>
                    <th className="px-6 py-5">Sumber Dana</th>
                    <th className="px-6 py-5">Umur Ekonomis</th>
                    <th className="px-6 py-5 text-right">Harga Perolehan</th>
                    <th className="px-6 py-5 text-right">Nilai Buku Saat Ini</th>
                    <th className="px-8 py-5 text-center">Aksi</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-50">
                 {assets.length === 0 ? (
                    <tr>
                       <td colSpan={6} className="px-8 py-20 text-center opacity-40">
                          <Landmark size={64} className="mx-auto mb-4 text-slate-300" />
                          <p className="font-bold text-slate-600">Belum ada aset tetap yang terdaftar.</p>
                       </td>
                    </tr>
                 ) : (
                    assets.map(asset => (
                       <tr key={asset.id} className="hover:bg-blue-50/20 transition-all group">
                          <td className="px-8 py-6">
                             <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-center justify-center transition-transform group-hover:scale-110">
                                   {getAssetIcon(asset.category)}
                                </div>
                                <div className="max-w-[200px]">
                                   <p className="font-black text-slate-900 truncate">{asset.name}</p>
                                   <p className="text-xs font-mono font-bold text-slate-400 uppercase tracking-tighter mt-1">{asset.code}</p>
                                </div>
                             </div>
                          </td>
                          <td className="px-6 py-6 font-bold text-slate-700"> {formatDate(asset.purchase_date)} </td>
                          <td className="px-6 py-6">
                             <div className="flex flex-col gap-1">
                                <span className={`text-[10px] font-black w-fit px-2 py-0.5 rounded-full ${asset.acquisition_method === 'SPLIT' ? 'bg-blue-100 text-blue-700' : asset.acquisition_method === 'KREDIT' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                   {asset.acquisition_method || 'LUNAS'}
                                </span>
                                <p className="text-[10px] text-slate-400 font-bold uppercase truncate max-w-[120px]">
                                   {asset.source_account_id ? coa.find(c => c.id === asset.source_account_id)?.name : 'Multi-Account'}
                                </p>
                             </div>
                          </td>
                          <td className="px-6 py-6 font-bold text-slate-600"> {asset.useful_life_months} Bulan </td>
                          <td className="px-6 py-6 text-right font-black text-slate-900"> {formatCurrency(asset.purchase_price)} </td>
                          <td className="px-6 py-6 text-right">
                             <p className="font-black text-emerald-600">{formatCurrency(asset.current_book_value)}</p>
                             <div className="w-full bg-slate-100 h-2 rounded-full mt-2 overflow-hidden max-w-[120px] ml-auto">
                                <div className={`h-full rounded-full ${ (asset.current_book_value / asset.purchase_price) < 0.2 ? 'bg-rose-500' : 'bg-emerald-500' }`} style={{ width: `${(asset.current_book_value / asset.purchase_price) * 100}%` }} />
                             </div>
                          </td>
                           <td className="px-8 py-6 text-center">
                              <div className="flex items-center justify-center gap-2">
                                 <button onClick={() => { setSelectedAsset(asset); setShowLabelModal(true); }} className="p-3 bg-white border border-slate-200 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all shadow-sm" title="Label Aset"> <QrCode size={18} /> </button>
                                 {asset.status === 'ACTIVE' ? (
                                   <>
                                     <button onClick={() => handleEdit(asset)} className="p-3 bg-white border border-slate-200 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all shadow-sm" title="Edit Aset"> <Pencil size={18} /> </button>
                                     <button onClick={() => handleOpenDisposal(asset)} className="p-3 bg-white border border-emerald-200 text-emerald-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl transition-all shadow-sm" title="Jual / Lepas Aset"> <DollarSign size={18} /> </button>
                                     <button onClick={() => handleDelete(asset)} className="p-3 bg-white border border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all shadow-sm" title="Hapus Aset"> <Trash2 size={18} /> </button>
                                   </>
                                 ) : (
                                   <span className="px-3 py-1 text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-400 rounded-full">SOLD</span>
                                 )}
                              </div>
                           </td>
                       </tr>
                    ))
                 )}
               </tbody>
            </table>
         </div>
      </div>

      {/* REGISTRATION MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-3xl overflow-hidden animate-in slide-in-from-bottom-10 duration-500">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
               <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                  {editingAssetId ? <Pencil size={28} className="text-amber-500" /> : <Landmark size={28} className="text-blue-600" />}
                  {editingAssetId ? 'Perbarui Data Aset' : 'Kapitalisasi Aset Tetap Baru'}
               </h2>
               <button onClick={() => { setShowModal(false); setEditingAssetId(null); }} className="w-10 h-10 flex items-center justify-center rounded-full bg-white border border-slate-200 text-slate-400 hover:text-slate-900 transition-all shadow-sm"> <X size={20} /> </button>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-8 overflow-y-auto max-h-[80vh] custom-scrollbar">
               {/* 1. Identity */}
               <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Kode Aset / Tag</label>
                    <input required value={formData.code} onChange={e => setFormData({...formData, code: e.target.value.toUpperCase()})} className="w-full bg-slate-50/50 border-2 border-slate-100 rounded-2xl px-5 py-4 font-black text-slate-900 focus:border-blue-500 outline-none transition-all" />
                  </div>
                  <div className="space-y-2">
                     <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Nama Aset Tetap</label>
                     <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-slate-50/50 border-2 border-slate-100 rounded-2xl px-5 py-4 font-black text-slate-900 focus:border-blue-500 outline-none transition-all" />
                  </div>
               </div>

               <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Kategori / Kelompok</label>
                    <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full bg-slate-50/50 border-2 border-slate-100 rounded-2xl px-5 py-4 font-black text-slate-900 focus:border-blue-500 appearance-none cursor-pointer outline-none">
                       <option>Peralatan & Mesin</option>
                       <option>Kendaraan</option>
                       <option>Bangunan</option>
                       <option>Elektronik & Laptop</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Tanggal Perolehan</label>
                    <input type="date" required value={formData.purchase_date} onChange={e => setFormData({...formData, purchase_date: e.target.value})} className="w-full bg-slate-50/50 border-2 border-slate-100 rounded-2xl px-5 py-4 font-black text-slate-900 focus:border-blue-500 outline-none transition-all" />
                  </div>
               </div>

               {/* 2. Pricing & Tax */}
               <div className="p-8 bg-blue-50/50 rounded-[40px] border-2 border-blue-100 space-y-8">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase text-blue-400 tracking-widest">Pricing & Acquisition Model</h4>
                    <div className="flex items-center gap-6">
                       <div className="flex items-center gap-3">
                          <label className="text-[10px] font-black text-slate-400 uppercase">Input Pajak?</label>
                          <select value={formData.tax_percent} onChange={(e) => setFormData({...formData, tax_percent: parseInt(e.target.value)})} className="bg-white border-2 border-blue-100 rounded-xl px-3 py-2 text-[11px] font-bold outline-none focus:border-blue-500 transition-all">
                            <option value={0}>Tanpa Pajak</option>
                            <option value={11}>PPN 11%</option>
                            <option value={12}>PPN 12%</option>
                          </select>
                       </div>

                       {formData.tax_percent > 0 && (
                         <button 
                           type="button"
                           onClick={() => setFormData({...formData, should_capitalize_tax: !formData.should_capitalize_tax})}
                           className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all border-2 ${formData.should_capitalize_tax ? 'bg-blue-600 text-white border-indigo-600' : 'bg-white text-blue-400 border-blue-100 hover:border-blue-200'}`}
                         >
                           {formData.should_capitalize_tax ? 'PAJAK KAPITALISASI' : 'PAJAK TERPISAH (PPN)'}
                         </button>
                       )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-indigo-900/40 uppercase tracking-widest">Harga Perolehan (Base)</label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-indigo-300 text-sm">Rp</span>
                          <input required value={formatThousand(formData.purchase_price)} onChange={e => setFormData({...formData, purchase_price: parseNumber(e.target.value)})} className="w-full bg-white border-2 border-blue-100 rounded-2xl pl-10 pr-4 py-4 font-black text-indigo-900 focus:ring-4 focus:ring-indigo-100 transition-all outline-none text-right" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-indigo-900/40 uppercase tracking-widest">Nilai Pajak</label>
                        <div className="w-full bg-blue-100/30 rounded-2xl px-4 py-4 font-black text-blue-400 text-right border-2 border-transparent">
                           {formatCurrency(taxAmount)}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-indigo-900/60 uppercase tracking-widest">Total Tagihan</label>
                        <div className="w-full bg-blue-600 rounded-2xl px-4 py-4 font-black text-white text-right shadow-xl shadow-indigo-100/50 animate-in zoom-in-95">
                           {formatCurrency(totalWithTax)}
                        </div>
                      </div>
                  </div>

                  {formData.tax_percent > 0 && !formData.should_capitalize_tax && (
                     <div className="animate-in slide-in-from-top-4 duration-300">
                        <SearchableSelect label="Akun PPN Masukan (Debit)" options={taxAccounts} value={formData.tax_account_id} onChange={(val: any) => setFormData({...formData, tax_account_id: val})} placeholder="Pilih akun pajak..." />
                     </div>
                  )}

                  {formData.tax_percent > 0 && formData.should_capitalize_tax && (
                    <div className="p-4 bg-blue-600/5 rounded-2xl border-2 border-dashed border-blue-100 text-[10px] text-blue-700 font-bold italic text-center animate-in zoom-in-95">
                      Pajak akan ditambahkan langsung ke nilai perolehan aset (Kapitalisasi).
                    </div>
                  )}

                  {/* 3. RESTORING DEPRECIATION FIELDS */}
                  <div className="grid grid-cols-2 gap-6 pt-4 border-t border-blue-100/50">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-indigo-900/40 uppercase tracking-widest">Estimasi Nilai Sisa (Salvage)</label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-indigo-300 text-sm">Rp</span>
                          <input value={formatThousand(formData.salvage_value)} onChange={e => setFormData({...formData, salvage_value: parseNumber(e.target.value)})} className="w-full bg-white border-2 border-blue-100 rounded-2xl pl-10 pr-4 py-4 font-black text-indigo-900 focus:border-blue-500 outline-none transition-all text-right" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-indigo-900/40 uppercase tracking-widest">Umur Ekonomis (Bulan)</label>
                        <input type="number" required value={formData.useful_life_months} onChange={e => setFormData({...formData, useful_life_months: e.target.value})} className="w-full bg-white border-2 border-blue-100 rounded-2xl px-5 py-4 font-black text-indigo-900 focus:border-blue-500 outline-none transition-all" />
                      </div>
                  </div>

                  {/* 4. Funding Model */}
                  {!editingAssetId && (
                     <div className="space-y-6 pt-8 border-t border-blue-100/50">
                        <div className="space-y-3">
                           <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Metode Perolehan / Sumber Dana</label>
                           <div className="flex p-1.5 bg-slate-100 rounded-[24px] w-full">
                              {(['LUNAS', 'KREDIT', 'SPLIT'] as const).map((m) => (
                                <button key={m} type="button" onClick={() => setFormData({...formData, payment_method: m})} className={`flex-1 py-3 rounded-2xl text-[10px] font-black transition-all ${formData.payment_method === m ? 'bg-white text-blue-600 shadow-sm ring-1 ring-slate-200' : 'text-slate-400 hover:text-slate-600'}`} >
                                   {m === 'LUNAS' ? 'LUNAS (KAS)' : m === 'KREDIT' ? 'CICILAN (HUTANG)' : 'SPLIT (KAS + HUTANG)'}
                                </button>
                              ))}
                           </div>
                        </div>

                        {formData.payment_method === 'SPLIT' ? (
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-2">
                              <div className="space-y-4 p-6 bg-emerald-50/50 rounded-[32px] border-2 border-emerald-100">
                                 <SearchableSelect label="Kas/Bank (Tunai)" options={cashAccounts} value={formData.cash_account_id} onChange={(val: any) => setFormData({...formData, cash_account_id: val})} placeholder="Pilih rekening..." />
                                 <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-emerald-300 text-xs text-right">Rp</span>
                                  <input type="text" value={formatThousand(formData.cash_amount)} onChange={e => { const val = parseNumber(e.target.value); setFormData({...formData, cash_amount: val, liability_amount: Math.round(totalWithTax - (parseFloat(val) || 0)).toString()}); }} className="w-full bg-white border-2 border-emerald-100 rounded-2xl pl-10 pr-4 py-3 font-black text-emerald-600 outline-none text-right" />
                              </div>
                              </div>
                              <div className="space-y-4 p-6 bg-rose-50/50 rounded-[32px] border-2 border-rose-100">
                                 <SearchableSelect label="Hutang / Vendor" options={liabilityAccounts} value={formData.liability_account_id} onChange={(val: any) => setFormData({...formData, liability_account_id: val})} placeholder="Pilih akun hutang..." />
                                 <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-rose-300 text-xs">Rp</span>
                                    <input type="text" value={formatThousand(formData.liability_amount)} onChange={e => { const val = parseNumber(e.target.value); setFormData({...formData, liability_amount: val, cash_amount: Math.round(totalWithTax - (parseFloat(val) || 0)).toString()}); }} className="w-full bg-white border-2 border-rose-100 rounded-2xl pl-10 pr-4 py-3 font-black text-rose-600 outline-none text-right" />
                                 </div>
                              </div>
                           </div>
                        ) : (
                          <div className="animate-in fade-in duration-300">
                             <SearchableSelect label={formData.payment_method === 'LUNAS' ? "Pilih Rekening Pembayaran" : "Pilih Akun Hutang / Vendor"} options={formData.payment_method === 'LUNAS' ? cashAccounts : liabilityAccounts} value={formData.source_account_id} onChange={(val: any) => setFormData({...formData, source_account_id: val})} placeholder="Pilih akun yang sesuai..." />
                          </div>
                        )}
                     </div>
                  )}
               </div>

               {/* 5. COA Mapping */}
               <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 <SearchableSelect label="Akun Biaya Penyusutan" options={expenseAccounts} value={formData.dep_expense_account_id} onChange={(val: any) => setFormData({...formData, dep_expense_account_id: val})} placeholder="-- Beban --" />
                 <SearchableSelect label="Akun Aset (Neraca)" options={assetAccounts} value={formData.asset_account_id} onChange={(val: any) => setFormData({...formData, asset_account_id: val})} placeholder="-- Aset --" />
                 <SearchableSelect label="Akun Akumulasi" options={accumAccounts} value={formData.accum_dep_account_id} onChange={(val: any) => setFormData({...formData, accum_dep_account_id: val})} placeholder="-- Akum --" />
               </div>

               {/* 6. Submit */}
               <div className="pt-6 flex gap-4">
                  <button type="button" onClick={() => { setShowModal(false); setEditingAssetId(null); }} className="flex-1 py-5 bg-slate-100 text-slate-600 font-black rounded-3xl hover:bg-slate-200 transition-all active:scale-95"> Batalkan </button>
                  <button type="submit" disabled={loading} className={`flex-[2] py-5 text-white font-black rounded-3xl transition-all shadow-xl active:scale-95 disabled:opacity-50 ${ editingAssetId ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-100' : 'bg-blue-600 hover:bg-indigo-700 shadow-blue-200' }`}>
                     {loading ? 'Sedang Memproses...' : (editingAssetId ? 'Simpan Perubahan' : 'Konfirmasi & Kapitalisasi')}
                  </button>
               </div>
            </form>
          </div>
        </div>
      )}

      {/* LABEL MODAL */}
      {showLabelModal && selectedAsset && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-300 print:hidden">
           <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-sm overflow-hidden p-8 space-y-8 animate-in zoom-in-95">
              <div className="flex items-center justify-between">
                 <h2 className="text-xl font-black text-slate-900 flex items-center gap-2"> <Printer className="text-blue-600" /> Label Aset </h2>
                 <button onClick={() => setShowLabelModal(false)} className="text-slate-400 hover:text-slate-900"> <X size={24} /> </button>
              </div>
              <div id="printable-label" className="bg-white border-2 border-slate-100 p-6 rounded-3xl flex flex-col items-center gap-4 text-center">
                 <h4 className="text-sm font-black text-slate-900 truncate w-full">{selectedAsset.name}</h4>
                 <div className="p-2 bg-slate-50 rounded-2xl flex flex-col items-center gap-3">
                    <Barcode value={selectedAsset.code} width={1.2} height={40} fontSize={10} background="transparent" />
                    <QRCodeCanvas value={`https://nizam.app/asset/${selectedAsset.id}`} size={48} level="H" />
                 </div>
                 <p className="text-[10px] font-mono font-bold text-blue-600">{selectedAsset.code}</p>
              </div>
              <div className="flex gap-4">
                 <button onClick={() => setShowLabelModal(false)} className="flex-1 py-4 bg-slate-100 text-slate-600 font-black rounded-2xl" > Tutup </button>
                 <button onClick={() => window.print()} className="flex-1 py-4 bg-blue-600 text-white font-black rounded-2xl shadow-xl flex items-center justify-center gap-2" > <Printer size={18} /> Cetak </button>
              </div>
           </div>
           <style jsx global>{`
             @media print {
               body * { visibility: hidden; }
               #printable-label, #printable-label * { visibility: visible; }
               #printable-label { position: absolute; left: 0; top: 0; width: 100%; border: none !important; }
               @page { margin: 0; size: auto; }
             }
           `}</style>
        </div>
      )}
      {/* DEPRECIATION PREVIEW MODAL */}
      {showPreview && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-300">
           <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95">
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                 <h2 className="text-xl font-black text-slate-900 flex items-center gap-3">
                    <History size={24} className="text-blue-600" />
                    Preview Jurnal Penyusutan Otomatis
                 </h2>
                 <button onClick={() => setShowPreview(false)} className="w-10 h-10 flex items-center justify-center rounded-full bg-white border border-slate-200 text-slate-400 hover:text-slate-900 transition-all shadow-sm"> <X size={20} /> </button>
              </div>

              <div className="p-8 max-h-[60vh] overflow-y-auto custom-scrollbar">
                 {projections.length === 0 ? (
                    <div className="py-20 text-center opacity-40">
                       <p className="font-bold text-slate-600">Tidak ada penyusutan yang perlu diproses bulan ini.</p>
                    </div>
                 ) : (
                    <div className="space-y-3">
                       {projections.map((p, i) => (
                          <div key={i} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between">
                             <div className="flex flex-col gap-1">
                                <p className="text-xs font-black text-slate-900">{p.asset_name}</p>
                                <p className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-tighter">{p.asset_code}</p>
                             </div>
                             <div className="text-right">
                                <p className="text-xs font-black text-blue-600">{formatCurrency(p.amount)}</p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{p.period}</p>
                             </div>
                          </div>
                       ))}
                    </div>
                 )}
              </div>

              <div className="p-8 bg-slate-50 border-t border-slate-100 flex gap-4">
                 <button onClick={() => setShowPreview(false)} className="flex-1 py-4 bg-white border-2 border-slate-200 text-slate-600 font-black rounded-3xl hover:bg-slate-50 transition-all"> Tutup </button>
                 <button 
                   onClick={async () => {
                      if (!confirm("Konfirmasi posting jurnal di atas?")) return
                      setShowPreview(false)
                      setDepProcessing(true)
                      const res = await runOrganizationDepreciation(orgId)
                      setDepProcessing(false)
                      if (res.success) {
                        alert(`Sukses! ${res.processed} Jurnal telah diposting.`)
                        window.location.reload()
                      } else {
                        alert("Gagal: " + res.error)
                      }
                   }}
                   disabled={projections.length === 0}
                   className="flex-[2] py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-3xl shadow-xl shadow-emerald-200 transition-all active:scale-95 disabled:opacity-50"
                 > 
                   Konfirmasi & Jalankan 
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* DISPOSAL MODAL */}
      {showDisposeModal && selectedAssetForDisposal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-300">
           <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-emerald-50/40">
                 <div>
                   <h2 className="text-xl font-black text-slate-900 flex items-center gap-3">
                     <DollarSign size={24} className="text-emerald-600" />
                     Jual / Lepas Aset Tetap
                   </h2>
                   <p className="text-[11px] font-bold text-slate-500 mt-1">{selectedAssetForDisposal.name} ({selectedAssetForDisposal.code})</p>
                 </div>
                 <button onClick={() => setShowDisposeModal(false)} className="w-10 h-10 flex items-center justify-center rounded-full bg-white border border-slate-200 text-slate-400 hover:text-slate-900 transition-all shadow-sm"><X size={20} /></button>
              </div>

              {!disposeResult ? (
                <div className="p-8 space-y-6">
                  <div className="p-5 bg-slate-50 rounded-3xl border border-slate-100 grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Harga Perolehan</p>
                      <p className="text-sm font-black text-slate-900">{formatCurrency(selectedAssetForDisposal.purchase_price)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Akumulasi Penyusutan</p>
                      <p className="text-sm font-black text-rose-500">-{formatCurrency(selectedAssetForDisposal.accumulated_depreciation || 0)}</p>
                    </div>
                    <div className="col-span-2 border-t border-slate-200 pt-4">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Nilai Buku Saat Ini (NBV)</p>
                      <p className="text-xl font-black text-emerald-600">{formatCurrency(selectedAssetForDisposal.current_book_value || 0)}</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Harga Jual Aktual (Rp)</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-400 text-sm">Rp</span>
                        <input
                          type="text"
                          value={formatThousand(disposalForm.salePrice)}
                          onChange={e => setDisposalForm({...disposalForm, salePrice: parseNumber(e.target.value)})}
                          className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl pl-10 pr-4 py-4 font-black text-slate-900 focus:border-emerald-500 outline-none text-right"
                        />
                      </div>
                      {(() => {
                        const sp = parseFloat(disposalForm.salePrice.replace(/\./g, '')) || 0
                        const bv = selectedAssetForDisposal.current_book_value || 0
                        const gl = sp - bv
                        if (sp === 0) return null
                        return (
                          <p className={`text-xs font-black px-1 ${gl >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {gl >= 0 ? `🟢 Keuntungan Pelepasan: +${formatCurrency(gl)}` : `🔴 Kerugian Pelepasan: ${formatCurrency(gl)}`}
                          </p>
                        )
                      })()}
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Tanggal Penjualan</label>
                      <input
                        type="date"
                        value={disposalForm.saleDate}
                        onChange={e => setDisposalForm({...disposalForm, saleDate: e.target.value})}
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 font-bold text-slate-900 focus:border-emerald-500 outline-none"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Masuk ke Rekening (Kas/Bank)</label>
                      <select
                        value={disposalForm.cashAccountId}
                        onChange={e => setDisposalForm({...disposalForm, cashAccountId: e.target.value})}
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 font-bold text-slate-900 focus:border-emerald-500 outline-none appearance-none"
                      >
                        <option value="">-- Pilih Rekening Tujuan --</option>
                        {cashAccounts.map((a: any) => (
                          <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Keterangan / Deskripsi Jurnal</label>
                      <input
                        type="text"
                        value={disposalForm.notes}
                        onChange={e => setDisposalForm({...disposalForm, notes: e.target.value})}
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 font-medium text-slate-900 focus:border-emerald-500 outline-none"
                      />
                    </div>
                  </div>

                  <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl flex gap-3">
                    <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-[10px] font-bold text-amber-700">Sistem akan otomatis membuat Jurnal Pelepasan: hapus nilai bruto aset, hapus akumulasi penyusutan, catat penerimaan kas, dan booking Keuntungan/Kerugian ke akun yang sesuai.</p>
                  </div>

                  <div className="flex gap-4">
                    <button onClick={() => setShowDisposeModal(false)} className="flex-1 py-4 bg-slate-100 text-slate-600 font-black rounded-3xl hover:bg-slate-200 transition-all">Batal</button>
                    <button
                      onClick={handleDispose}
                      disabled={disposeLoading}
                      className="flex-[2] py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-3xl shadow-xl shadow-emerald-200 transition-all active:scale-95 disabled:opacity-50"
                    >
                      {disposeLoading ? 'Memproses Jurnal...' : 'Konfirmasi & Terbitkan Jurnal'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-8 space-y-6 text-center">
                  <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto">
                    <DollarSign size={40} className="text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 mb-1">Pelepasan Aset Berhasil!</h3>
                    <p className="text-sm text-slate-500">Jurnal akuntansi telah diposting secara otomatis.</p>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="p-4 bg-slate-50 rounded-2xl">
                      <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Nilai Buku</p>
                      <p className="text-sm font-black text-slate-700">{formatCurrency(disposeResult.bookValue)}</p>
                    </div>
                    <div className="p-4 bg-emerald-50 rounded-2xl">
                      <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Harga Jual</p>
                      <p className="text-sm font-black text-emerald-700">{formatCurrency(disposeResult.salePrice)}</p>
                    </div>
                    <div className={`p-4 rounded-2xl ${disposeResult.gainLoss >= 0 ? 'bg-emerald-50' : 'bg-rose-50'}`}>
                      <p className="text-[10px] font-black text-slate-400 uppercase mb-1">{disposeResult.gainLoss >= 0 ? 'Keuntungan' : 'Kerugian'}</p>
                      <p className={`text-sm font-black ${disposeResult.gainLoss >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{formatCurrency(Math.abs(disposeResult.gainLoss))}</p>
                    </div>
                  </div>
                  <button onClick={() => setShowDisposeModal(false)} className="w-full py-4 bg-slate-900 text-white font-black rounded-3xl hover:bg-slate-700 transition-all">
                    Tutup
                  </button>
                </div>
              )}
           </div>
        </div>
      )}
    </div>
  )
}
