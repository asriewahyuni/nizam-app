'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CheckCircle2, ExternalLink, Upload } from 'lucide-react'
import {
  formatStoreThemeButtonRadius,
  formatStoreThemeRadius,
  formatThemeShadow,
  resolveThemeFontFamily,
  type PublicOrderStatusPayload,
} from '@/modules/ecommerce/lib/ecommerce'
import { formatDate, formatRupiah } from '@/lib/utils'

type OrderStatusClientProps = {
  payload: PublicOrderStatusPayload
  orgSlug: string
  storeSlug: string
  accessToken: string
}

export default function OrderStatusClient({
  payload,
  orgSlug,
  storeSlug,
  accessToken,
}: OrderStatusClientProps) {
  const router = useRouter()
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [payerName, setPayerName] = useState(payload.order.customerName)
  const [payerBankName, setPayerBankName] = useState('')
  const [paidAmount, setPaidAmount] = useState(String(payload.order.grandTotal))
  const [uploadLoading, setUploadLoading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [uploadSuccess, setUploadSuccess] = useState('')
  const [clientUploadKey, setClientUploadKey] = useState(() => crypto.randomUUID())

  const radius = formatStoreThemeRadius(payload.theme.tokens.cardRadius)
  const buttonRadius = formatStoreThemeButtonRadius(payload.theme.tokens.buttonRadius)
  const shadow = formatThemeShadow(payload.theme.tokens.shadow)
  const fontFamily = resolveThemeFontFamily(payload.theme.tokens.fontLabel)

  async function submitPaymentProof() {
    if (!proofFile) {
      setUploadError('Pilih file bukti pembayaran lebih dulu.')
      return
    }

    setUploadLoading(true)
    setUploadError('')
    setUploadSuccess('')

    try {
      const formData = new FormData()
      formData.set('org_slug', orgSlug)
      formData.set('store_slug', storeSlug)
      formData.set('access_token', accessToken)
      formData.set('client_upload_key', clientUploadKey)
      formData.set('file', proofFile)
      formData.set('payer_name', payerName)
      formData.set('payer_bank_name', payerBankName)
      formData.set('paid_amount', paidAmount)

      const response = await fetch(`/api/ecommerce/orders/${payload.order.orderNumber}/payment-proof`, {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || 'Upload bukti pembayaran gagal.')
      }

      setUploadSuccess('Bukti pembayaran berhasil dikirim. Tim toko akan memeriksa terlebih dahulu.')
      setProofFile(null)
      setClientUploadKey(crypto.randomUUID())
      window.setTimeout(() => {
        router.refresh()
      }, 700)
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Upload bukti pembayaran gagal.')
    } finally {
      setUploadLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen"
      style={{
        background: `linear-gradient(180deg, ${payload.theme.tokens.surface} 0%, ${payload.theme.tokens.surfaceAlt} 100%)`,
        fontFamily,
        color: payload.theme.tokens.text,
      }}
    >
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-6 lg:px-8">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: payload.theme.tokens.muted }}>
            Status Order Publik
          </div>
          <div className="mt-2 text-2xl font-black tracking-tight text-slate-900">{payload.store.name}</div>
          <div className="mt-1 text-sm font-medium text-slate-500">
            Nomor order: <span className="font-black text-slate-900">{payload.order.orderNumber}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/toko/${payload.store.orgSlug}/${payload.store.slug}`}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700"
          >
            Kembali ke Store
          </Link>
          <Link
            href={payload.order.accessUrl}
            className="inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-black text-white"
            style={{ backgroundColor: payload.theme.tokens.accent, borderRadius: buttonRadius }}
          >
            Buka Link Order
            <ExternalLink size={14} />
          </Link>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-6 pb-16 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">
        <section className="space-y-6">
          <div className="rounded-[30px] border bg-white p-6" style={{ borderColor: payload.theme.tokens.border, borderRadius: radius, boxShadow: shadow }}>
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-emerald-100 p-2 text-emerald-600">
                <CheckCircle2 size={18} />
              </div>
              <div>
                <div className="text-sm font-black text-slate-900">Order sudah tercatat di sistem.</div>
                <div className="mt-1 text-sm font-medium text-slate-500">
                  Halaman ini bisa dibuka lagi kapan saja selama link aksesnya masih aktif.
                </div>
              </div>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Status Order</div>
                <div className="mt-2 text-sm font-black text-slate-900">{payload.order.status}</div>
              </div>
              <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Status Pembayaran</div>
                <div className="mt-2 text-sm font-black text-slate-900">{payload.order.paymentStatus}</div>
              </div>
              <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Tanggal Order</div>
                <div className="mt-2 text-sm font-black text-slate-900">{formatDate(payload.order.createdAt)}</div>
              </div>
              <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Batas Bayar</div>
                <div className="mt-2 text-sm font-black text-slate-900">
                  {payload.order.paymentDueAt ? formatDate(payload.order.paymentDueAt) : 'Belum diatur'}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[30px] border bg-white p-6" style={{ borderColor: payload.theme.tokens.border, borderRadius: radius, boxShadow: shadow }}>
            <div className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: payload.theme.tokens.muted }}>
              Item Order
            </div>
            <div className="mt-4 space-y-4">
              {payload.order.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-4 rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-4">
                    <div
                      className="h-16 w-16 rounded-[18px] bg-cover bg-center"
                      style={{
                        backgroundImage: item.imageUrl ? `url(${item.imageUrl})` : undefined,
                        backgroundColor: item.imageUrl ? undefined : payload.theme.tokens.accentSoft,
                      }}
                    />
                    <div>
                      <div className="font-black text-slate-900">{item.productName}</div>
                      {item.variantName && <div className="text-xs font-medium text-slate-500">{item.variantName}</div>}
                      <div className="text-xs font-medium text-slate-500">
                        {item.quantity} x {formatRupiah(item.unitPrice)}
                      </div>
                    </div>
                  </div>
                  <div className="font-black text-slate-900">{formatRupiah(item.lineTotal)}</div>
                </div>
              ))}
            </div>
          </div>

          {payload.order.address && (
            <div className="rounded-[30px] border bg-white p-6" style={{ borderColor: payload.theme.tokens.border, borderRadius: radius, boxShadow: shadow }}>
              <div className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: payload.theme.tokens.muted }}>
                Alamat Pengiriman
              </div>
              <div className="mt-4 text-sm font-medium leading-relaxed text-slate-600">
                <div className="font-black text-slate-900">{payload.order.address.recipientName}</div>
                <div>{payload.order.address.phone || '-'}</div>
                <div className="mt-2">
                  {[
                    payload.order.address.line1,
                    payload.order.address.line2,
                    payload.order.address.district,
                    payload.order.address.city,
                    payload.order.address.province,
                    payload.order.address.postalCode,
                    payload.order.address.country,
                  ].filter(Boolean).join(', ')}
                </div>
                {payload.order.address.notes && (
                  <div className="mt-2 rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3">
                    Catatan alamat: {payload.order.address.notes}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        <aside className="space-y-6">
          <div className="rounded-[30px] border bg-white p-6" style={{ borderColor: payload.theme.tokens.border, borderRadius: radius, boxShadow: shadow }}>
            <div className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: payload.theme.tokens.muted }}>
              Ringkasan Pembayaran
            </div>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between font-medium text-slate-600">
                <span>Subtotal</span>
                <span className="font-black text-slate-900">{formatRupiah(payload.order.subtotalAmount)}</span>
              </div>
              <div className="flex items-center justify-between font-medium text-slate-600">
                <span>Ongkir</span>
                <span className="font-black text-slate-900">{formatRupiah(payload.order.shippingAmount)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-base">
                <span className="font-black text-slate-900">Total</span>
                <span className="font-black text-slate-900">{formatRupiah(payload.order.grandTotal)}</span>
              </div>
              {payload.order.shippingLabel && (
                <div className="rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-600">
                  Ongkir yang dipakai: {payload.order.shippingLabel}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-[30px] border bg-white p-6" style={{ borderColor: payload.theme.tokens.border, borderRadius: radius, boxShadow: shadow }}>
            <div className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: payload.theme.tokens.muted }}>
              Instruksi Transfer
            </div>
            <div className="mt-4 rounded-[22px] border border-slate-200 bg-slate-50 p-4 text-sm font-medium leading-relaxed text-slate-600">
              {payload.order.transferInstructions || 'Instruksi transfer belum tersedia. Hubungi tim toko.'}
            </div>
          </div>

          <div className="rounded-[30px] border bg-white p-6" style={{ borderColor: payload.theme.tokens.border, borderRadius: radius, boxShadow: shadow }}>
            <div className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: payload.theme.tokens.muted }}>
              Upload Bukti Pembayaran
            </div>
            <div className="mt-2 text-sm font-medium text-slate-500">
              Maksimal {payload.order.proofMaxSizeMb}MB. Format yang diterima: JPG, PNG, WEBP, atau PDF.
            </div>
            {!payload.order.canUploadProof ? (
              <div className="mt-4 rounded-[18px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-700">
                Order ini sudah tidak menerima upload bukti baru. Jika ada kendala, hubungi tim toko.
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <input
                  value={payerName}
                  onChange={(event) => setPayerName(event.target.value)}
                  placeholder="Nama pengirim transfer"
                  className="w-full rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4 font-medium outline-none focus:border-blue-500"
                />
                <input
                  value={payerBankName}
                  onChange={(event) => setPayerBankName(event.target.value)}
                  placeholder="Nama bank pengirim"
                  className="w-full rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4 font-medium outline-none focus:border-blue-500"
                />
                <input
                  value={paidAmount}
                  onChange={(event) => setPaidAmount(event.target.value)}
                  type="number"
                  min="0"
                  placeholder="Nominal transfer"
                  className="w-full rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4 font-medium outline-none focus:border-blue-500"
                />
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,.pdf"
                  onChange={(event) => setProofFile(event.target.files?.[0] || null)}
                  className="w-full rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-medium outline-none"
                />
                {uploadError && (
                  <div className="rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
                    {uploadError}
                  </div>
                )}
                {uploadSuccess && (
                  <div className="rounded-[18px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
                    {uploadSuccess}
                  </div>
                )}
                <button
                  type="button"
                  onClick={submitPaymentProof}
                  disabled={uploadLoading}
                  className="inline-flex w-full items-center justify-center gap-2 px-5 py-4 text-sm font-black text-white disabled:opacity-60"
                  style={{ backgroundColor: payload.theme.tokens.accentStrong, borderRadius: buttonRadius }}
                >
                  <Upload size={16} />
                  {uploadLoading ? 'Mengirim bukti...' : 'Kirim Bukti Pembayaran'}
                </button>
              </div>
            )}
          </div>

          {payload.order.payments.length > 0 && (
            <div className="rounded-[30px] border bg-white p-6" style={{ borderColor: payload.theme.tokens.border, borderRadius: radius, boxShadow: shadow }}>
              <div className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: payload.theme.tokens.muted }}>
                Riwayat Pembayaran
              </div>
              <div className="mt-4 space-y-3">
                {payload.order.payments.map((payment) => (
                  <div key={payment.id} className="rounded-[20px] border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-black text-slate-900">{payment.status}</div>
                      <div className="text-xs font-medium text-slate-500">{formatDate(payment.createdAt)}</div>
                    </div>
                    <div className="mt-2 text-sm font-medium text-slate-600">
                      {payment.paidAmount !== null ? formatRupiah(payment.paidAmount) : 'Nominal belum tercatat'}
                    </div>
                    {payment.payerName && (
                      <div className="mt-1 text-xs font-medium text-slate-500">
                        Pengirim: {payment.payerName}{payment.payerBankName ? ` • ${payment.payerBankName}` : ''}
                      </div>
                    )}
                    {payment.reviewNote && (
                      <div className="mt-2 rounded-[16px] border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600">
                        Catatan admin: {payment.reviewNote}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>
      </main>
    </div>
  )
}
