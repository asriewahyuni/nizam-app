'use client'

import React, { useEffect, useState, useRef, useCallback } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { CheckCircle2, ShoppingBag, X, ExternalLink } from 'lucide-react'
import { checkLmsAdminOrderAlertsAction, type OrderAlertItem } from '@/modules/edu/actions/lms-order-alerts.actions'
import { formatRupiah } from '@/lib/utils'

/**
 * Web Audio API Synth Chimes: Tidak membutuhkan file statis eksternal (.mp3/.wav),
 * instan, tanpa loading, bebas 404, dan terdengar jernih profesional.
 */
function playMelodicChime(type: 'new_order' | 'payment_confirmed') {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()

    if (ctx.state === 'suspended') {
      ctx.resume()
    }

    const now = ctx.currentTime
    const masterGain = ctx.createGain()
    masterGain.gain.setValueAtTime(0.25, now)
    masterGain.connect(ctx.destination)

    if (type === 'new_order') {
      // Arpeggio ceria (Cash Register / New Order Chime: C6 -> E6 -> G6 -> C7)
      const freqs = [1046.50, 1318.51, 1567.98, 2093.00]
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(freq, now + idx * 0.08)

        gain.gain.setValueAtTime(0.3, now + idx * 0.08)
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.45)

        osc.connect(gain)
        gain.connect(masterGain)

        osc.start(now + idx * 0.08)
        osc.stop(now + idx * 0.08 + 0.5)
      })
    } else {
      // Akor sukses / konfirmasi pembayaran (E6 -> G6 + B6 + E7 chord)
      const freqs = [1318.51, 1567.98, 1975.53, 2637.02]
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(freq, now + idx * 0.06)

        gain.gain.setValueAtTime(0.35, now + idx * 0.06)
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.7)

        osc.connect(gain)
        gain.connect(masterGain)

        osc.start(now + idx * 0.06)
        osc.stop(now + idx * 0.06 + 0.75)
      })
    }
  } catch {
    // Abaikan jika peramban tidak mendukung atau audio diblokir sebelum interaksi pertama
  }
}

type ToastNotification = {
  id: string
  type: 'new_order' | 'payment_confirmed'
  title: string
  message: string
  orderNumber: string
  amount: number
}

