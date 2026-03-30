'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  CreditCard,
  Download,
  Printer,
  ShieldCheck,
} from 'lucide-react'
import type { OperatorDocumentSnapshot } from '@/modules/saas/actions/operator-sales.actions'

function formatIdr(value: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value || 0)
}

function formatDate(dateLike: string | null | undefined) {
  if (!dateLike) return '-'

  const date = new Date(dateLike)
  if (Number.isNaN(date.getTime())) return '-'

  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

function normalizeBankInfo(raw: unknown) {
  if (!raw) return null

  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>
      return {
        bank: typeof parsed.bank === 'string' ? parsed.bank : '',
        account: typeof parsed.account === 'string' ? parsed.account : '',
        name: typeof parsed.name === 'string' ? parsed.name : '',
      }
    } catch {
      return null
    }
  }

  if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>
    return {
      bank: typeof obj.bank === 'string' ? obj.bank : '',
      account: typeof obj.account === 'string' ? obj.account : '',
      name: typeof obj.name === 'string' ? obj.name : '',
    }
  }

  return null
}

function parseCurrencyValue(raw: string) {
  const normalized = raw.replace(/[^\d-]/g, '')
  if (!normalized) return 0
  const value = Number(normalized)
  return Number.isFinite(value) ? value : 0
}

function parsePercentValue(raw: string) {
  const normalized = raw.replace(/[^\d.,-]/g, '').replace(',', '.')
  if (!normalized) return 0
  const value = Number(normalized)
  return Number.isFinite(value) ? value : 0
}

type QuoteAddon = {
  name: string
  promoPrice: number
  anchorPrice: number | null
}

type QuoteBreakdown = {
  baseAmount: number | null
  addons: QuoteAddon[]
  aiTokenLabel: string | null
  aiTokenTotal: number
  extraEntityQty: number
  extraEntityUnitPrice: number
  extraEntityTotal: number
  extraBranchQty: number
  extraBranchUnitPrice: number
  extraBranchTotal: number
  subtotal: number | null
  discountPercent: number | null
  discountAmount: number | null
  taxPercent: number | null
  taxAmount: number | null
  grandTotal: number | null
  modules: string[]
  note: string | null
}

function createEmptyBreakdown(): QuoteBreakdown {
  return {
    baseAmount: null,
    addons: [],
    aiTokenLabel: null,
    aiTokenTotal: 0,
    extraEntityQty: 0,
    extraEntityUnitPrice: 0,
    extraEntityTotal: 0,
    extraBranchQty: 0,
    extraBranchUnitPrice: 0,
    extraBranchTotal: 0,
    subtotal: null,
    discountPercent: null,
    discountAmount: null,
    taxPercent: null,
    taxAmount: null,
    grandTotal: null,
    modules: [],
    note: null,
  }
}

