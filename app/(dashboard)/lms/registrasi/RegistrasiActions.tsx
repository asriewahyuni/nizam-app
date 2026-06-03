'use client'

import { useState, useTransition } from 'react'
import { CheckCircle2, XCircle, Loader2, CreditCard, X } from 'lucide-react'
import {
  confirmLmsRegistration,
  cancelLmsRegistration,
  updateRegistrationPayment,
} from '@/modules/edu/actions/lms-registration.actions'
import { useConfirm } from '@/components/ui/NizamUI'

type Reg = {
  id: string
  full_name: string
  email: string
  phone: string | null
  status: string
  amount_paid: number | null
  payment_method: string | null
  registered_at: string
}

// ── Tombol Konfirmasi & Batalkan ──────────────────────────────────────────────

export function RegistrasiActions({ reg }: { reg: Reg }) {
  const [isPending, startTransition] = useTransition()
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const { confirm, ConfirmUI } = useConfirm()
  const [error, setError] = useState<string | null>(null)

  function handleConfirm() {
    setError(null)
    startTransition(async () => {
      try {
        await confirmLmsRegistration(reg.id)
      } catch (e: any) {
        setError(e.message)
      }
    })
  }

  async function handleCancel() {
    if (!await confirm(`Batalkan pendaftaran ${reg.full_name}?`)) return
    setError(null)
    startTransition(async () => {
      try {
        await cancelLmsRegistration(reg.id)
      } catch (e: any) {
        setError(e.message)
      }
    })
  }

  if (reg.status === 'CONFIRMED') {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600">
          <CheckCircle2 className="h-3.5 w-3.5" /> Terkonfirmasi
        </span>
        <button type="button"
          onClick={handleCancel}
          disabled={isPending}
          className="text-xs text-slate-400 hover:text-red-500 transition-colors disabled:opacity-50"
        >
          Batalkan
        </button>
      </div>
    )
  }

  if (reg.status === 'CANCELLED') {
    return <span className="text-xs font-bold text-slate-400">Dibatalkan</span>
  }

  return (
    <div className="space-y-1">
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex gap-2">
        <button type="button"
          onClick={() => setShowPaymentModal(true)}
          disabled={isPending}
          className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
        >
          <CreditCard className="h-3 w-3" /> Konfirmasi Bayar
        </button>
        <button type="button"
          onClick={handleConfirm}
          disabled={isPending}
          className="flex items-center gap-1.5 rounded-lg bg-blue-50 border border-blue-200 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100 disabled:opacity-50 transition-colors"
        >
          {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
          Konfirmasi
        </button>
        <button type="button"
          onClick={handleCancel}
          disabled={isPending}
          className="flex items-center gap-1.5 rounded-lg bg-red-50 border border-red-200 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100 disabled:opacity-50 transition-colors"
        >
          <XCircle className="h-3 w-3" /> Batalkan
        </button>
      </div>
      {showPaymentModal && (
        <PaymentModal
          reg={reg}
          onClose={() => setShowPaymentModal(false)}
        />
      )}
      {ConfirmUI}
    </div>
  )
}

// ── Modal Konfirmasi Pembayaran ────────────────────────────────────────────────

function PaymentModal({ reg, onClose }: { reg: Reg; onClose: () => void }) {
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('Transfer Bank')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  function handleSave() {
    if (!amount || isNaN(Number(amount))) {
      setError('Jumlah pembayaran wajib diisi')
      return
    }
    setError(null)
    startTransition(async () => {
      try {
        await updateRegistrationPayment(reg.id, Number(amount), method)
        setDone(true)
        setTimeout(() => onClose(), 1200)
      } catch (e: any) {
        setError(e.message)
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-slate-900">Konfirmasi Pembayaran</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {done ? (
          <div className="py-6 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
            <p className="mt-2 text-sm font-bold text-slate-900">Pembayaran dikonfirmasi!</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
              <strong>{reg.full_name}</strong> — {reg.email}
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600">Jumlah Dibayar (Rp)</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600">Metode Pembayaran</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              >
                <option>Transfer Bank</option>
                <option>QRIS</option>
                <option>Tunai</option>
                <option>Virtual Account</option>
                <option>Lainnya</option>
              </select>
            </div>
            {error && <p className="text-xs font-semibold text-red-500 bg-red-50 rounded-xl px-3 py-2">{error}</p>}
            <div className="flex gap-3 pt-1">
              <button type="button"
                onClick={onClose}
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Batal
              </button>
              <button type="button"
                onClick={handleSave}
                disabled={isPending}
                className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Simpan
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
