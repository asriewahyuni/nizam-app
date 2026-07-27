'use client'

import { useState, useTransition } from 'react'
import {
  CheckCircle2,
  Key,
  Mail,
  Send,
  Server,
  ShieldCheck,
  Sparkles,
  Sliders,
} from 'lucide-react'
import type { TenantEmailConfig } from '@/modules/notifications/email-settings.server'

export function LmsEmailSettingsForm({
  orgId,
  initialConfig,
  onSaveAction,
  onSendTestEmailAction,
}: {
  orgId: string
  initialConfig: TenantEmailConfig
  onSaveAction: (orgId: string, config: TenantEmailConfig) => Promise<{ success?: boolean; error?: string }>
  onSendTestEmailAction: (orgId: string, targetEmail: string) => Promise<{ success?: boolean; error?: string }>
}) {
  const [config, setConfig] = useState<TenantEmailConfig>(initialConfig)
  const [testEmail, setTestEmail] = useState('')
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [testMessage, setTestMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)
    startTransition(async () => {
      const res = await onSaveAction(orgId, config)
      if (res.error) {
        setMessage({ type: 'error', text: res.error })
      } else {
        setMessage({ type: 'success', text: 'Pengaturan notifikasi email & provider berhasil disimpan!' })
      }
    })
  }

  const handleSendTestEmail = (e: React.FormEvent) => {
    e.preventDefault()
    setTestMessage(null)
    startTransition(async () => {
      const res = await onSendTestEmailAction(orgId, testEmail)
      if (res.error) {
        setTestMessage({ type: 'error', text: res.error })
      } else {
        setTestMessage({ type: 'success', text: `Email uji coba berhasil dikirim ke ${testEmail}!` })
      }
    })
  }

  return (
    <div className="space-y-8 font-sans">
      {/* Alert Notification */}
      {message && (
        <div className={`p-4 rounded-xl border text-sm font-semibold flex items-center justify-between shadow-sm ${message.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} />
            <span>{message.text}</span>
          </div>
          <button type="button" onClick={() => setMessage(null)} className="text-xs underline cursor-pointer">Tutup</button>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-8">
        {/* Section 1: Provider Email */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 text-indigo-600 font-bold mb-1">
            <Server size={20} />
            <h2 className="text-lg text-slate-900">Provider &amp; Server Pengiriman Email</h2>
          </div>
          <p className="text-xs text-slate-500 mb-6">
            Pilih metode pengiriman email otomatis. Anda dapat menggunakan Mailketing API bawaan atau mengkonfigurasi server SMTP Custom milik organisasi Anda.
          </p>

          {/* Provider Selection */}
          <div className="grid sm:grid-cols-2 gap-4 mb-6">
            <label className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition ${config.provider === 'MAILKETING' ? 'border-indigo-600 bg-indigo-50/50 shadow-sm' : 'border-slate-200 hover:bg-slate-50'}`}>
              <input
                type="radio"
                name="provider"
                checked={config.provider === 'MAILKETING'}
                onChange={() => setConfig({ ...config, provider: 'MAILKETING' })}
                className="mt-1 text-indigo-600 focus:ring-indigo-500"
              />
              <div>
                <span className="font-bold text-slate-900 block text-sm">Mailketing API (Standar Nizam)</span>
                <span className="text-xs text-slate-500">Layanan email blast &amp; transaksi terintegrasi berkecepatan tinggi.</span>
              </div>
            </label>

            <label className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition ${config.provider === 'SMTP' ? 'border-indigo-600 bg-indigo-50/50 shadow-sm' : 'border-slate-200 hover:bg-slate-50'}`}>
              <input
                type="radio"
                name="provider"
                checked={config.provider === 'SMTP'}
                onChange={() => setConfig({ ...config, provider: 'SMTP' })}
                className="mt-1 text-indigo-600 focus:ring-indigo-500"
              />
              <div>
                <span className="font-bold text-slate-900 block text-sm">Custom SMTP Server</span>
                <span className="text-xs text-slate-500">Gunakan server email / Google Workspace / cPanel milik domain sendiri.</span>
              </div>
            </label>
          </div>

          {/* Pengirim (From Header) */}
          <div className="grid sm:grid-cols-2 gap-4 border-t border-slate-100 pt-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Nama Pengirim (From Name)</label>
              <input
                type="text"
                value={config.fromName}
                onChange={(e) => setConfig({ ...config, fromName: e.target.value })}
                required
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Email Pengirim (From Email)</label>
              <input
                type="email"
                value={config.fromEmail}
                onChange={(e) => setConfig({ ...config, fromEmail: e.target.value })}
                required
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Form SMTP Detail jika SMTP dipilih */}
          {config.provider === 'SMTP' && (
            <div className="mt-6 space-y-4 border-t border-slate-100 pt-5 bg-slate-50/70 p-4 rounded-xl border">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Kredensial Server SMTP Custom</h3>

              <div className="grid sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">SMTP Host</label>
                  <input
                    type="text"
                    placeholder="mail.domainanda.com atau smtp.gmail.com"
                    value={config.smtpHost}
                    onChange={(e) => setConfig({ ...config, smtpHost: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-indigo-500 focus:outline-none bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Port</label>
                  <input
                    type="number"
                    value={config.smtpPort}
                    onChange={(e) => setConfig({ ...config, smtpPort: Number(e.target.value) })}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-indigo-500 focus:outline-none bg-white"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Username SMTP</label>
                  <input
                    type="text"
                    value={config.smtpUser}
                    onChange={(e) => setConfig({ ...config, smtpUser: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-indigo-500 focus:outline-none bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Password SMTP</label>
                  <input
                    type="password"
                    placeholder="••••••••••••"
                    value={config.smtpPass}
                    onChange={(e) => setConfig({ ...config, smtpPass: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-indigo-500 focus:outline-none bg-white"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Section 2: Triggers Notifikasi Otomatis */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 text-indigo-600 font-bold mb-1">
            <Sliders size={20} />
            <h2 className="text-lg text-slate-900">Pengaturan Triggers Email Otomatis</h2>
          </div>
          <p className="text-xs text-slate-500 mb-6">
            Aktifkan atau nonaktifkan pengiriman email otomatis sesuai dengan event pembelajaran dan transaksi.
          </p>

          <div className="space-y-4">
            <label className="flex items-center justify-between p-3.5 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition cursor-pointer">
              <div>
                <span className="font-bold text-slate-900 text-sm block">📦 Pesanan Baru &amp; Instruksi Bayar</span>
                <span className="text-xs text-slate-500">Kirim email ke pembeli saat checkout berhasil dibuat (menunggu pembayaran).</span>
              </div>
              <input
                type="checkbox"
                checked={config.triggers.orderCreated}
                onChange={(e) => setConfig({ ...config, triggers: { ...config.triggers, orderCreated: e.target.checked } })}
                className="h-5 w-5 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between p-3.5 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition cursor-pointer">
              <div>
                <span className="font-bold text-slate-900 text-sm block">🎓 Pembayaran Sukses &amp; Akses Kelas Terbuka</span>
                <span className="text-xs text-slate-500">Kirim email konfirmasi dan tombol akses masuk kelas saat pembayaran lunas.</span>
              </div>
              <input
                type="checkbox"
                checked={config.triggers.orderPaid}
                onChange={(e) => setConfig({ ...config, triggers: { ...config.triggers, orderPaid: e.target.checked } })}
                className="h-5 w-5 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between p-3.5 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition cursor-pointer">
              <div>
                <span className="font-bold text-slate-900 text-sm block">🔑 Tautan Klaim Akun Pengunjung (*Guest Claim*)</span>
                <span className="text-xs text-slate-500">Kirim tautan sekali pakai untuk pembeli tamu yang baru mendaftar tanpa login.</span>
              </div>
              <input
                type="checkbox"
                checked={config.triggers.accountClaim}
                onChange={(e) => setConfig({ ...config, triggers: { ...config.triggers, accountClaim: e.target.checked } })}
                className="h-5 w-5 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between p-3.5 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition cursor-pointer">
              <div>
                <span className="font-bold text-slate-900 text-sm block">🏆 Sertifikat Kelulusan Terbit</span>
                <span className="text-xs text-slate-500">Kirim pemberitahuan dan tautan unduh saat peserta lulus kelas.</span>
              </div>
              <input
                type="checkbox"
                checked={config.triggers.certificateIssued}
                onChange={(e) => setConfig({ ...config, triggers: { ...config.triggers, certificateIssued: e.target.checked } })}
                className="h-5 w-5 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between p-3.5 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition cursor-pointer">
              <div>
                <span className="font-bold text-slate-900 text-sm block">💸 Notifikasi Komisi &amp; Pencairan Afiliasi</span>
                <span className="text-xs text-slate-500">Kirim notifikasi ke mitra afiliasi saat transaksi referensi berhasil atau komisi dicairkan.</span>
              </div>
              <input
                type="checkbox"
                checked={config.triggers.affiliatePayout}
                onChange={(e) => setConfig({ ...config, triggers: { ...config.triggers, affiliatePayout: e.target.checked } })}
                className="h-5 w-5 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
            </label>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-md hover:bg-indigo-700 transition cursor-pointer disabled:opacity-50"
          >
            {isPending ? 'Menyimpan...' : 'Simpan Pengaturan Email'}
          </button>
        </div>
      </form>

      {/* Section 3: Form Kirim Email Uji Coba (Test Email) */}
      <div className="rounded-2xl border border-slate-200 bg-slate-900 text-white p-6 shadow-xl">
        <div className="flex items-center gap-2 font-bold mb-1 text-emerald-400">
          <Send size={18} />
          <h2 className="text-lg text-white">Uji Coba Pengiriman Email (Test Email)</h2>
        </div>
        <p className="text-xs text-slate-300 mb-4">
          Pastikan kredensial SMTP atau Mailketing terpasang dengan benar sebelum digunakan pada publik.
        </p>

        {testMessage && (
          <div className={`mb-4 p-3.5 rounded-xl border text-xs font-semibold ${testMessage.type === 'success' ? 'bg-emerald-950 border-emerald-500/40 text-emerald-300' : 'bg-rose-950 border-rose-500/40 text-rose-300'}`}>
            {testMessage.text}
          </div>
        )}

        <form onSubmit={handleSendTestEmail} className="flex flex-col sm:flex-row gap-3">
          <input
            type="email"
            placeholder="Masukkan alamat email penerima uji coba..."
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            required
            className="flex-1 rounded-xl bg-white/10 border border-white/20 px-4 py-2.5 text-sm text-white placeholder-slate-400 focus:border-emerald-400 focus:outline-none"
          />
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-bold text-slate-950 hover:bg-emerald-400 transition cursor-pointer disabled:opacity-50 shrink-0"
          >
            <Mail size={16} />
            <span>{isPending ? 'Mengirim...' : 'Kirim Test Email'}</span>
          </button>
        </form>
      </div>
    </div>
  )
}