function parseQuoteBreakdown(rawDescription: string | null | undefined): QuoteBreakdown {
  const breakdown = createEmptyBreakdown()
  const lines = String(rawDescription || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  lines.forEach((line) => {
    if (line.startsWith('Paket dasar:')) {
      breakdown.baseAmount = parseCurrencyValue(line.slice('Paket dasar:'.length))
      return
    }

    const addonWithAnchor = line.match(/^Add-on\s+(.+):\s+(.+)\s+->\s+(.+)$/i)
    if (addonWithAnchor) {
      breakdown.addons.push({
        name: addonWithAnchor[1].trim(),
        anchorPrice: parseCurrencyValue(addonWithAnchor[2]),
        promoPrice: parseCurrencyValue(addonWithAnchor[3]),
      })
      return
    }

    const addonSimple = line.match(/^Add-on\s+(.+):\s+(.+)$/i)
    if (addonSimple) {
      breakdown.addons.push({
        name: addonSimple[1].trim(),
        anchorPrice: null,
        promoPrice: parseCurrencyValue(addonSimple[2]),
      })
      return
    }

    if (line.startsWith('Token AI:')) {
      const tokenText = line.slice('Token AI:'.length).trim()
      if (tokenText.toLowerCase() === 'tidak ada') return

      const lastOpenParen = tokenText.lastIndexOf('(')
      const lastCloseParen = tokenText.endsWith(')') ? tokenText.length - 1 : -1
      if (lastOpenParen > 0 && lastCloseParen > lastOpenParen) {
        breakdown.aiTokenLabel = tokenText.slice(0, lastOpenParen).trim()
        breakdown.aiTokenTotal = parseCurrencyValue(tokenText.slice(lastOpenParen + 1, lastCloseParen))
      } else {
        breakdown.aiTokenLabel = tokenText
      }
      return
    }

    const extraEntityMatch = line.match(/^Entitas tambahan:\s+(\d+)\s+x\s+(.+?)\s+=\s+(.+)$/i)
    if (extraEntityMatch) {
      breakdown.extraEntityQty = Number(extraEntityMatch[1] || 0)
      breakdown.extraEntityUnitPrice = parseCurrencyValue(extraEntityMatch[2])
      breakdown.extraEntityTotal = parseCurrencyValue(extraEntityMatch[3])
      return
    }

    const extraBranchMatch = line.match(/^Cabang tambahan:\s+(\d+)\s+x\s+(.+?)\s+=\s+(.+)$/i)
    if (extraBranchMatch) {
      breakdown.extraBranchQty = Number(extraBranchMatch[1] || 0)
      breakdown.extraBranchUnitPrice = parseCurrencyValue(extraBranchMatch[2])
      breakdown.extraBranchTotal = parseCurrencyValue(extraBranchMatch[3])
      return
    }

    if (line.startsWith('Subtotal:')) {
      breakdown.subtotal = parseCurrencyValue(line.slice('Subtotal:'.length))
      return
    }

    const discountMatch = line.match(/^Diskon:\s+([\d.,]+)%\s+\((.+)\)$/i)
    if (discountMatch) {
      breakdown.discountPercent = parsePercentValue(discountMatch[1])
      breakdown.discountAmount = parseCurrencyValue(discountMatch[2])
      return
    }

    const taxMatch = line.match(/^Pajak:\s+([\d.,]+)%\s+\((.+)\)$/i)
    if (taxMatch) {
      breakdown.taxPercent = parsePercentValue(taxMatch[1])
      breakdown.taxAmount = parseCurrencyValue(taxMatch[2])
      return
    }

    if (line.startsWith('Grand total:')) {
      breakdown.grandTotal = parseCurrencyValue(line.slice('Grand total:'.length))
      return
    }

    if (line.startsWith('Modul dipilih:')) {
      breakdown.modules = line
        .slice('Modul dipilih:'.length)
        .split(',')
        .map((moduleName) => moduleName.trim())
        .filter(Boolean)
      return
    }

    if (line.startsWith('Catatan:')) {
      breakdown.note = line.slice('Catatan:'.length).trim() || null
    }
  })

  return breakdown
}

type PricingRow = {
  label: string
  qty: number
  total: number
  note?: string | null
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-600">
      {children}
    </span>
  )
}

