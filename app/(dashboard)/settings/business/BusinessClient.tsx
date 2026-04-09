'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { Settings, Save, Fingerprint, Building, Receipt, FileText, Upload, Check, AlertCircle, Plus, Trash2, Link as LinkIcon, Copy, X, Key, ShieldCheck, Clock, Zap, RotateCcw } from 'lucide-react'
import { updateOrgSettings, uploadLogo, checkSlugAvailability } from '@/modules/organization/actions/org.actions'
import { resetOrganizationData, type ResetOrganizationMode } from '@/modules/settings/actions/audit.actions'
import { motion, AnimatePresence } from 'framer-motion'

type BusinessSettingsMap = Record<string, string | number | boolean | null | undefined>
type BusinessProfile = {
  name?: string
  slug?: string
  logo_url?: string | null
  settings?: BusinessSettingsMap
}

export default function BusinessClient({ 
  orgId, 
  currentRole,
  initialSettings,
  baseUrl,
}: { 
  orgId: string, 
  currentRole: string,
  initialSettings: BusinessProfile
  baseUrl: string
}) {
  const [settings, setSettings] = useState<BusinessSettingsMap>(initialSettings?.settings || {})
  const [currentSlug, setCurrentSlug] = useState(initialSettings?.slug || '')
  const [loading, setLoading] = useState(false)
  const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle')
  const [isResetModalOpen, setIsResetModalOpen] = useState(false)
  const [resetMode, setResetMode] = useState<ResetOrganizationMode>('transactions')
  const [resetConfirmation, setResetConfirmation] = useState('')


  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    
    const formData = new FormData(e.currentTarget)
    const newSlug = (formData.get('slug') as string)?.toLowerCase().replace(/[^a-z0-9-]/g, '-')
    
    const newSettings = {
      ...settings,
      brand_name: (formData.get('brand_name') as string) || '',
      company_address: (formData.get('company_address') as string) || '',
      hotline: (formData.get('hotline') as string) || '',
      email: (formData.get('email') as string) || '',
      website: (formData.get('website') as string) || '',
      emp_format: (formData.get('emp_format') as string) || 'EMP{MM}{YY}{0000}',
      po_format: (formData.get('po_format') as string) || 'PO-{YYYY}{MM}-{0000}',
      so_format: (formData.get('so_format') as string) || 'SO/{YY}/{MM}/{000}',
      inv_format: (formData.get('inv_format') as string) || 'INV/NIZ/{YYYY}/{0000}',
    }
    
    const logoUrl = formData.get('logo_url') as string

    const res = await updateOrgSettings(orgId, { 
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

  const expectedResetConfirmation = resetMode === 'all_data'
    ? (initialSettings?.name || '').trim()
    : 'RESET TRANSAKSI'

  const handleResetOrganizationData = async () => {
    if (currentRole !== 'owner') {
      alert('Hanya owner yang dapat menjalankan reset data organisasi.')
      return
    }

    if (resetConfirmation.trim() !== expectedResetConfirmation) {
      alert(`Konfirmasi belum cocok. Ketik "${expectedResetConfirmation}" untuk melanjutkan.`)
      return
    }

    setLoading(true)
    const res = await resetOrganizationData(orgId, {
      mode: resetMode,
      confirmationText: resetConfirmation.trim(),
    })

    const resetResult = res as { success?: boolean; error?: string; message?: string }
    if (!resetResult.success) {
      alert(resetResult.error)
      setLoading(false)
      return
    }

    alert(resetResult.message || 'Reset data selesai.')
    setIsResetModalOpen(false)
    setResetConfirmation('')
    window.location.reload()
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

      <div className="rounded-[32px] border border-blue-100 bg-gradient-to-r from-blue-50 via-white to-slate-50 p-6 shadow-lg shadow-blue-100/40">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl space-y-2">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-700">Migrasi & Onboarding</div>
            <h2 className="text-xl font-black tracking-tight text-slate-900">Butuh panduan migrasi client dari Excel atau aplikasi lama?</h2>
            <p className="text-sm font-medium leading-6 text-slate-600">
              Buka pusat migrasi untuk melihat urutan cut-off, checklist onboarding, dan download template Excel yang siap dibagikan ke client.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/settings/business/migration"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-white transition hover:bg-black"
            >
              <FileText size={16} />
              Buka Pusat Migrasi
            </Link>
            <a
              href="/templates/migrasi/NIZAM_Migration_Template.xlsx"
              download
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
            >
              <Upload size={16} />
              Download Template
            </a>
          </div>
        </div>
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
                 <input name="brand_name" defaultValue={String(settings.brand_name ?? initialSettings.name ?? '')} placeholder="Nama Bisnis Anda" className="w-full px-5 py-3 text-sm border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-blue-50 focus:border-blue-500 font-black text-slate-800 bg-white shadow-sm" />
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
                             updateOrgSettings(orgId, { slug: currentSlug }).then(() => {
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
              <input name="hotline" defaultValue={String(settings.hotline ?? '')} placeholder="0812..." className="w-full px-5 py-3 text-sm border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-blue-50 focus:border-blue-500 font-bold" />
           </div>
           <div className="space-y-2">
              <label className="text-[9px] uppercase font-black text-slate-400 tracking-[0.2em] ml-1">Official Email</label>
              <input name="email" type="email" defaultValue={String(settings.email ?? '')} placeholder="hello@company.com" className="w-full px-5 py-3 text-sm border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-blue-50 focus:border-blue-500 font-bold" />
           </div>
           <div className="space-y-2">
              <label className="text-[9px] uppercase font-black text-slate-400 tracking-[0.2em] ml-1">Website</label>
              <input name="website" defaultValue={String(settings.website ?? '')} placeholder="www..." className="w-full px-5 py-3 text-sm border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-blue-50 focus:border-blue-500 font-bold" />
           </div>
           <div className="space-y-2 md:col-span-3">
              <label className="text-[9px] uppercase font-black text-slate-400 tracking-[0.2em] ml-1">Alamat Headquarter</label>
              <textarea name="company_address" defaultValue={String(settings.company_address ?? '')} placeholder="Jl..." className="w-full px-5 py-3 text-sm border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-blue-50 focus:border-blue-500 font-bold min-h-[100px]" />
           </div>
        </div>

        <div className="space-y-8">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2 uppercase italic tracking-tight">
              <Fingerprint size={20} className="text-slate-400" /> Format Kode Dokumen
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-8 bg-slate-50/50 rounded-[32px] border border-slate-100/50 shadow-inner">
            <div className="space-y-2">
              <label className="text-[9px] uppercase font-black text-slate-400 tracking-[0.2em] ml-1">Format NIK Karyawan</label>
              <input
                name="emp_format"
                defaultValue={String(settings.emp_format ?? 'EMP{MM}{YY}{0000}')}
                placeholder="EMP{MM}{YY}{0000}"
                className="w-full px-5 py-3 text-sm border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-blue-50 focus:border-blue-500 font-bold"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[9px] uppercase font-black text-slate-400 tracking-[0.2em] ml-1">Format Purchase Order (PO)</label>
              <input
                name="po_format"
                defaultValue={String(settings.po_format ?? 'PO-{YYYY}{MM}-{0000}')}
                placeholder="PO-{YYYY}{MM}-{0000}"
                className="w-full px-5 py-3 text-sm border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-blue-50 focus:border-blue-500 font-bold"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[9px] uppercase font-black text-slate-400 tracking-[0.2em] ml-1">Format Sales Order (SO)</label>
              <input
                name="so_format"
                defaultValue={String(settings.so_format ?? 'SO/{YY}/{MM}/{000}')}
                placeholder="SO/{YY}/{MM}/{000}"
                className="w-full px-5 py-3 text-sm border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-blue-50 focus:border-blue-500 font-bold"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[9px] uppercase font-black text-slate-400 tracking-[0.2em] ml-1">Format Invoice Umum</label>
              <input
                name="inv_format"
                defaultValue={String(settings.inv_format ?? 'INV/NIZ/{YYYY}/{0000}')}
                placeholder="INV/NIZ/{YYYY}/{0000}"
                className="w-full px-5 py-3 text-sm border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-blue-50 focus:border-blue-500 font-bold"
              />
            </div>

            <div className="md:col-span-2 rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3">
              <p className="text-[11px] font-bold text-indigo-700 leading-relaxed">
                Placeholder yang didukung untuk format: <code>{'{YYYY}'}</code>, <code>{'{YY}'}</code>, <code>{'{MM}'}</code>, <code>{'{DD}'}</code>, dan blok nomor seperti <code>{'{0000}'}</code>.
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-10 border-t border-slate-100 gap-6">
           <button type="submit" disabled={loading} className="flex items-center gap-3 px-12 py-5 bg-slate-900 text-white rounded-[24px] font-black text-[12px] uppercase tracking-[0.2em] hover:bg-black transition-all shadow-2xl shadow-slate-900/20 disabled:opacity-50 active:scale-95">
             <Save size={18}/>
             {loading ? 'Processing...' : 'Simpan Seluruh Pengaturan'}
           </button>
        </div>
      </form>

      <div className="bg-white rounded-[40px] border border-rose-100 shadow-xl shadow-rose-100/40 p-10 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <h3 className="text-lg font-black text-rose-700 uppercase tracking-tight flex items-center gap-3">
              <Zap size={20} />
              Danger Zone
            </h3>
            <p className="text-sm text-slate-500 mt-2 max-w-2xl leading-6">
              Pakai fitur ini jika tim ingin mengulang input dari nol tanpa menghapus organisasi. Reset hanya tersedia untuk owner dan wajib melalui konfirmasi manual.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setResetMode('transactions')
              setResetConfirmation('')
              setIsResetModalOpen(true)
            }}
            disabled={currentRole !== 'owner'}
            className="px-6 py-4 bg-rose-600 text-white rounded-3xl text-xs font-black uppercase tracking-[0.2em] hover:bg-rose-700 transition-all shadow-lg shadow-rose-200 disabled:opacity-50"
          >
            Buka Reset Data
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-6 space-y-3">
            <div className="flex items-center gap-3 text-slate-900 font-black uppercase text-sm tracking-tight">
              <RotateCcw size={18} className="text-blue-600" />
              Reset Transaksi
            </div>
            <p className="text-sm text-slate-500 leading-6">
              Menghapus jurnal, kas/bank, inventory movement, sales, purchasing, payroll run, reimbursement, audit log, approval, dan transaksi operasional lain. Data master utama tetap disimpan.
            </p>
          </div>

          <div className="rounded-[28px] border border-rose-200 bg-rose-50 p-6 space-y-3">
            <div className="flex items-center gap-3 text-rose-700 font-black uppercase text-sm tracking-tight">
              <Zap size={18} />
              Reset Semua Data Operasional
            </div>
            <p className="text-sm text-rose-700/80 leading-6">
              Selain transaksi, mode ini juga menghapus produk, kontak, karyawan, bank account, gudang, fleet master, invitation link, dan master operasional lain. Struktur cabang akan dikembalikan ke satu Unit Utama. Profil bisnis, owner, role, akun, serta billing tetap dipertahankan.
            </p>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isResetModalOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !loading && setIsResetModalOpen(false)}
              className="absolute inset-0 bg-slate-950/70 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              className="relative w-full max-w-2xl rounded-[40px] border border-white/70 bg-white shadow-2xl overflow-hidden"
            >
              <div className="p-8 md:p-10 space-y-8">
                <div className="flex items-start justify-between gap-6">
                  <div className="space-y-2">
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">Reset Data Organisasi</h3>
                    <p className="text-sm text-slate-500 leading-6">
                      Pilih mode reset yang sesuai. Aksi ini tidak bisa di-undo dan hanya dapat dijalankan oleh owner organisasi.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => !loading && setIsResetModalOpen(false)}
                    className="w-11 h-11 rounded-2xl bg-slate-100 text-slate-400 hover:bg-slate-200 transition-all flex items-center justify-center"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setResetMode('transactions')}
                    className={`text-left rounded-[28px] border p-6 transition-all ${
                      resetMode === 'transactions'
                        ? 'border-blue-500 bg-blue-50 shadow-lg shadow-blue-100'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <p className="text-sm font-black text-slate-900 uppercase tracking-tight">Reset Transaksi</p>
                    <p className="text-sm text-slate-500 mt-3 leading-6">
                      Menjaga master data inti seperti produk, kontak, karyawan, rekening, gudang, dan role tetap ada.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setResetMode('all_data')}
                    className={`text-left rounded-[28px] border p-6 transition-all ${
                      resetMode === 'all_data'
                        ? 'border-rose-500 bg-rose-50 shadow-lg shadow-rose-100'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <p className="text-sm font-black text-slate-900 uppercase tracking-tight">Reset Semua Data Operasional</p>
                    <p className="text-sm text-slate-500 mt-3 leading-6">
                      Menghapus transaksi sekaligus master operasional sehingga organisasi terasa kembali ke fase awal, dengan menyisakan satu Unit Utama untuk akun dan konteks dasar organisasi.
                    </p>
                  </button>
                </div>

                <div className="rounded-[28px] border border-amber-200 bg-amber-50 p-6 space-y-3">
                  <p className="text-xs font-black text-amber-700 uppercase tracking-[0.2em]">Konfirmasi Wajib</p>
                  <p className="text-sm text-amber-900 leading-6">
                    {resetMode === 'all_data'
                      ? `Untuk melanjutkan, ketik nama organisasi persis seperti ini: ${initialSettings?.name}`
                      : 'Untuk melanjutkan, ketik persis: RESET TRANSAKSI'}
                  </p>
                  <input
                    value={resetConfirmation}
                    onChange={(e) => setResetConfirmation(e.target.value)}
                    placeholder={expectedResetConfirmation}
                    className="w-full px-5 py-4 rounded-2xl border border-amber-200 bg-white text-sm font-bold outline-none focus:border-amber-500"
                  />
                </div>

                <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-6 space-y-3">
                  <p className="text-xs font-black text-slate-500 uppercase tracking-[0.2em]">Yang Tetap Dipertahankan</p>
                  <p className="text-sm text-slate-700 leading-6">
                    Profil bisnis, slug, owner membership, role, chart of accounts, dan data billing SaaS.
                  </p>
                </div>

                <div className="flex flex-col-reverse md:flex-row md:justify-end gap-4">
                  <button
                    type="button"
                    onClick={() => !loading && setIsResetModalOpen(false)}
                    className="px-6 py-4 rounded-2xl bg-slate-100 text-slate-500 font-black text-xs uppercase tracking-[0.2em] hover:bg-slate-200 transition-all"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleResetOrganizationData}
                    disabled={loading || currentRole !== 'owner'}
                    className={`px-6 py-4 rounded-2xl text-white font-black text-xs uppercase tracking-[0.2em] transition-all shadow-lg disabled:opacity-50 ${
                      resetMode === 'all_data'
                        ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-200'
                        : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'
                    }`}
                  >
                    {loading ? 'Memproses Reset...' : resetMode === 'all_data' ? 'Reset Semua Data Operasional' : 'Reset Transaksi'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
