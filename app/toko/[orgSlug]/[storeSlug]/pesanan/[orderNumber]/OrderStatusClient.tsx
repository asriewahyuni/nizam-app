'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  Landmark,
  Upload,
  ArrowLeft,
  Clock,
  FileText,
  Check,
  ShoppingBag,
  Package,
  AlertCircle,
  Shield,
  Lock,
  Headphones,
  MessageCircle,
  Sparkles,
  MapPin,
  Share2,
} from 'lucide-react'
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
  const [copiedAccountNumber, setCopiedAccountNumber] = useState(false)
  const [copiedOrderLink, setCopiedOrderLink] = useState(false)
  const [copiedNominal, setCopiedNominal] = useState(false)

  function copyNominal(amount: number) {
    if (!amount && amount !== 0) return
    navigator.clipboard?.writeText(String(amount)).then(() => {
      setCopiedNominal(true)
      window.setTimeout(() => setCopiedNominal(false), 2000)
    }).catch(() => {})
  }

  function copyAccountNumber(accountNumber: string) {
    if (!accountNumber) return
    navigator.clipboard?.writeText(accountNumber).then(() => {
      setCopiedAccountNumber(true)
      window.setTimeout(() => setCopiedAccountNumber(false), 2000)
    }).catch(() => {})
  }

  function copyOrderLink() {
    const url = payload.order.accessUrl || (typeof window !== 'undefined' ? window.location.href : '')
    if (!url) return
    navigator.clipboard?.writeText(url).then(() => {
      setCopiedOrderLink(true)
      window.setTimeout(() => setCopiedOrderLink(false), 2000)
    }).catch(() => {})
  }

  function formatFileSize(bytes: number) {
    const kb = bytes / 1024
    return kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb.toFixed(0)} KB`
  }

  const radius = formatStoreThemeRadius(payload.theme.tokens.cardRadius)
  const buttonRadius = formatStoreThemeButtonRadius(payload.theme.tokens.buttonRadius)
  const shadow = formatThemeShadow(payload.theme.tokens.shadow)
  const fontFamily = resolveThemeFontFamily(payload.theme.tokens.fontLabel)

  // Brand colors & tokens
  const primaryColor = payload.theme.tokens.accent || '#004da4'
  const secondaryColor = payload.theme.tokens.accentStrong || '#c69232'
  const softColor = payload.theme.tokens.accentSoft || '#eef4fc'

  // WhatsApp Support URL
  const whatsappNumber = payload.store.whatsappPhone || payload.store.supportPhone || ''
  const cleanWa = whatsappNumber.replace(/\D/g, '')
  const waHref = cleanWa
    ? `https://wa.me/${cleanWa.startsWith('0') ? '62' + cleanWa.slice(1) : cleanWa}?text=${encodeURIComponent(
        `Halo Admin ${payload.store.brandName || payload.store.name}, saya ingin konsultasi/tanya tentang Order ${payload.order.orderNumber}.`
      )}`
    : '#'

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

  // Timeline step helper
  const isPaid = ['PAID', 'VERIFYING', 'APPROVED', 'LUNAS'].includes(payload.order.paymentStatus.toUpperCase()) ||
                 ['PROCESSING', 'COMPLETED', 'SELESAI'].includes(payload.order.status.toUpperCase())
  const isCompleted = ['COMPLETED', 'SELESAI', 'ACTIVE'].includes(payload.order.status.toUpperCase())

  return (
    <div
      className="min-h-screen bg-slate-50/70 text-slate-900 antialiased"
      style={{
        fontFamily,
      }}
    >
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-2.5">
            {payload.store.logoUrl ? (
              <img
                src={payload.store.logoUrl}
                alt={payload.store.brandName || payload.store.name}
                className="h-9 w-auto max-w-[130px] object-contain"
              />
            ) : (
              <div
                className="grid h-9 w-9 place-items-center rounded-xl text-sm font-extrabold text-white shadow-sm"
                style={{ backgroundColor: primaryColor }}
              >
                {(payload.store.brandName || payload.store.name || 'C')[0]}
              </div>
            )}
            <div className="leading-tight">
              <div className="text-[15px] font-extrabold tracking-tight text-slate-900">
                {payload.store.brandName || payload.store.name}
              </div>
              <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">
                Status Order Publik
              </div>
            </div>
          </div>
          <div
            className="hidden sm:flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-2xs"
            style={{
              borderColor: `${primaryColor}33`,
              backgroundColor: softColor,
              color: primaryColor,
            }}
          >
            <span className="relative flex h-2 w-2">
              <span
                className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
                style={{ backgroundColor: primaryColor }}
              />
              <span
                className="relative inline-flex h-2 w-2 rounded-full"
                style={{ backgroundColor: primaryColor }}
              />
            </span>
            Terhubung Aman
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
        {/* Order Banner */}
        <section
          className="mb-6 overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-7"
          style={{
            backgroundImage: `linear-gradient(135deg, #ffffff 0%, ${softColor} 100%)`,
          }}
        >
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider"
                style={{
                  backgroundColor: softColor,
                  color: primaryColor,
                }}
              >
                <CheckCircle2 size={13} />
                Order Tercatat
              </span>
              <h1 className="mt-3 text-xl font-extrabold tracking-tight sm:text-2xl text-slate-900">
                Nomor Order <span className="font-mono" style={{ color: primaryColor }}>{payload.order.orderNumber}</span>
              </h1>
              <p className="mt-1.5 max-w-xl text-sm text-slate-600">
                Halaman ini bisa dibuka kapan saja selama link akses masih aktif. Simpan tautannya untuk cek status pembayaran.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <Link
                href={`/store/${payload.store.orgSlug}/${payload.store.slug}`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 hover:text-slate-900"
              >
                <ArrowLeft size={14} />
                Kembali ke Store
              </Link>
              <button
                type="button"
                onClick={copyOrderLink}
                className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:opacity-90"
                style={{ backgroundColor: primaryColor }}
              >
                {copiedOrderLink ? (
                  <>
                    <Check size={14} />
                    <span>Link Tersalin</span>
                  </>
                ) : (
                  <>
                    <Share2 size={14} />
                    <span>Salin Link Order</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* 4-Column Status Grid */}
          <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-200/70 bg-white/90 p-3.5 shadow-2xs">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Status Order</div>
              <div
                className="mt-1.5 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold"
                style={{ backgroundColor: softColor, color: primaryColor }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: primaryColor }} />
                {payload.order.status}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200/70 bg-white/90 p-3.5 shadow-2xs">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Pembayaran</div>
              <div
                className="mt-1.5 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold"
                style={{
                  backgroundColor: isPaid ? '#dcfce7' : '#fef3c7',
                  color: isPaid ? '#166534' : '#92400e',
                }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: isPaid ? '#166534' : '#d97706' }}
                />
                {payload.order.paymentStatus}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200/70 bg-white/90 p-3.5 shadow-2xs">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Tanggal Order</div>
              <div className="mt-1.5 text-sm font-bold text-slate-900">{formatDate(payload.order.createdAt)}</div>
            </div>
            <div className="rounded-xl border border-slate-200/70 bg-white/90 p-3.5 shadow-2xs">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Batas Bayar</div>
              <div className="mt-1.5 text-sm font-bold" style={{ color: primaryColor }}>
                {payload.order.paymentDueAt ? formatDate(payload.order.paymentDueAt) : 'Belum diatur'}
              </div>
            </div>
          </div>
        </section>

        {/* Progress Timeline Section */}
        <section className="mb-6 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Progres Pesanan</h2>
          <ol className="mt-4 grid gap-4 sm:grid-cols-4">
            <li className="relative">
              <div className="flex items-center gap-2">
                <div
                  className="grid h-7 w-7 place-items-center rounded-full text-white shadow-sm"
                  style={{ backgroundColor: primaryColor }}
                >
                  <CheckCircle2 size={14} />
                </div>
                <span className="text-sm font-bold text-slate-900">Order Dibuat</span>
              </div>
              <p className="mt-1 pl-9 text-xs text-slate-500">{formatDate(payload.order.createdAt)}</p>
            </li>

            <li className="relative">
              <div className="flex items-center gap-2">
                <div
                  className="grid h-7 w-7 place-items-center rounded-full text-white shadow-sm"
                  style={{ backgroundColor: primaryColor }}
                >
                  <Clock size={14} />
                </div>
                <span className="text-sm font-bold text-slate-900">Menunggu Pembayaran</span>
              </div>
              <p className="mt-1 pl-9 text-xs text-slate-500">Upload bukti transfer</p>
            </li>

            <li className={`relative ${!isPaid ? 'opacity-50' : ''}`}>
              <div className="flex items-center gap-2">
                <div
                  className={`grid h-7 w-7 place-items-center rounded-full border-2 text-xs font-bold ${
                    isPaid ? 'border-transparent text-white' : 'border-slate-300 bg-white text-slate-500'
                  }`}
                  style={{ backgroundColor: isPaid ? primaryColor : undefined }}
                >
                  {isPaid ? <Check size={14} /> : '3'}
                </div>
                <span className="text-sm font-semibold text-slate-900">Verifikasi</span>
              </div>
              <p className="mt-1 pl-9 text-xs text-slate-500">Maksimal 1x24 jam</p>
            </li>

            <li className={`relative ${!isCompleted ? 'opacity-50' : ''}`}>
              <div className="flex items-center gap-2">
                <div
                  className={`grid h-7 w-7 place-items-center rounded-full border-2 text-xs font-bold ${
                    isCompleted ? 'border-transparent text-white' : 'border-slate-300 bg-white text-slate-500'
                  }`}
                  style={{ backgroundColor: isCompleted ? primaryColor : undefined }}
                >
                  {isCompleted ? <Check size={14} /> : '4'}
                </div>
                <span className="text-sm font-semibold text-slate-900">Akses Aktif</span>
              </div>
              <p className="mt-1 pl-9 text-xs text-slate-500">Instan setelah verifikasi</p>
            </li>
          </ol>
        </section>

        {/* Main 2-Column Layout */}
        <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
          {/* LEFT COLUMN */}
          <div className="space-y-6">
            {/* 1. Instruksi Transfer & Pembayaran (PRIORITAS UTAMA - PALING ATAS) */}
            <section
              className="rounded-2xl border-2 bg-white p-5 shadow-md sm:p-7"
              style={{
                borderColor: `${primaryColor}50`,
                backgroundImage: `linear-gradient(180deg, #ffffff 0%, ${softColor} 100%)`,
              }}
            >
              <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className="grid h-8 w-8 place-items-center rounded-lg text-white text-sm font-black shadow-2xs"
                    style={{ backgroundColor: primaryColor }}
                  >
                    1
                  </div>
                  <h2 className="text-lg font-extrabold tracking-tight text-slate-900">
                    Instruksi Transfer & Pembayaran
                  </h2>
                </div>
                <span
                  className="rounded-full px-3 py-1 text-xs font-bold"
                  style={{
                    backgroundColor: `${primaryColor}1a`,
                    color: primaryColor,
                  }}
                >
                  Prioritas Pembayaran
                </span>
              </div>
              <p className="mb-5 pl-10 text-xs sm:text-sm font-medium text-slate-600">
                Silakan lakukan transfer sesuai rekening/VA dan nominal tagihan di bawah ini.
              </p>

              {payload.store.bankAccountNumber ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {/* BOX A: REKENING / VA / QRIS */}
                  <div className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          Rekening / VA Tujuan
                        </span>
                        <div
                          className="rounded-md px-2.5 py-0.5 text-[10px] font-black tracking-wider text-white"
                          style={{ backgroundColor: primaryColor }}
                        >
                          {payload.store.bankName || 'BANK TRANSFER'}
                        </div>
                      </div>
                      <div className="mt-2">
                        <div className="truncate font-mono text-2xl sm:text-3xl font-extrabold tracking-wider text-slate-950">
                          {payload.store.bankAccountNumber}
                        </div>
                        {payload.store.bankAccountHolder && (
                          <div className="mt-1 text-xs sm:text-sm font-semibold text-slate-700">
                            a.n. {payload.store.bankAccountHolder}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="mt-5 pt-3 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => copyAccountNumber(payload.store.bankAccountNumber)}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-800 transition hover:bg-slate-100 active:scale-[0.99] shadow-2xs"
                      >
                        {copiedAccountNumber ? (
                          <>
                            <Check size={15} className="text-emerald-600" />
                            <span className="text-emerald-700 font-extrabold">Nomor Rekening Tersalin</span>
                          </>
                        ) : (
                          <>
                            <Copy size={15} />
                            <span>Salin Nomor Rekening / VA</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* BOX B: NOMINAL TRANSFER */}
                  <div className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          Nominal Yang Harus Ditransfer
                        </span>
                        <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                          Tepat 3 Angka Terakhir
                        </span>
                      </div>
                      <div className="mt-2">
                        <div
                          className="font-mono text-2xl sm:text-3xl font-extrabold tabular-nums tracking-tight"
                          style={{ color: primaryColor }}
                        >
                          {formatRupiah(payload.order.grandTotal)}
                        </div>
                        <div className="mt-1 text-xs text-slate-500 font-medium">
                          Termasuk kode unik / diskon pesanan
                        </div>
                      </div>
                    </div>
                    <div className="mt-5 pt-3 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => copyNominal(payload.order.grandTotal)}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-800 transition hover:bg-slate-100 active:scale-[0.99] shadow-2xs"
                      >
                        {copiedNominal ? (
                          <>
                            <Check size={15} className="text-emerald-600" />
                            <span className="text-emerald-700 font-extrabold">Nominal Tersalin</span>
                          </>
                        ) : (
                          <>
                            <Copy size={15} />
                            <span>Salin Nominal Transfer</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm font-medium text-slate-600">
                  Instruksi transfer belum dikonfigurasi. Hubungi admin toko.
                </div>
              )}

              <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3.5 text-xs sm:text-sm text-amber-950 font-medium shadow-2xs">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <div>
                  <span className="font-bold">Penting:</span> Transfer <b>tepat</b> sesuai nominal di atas hingga digit terakhir agar sistem dapat memverifikasi pembayaran Anda secara otomatis dan cepat.
                </div>
              </div>

              {payload.order.transferInstructions && (
                <div className="mt-4 rounded-xl border border-slate-200/80 bg-white p-4 text-xs sm:text-sm font-medium leading-relaxed text-slate-700">
                  {payload.order.transferInstructions}
                </div>
              )}
            </section>

            {/* 2. Upload Bukti Pembayaran */}
            <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-1 flex items-center gap-2">
                <div
                  className="grid h-8 w-8 place-items-center rounded-lg text-white text-sm font-black shadow-2xs"
                  style={{ backgroundColor: primaryColor }}
                >
                  2
                </div>
                <h2 className="text-base font-bold tracking-tight text-slate-900">Upload Bukti Pembayaran</h2>
              </div>
              <p className="mb-4 pl-10 text-xs text-slate-500">
                Maksimal {payload.order.proofMaxSizeMb}MB · JPG, PNG, WEBP, atau PDF.
              </p>

              {!payload.order.canUploadProof ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">
                  Order ini sudah tidak menerima upload bukti pembayaran baru. Jika ada kendala, silakan hubungi tim toko.
                </div>
              ) : (
                <>
                  <label
                    htmlFor="proof-upload"
                    className="group flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/70 px-4 py-8 text-center transition hover:border-slate-300 hover:bg-slate-100/60"
                  >
                    <div
                      className="grid h-12 w-12 place-items-center rounded-full transition text-white shadow-2xs"
                      style={{ backgroundColor: primaryColor }}
                    >
                      <Upload size={20} />
                    </div>
                    <div className="text-sm font-bold text-slate-900">
                      Klik untuk pilih file <span className="font-normal text-slate-500">atau drag & drop</span>
                    </div>
                    <div className="text-xs text-slate-500 font-medium">
                      {proofFile ? `${proofFile.name} · ${formatFileSize(proofFile.size)}` : 'Belum ada file dipilih'}
                    </div>
                    <input
                      id="proof-upload"
                      type="file"
                      className="hidden"
                      accept=".jpg,.jpeg,.png,.webp,.pdf"
                      onChange={(event) => setProofFile(event.target.files?.[0] || null)}
                    />
                  </label>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-semibold text-slate-700">Nama Pengirim</span>
                      <input
                        value={payerName}
                        onChange={(event) => setPayerName(event.target.value)}
                        placeholder="Nama sesuai rekening"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-semibold text-slate-700">Bank Pengirim</span>
                      <input
                        value={payerBankName}
                        onChange={(event) => setPayerBankName(event.target.value)}
                        placeholder="Contoh: BCA / Mandiri / BRI"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                      />
                    </label>
                  </div>

                  <div className="mt-3">
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-semibold text-slate-700">Nominal Transfer</span>
                      <input
                        value={paidAmount}
                        onChange={(event) => setPaidAmount(event.target.value)}
                        type="number"
                        min="0"
                        placeholder="Nominal transfer"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                      />
                    </label>
                  </div>

                  {uploadError && (
                    <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
                      {uploadError}
                    </div>
                  )}
                  {uploadSuccess && (
                    <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
                      {uploadSuccess}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={submitPaymentProof}
                    disabled={uploadLoading}
                    className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-sm font-bold text-white shadow-sm transition hover:opacity-95 active:scale-[0.99] disabled:opacity-60"
                    style={{
                      background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}dd)`,
                    }}
                  >
                    <Upload size={16} />
                    {uploadLoading ? 'Mengirim bukti...' : 'Kirim Bukti Pembayaran'}
                  </button>
                </>
              )}
            </section>

            {/* 3. Item Order */}
            <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-bold tracking-tight text-slate-900">Rincian Item Pesanan</h2>
                <span className="text-xs font-semibold text-slate-500">
                  {payload.order.items.length} item
                </span>
              </div>
              <div className="space-y-3">
                {payload.order.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/80 p-3.5 transition hover:border-slate-300"
                    style={{ backgroundColor: softColor }}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div
                        className="grid h-16 w-16 shrink-0 place-items-center rounded-lg bg-cover bg-center text-white"
                        style={{
                          backgroundImage: item.imageUrl ? `url(${item.imageUrl})` : undefined,
                          backgroundColor: item.imageUrl ? undefined : primaryColor,
                        }}
                      >
                        {!item.imageUrl && <Package size={22} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-bold leading-tight text-slate-900 truncate">
                          {item.productName}
                        </div>
                        {item.variantName && (
                          <div className="mt-0.5 text-xs text-slate-500 truncate">{item.variantName}</div>
                        )}
                        <div className="mt-1 text-xs text-slate-500">
                          {item.quantity} × {formatRupiah(item.unitPrice)}
                        </div>
                        <div
                          className="mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                          style={{
                            backgroundColor: `${primaryColor}1a`,
                            color: primaryColor,
                          }}
                        >
                          <CheckCircle2 size={12} />
                          Akses Instan
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-sm font-extrabold tabular-nums text-slate-900">
                        {formatRupiah(item.lineTotal)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* 4. Alamat Pengiriman (jika ada) */}
            {payload.order.address && (
              <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
                <h2 className="text-base font-bold tracking-tight text-slate-900">Alamat Pengiriman</h2>
                <div className="mt-4 flex gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-4">
                  <MapPin className="mt-0.5 h-5 w-5 shrink-0" style={{ color: primaryColor }} />
                  <div className="min-w-0 text-sm">
                    <div className="font-bold text-slate-900">
                      {payload.order.address.recipientName}{' '}
                      {payload.order.address.phone && (
                        <span className="ml-1 text-xs font-medium text-slate-500">
                          · {payload.order.address.phone}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-slate-600">
                      {[
                        payload.order.address.line1,
                        payload.order.address.line2,
                        payload.order.address.district,
                        payload.order.address.city,
                        payload.order.address.province,
                        payload.order.address.postalCode,
                        payload.order.address.country,
                      ]
                        .filter(Boolean)
                        .join(', ')}
                    </div>
                    {payload.order.address.notes && (
                      <div className="mt-2 rounded-lg bg-white px-3 py-1.5 text-xs text-slate-600 border border-slate-200">
                        Catatan: {payload.order.address.notes}
                      </div>
                    )}
                  </div>
                </div>
              </section>
            )}

            {/* 5. Riwayat Pembayaran */}
            {payload.order.payments.length > 0 && (
              <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
                <h2 className="text-base font-bold tracking-tight text-slate-900">Riwayat Pembayaran</h2>
                <ul className="mt-4 divide-y divide-slate-200">
                  {payload.order.payments.map((payment) => (
                    <li key={payment.id} className="flex items-start justify-between gap-3 py-3.5">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                            style={{ backgroundColor: softColor, color: primaryColor }}
                          >
                            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: primaryColor }} />
                            {payment.status}
                          </span>
                          <span className="text-xs text-slate-500">{formatDate(payment.createdAt)}</span>
                        </div>
                        <div className="mt-1 text-xs text-slate-600">
                          {payment.payerName
                            ? `Pengirim: ${payment.payerName}${payment.payerBankName ? ` (${payment.payerBankName})` : ''}`
                            : 'Bukti transfer diunggah'}
                        </div>
                        {payment.reviewNote && (
                          <div className="mt-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600">
                            Catatan: {payment.reviewNote}
                          </div>
                        )}
                      </div>
                      <div className="shrink-0 text-right text-xs font-extrabold text-slate-900">
                        {payment.paidAmount !== null ? formatRupiah(payment.paidAmount) : 'Nominal belum tercatat'}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          {/* RIGHT COLUMN (Sticky Sidebar) */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
              <h2 className="text-base font-bold tracking-tight text-slate-900">Ringkasan Pembayaran</h2>

              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between text-slate-600">
                  <dt>Subtotal</dt>
                  <dd className="tabular-nums font-semibold text-slate-900">
                    {formatRupiah(payload.order.subtotalAmount)}
                  </dd>
                </div>
                {payload.order.discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <dt>Kode diskon</dt>
                    <dd className="tabular-nums font-bold">-{formatRupiah(payload.order.discountAmount)}</dd>
                  </div>
                )}
                <div className="flex justify-between text-slate-600">
                  <dt>Ongkir</dt>
                  <dd className="tabular-nums font-semibold text-slate-900">
                    {formatRupiah(payload.order.shippingAmount)}
                  </dd>
                </div>
              </dl>

              <div
                className="mt-4 rounded-xl px-3 py-2 text-[11px] font-medium"
                style={{ backgroundColor: softColor, color: primaryColor }}
              >
                {payload.order.shippingAmount > 0
                  ? `Pengiriman • ${payload.order.shippingLabel || 'Kurir'}`
                  : 'Digital • Akses Instan / Tanpa Ongkir • Langsung aktif'}
              </div>

              <div className="mt-4 flex items-baseline justify-between border-t border-slate-200 pt-4">
                <span className="text-sm font-semibold text-slate-700">Total Bayar</span>
                <span className="text-2xl font-extrabold tabular-nums" style={{ color: primaryColor }}>
                  {formatRupiah(payload.order.grandTotal)}
                </span>
              </div>

              {/* 3 Trust Badges */}
              <div className="mt-5 space-y-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 text-xs">
                <div className="flex items-center gap-2 text-slate-600 font-medium">
                  <Shield size={14} style={{ color: primaryColor }} />
                  <span>Transaksi terenkripsi end-to-end</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600 font-medium">
                  <Lock size={14} style={{ color: primaryColor }} />
                  <span>Akses otomatis setelah verifikasi</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600 font-medium">
                  <Headphones size={14} style={{ color: primaryColor }} />
                  <span>Bantuan admin 24/7</span>
                </div>
              </div>

              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 shadow-2xs"
              >
                <MessageCircle size={15} style={{ color: primaryColor }} />
                Hubungi Admin via WhatsApp
              </a>
            </section>
          </aside>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200/80 py-6 text-center text-xs text-slate-500 font-medium">
        © 2026 {payload.store.brandName || payload.store.name} · Halaman Status Order Publik
      </footer>
    </div>
  )
}