function TotalsRow({
  label,
  value,
  strong = false,
}: {
  label: string
  value: string
  strong?: boolean
}) {
  return (
    <div className={`flex items-center justify-between ${strong ? 'text-base font-black text-slate-900' : 'text-sm font-semibold text-slate-600'}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}

export default function SaasDocumentView({
  snapshot,
}: {
  snapshot: OperatorDocumentSnapshot
}) {
  const router = useRouter()
  const { invoice, saasConfig, packageModules } = snapshot

  const isQuotation = String(invoice.invoice_number || '').startsWith('QTN-SAAS-')
  const documentLabel = isQuotation ? 'Surat Penawaran' : 'Invoice'
  const documentFilePrefix = isQuotation ? 'penawaran' : 'invoice'
  const itemName = invoice.item_name || `${isQuotation ? 'Penawaran SaaS' : 'Invoice SaaS'}${invoice.package?.name ? `: ${invoice.package.name}` : ''}`

  const bankInfo = useMemo(() => normalizeBankInfo(saasConfig.bank_info), [saasConfig.bank_info])
  const breakdown = useMemo(() => parseQuoteBreakdown(invoice.item_description), [invoice.item_description])

  const includedModules = breakdown.modules.length > 0 ? breakdown.modules : packageModules
  const selectedAddonNames = breakdown.addons.map((addon) => addon.name)

  const pricingRows = useMemo<PricingRow[]>(() => {
    const rows: PricingRow[] = []

    if (breakdown.baseAmount && breakdown.baseAmount > 0) {
      rows.push({
        label: itemName,
        qty: 1,
        total: breakdown.baseAmount,
        note: invoice.package?.billing ? `Skema billing: ${invoice.package.billing}` : null,
      })
    }

    breakdown.addons.forEach((addon) => {
      rows.push({
        label: `Add-on ${addon.name}`,
        qty: 1,
        total: addon.promoPrice,
        note: addon.anchorPrice && addon.anchorPrice > addon.promoPrice
          ? `Harga normal ${formatIdr(addon.anchorPrice)}`
          : addon.anchorPrice
            ? `Harga add-on ${formatIdr(addon.anchorPrice)}`
            : null,
      })
    })

    if (breakdown.aiTokenTotal > 0) {
      rows.push({
        label: breakdown.aiTokenLabel || 'Paket Token AI',
        qty: 1,
        total: breakdown.aiTokenTotal,
        note: 'Top-up token AI',
      })
    }

    if (breakdown.extraEntityQty > 0 && breakdown.extraEntityTotal > 0) {
      rows.push({
        label: 'Entitas tambahan',
        qty: breakdown.extraEntityQty,
        total: breakdown.extraEntityTotal,
        note: `${formatIdr(breakdown.extraEntityUnitPrice)} per entitas`,
      })
    }

    if (breakdown.extraBranchQty > 0 && breakdown.extraBranchTotal > 0) {
      rows.push({
        label: 'Cabang tambahan',
        qty: breakdown.extraBranchQty,
        total: breakdown.extraBranchTotal,
        note: `${formatIdr(breakdown.extraBranchUnitPrice)} per cabang`,
      })
    }

    if (rows.length === 0) {
      rows.push({
        label: itemName,
        qty: 1,
        total: Number(invoice.amount || 0),
        note: invoice.package?.billing ? `Skema billing: ${invoice.package.billing}` : null,
      })
    }

    return rows
  }, [breakdown, invoice.amount, invoice.package?.billing, itemName])

  const subtotalAmount = breakdown.subtotal
    ?? pricingRows.reduce((sum, row) => sum + row.total, 0)
    ?? Number(invoice.amount || 0)
  const discountAmount = breakdown.discountAmount ?? Number(invoice.discount_amount || 0)
  const taxAmount = breakdown.taxAmount ?? Number(invoice.tax_amount || 0)
  const grandTotal = Number(invoice.amount || breakdown.grandTotal || subtotalAmount - discountAmount + taxAmount || 0)
  const statusLabel = invoice.status === 'PAID'
    ? 'Lunas'
    : isQuotation
      ? 'Menunggu Persetujuan'
      : 'Menunggu Pembayaran'

  const handlePrintOrPdf = () => {
    window.print()
  }

  const handleDownloadHtml = () => {
    const card = document.getElementById('saas-document-card')
    if (!card) return

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${documentLabel} ${invoice.invoice_number}</title><style>body{font-family:Arial,sans-serif;background:#fff;color:#0f172a;padding:24px}*{box-sizing:border-box}article{max-width:960px;margin:0 auto;border:1px solid #e2e8f0;border-radius:24px;overflow:hidden}section,header,footer{padding:24px}table{width:100%;border-collapse:collapse}th,td{padding:12px 0;border-bottom:1px solid #e2e8f0;text-align:left}th:last-child,td:last-child{text-align:right}</style></head><body>${card.outerHTML}</body></html>`
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${documentFilePrefix}-${invoice.invoice_number}.html`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 print:bg-white print:p-0">
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-600"
          >
            <ArrowLeft size={14} /> Kembali
          </button>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handlePrintOrPdf}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-black uppercase tracking-wider text-white"
            >
              <Printer size={14} /> Print / Download PDF
            </button>
            <button
              type="button"
              onClick={handleDownloadHtml}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-600"
            >
              <Download size={14} /> Download HTML
            </button>
          </div>
        </div>

        <article
          id="saas-document-card"
          className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm print:rounded-none print:border-none print:shadow-none"
        >
          <header className="bg-slate-950 px-6 py-8 text-white md:px-10">
            <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-100">
                  <ShieldCheck size={12} /> NIZAM ERP
                </div>
                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.35em] text-slate-300">Dokumen Komersial</p>
                  <h1 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">{documentLabel}</h1>
                  <p className="mt-2 text-xs font-semibold text-slate-300">
                    {isQuotation
                      ? 'Ruang lingkup layanan dan nilai komersial yang ditawarkan kepada calon pelanggan.'
                      : 'Tagihan resmi atas layanan SaaS yang telah disepakati.'}
                  </p>
                </div>
              </div>

              <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4 md:min-w-[280px]">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300">Nomor Dokumen</p>
                  <p className="mt-1 text-sm font-black text-white">{invoice.invoice_number}</p>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300">Tanggal Terbit</p>
                    <p className="mt-1 font-bold">{formatDate(invoice.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300">Berlaku Sampai</p>
                    <p className="mt-1 font-bold">{formatDate(invoice.due_date)}</p>
                  </div>
                </div>
              </div>
            </div>
          </header>

          <section className="grid grid-cols-1 gap-5 border-b border-slate-100 px-6 py-6 md:grid-cols-[1.3fr_0.7fr] md:px-10">
            <div className="space-y-3">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Kepada Yth.</p>
              <div>
                <p className="text-2xl font-black tracking-tight text-slate-900">{invoice.organization?.name || '-'}</p>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  {invoice.organization?.owner_email || 'Organisasi Tenant NIZAM SaaS'}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Ringkasan</p>
              <div className="mt-3 space-y-2 text-sm font-semibold text-slate-600">
                <div className="flex items-center justify-between gap-4">
                  <span>Status</span>
                  <Badge>{statusLabel}</Badge>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span>Paket</span>
                  <span className="text-right font-black text-slate-900">{invoice.package?.name || '-'}</span>
                </div>
                {invoice.package?.billing && (
                  <div className="flex items-center justify-between gap-4">
                    <span>Billing</span>
                    <span className="text-right font-black text-slate-900">{invoice.package.billing}</span>
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="px-6 py-6 md:px-10">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                    <th className="py-3">Uraian</th>
                    <th className="py-3 text-right">Qty</th>
                    <th className="py-3 text-right">Nominal</th>
                  </tr>
                </thead>
                <tbody>
                  {pricingRows.map((row, index) => (
                    <tr key={`${row.label}-${index}`} className="border-b border-slate-100">
                      <td className="py-4">
                        <div className="flex items-start gap-3">
                          <div className="rounded-xl bg-slate-100 p-2 text-slate-700">
                            <Building2 size={16} />
                          </div>
                          <div>
                            <p className="font-black text-slate-900">{row.label}</p>
                            {row.note && (
                              <p className="mt-1 text-xs font-medium text-slate-500">{row.note}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-4 text-right text-sm font-black text-slate-700">{row.qty}</td>
                      <td className="py-4 text-right text-sm font-black text-slate-900">{formatIdr(row.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {(includedModules.length > 0 || selectedAddonNames.length > 0 || breakdown.note) && (
            <section className="grid grid-cols-1 gap-4 border-t border-slate-100 bg-slate-50 px-6 py-6 md:grid-cols-3 md:px-10">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Cakupan Modul</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {includedModules.length > 0 ? includedModules.map((moduleName) => (
                    <span
                      key={moduleName}
                      className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700"
                    >
                      {moduleName}
                    </span>
                  )) : (
                    <span className="text-xs font-semibold text-slate-400">Tidak ada data modul.</span>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Add-on Tercakup</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedAddonNames.length > 0 ? selectedAddonNames.map((addonName) => (
                    <span
                      key={addonName}
                      className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-indigo-700"
                    >
                      {addonName}
                    </span>
                  )) : (
                    <span className="text-xs font-semibold text-slate-400">Tidak ada add-on tambahan.</span>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Catatan Penawaran</p>
                <p className="mt-3 text-sm font-medium leading-relaxed text-slate-600">
                  {breakdown.note || 'Tidak ada catatan tambahan.'}
                </p>
              </div>
            </section>
          )}

          <section className="grid grid-cols-1 gap-6 px-6 py-6 md:grid-cols-[1.1fr_0.9fr] md:px-10">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                <CreditCard size={12} /> Pembayaran
              </div>
              {bankInfo?.bank || bankInfo?.account || bankInfo?.name ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-black text-slate-800">{bankInfo?.bank || '-'}</p>
                  <p className="mt-1 font-mono text-lg font-black tracking-tight text-slate-900">{bankInfo?.account || '-'}</p>
                  <p className="text-xs font-semibold text-slate-500">a.n {bankInfo?.name || '-'}</p>
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs font-semibold text-slate-500">
                  Informasi rekening belum diatur di `saas_config.bank_info`.
                </div>
              )}
              <div className="inline-flex items-center gap-2 text-[11px] font-bold text-slate-500">
                <CalendarDays size={12} /> Dokumen diterbitkan otomatis oleh sistem NIZAM ERP.
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="space-y-3">
                <TotalsRow label="Subtotal" value={formatIdr(subtotalAmount)} />
                {discountAmount > 0 && (
                  <TotalsRow
                    label={`Diskon${(breakdown.discountPercent ?? Number(invoice.discount_percent || 0)) > 0 ? ` (${breakdown.discountPercent ?? Number(invoice.discount_percent || 0)}%)` : ''}`}
                    value={formatIdr(discountAmount)}
                  />
                )}
                {taxAmount > 0 && (
                  <TotalsRow
                    label={`Pajak${(breakdown.taxPercent ?? Number(invoice.tax_percent || 0)) > 0 ? ` (${breakdown.taxPercent ?? Number(invoice.tax_percent || 0)}%)` : ''}`}
                    value={formatIdr(taxAmount)}
                  />
                )}
                <div className="border-t border-slate-200 pt-3">
                  <TotalsRow label="Grand Total" value={formatIdr(grandTotal)} strong />
                </div>
              </div>
            </div>
          </section>

          <footer className="border-t border-slate-100 px-6 py-5 text-center md:px-10">
            <p className="mx-auto max-w-3xl text-[11px] font-semibold leading-relaxed text-slate-500">
              {isQuotation
                ? 'Surat penawaran ini sah sebagai acuan komersial hingga batas waktu yang tercantum. Mohon lakukan konfirmasi sebelum jatuh tempo apabila penawaran disetujui.'
                : 'Invoice ini sah sebagai bukti tagihan resmi atas layanan SaaS NIZAM ERP. Simpan dokumen ini sebagai arsip transaksi perusahaan.'}
            </p>
          </footer>
        </article>
      </div>
    </div>
  )
}
