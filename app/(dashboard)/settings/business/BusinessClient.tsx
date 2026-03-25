'use client'

import React, { useState } from 'react'
import { Settings, Save, Fingerprint, Building, Receipt, FileText } from 'lucide-react'
import { updateOrgSettings } from '@/modules/organization/actions/org.actions'

export default function BusinessClient({ orgId, initialSettings }: { orgId: string, initialSettings: any }) {
  const [settings, setSettings] = useState(initialSettings || {})
  const [loading, setLoading] = useState(false)

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    
    // Combine existing settings with the new prefix settings
    const formData = new FormData(e.currentTarget)
    const newSettings = {
      ...settings,
      brand_name: formData.get('brand_name') || '',
      company_address: formData.get('company_address') || '',
      hotline: formData.get('hotline') || '',
      email: formData.get('email') || '',
      website: formData.get('website') || '',
      emp_format: formData.get('emp_format') || 'EMP{MM}{YY}{0000}',
      po_format: formData.get('po_format') || 'PO-{YYYY}{MM}-{0000}',
      so_format: formData.get('so_format') || 'SO/{YY}/{MM}/{000}',
      inv_format: formData.get('inv_format') || 'INV/NIZ/{YYYY}/{0000}',
    }

    const res = await updateOrgSettings(orgId, { settings: newSettings })
    if (res.error) alert(res.error)
    else {
      setSettings(newSettings)
      alert('Pengaturan Bisnis berhasil disimpan!')
    }
    setLoading(false)
  }

  return (
    <div className="flex flex-col gap-8 w-full max-w-4xl mx-auto pb-20">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
          <Settings className="text-slate-600" size={32} />
          Pengaturan Bisnis
        </h1>
        <p className="text-sm text-slate-500 font-medium">Konfigurasi format penomoran (ID) untuk seluruh dokumen dan master data di NIZAM.</p>
      </div>

      <form onSubmit={handleSave} className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-8 space-y-10">
        
        <div className="space-y-6">
           <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">Informasi Profil Bisnis</h3>
           <p className="text-xs text-slate-500 mb-6">Informasi ini akan ditampilkan otomatis sebagai kop header di setiap dokumen cetak (Invoice, Surat Jalan, PO, dll).</p>
           
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="space-y-1">
                 <label className="text-[10px] uppercase font-bold text-slate-400">Nama Brand / Merk Dagang</label>
                 <input name="brand_name" defaultValue={settings.brand_name || ''} placeholder="Contoh: Toko Maju Jaya" className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl outline-none focus:border-blue-500" />
              </div>
              <div className="space-y-1">
                 <label className="text-[10px] uppercase font-bold text-slate-400">Hotline / WhatsApp</label>
                 <input name="hotline" defaultValue={settings.hotline || ''} placeholder="081234567890" className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl outline-none focus:border-blue-500" />
              </div>
              <div className="space-y-1">
                 <label className="text-[10px] uppercase font-bold text-slate-400">Email Utama (CS/Sales)</label>
                 <input name="email" type="email" defaultValue={settings.email || ''} placeholder="sales@tokomajujaya.com" className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl outline-none focus:border-blue-500" />
              </div>
              <div className="space-y-1">
                 <label className="text-[10px] uppercase font-bold text-slate-400">Website</label>
                 <input name="website" defaultValue={settings.website || ''} placeholder="www.tokomajujaya.com" className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl outline-none focus:border-blue-500" />
              </div>
              <div className="space-y-1 md:col-span-2">
                 <label className="text-[10px] uppercase font-bold text-slate-400">Alamat Lengkap Perusahaan</label>
                 <textarea name="company_address" defaultValue={settings.company_address || ''} placeholder="Cth: Jl. Sudirman No 123, Jakarta" className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl outline-none focus:border-blue-500 min-h-[80px]" />
              </div>
           </div>
        </div>

        {/* Format Penomoran Section */}
        <div className="space-y-6">
           <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">Format Penomoran & Identitas Auto-Generate</h3>
           <p className="text-xs text-slate-500 mb-6">Tentukan format penomoran menggunakan variabel. Variabel yang didukung: <code className="bg-slate-100 text-blue-600 px-1 py-0.5 rounded">{"{YYYY}"}</code>, <code className="bg-slate-100 text-blue-600 px-1 py-0.5 rounded">{"{YY}"}</code>, <code className="bg-slate-100 text-blue-600 px-1 py-0.5 rounded">{"{MM}"}</code>, <code className="bg-slate-100 text-blue-600 px-1 py-0.5 rounded">{"{DD}"}</code>. Gunakan variabel nol untuk nomor urut, contoh: <code className="bg-slate-100 text-blue-600 px-1 py-0.5 rounded">{"{0000}"}</code> untuk 4 digit.</p>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              
              {/* HRIS */}
              <div className="space-y-4 p-6 bg-slate-50 rounded-2xl border border-slate-100 hover:border-blue-200 transition">
                 <h4 className="flex items-center gap-2 text-sm font-bold text-slate-700">
                    <Fingerprint size={16} className="text-blue-500" /> NIK Karyawan (HRIS)
                 </h4>
                 <div className="space-y-1">
                   <label className="text-[10px] uppercase font-bold text-slate-400">Format String</label>
                   <input name="emp_format" defaultValue={settings.emp_format || 'EMP{MM}{YY}{0000}'} placeholder="EMP{MM}{YY}{0000}" className="w-full px-4 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-blue-500" />
                 </div>
              </div>

              {/* Purchasing */}
              <div className="space-y-4 p-6 bg-slate-50 rounded-2xl border border-slate-100 hover:border-amber-200 transition">
                 <h4 className="flex items-center gap-2 text-sm font-bold text-slate-700">
                    <Building size={16} className="text-amber-500" /> Purchase Order (PO)
                 </h4>
                 <div className="space-y-1">
                   <label className="text-[10px] uppercase font-bold text-slate-400">Format String</label>
                   <input name="po_format" defaultValue={settings.po_format || 'PO-{YYYY}{MM}-{0000}'} placeholder="PO-{YYYY}{MM}-{0000}" className="w-full px-4 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-amber-500" />
                 </div>
              </div>

              {/* Sales Order */}
              <div className="space-y-4 p-6 bg-slate-50 rounded-2xl border border-slate-100 hover:border-emerald-200 transition">
                 <h4 className="flex items-center gap-2 text-sm font-bold text-slate-700">
                    <FileText size={16} className="text-emerald-500" /> Sales Order (SO)
                 </h4>
                 <div className="space-y-1">
                   <label className="text-[10px] uppercase font-bold text-slate-400">Format String</label>
                   <input name="so_format" defaultValue={settings.so_format || 'SO/{YY}/{MM}/{000}'} placeholder="SO/{YY}/{MM}/{000}" className="w-full px-4 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-emerald-500" />
                 </div>
              </div>

              {/* Invoice */}
              <div className="space-y-4 p-6 bg-slate-50 rounded-2xl border border-slate-100 hover:border-purple-200 transition">
                 <h4 className="flex items-center gap-2 text-sm font-bold text-slate-700">
                    <Receipt size={16} className="text-purple-500" /> Invoice
                 </h4>
                 <div className="space-y-1">
                   <label className="text-[10px] uppercase font-bold text-slate-400">Format String</label>
                   <input name="inv_format" defaultValue={settings.inv_format || 'INV/NIZ/{YYYY}/{0000}'} placeholder="INV/NIZ/{YYYY}/{0000}" className="w-full px-4 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-purple-500" />
                 </div>
              </div>
           </div>
        </div>

        <div className="flex justify-end pt-6 border-t border-slate-100">
           <button type="submit" disabled={loading} className="flex items-center gap-2 px-8 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition shadow-lg disabled:opacity-50">
             <Save size={18}/>
             {loading ? 'Menyimpan...' : 'Simpan Pengaturan'}
           </button>
        </div>
      </form>
    </div>
  )
}
