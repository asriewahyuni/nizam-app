'use client'

import React, { useState, useEffect } from 'react'
import { Settings, Save, Fingerprint, Building, Receipt, FileText, Upload, Check, AlertCircle, Plus, Trash2, Link as LinkIcon, Copy, X, Key, ShieldCheck, Clock } from 'lucide-react'
import { updateOrgSettings, uploadLogo, checkSlugAvailability } from '@/modules/organization/actions/org.actions'
import { motion, AnimatePresence } from 'framer-motion'

export default function BusinessClient({ 
  orgId, 
  initialSettings, 
  roles = []
}: { 
  orgId: string, 
  initialSettings: any, 
  roles?: any[]
}) {
  const [settings, setSettings] = useState(initialSettings?.settings || {})
  const [currentSlug, setCurrentSlug] = useState(initialSettings?.slug || '')
  const [loading, setLoading] = useState(false)
  const [baseUrl, setBaseUrl] = useState('https://nizam.app')
  const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle')
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setBaseUrl(window.location.origin)
    }
  }, [])


  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    
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
      setSlugStatus('idle')
      alert('Pengaturan Bisnis berhasil disimpan!')
    }
    setLoading(false)
  }

  return (
    <div className="flex flex-col gap-8 w-full max-w-5xl mx-auto pb-20">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
          <Settings className="text-blue-600" size={32} />
          PROFIL BISNIS
        </h1>
        <p className="text-sm text-slate-500 font-medium">Konfigurasi profile bisnis and system-wide identification formats.</p>
      </div>

      <form onSubmit={handleSave} className="bg-white rounded-[40px] border border-slate-100 shadow-xl shadow-slate-200/50 p-10 space-y-12">
        
        <div className="space-y-8">
           <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="text-lg font-black text-slate-900 flex items-center gap-2 uppercase italic tracking-tight">
                <Building size={20} className="text-slate-400" /> Profil Instansi
              </h3>
           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-3 gap-8 p-10 bg-slate-50/50 rounded-[32px] border border-slate-100/50 shadow-inner">
              <div className="md:col-span-3 bg-white p-8 rounded-3xl border border-slate-200 flex flex-col md:flex-row gap-8 items-center shadow-sm">
                 <div className="w-32 h-32 bg-slate-50 rounded-[28px] border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden shrink-0 shadow-inner group relative">
                    {initialSettings.logo_url ? (
                       <img src={initialSettings.logo_url} alt="Logo" className="w-full h-full object-contain" />
                    ) : (
                       <Building size={32} className="text-slate-300" />
                    )}
                    <label htmlFor="logo-upload" className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center cursor-pointer text-white text-[10px] font-black uppercase tracking-widest">Ganti Logo</label>
                 </div>
                  <div className="flex-1 space-y-6 w-full">
                     <div className="space-y-1">
                        <label className="text-[10px] uppercase font-black text-slate-400 tracking-[0.2em] leading-none">Banner Logo Perusahaan</label>
                        <p className="text-[10px] text-slate-400 italic">Recommended format: Square (1:1) PNG or SVG with transparency.</p>
                     </div>
                     
                     <div className="flex flex-col sm:flex-row gap-4 items-center">
                        <input type="file" id="logo-upload" className="hidden" accept="image/*" onChange={(e) => {
                           const file = e.target.files?.[0];
                           if (file) {
                              const fd = new FormData();
                              fd.append('file', file);
                              uploadLogo(orgId, fd).then(res => {
                                 if (res.error) alert(res.error);
                                 else window.location.reload();
                              });
                           }
                        }} disabled={loading} />
                        
                        <div className="flex-1 w-full space-y-1 group">
                           <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Logo URL Connection</label>
                           <input 
                              name="logo_url" 
                              defaultValue={initialSettings.logo_url || ""}
                              placeholder="https://cloud.com/brand/logo.png" 
                              className="w-full px-5 py-3 text-[11px] border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-blue-50 focus:border-blue-500 font-bold bg-slate-50 transition-all"
                           />
                        </div>
                     </div>
                  </div>
              </div>

              <div className="space-y-2 md:col-span-1">
                 <label className="text-[9px] uppercase font-black text-slate-400 tracking-[0.2em] ml-1">Nama Brand / Merk</label>
                 <input name="brand_name" defaultValue={settings.brand_name || initialSettings.name} placeholder="Nama Bisnis Anda" className="w-full px-5 py-3 text-sm border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-blue-50 focus:border-blue-500 font-black text-slate-800 bg-white shadow-sm" />
              </div>

              <div className="space-y-2 md:col-span-2">
                 <label className="text-[9px] uppercase font-black text-slate-400 tracking-[0.2em] ml-1">Unique Business Identity (Slug)</label>
                 <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
                    <div className="flex-1 min-w-0 flex items-center gap-2 bg-white px-5 py-3 rounded-2xl border border-slate-200 shadow-sm overflow-hidden group focus-within:ring-4 focus-within:ring-blue-50 focus-within:border-blue-500">
                       <span className="text-[10px] font-black text-slate-300 select-none">{baseUrl.replace(/^https?:\/\//, '')}/</span>
                       <input 
                          name="slug" 
                          defaultValue={currentSlug} 
                          onChange={(e) => {
                             const val = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-')
                             e.target.value = val
                             setCurrentSlug(val)
                             setSlugStatus('idle')
                          }}
                          placeholder="shop-name" 
                          className="flex-1 bg-transparent text-sm outline-none font-black text-blue-600 min-w-0" 
                       />
                    </div>
                    {slugStatus === 'available' ? (
                       <button 
                          type="button" 
                          onClick={() => {
                             (updateOrgSettings as any)(orgId, { slug: currentSlug }).then(() => {
                                setSlugStatus('idle');
                                alert('Identitas bisnis berhasil dikunci!');
                             });
                          }}
                          className="px-6 py-3 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg flex items-center gap-2"
                       >
                          <Check size={14} /> Gunakan
                       </button>
                    ) : (
                       <button 
                          type="button" 
                          onClick={() => {
                             if (!currentSlug) return;
                             checkSlugAvailability(orgId, currentSlug).then(res => {
                                setSlugStatus(res.available ? 'available' : 'taken');
                             });
                          }}
                          disabled={!currentSlug || slugStatus === 'checking'}
                          className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 ${
                             slugStatus === 'taken' ? 'bg-rose-500 text-white' : 'bg-slate-900 text-white hover:bg-black'
                          }`}
                       >
                          {slugStatus === 'taken' ? '✗ Terpakai' : 'Cek Ketersediaan'}
                       </button>
                    )}
                 </div>
              </div>
           </div>
        </div>

        {/* CONTACT & ADDRESS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
           <div className="space-y-2">
              <label className="text-[9px] uppercase font-black text-slate-400 tracking-[0.2em] ml-1">WhatsApp Hotline</label>
              <input name="hotline" defaultValue={settings.hotline || ''} placeholder="0812..." className="w-full px-5 py-3 text-sm border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-blue-50 focus:border-blue-500 font-bold" />
           </div>
           <div className="space-y-2">
              <label className="text-[9px] uppercase font-black text-slate-400 tracking-[0.2em] ml-1">Official Email</label>
              <input name="email" type="email" defaultValue={settings.email || ''} placeholder="hello@company.com" className="w-full px-5 py-3 text-sm border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-blue-50 focus:border-blue-500 font-bold" />
           </div>
           <div className="space-y-2">
              <label className="text-[9px] uppercase font-black text-slate-400 tracking-[0.2em] ml-1">Website</label>
              <input name="website" defaultValue={settings.website || ''} placeholder="www..." className="w-full px-5 py-3 text-sm border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-blue-50 focus:border-blue-500 font-bold" />
           </div>
           <div className="space-y-2 md:col-span-3">
              <label className="text-[9px] uppercase font-black text-slate-400 tracking-[0.2em] ml-1">Alamat Headquarter</label>
              <textarea name="company_address" defaultValue={settings.company_address || ''} placeholder="Jl..." className="w-full px-5 py-3 text-sm border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-blue-50 focus:border-blue-500 font-bold min-h-[100px]" />
           </div>
        </div>

        <div className="flex justify-end pt-10 border-t border-slate-100 gap-6">
           <button type="submit" disabled={loading} className="flex items-center gap-3 px-12 py-5 bg-slate-900 text-white rounded-[24px] font-black text-[12px] uppercase tracking-[0.2em] hover:bg-black transition-all shadow-2xl shadow-slate-900/20 disabled:opacity-50 active:scale-95">
             <Save size={18}/>
             {loading ? 'Processing...' : 'Simpan Seluruh Pengaturan'}
           </button>
        </div>
      </form>
    </div>
  )
}