export default function LmsAdminAudioNotifier({ orgId }: { orgId: string }) {
  const pathname = usePathname()
  const router = useRouter()

  const [enabled, setEnabled] = useState(true)
  const [toasts, setToasts] = useState<ToastNotification[]>([])

  const lastCheckedRef = useRef<string>('')
  const pollingRef = useRef<NodeJS.Timeout | null>(null)

  const testAudio = useCallback(() => {
    playMelodicChime('new_order')
    setTimeout(() => {
      playMelodicChime('payment_confirmed')
    }, 600)

    // Munculkan toast tes sementara
    const testId = `test-${Date.now()}`
    setToasts((prev) => [
      {
        id: testId,
        type: 'new_order',
        title: 'Tes Suara Notifikasi LMS',
        message: 'Pesanan Masuk & Konfirmasi Pembayaran Berhasil!',
        orderNumber: 'ECO-TEST-001',
        amount: 150000,
      },
      ...prev,
    ])

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== testId))
    }, 6000)
  }, [])

  // Baca pengaturan mute dari localStorage & dengarkan event perubahan dari halaman Settings
  useEffect(() => {
    const syncEnabled = () => {
      const saved = localStorage.getItem('lms_admin_audio_enabled')
      setEnabled(saved !== 'false')
    }

    syncEnabled()

    const handleTestAudio = () => {
      testAudio()
    }

    window.addEventListener('lms_admin_audio_settings_changed', syncEnabled)
    window.addEventListener('lms_admin_audio_test', handleTestAudio)
    window.addEventListener('storage', syncEnabled)

    return () => {
      window.removeEventListener('lms_admin_audio_settings_changed', syncEnabled)
      window.removeEventListener('lms_admin_audio_test', handleTestAudio)
      window.removeEventListener('storage', syncEnabled)
    }
  }, [testAudio])

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  const pollAlerts = useCallback(async () => {
    if (!orgId || !pathname.startsWith('/lms/admin')) return

    // Ambil timestamp dari sessionStorage (atau inisialisasi)
    const storedTimestamp = sessionStorage.getItem('lms_admin_alerts_timestamp') || ''

    const res = await checkLmsAdminOrderAlertsAction(orgId, storedTimestamp)
    if (res.serverTime) {
      sessionStorage.setItem('lms_admin_alerts_timestamp', res.serverTime)
      lastCheckedRef.current = res.serverTime
    }

    if (!storedTimestamp) {
      // Pertama kali halaman admin dimuat di sesi ini, jangan picu alert historis
      return
    }

    const newToasts: ToastNotification[] = []

    // Pesanan Baru
    if (res.newOrders && res.newOrders.length > 0) {
      if (enabled) playMelodicChime('new_order')
      res.newOrders.forEach((o) => {
        newToasts.push({
          id: `order-${o.id}-${Date.now()}`,
          type: 'new_order',
          title: 'Pesanan Baru Masuk! 🎉',
          message: `${o.customerName} membuat pesanan #${o.orderNumber}`,
          orderNumber: o.orderNumber,
          amount: o.grandTotal,
        })
      })
    }

    // Konfirmasi Pembayaran
    if (res.confirmedPayments && res.confirmedPayments.length > 0) {
      if (enabled) playMelodicChime('payment_confirmed')
      res.confirmedPayments.forEach((p) => {
        newToasts.push({
          id: `pay-${p.id}-${Date.now()}`,
          type: 'payment_confirmed',
          title: 'Konfirmasi Pembayaran! 💰',
          message: `${p.customerName} (#${p.orderNumber}) terverifikasi lunas`,
          orderNumber: p.orderNumber,
          amount: p.grandTotal,
        })
      })
    }

    if (newToasts.length > 0) {
      setToasts((prev) => [...newToasts, ...prev].slice(0, 4))
      // Otomatis hapus setelah 8 detik
      newToasts.forEach((t) => {
        setTimeout(() => {
          setToasts((prev) => prev.filter((item) => item.id !== t.id))
        }, 8000)
      })
    }
  }, [orgId, pathname, enabled])

  useEffect(() => {
    if (!pathname.startsWith('/lms/admin')) {
      if (pollingRef.current) clearInterval(pollingRef.current)
      return
    }

    // Periksa pertama kali setelah 3 detik, selanjutnya setiap 12 detik
    const initialTimer = setTimeout(() => {
      pollAlerts()
    }, 3000)

    pollingRef.current = setInterval(() => {
      pollAlerts()
    }, 12000)

    return () => {
      clearTimeout(initialTimer)
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [pathname, pollAlerts])

  // Hanya jalankan jika sedang di dalam area /lms/admin
  if (!pathname.startsWith('/lms/admin')) return null

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-20 right-4 z-50 flex w-full max-w-sm flex-col gap-3 pointer-events-none sm:right-6">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex flex-col gap-2 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xl shadow-slate-900/10 transition-all duration-300 animate-in fade-in slide-in-from-top-5"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                  t.type === 'new_order'
                    ? 'bg-indigo-50 text-indigo-600'
                    : 'bg-emerald-50 text-emerald-600'
                }`}
              >
                {t.type === 'new_order' ? <ShoppingBag size={18} /> : <CheckCircle2 size={18} />}
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900">{t.title}</div>
                <div className="text-[11px] font-semibold text-slate-500">
                  {t.orderNumber} &bull; <span className="text-slate-900">{formatRupiah(t.amount)}</span>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => dismissToast(t.id)}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X size={14} />
            </button>
          </div>
          <div className="text-xs font-medium text-slate-600 pl-1">{t.message}</div>
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                dismissToast(t.id)
                router.push('/lms/admin/penjualan/transaksi')
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800"
            >
              <span>Lihat Transaksi</span>
              <ExternalLink size={12} />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
