'use client'

import React, { useState, useEffect } from 'react'
import { Settings, Save, Fingerprint, Building, Receipt, FileText, Upload, ArrowRight, Eye, EyeOff } from 'lucide-react'
import { updateOrgSettings, uploadLogo, checkSlugAvailability } from '@/modules/organization/actions/org.actions'

export default function BusinessClient({ orgId, initialSettings }: { orgId: string, initialSettings: any }) {
  const [settings, setSettings] = useState(initialSettings || {})
  const [currentSlug, setCurrentSlug] = useState(initialSettings?.slug || '')
  const [loading, setLoading] = useState(false)
  const [baseUrl, setBaseUrl] = useState('https://nizam.app')
  const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setBaseUrl(window.location.origin)
    }
  }, [])

  const handleCheckSlug = async (slug: string) => {
    if (!slug || slug === (initialSettings?.slug || '')) {
      setSlugStatus('idle')
      return
    }
    setSlugStatus('checking')
    const res = await checkSlugAvailability(orgId, slug)
    if (res.available) setSlugStatus('available')
    else setSlugStatus('taken')
  }

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    
    // Combine existing settings with the new prefix settings
    const formData = new FormData(e.currentTarget)
    const newSlug = (formData.get('slug') as string)?.toLowerCase().replace(/[^a-z0-9-]/g, '-')
    
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
    
    const logoUrl = formData.get('logo_url') as string

    const res = await (updateOrgSettings as any)(orgId, { 
       settings: newSettings,
       logo_url: logoUrl,
       slug: newSlug
    })
    
    if (res.error) alert(res.error)
    else {
      setSettings(newSettings)
      if (newSlug) setCurrentSlug(newSlug)
      alert('Pengaturan Bisnis berhasil disimpan!')
    }
    setLoading(false)
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    const formData = new FormData()
    formData.append('file', file)

    const res = await uploadLogo(orgId, formData)
    if (res.error) alert(res.error)
    else if (res.url) {
      setSettings((prev: any) => ({ ...prev, logo_url: res.url }))
      alert('Logo berhasil diupload!')
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
        <p className="text-sm text-slate-500 font-medium">Konfigurasi profile bisnis dan format penomoran ID sistem NIZAM.</p>
      </div>

      <form onSubmit={handleSave} className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-8 space-y-10">
        
        <div className="space-y-6">
           <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">Informasi Profil Bisnis</h3>
           
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="space-y-4 md:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 flex flex-col md:flex-row gap-6 items-center">
                 <div className="w-32 h-32 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                    {settings.logo_url ? (
                       <img src={settings.logo_url} alt="Logo" className="w-full h-full object-contain" />
                    ) : (
                       <Building size={32} className="text-slate-300" />
                    )}
                 </div>
                  <div className="flex-1 space-y-4 w-full">
                     <div className="flex flex-col gap-1">
                        <label className="text-[10px] uppercase font-black text-slate-500 tracking-widest leading-none">Logo Perusahaan</label>
                        <p className="text-[10px] text-slate-400 italic">Format transparan (PNG/SVG) direkomendasikan.</p>
                     </div>
                     
                     <div className="flex flex-col sm:flex-row gap-4 items-center">
                        <div className="relative group">
                           <input 
                              type="file" 
                              id="logo-upload" 
                              className="hidden" 
                              accept="image/*" 
                              onChange={handleFileChange}
                              disabled={loading}
                           />
                           <label 
                              htmlFor="logo-upload" 
                              className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-800 cursor-pointer transition-all shadow-lg disabled:opacity-50"
                           >
                              <Upload size={14} />
                              {loading ? "Uploading..." : "Upload File Logo"}
                           </label>
                        </div>
                        
                        <div className="flex-1 w-full space-y-1">
                           <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">Atau Gunakan Link (URL)</label>
                           <input 
                              name="logo_url" 
                              defaultValue={settings.logo_url || ""}
                              onChange={(e) => setSettings({ ...settings, logo_url: e.target.value })}
                              placeholder="https://domain.com/logo.png" 
                              className="w-full px-4 py-2 text-[11px] border border-slate-200 rounded-xl outline-none focus:border-blue-500 font-medium bg-slate-50"
                           />
                        </div>
                     </div>
                  </div>
              </div>

              <div className="space-y-1">
                 <label className="text-[10px] uppercase font-bold text-slate-400">Nama Brand / Merk Dagang</label>
                 <input name="brand_name" defaultValue={settings.brand_name || ''} placeholder="Contoh: Toko Maju Jaya" className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl outline-none focus:border-blue-500 font-bold" />
              </div>

              <div className="space-y-1">
                 <label className="text-[10px] uppercase font-bold text-slate-400">Unique Business Slug (Join URL)</label>
                 <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <div className="flex-1 flex items-center gap-2 bg-white px-4 py-2.5 rounded-xl border border-slate-200 shadow-inner">
                       <span className="text-[10px] font-bold text-slate-300 underline decoration-slate-100">{baseUrl.replace(/^https?:\/\//, '')}/join/</span>
                       <input 
                          name="slug" 
                          defaultValue={currentSlug} 
                          onChange={(e) => {
                             const val = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-')
                             e.target.value = val
                             setSlugStatus('idle')
                          }}
                          placeholder="my-business" 
                          className="flex-1 bg-transparent text-sm outline-none font-black text-blue-600" 
                       />
                    </div>
                    <button 
                       type="button" 
                       onClick={() => {
                          const input = document.querySelector('input[name="slug"]') as HTMLInputElement
                          handleCheckSlug(input.value)
                       }}
                       disabled={slugStatus === 'checking'}
                       className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md active:scale-95 ${
                          slugStatus === 'available' ? 'bg-emerald-500 text-white' :
                          slugStatus === 'taken' ? 'bg-rose-500 text-white' :
                          'bg-slate-900 text-white hover:bg-black'
                       }`}
                    >
                       {slugStatus === 'checking' ? 'Mengecek...' : 
                        slugStatus === 'available' ? '✓ Tersedia' : 
                        slugStatus === 'taken' ? '✗ Digunakan' : 
                        'Cek Ketersediaan'}
                    </button>
                 </div>
                 <p className="text-[9px] text-slate-400 mt-2 italic font-medium">Contoh Link: <span className="text-blue-500 font-bold">{baseUrl}/join/{currentSlug}</span></p>
              </div>

              {/* Activation Link Center */}
              <div className="md:col-span-2 p-6 bg-blue-50 rounded-2xl border border-blue-100 space-y-4">
                 <div className="flex items-center gap-3 text-blue-700">
                    <Fingerprint size={24} />
                    <div>
                       <h4 className="text-sm font-black uppercase tracking-tight leading-none">Pusat Aktivasi Karyawan</h4>
                       <p className="text-[10px] font-bold mt-1 opacity-70 italic tracking-wide">Bagikan link unik ini kepada karyawan baru untuk pendaftaran mandiri.</p>
                    </div>
                 </div>
                 <div className="flex items-center gap-2 bg-white p-2 pl-5 rounded-2xl border border-blue-200 shadow-sm overflow-hidden">
                    <code className="flex-1 text-xs font-black text-slate-600 truncate">{baseUrl}/join/{currentSlug}</code>
                    <button 
                       type="button" 
                       onClick={() => {
                          const fullUrl = `${baseUrl}/join/${currentSlug}`;
                          navigator.clipboard.writeText(fullUrl);
                          alert('Link Aktivasi berhasil disalin!');
                       }}
                       className="px-6 py-3 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-blue-700 transition-all shadow-lg active:scale-90 shrink-0"
                    >
                       Copy Link
                    </button>
                 </div>
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
           <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">Format Penomoran</h3>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4 p-6 bg-slate-50 rounded-2xl border border-slate-100">
                 <h4 className="flex items-center gap-2 text-[11px] font-black text-slate-500 uppercase tracking-widest">
                    <Fingerprint size={16} className="text-blue-500" /> NIK Karyawan (HRIS)
                 </h4>
                 <input name="emp_format" defaultValue={settings.emp_format || 'EMP{MM}{YY}{0000}'} className="w-full px-4 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-blue-500 font-bold" />
              </div>
              <div className="space-y-4 p-6 bg-slate-50 rounded-2xl border border-slate-100">
                 <h4 className="flex items-center gap-2 text-[11px] font-black text-slate-500 uppercase tracking-widest">
                    <Building size={16} className="text-amber-500" /> Purchase Order (PO)
                 </h4>
                 <input name="po_format" defaultValue={settings.po_format || 'PO-{YYYY}{MM}-{0000}'} className="w-full px-4 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-amber-500 font-bold" />
              </div>
              <div className="space-y-4 p-6 bg-slate-50 rounded-2xl border border-slate-100">
                 <h4 className="flex items-center gap-2 text-[11px] font-black text-slate-500 uppercase tracking-widest">
                    <FileText size={16} className="text-emerald-500" /> Sales Order (SO)
                 </h4>
                 <input name="so_format" defaultValue={settings.so_format || 'SO/{YY}/{MM}/{000}'} className="w-full px-4 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-emerald-500 font-bold" />
              </div>
              <div className="space-y-4 p-6 bg-slate-50 rounded-2xl border border-slate-100">
                 <h4 className="flex items-center gap-2 text-[11px] font-black text-slate-500 uppercase tracking-widest">
                    <Receipt size={16} className="text-purple-500" /> Invoice
                 </h4>
                 <input name="inv_format" defaultValue={settings.inv_format || 'INV/NIZ/{YYYY}/{0000}'} className="w-full px-4 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-purple-500 font-bold" />
              </div>
           </div>
        </div>

        <div className="flex justify-end pt-6 border-t border-slate-100">
           <button type="submit" disabled={loading} className="flex items-center gap-2 px-10 py-4 bg-slate-900 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-black transition-all shadow-xl disabled:opacity-50 active:scale-95">
             <Save size={18}/>
             {loading ? 'Menyimpan...' : 'Simpan Pengaturan'}
           </button>
        </div>
      </form>
    </div>
  )
}
