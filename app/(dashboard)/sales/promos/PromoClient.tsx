'use client'

import React, { useState } from 'react'
import {
  Zap,
  Tag,
  Gift,
  Percent,
  Plus,
  AlertCircle,
  Copy,
  CheckCircle2,
  Trash2,
  Clock3,
} from 'lucide-react'
import { PageHeader, StatCard, SectionCard, SectionHeader, SafeButton } from '@/components/ui/NizamUI'
import { formatDate } from '@/lib/utils'
import { createSalesPromo, deleteSalesPromo } from '@/modules/sales/actions/promo.actions'
import type { SalesPromoRecord } from '@/modules/sales/lib/sales-promos'

type PromoClientProps = {
  orgId: string
  initialPromos: SalesPromoRecord[]
}

export default function PromoClient({ orgId, initialPromos }: PromoClientProps) {
  const [showModal, setShowModal] = useState(false)
  const [promos, setPromos] = useState<SalesPromoRecord[]>(initialPromos)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const activePromos = promos.filter((promo) => promo.status === 'ACTIVE')
  const expiredPromos = promos.filter((promo) => promo.status === 'EXPIRED')
  const totalUsage = promos.reduce((sum, promo) => sum + promo.usageCount, 0)

  const resetFlash = () => {
    setError(null)
    setSuccess(null)
  }

  const handleCopy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code)
      setCopiedCode(code)
      setTimeout(() => setCopiedCode(null), 2000)
    } catch {
      setError('Gagal menyalin kode promo ke clipboard.')
    }
  }

  const handleAddPromo = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    resetFlash()
    setIsSaving(true)

    const form = e.currentTarget
    const formData = new FormData(form)
    const result = await createSalesPromo(orgId, {
      code: String(formData.get('code') || ''),
      type: String(formData.get('type') || ''),
      value: Number(formData.get('value') || 0),
      expiresAt: String(formData.get('expires_at') || '').trim() || null,
    })

    if ('error' in result) {
      setError(result.error)
      setIsSaving(false)
      return
    }

    setPromos((current) => [result.promo, ...current])
    setShowModal(false)
    setSuccess(`Kode promo ${result.promo.code} berhasil diterbitkan.`)
    setIsSaving(false)
    form.reset()
  }

  const handleDeletePromo = async (promo: SalesPromoRecord) => {
    resetFlash()
    if (!confirm(`Hapus promo ${promo.code} secara permanen?`)) return

    setIsSaving(true)
    const result = await deleteSalesPromo(orgId, promo.id)
    if ('error' in result) {
      setError(result.error)
      setIsSaving(false)
      return
    }

    setPromos((current) => current.filter((item) => item.id !== promo.id))
    setSuccess(`Promo ${promo.code} berhasil dihapus.`)
    setIsSaving(false)
  }

  return (
    <div className="max-w-7xl mx-auto pb-24 space-y-12">
      <PageHeader
        icon={<Zap />}
        title="Promo & Reward"
        subtitle="Manajemen program diskon otomatis, potongan harga spesial, dan metrik kupon."
        tag="Loyalty Program"
        actions={
          <SafeButton variant="primary" icon={<Plus size={18} />} onClick={() => {
            resetFlash()
            setShowModal(true)
          }}>
            Buat Kupon Baru
          </SafeButton>
        }
      />

      {(error || success) && (
        <div className={`rounded-xl border px-5 py-4 text-sm font-bold ${
          error
            ? 'border-rose-100 bg-rose-50 text-rose-600'
            : 'border-emerald-100 bg-emerald-50 text-emerald-700'
        }`}>
          {error || success}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard label="Diskon Berjalan" value={activePromos.length} icon={Percent} color="blue" />
        <StatCard label="Total Klaim" value={totalUsage} icon={Gift} color="emerald" sub="Kupon terpakai" />
        <StatCard label="Poin Tersalurkan" value="0 Pts" icon={Zap} color="amber" sub="Segera Hadir" />
        <StatCard label="Promo Berakhir" value={expiredPromos.length} icon={Tag} color="rose" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <SectionCard>
            <SectionHeader title="Daftar Kupon Diskon" subtitle="Kode diskon yang bisa digunakan di quotation maupun POS." />
            <div className="space-y-4">
              {promos.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center">
                  <p className="text-sm font-semibold text-slate-700">Belum ada promo tersimpan.</p>
                  <p className="mt-2 text-xs font-medium text-slate-400">Buat kode voucher pertama Anda agar bisa dipakai di quotation dan POS.</p>
                </div>
              )}

              {promos.map((promo) => (
                <div
                  key={promo.id}
                  className="group relative flex items-center justify-between p-6 rounded-xl border border-slate-100 bg-white hover:border-blue-200 hover:shadow-xl hover:shadow-blue-500/5 transition-all overflow-hidden"
                >
                  <div className="flex items-center gap-5 relative z-10">
                    <div className={`w-16 h-16 rounded-xl flex flex-col items-center justify-center border-2 border-dashed ${
                      promo.status === 'ACTIVE'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-600'
                        : promo.status === 'EXPIRED'
                          ? 'border-rose-200 bg-rose-50 text-rose-500'
                          : 'border-slate-200 bg-slate-50 text-slate-400'
                    }`}>
                      {promo.type === 'PERCENT' ? <Percent size={24} /> : <Tag size={24} />}
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h4 className={`text-xl font-semibold tracking-tight ${
                          promo.status === 'ACTIVE' ? 'text-slate-800' : 'text-slate-400 line-through'
                        }`}>
                          {promo.code}
                        </h4>
                        <span className={`px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide rounded-full ${
                          promo.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-600'
                            : promo.status === 'EXPIRED'
                              ? 'bg-rose-50 text-rose-600'
                              : 'bg-slate-100 text-slate-500'
                        }`}>
                          {promo.status}
                        </span>
                      </div>
                      <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wide">
                        Potongan:{' '}
                        <strong className="text-blue-600">
                          {promo.type === 'PERCENT'
                            ? `${promo.value}%`
                            : `Rp ${new Intl.NumberFormat('id-ID').format(promo.value)}`}
                        </strong>{' '}
                        • Dipakai {promo.usageCount} kali
                      </div>
                      <div className="mt-2 flex items-center gap-2 text-[11px] font-medium text-slate-500">
                        <Clock3 size={12} />
                        {promo.expiresAt
                          ? `Expired ${formatDate(promo.expiresAt, 'short')}`
                          : 'Tanpa tanggal expired'}
                      </div>
                    </div>
                  </div>

                  <div className="relative z-10 flex items-center gap-2">
                    <button
                      onClick={() => handleCopy(promo.code)}
                      className="bg-slate-50 p-3 rounded-xl text-slate-400 hover:bg-blue-600 hover:text-white transition-all shadow-sm group-hover:-translate-y-1"
                      title="Salin kode promo"
                    >
                      {copiedCode === promo.code ? <CheckCircle2 size={18} className="text-emerald-400" /> : <Copy size={18} />}
                    </button>
                    <button
                      onClick={() => handleDeletePromo(promo)}
                      disabled={isSaving}
                      className="bg-slate-50 p-3 rounded-xl text-slate-400 hover:bg-rose-600 hover:text-white transition-all shadow-sm group-hover:-translate-y-1 disabled:opacity-50"
                      title="Hapus promo"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>

                  {promo.status === 'ACTIVE' && (
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity -mr-16 -mt-16 pointer-events-none" />
                  )}
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        <div className="space-y-6">
          <div className="bg-gradient-to-br from-indigo-500 to-blue-600 rounded-[32px] p-8 text-white relative shadow-md overflow-hidden">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20 mix-blend-overlay"></div>
            <Gift size={28} className="text-white/80 mb-6 drop-shadow-md" />
            <h3 className="text-xl font-semibold mb-2 relative z-10">Customer Loyalty Points</h3>
            <p className="text-sm font-semibold text-white/80 mb-8 relative z-10 leading-relaxed">
              Persiapkan program poin loyalitas untuk menjaga pelanggan setia Anda tidak kabur ke kompetitor.
            </p>
            <button className="relative z-10 w-full bg-white text-blue-600 font-semibold tracking-wide uppercase text-[10px] py-4 rounded-xl hover:bg-blue-50 transition-colors shadow-lg shadow-black/10">
              Aktifkan Modul Loyalty
            </button>
          </div>

          <div className="bg-amber-50 rounded-xl p-6 border border-amber-100 flex items-start gap-4">
            <AlertCircle size={24} className="text-amber-500 mt-1 flex-shrink-0" />
            <div className="space-y-2 text-amber-800 text-sm font-bold leading-relaxed">
              Kupon yang dibuat di halaman ini sekarang bisa dipakai langsung di quotation dan POS. Atur tanggal expired saat membuat promo agar status aktif dan expired tetap jelas.
            </div>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative w-full max-w-md bg-white rounded-xl p-8 shadow-md">
            <h3 className="text-xl font-bold mb-6">Buat Kupon Spesial</h3>
            <form onSubmit={handleAddPromo} className="space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Kode Promo (Harus Unik)</label>
                <input
                  name="code"
                  required
                  minLength={4}
                  maxLength={20}
                  style={{ textTransform: 'uppercase' }}
                  className="w-full h-12 px-4 border rounded-xl bg-slate-50 text-sm font-bold focus:border-blue-500 outline-none"
                  placeholder="Cth: HARNAS2025"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Tipe Diskon</label>
                  <select name="type" className="w-full h-12 px-4 border rounded-xl bg-slate-50 text-sm font-bold focus:border-blue-500 outline-none">
                    <option value="PERCENT">Persentase (%)</option>
                    <option value="FIXED">Nominal (Rp)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Nilai Potongan</label>
                  <input
                    type="number"
                    name="value"
                    required
                    min={1}
                    className="w-full h-12 px-4 border rounded-xl bg-slate-50 text-sm font-bold focus:border-blue-500 outline-none"
                    placeholder="10 / 50000"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Tanggal Expired</label>
                <input
                  type="date"
                  name="expires_at"
                  className="w-full h-12 px-4 border rounded-xl bg-slate-50 text-sm font-bold focus:border-blue-500 outline-none"
                />
                <p className="text-[11px] font-medium text-slate-400">Kosongkan jika promo tidak memiliki batas tanggal.</p>
              </div>
              <div className="flex justify-end gap-3 pt-6 mt-4 border-t">
                <button type="button" onClick={() => setShowModal(false)} className="px-6 py-3 font-bold text-slate-400">
                  Batal
                </button>
                <SafeButton variant="primary" type="submit" disabled={isSaving}>
                  {isSaving ? 'Menyimpan...' : 'Terbitkan Kupon'}
                </SafeButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
