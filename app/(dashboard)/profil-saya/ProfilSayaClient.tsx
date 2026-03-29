'use client'

import React, { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { Camera, Lock, CheckCircle, AlertCircle, Eye, EyeOff, Phone, User, Briefcase, Shield, X } from 'lucide-react'
import { uploadEmployeeAvatar, updateEmployeeProfile, updateEmployeePasswordSelf } from '@/modules/hris/actions/employee.actions'

interface Props {
  employee: any
  orgId: string
  userName: string
}

export default function ProfilSayaClient({ employee, orgId, userName }: Props) {
  const [avatarPreview, setAvatarPreview] = useState<string | null>(employee?.avatar_url || null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [whatsapp, setWhatsapp] = useState(employee?.whatsapp || '')
  const [saving, setSaving] = useState(false)
  const [pwdSaving, setPwdSaving] = useState(false)
  const [showOldPwd, setShowOldPwd] = useState(false)
  const [showNewPwd, setShowNewPwd] = useState(false)
  const [showConfirmPwd, setShowConfirmPwd] = useState(false)
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  const handleSaveProfile = async () => {
    if (!employee?.id) return showToast('Data karyawan tidak ditemukan.', 'error')
    setSaving(true)

    let avatarUrl = employee?.avatar_url
    if (avatarFile) {
      const res = await uploadEmployeeAvatar(avatarFile, employee.id)
      if (res.error) { showToast('Gagal upload avatar: ' + res.error, 'error'); setSaving(false); return }
      avatarUrl = res.url
    }

    const res = await updateEmployeeProfile(employee.id, { avatar_url: avatarUrl, whatsapp })
    setSaving(false)
    if (res.error) showToast(res.error, 'error')
    else showToast('Profil berhasil disimpan!', 'success')
  }

  const handleChangePassword = async () => {
    if (!employee?.id) return showToast('Data karyawan tidak ditemukan.', 'error')
    if (!newPwd) return showToast('Password baru wajib diisi.', 'error')
    if (newPwd.length < 6) return showToast('Password minimal 6 karakter.', 'error')
    if (newPwd !== confirmPwd) return showToast('Konfirmasi password tidak cocok.', 'error')

    setPwdSaving(true)
    const res = await updateEmployeePasswordSelf(employee.id, newPwd)
    setPwdSaving(false)
    if (res.error) showToast(res.error, 'error')
    else { showToast('Password berhasil diperbarui!', 'success'); setNewPwd(''); setConfirmPwd('') }
  }

  const initials = employee
    ? `${employee.first_name?.[0] || ''}${employee.last_name?.[0] || ''}`.toUpperCase()
    : (userName?.[0] || 'U').toUpperCase()

  return (
    <div className="max-w-2xl mx-auto space-y-8 py-4">

      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Profil Saya</h1>
        <p className="text-sm font-medium text-slate-400 mt-1">Kelola foto profil, kontak, dan keamanan akun Anda</p>
      </div>

      {/* === IDENTITY CARD === */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-[40px] border border-slate-100 shadow-xl shadow-slate-900/5 overflow-hidden">
        <div className="h-2 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />
        <div className="p-10 space-y-8">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center">
              <User size={18} />
            </div>
            <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Identitas & Kontak</h2>
          </div>

          {/* Avatar */}
          <div className="flex flex-col items-center gap-4">
            <button type="button" onClick={() => avatarInputRef.current?.click()} className="relative group">
              <div className="w-28 h-28 rounded-[32px] overflow-hidden shadow-2xl shadow-blue-100 border-4 border-white">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-4xl font-black text-white">
                    {initials}
                  </div>
                )}
              </div>
              <div className="absolute inset-0 bg-black/40 rounded-[32px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                <Camera size={28} className="text-white" />
              </div>
            </button>
            <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
            <div className="text-center">
              <p className="font-black text-lg text-slate-900 tracking-tight">
                {employee ? `${employee.first_name} ${employee.last_name || ''}` : userName}
              </p>
              <p className="text-sm font-bold text-blue-600 uppercase tracking-widest mt-0.5">{employee?.job_title || 'Karyawan'}</p>
              {employee?.nik && <p className="text-[11px] font-black text-slate-300 font-mono tracking-widest mt-1">#{employee.nik}</p>}
            </div>
          </div>

          {/* Employee info display (read-only) */}
          {employee && (
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">Departemen</p>
                <p className="text-sm font-black text-slate-700">{employee.department || 'Umum'}</p>
              </div>
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">Status</p>
                <p className="text-sm font-black text-slate-700">{(employee.employment_status || 'FULL_TIME').replace('_', ' ')}</p>
              </div>
              {employee.email && (
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 col-span-2">
                  <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">Email</p>
                  <p className="text-sm font-black text-slate-700">{employee.email}</p>
                </div>
              )}
            </div>
          )}

          {/* WhatsApp editable */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 flex items-center gap-2">
              <Phone size={12} className="text-emerald-500" /> Nomor WhatsApp
            </label>
            <div className="relative">
              <span className="absolute left-5 top-1/2 -translate-y-1/2 text-lg">📱</span>
              <input
                type="tel"
                value={whatsapp}
                onChange={e => setWhatsapp(e.target.value)}
                placeholder="628123456789 (awali dengan kode negara)"
                className="w-full pl-12 pr-6 py-4 rounded-2xl border border-slate-100 bg-slate-50 text-sm font-black text-slate-700 focus:bg-white focus:border-emerald-500 outline-none transition-all"
              />
            </div>
          </div>

          <button
            onClick={handleSaveProfile}
            disabled={saving}
            className="w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-2 transition-all shadow-xl shadow-blue-200 active:scale-[0.98]"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <CheckCircle size={16} />
            )}
            {saving ? 'Menyimpan...' : 'Simpan Profil'}
          </button>
        </div>
      </motion.div>

      {/* === SECURITY CARD === */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white rounded-[40px] border border-slate-100 shadow-xl shadow-slate-900/5 overflow-hidden">
        <div className="h-2 bg-gradient-to-r from-amber-400 via-orange-400 to-rose-500" />
        <div className="p-10 space-y-8">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center">
              <Shield size={18} />
            </div>
            <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Keamanan Akun</h2>
          </div>

          <div className="space-y-4">
            {[
              { label: 'Password Baru', value: newPwd, setter: setNewPwd, show: showNewPwd, toggle: () => setShowNewPwd(v => !v) },
              { label: 'Konfirmasi Password', value: confirmPwd, setter: setConfirmPwd, show: showConfirmPwd, toggle: () => setShowConfirmPwd(v => !v) },
            ].map((field) => (
              <div key={field.label} className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">{field.label}</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" />
                  <input
                    type={field.show ? 'text' : 'password'}
                    value={field.value}
                    onChange={e => field.setter(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-12 pr-12 py-4 rounded-2xl border border-slate-100 bg-slate-50 text-sm font-black text-slate-700 focus:bg-white focus:border-amber-400 outline-none transition-all"
                  />
                  <button type="button" onClick={field.toggle} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-600">
                    {field.show ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            ))}

            {newPwd && confirmPwd && newPwd !== confirmPwd && (
              <p className="text-[11px] text-rose-500 font-bold flex items-center gap-1.5 ml-1">
                <AlertCircle size={12} /> Password tidak cocok
              </p>
            )}
            {newPwd && newPwd.length < 6 && (
              <p className="text-[11px] text-amber-500 font-bold flex items-center gap-1.5 ml-1">
                <AlertCircle size={12} /> Minimal 6 karakter
              </p>
            )}
          </div>

          <button
            onClick={handleChangePassword}
            disabled={pwdSaving || !newPwd || !confirmPwd}
            className="w-full py-4 rounded-2xl bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-2 transition-all shadow-xl shadow-amber-200 active:scale-[0.98]"
          >
            {pwdSaving ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Lock size={16} />
            )}
            {pwdSaving ? 'Memperbarui...' : 'Ubah Password'}
          </button>

          <p className="text-[11px] text-center text-slate-400 font-medium">
            Password baru akan langsung aktif. Logout dan login kembali jika diminta.
          </p>
        </div>
      </motion.div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-8 right-8 z-[9000] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl border ${
          toast.type === 'success'
            ? 'bg-emerald-50 border-emerald-100 text-emerald-800 shadow-emerald-200/50'
            : 'bg-rose-50 border-rose-100 text-rose-800 shadow-rose-200/50'
        }`}>
          {toast.type === 'success'
            ? <CheckCircle size={22} className="text-emerald-500 shrink-0" />
            : <AlertCircle size={22} className="text-rose-500 shrink-0" />
          }
          <p className="text-sm font-bold">{toast.message}</p>
          <button onClick={() => setToast(null)} className="ml-2 pl-4 border-l border-current opacity-60 hover:opacity-100 transition-opacity">
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  )
}
