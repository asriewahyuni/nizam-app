'use client'

import { useState, useTransition } from 'react'
import {
  CheckCircle2,
  Key,
  MessageCircle,
  Send,
  ShieldCheck,
} from 'lucide-react'
import type { TenantWhatsappConfig } from '@/modules/notifications/whatsapp-settings.server'

export function LmsWhatsappSettingsForm({
  orgId,
  initialConfig,
  onSaveAction,
  onSendTestWhatsappAction,
}: {
  orgId: string
  initialConfig: TenantWhatsappConfig
  onSaveAction: (orgId: string, config: TenantWhatsappConfig) => Promise<{ success?: boolean; error?: string }>
  onSendTestWhatsappAction: (orgId: string, targetPhone: string) => Promise<{ success?: boolean; error?: string }>
}) {
  const [config, setConfig] = useState<TenantWhatsappConfig>(initialConfig)
  const [testPhone, setTestPhone] = useState('')
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
        setMessage({ type: 'success', text: 'Pengaturan notifikasi WhatsApp berhasil disimpan!' })
      }
    })
  }

  const handleSendTest = (e: React.FormEvent) => {
    e.preventDefault()
    setTestMessage(null)
    startTransition(async () => {
      const res = await onSendTestWhatsappAction(orgId, testPhone)
      if (res.error) {
        setTestMessage({ type: 'error', text: res.error })
      } else {
        setTestMessage({ type: 'success', text: `Pesan uji coba berhasil dikirim ke ${testPhone}!` })
      }
    })
  }

  return (
    <div className="space-y-8 font-sans">
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
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 text-indigo-600 font-bold mb-1">
            <MessageCircle size={20} />
            <h2 className="text-lg text-slate-900">Provider WhatsApp</h2>
          </div>
          <p className="text-xs text-slate-500 mb-6">
            Nizam mengirim notifikasi WhatsApp (order pending, lunas, akses kelas aktif, refund, komisi afiliasi) lewat{' '}
            <a href="https://dripsender.id" target="_blank" rel="noreferrer" className="text-indigo-600 underline">dripsender.id</a>.
            Setiap organisasi memakai akun Dripsender masing-masing.
          </p>

          <label className="flex items-center justify-between p-3.5 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition cursor-pointer mb-6">
            <div className="flex items-center gap-2.5">
              <ShieldCheck size={18} className="text-emerald-600" />
              <div>
                <span className="font-bold text-slate-900 text-sm block">Aktifkan Notifikasi WhatsApp</span>
                <span className="text-xs text-slate-500">Kalau dimatikan, semua pengiriman WhatsApp otomatis akan ditolak (email tetap jalan).</span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
              className="h-5 w-5 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
            />
          </label>

          <div>
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1">
              <Key size={13} />
              API Key Dripsender
            </label>
            <input
              type="password"
              placeholder="Masukkan API key dari dashboard dripsender.id"
              value={config.dripsenderApiKey}
              onChange={(e) => setConfig({ ...config, dripsenderApiKey: e.target.value })}
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-mono focus:border-indigo-500 focus:outline-none"
            />
            <p className="mt-1.5 text-xs text-slate-400">Disimpan terenkripsi, khusus untuk organisasi ini.</p>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-md hover:bg-indigo-700 transition cursor-pointer disabled:opacity-50"
          >
            {isPending ? 'Menyimpan...' : 'Simpan Pengaturan WhatsApp'}
          </button>
        </div>
      </form>

      <div className="rounded-2xl border border-slate-200 bg-slate-900 text-white p-6 shadow-xl">
        <div className="flex items-center gap-2 font-bold mb-1 text-emerald-400">
          <Send size={18} />
          <h2 className="text-lg text-white">Uji Coba Pengiriman WhatsApp</h2>
        </div>
        <p className="text-xs text-slate-300 mb-4">
          Pastikan API key Dripsender terpasang benar sebelum dipakai untuk notifikasi ke pembeli. Simpan pengaturan dulu sebelum uji coba.
        </p>

        {testMessage && (
          <div className={`mb-4 p-3.5 rounded-xl border text-xs font-semibold ${testMessage.type === 'success' ? 'bg-emerald-950 border-emerald-500/40 text-emerald-300' : 'bg-rose-950 border-rose-500/40 text-rose-300'}`}>
            {testMessage.text}
          </div>
        )}

        <form onSubmit={handleSendTest} className="flex flex-col sm:flex-row gap-3">
          <input
            type="tel"
            placeholder="Nomor WhatsApp tujuan uji coba, mis. 6281234567890"
            value={testPhone}
            onChange={(e) => setTestPhone(e.target.value)}
            required
            className="flex-1 rounded-xl bg-white/10 border border-white/20 px-4 py-2.5 text-sm text-white placeholder-slate-400 focus:border-emerald-400 focus:outline-none"
          />
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-bold text-slate-950 hover:bg-emerald-400 transition cursor-pointer disabled:opacity-50 shrink-0"
          >
            <MessageCircle size={16} />
            <span>{isPending ? 'Mengirim...' : 'Kirim Test WhatsApp'}</span>
          </button>
        </form>
      </div>
    </div>
  )
}
