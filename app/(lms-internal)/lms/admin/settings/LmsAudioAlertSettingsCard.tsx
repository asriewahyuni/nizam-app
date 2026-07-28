'use client'

import React, { useEffect, useState } from 'react'
import { Volume2, VolumeX } from 'lucide-react'

export default function LmsAudioAlertSettingsCard() {
  const [enabled, setEnabled] = useState(true)

  useEffect(() => {
    const syncEnabled = () => {
      const saved = localStorage.getItem('lms_admin_audio_enabled')
      setEnabled(saved !== 'false')
    }

    syncEnabled()

    window.addEventListener('lms_admin_audio_settings_changed', syncEnabled)
    window.addEventListener('storage', syncEnabled)

    return () => {
      window.removeEventListener('lms_admin_audio_settings_changed', syncEnabled)
      window.removeEventListener('storage', syncEnabled)
    }
  }, [])

  const toggleEnabled = () => {
    const next = !enabled
    setEnabled(next)
    localStorage.setItem('lms_admin_audio_enabled', String(next))
    window.dispatchEvent(new Event('lms_admin_audio_settings_changed'))
  }

  const handleTestAudio = () => {
    window.dispatchEvent(new Event('lms_admin_audio_test'))
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:border-indigo-200">
      <div className="flex items-start sm:items-center gap-3.5">
        <div
          className={`p-2.5 rounded-xl transition ${
            enabled
              ? 'bg-indigo-50 text-indigo-600'
              : 'bg-slate-100 text-slate-400'
          }`}
        >
          {enabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
        </div>
        <div>
          <h2 className="font-bold text-slate-900 text-sm">
            Notifikasi Suara Pesanan &amp; Pembayaran (Audio Alerts)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Aktifkan suara melodi dan notifikasi popup otomatis saat ada pesanan baru atau konfirmasi pembayaran di halaman Admin.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
        <button
          type="button"
          onClick={handleTestAudio}
          title="Uji coba suara dan notifikasi pesanan"
          className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          Tes Suara
        </button>

        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold ${enabled ? 'text-indigo-600' : 'text-slate-400'}`}>
            {enabled ? 'Aktif' : 'Nonaktif'}
          </span>
          <button
            type="button"
            onClick={toggleEnabled}
            role="switch"
            aria-checked={enabled}
            title={
              enabled
                ? 'Notifikasi Suara: AKTIF (Klik untuk nonaktifkan)'
                : 'Notifikasi Suara: BISU (Klik untuk aktifkan)'
            }
            className={`cursor-pointer relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
              enabled ? 'bg-indigo-600' : 'bg-slate-200'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                enabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  )
}
