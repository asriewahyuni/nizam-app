'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Building2, FileText, Mail, MapPin, Phone, Printer } from 'lucide-react'
import { formatDate, formatRupiah } from '@/lib/utils'

type QuickBillInvoice = {
  id: string
  doc_number: string
  doc_href: string | null
  due_date: string
  grand_total: number
  paid_amount: number
  returned_amount: number
  outstanding: number
  days_overdue: number
  aging_bucket: string
  source_label: string
}

type QuickBillDocumentSnapshot = {
  docNumber: string
  issuedAt: string
  customer: {
    id: string
    name: string
    email: string | null
    phone: string | null
    address: string | null
  }
  totals: {
    invoiceCount: number
    overdueInvoiceCount: number
    totalOutstanding: number
    oldestDueDate: string | null
    maxDaysOverdue: number
  }
  bucketBreakdown: Array<{
    bucket: string
    amount: number
  }>
  invoices: QuickBillInvoice[]
}

type CompanyProfile = {
  name: string
  logo: string
  address: string
  email: string
  hotline: string
  website: string
}

function highlightClass(bucket: string) {
  if (bucket === 'Current') return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (bucket === '0-30 Days' || bucket === '31-60 Days') return 'bg-amber-50 text-amber-700 border-amber-200'
  return 'bg-rose-50 text-rose-700 border-rose-200'
}

/**
 * Printable customer collection document that consolidates open AR invoices
 * without generating a new accounting transaction.
 */
export default function QuickBillDocument({
  snapshot,
  companyProfile,
  activeBranchName,
}: {
  snapshot: QuickBillDocumentSnapshot
  companyProfile: CompanyProfile
  activeBranchName?: string | null
}) {
  const router = useRouter()

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4; margin: 10mm; }
          body {
            background: #fff !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          body * { visibility: hidden !important; }
          #quick-bill-card, #quick-bill-card * { visibility: visible !important; }
          #quick-bill-card {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            max-width: none;
            margin: 0;
            border: none;
            box-shadow: none;
            border-radius: 0;
          }
          .quick-bill-no-print { display: none !important; }
        }
      `}</style>

      <div className="min-h-screen bg-slate-50 px-4 py-10 print:bg-white print:p-0">
        <div className="mx-auto max-w-5xl space-y-5">
          <div className="quick-bill-no-print flex items-center justify-between">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 font-bold text-slate-500 transition-colors hover:text-slate-900"
            >
              <ArrowLeft size={18} />
              Kembali
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 rounded-2xl bg-slate-900 px-6 py-2.5 text-xs font-black uppercase tracking-widest text-white transition-colors hover:bg-emerald-600"
            >
              <Printer size={16} />
              Print / PDF
            </button>
          </div>

          <article
            id="quick-bill-card"
            className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-md print:rounded-none print:border-none print:shadow-none"
          >
            <header className="border-b-2 border-slate-900 px-10 py-8">
              <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
                <div className="flex items-start gap-4">
                  <Image
                    src={companyProfile.logo}
                    alt="Logo Perusahaan"
                    width={56}
                    height={56}
                    unoptimized
                    className="h-14 w-14 object-contain"
                  />
                  <div className="space-y-1.5">
                    <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900">{companyProfile.name}</h1>
                    <p className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                      <MapPin size={12} className="text-slate-400" />
                      {companyProfile.address}
                    </p>
                    <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold text-slate-500">
                      {companyProfile.email && <span className="inline-flex items-center gap-1.5"><Mail size={11} /> {companyProfile.email}</span>}
                      {companyProfile.hotline && <span className="inline-flex items-center gap-1.5"><Phone size={11} /> {companyProfile.hotline}</span>}
                      {companyProfile.website && <span>{companyProfile.website}</span>}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-600">Non-Posting Collection Bill</p>
                  <h2 className="mt-2 text-4xl font-black tracking-tight text-slate-900">QUICK BILL</h2>
                  <p className="mt-2 text-sm font-black text-slate-700">{snapshot.docNumber}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">Tanggal terbit: {formatDate(snapshot.issuedAt)}</p>
                  {activeBranchName && (
                    <p className="mt-1 text-[11px] font-semibold text-slate-500">Unit aktif: {activeBranchName}</p>
                  )}
                </div>
              </div>
            </header>

            <section className="grid gap-6 border-b border-slate-200 px-10 py-6 md:grid-cols-[1.2fr_0.8fr]">
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tagihan Untuk</p>
                  <p className="mt-1 text-xl font-black text-slate-900">{snapshot.customer.name}</p>
                  {snapshot.customer.address && <p className="mt-1 text-sm text-slate-500">{snapshot.customer.address}</p>}
                  <div className="mt-2 flex flex-wrap gap-3 text-xs font-semibold text-slate-500">
                    {snapshot.customer.email && <span>{snapshot.customer.email}</span>}
                    {snapshot.customer.phone && <span>{snapshot.customer.phone}</span>}
                  </div>
                </div>
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">Catatan</p>
                  <p className="mt-2 text-xs font-semibold leading-relaxed text-amber-900">
                    Dokumen ini adalah ringkasan penagihan dari invoice AR yang masih outstanding. Dokumen ini tidak membuat jurnal baru dan tidak mengubah saldo piutang.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Grand Total Outstanding</p>
                  <p className="mt-2 text-3xl font-black tracking-tight text-slate-900">{formatRupiah(snapshot.totals.totalOutstanding)}</p>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-xs font-semibold text-slate-500">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Invoice</p>
                      <p className="mt-1 text-sm font-black text-slate-900">{snapshot.totals.invoiceCount}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Overdue</p>
                      <p className="mt-1 text-sm font-black text-slate-900">{snapshot.totals.overdueInvoiceCount}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Jatuh Tempo Terlama</p>
                      <p className="mt-1 text-sm font-black text-slate-900">{snapshot.totals.oldestDueDate ? formatDate(snapshot.totals.oldestDueDate) : '-'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Maks. Keterlambatan</p>
                      <p className="mt-1 text-sm font-black text-slate-900">
                        {snapshot.totals.maxDaysOverdue > 0 ? `${snapshot.totals.maxDaysOverdue} hari` : 'Belum jatuh tempo'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 p-5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Komposisi Aging</p>
                  <div className="mt-3 space-y-3">
                    {snapshot.bucketBreakdown.map((item) => (
                      <div key={item.bucket} className="flex items-center justify-between gap-3 text-xs font-semibold">
                        <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase ${highlightClass(item.bucket)}`}>
                          {item.bucket}
                        </span>
                        <span className="font-black text-slate-900">{formatRupiah(item.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section className="px-10 py-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-xl bg-slate-100 p-2 text-slate-700">
                  <Building2 size={18} />
                </div>
                <div>
                  <p className="text-sm font-black uppercase tracking-widest text-slate-900">Rincian Invoice Outstanding</p>
                  <p className="text-xs font-medium text-slate-500">Setiap baris di bawah menjadi sumber penagihan pada Quick Bill ini.</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-slate-300 text-left">
                      <th className="py-3 text-[10px] font-black uppercase tracking-widest text-slate-500">No. Dokumen</th>
                      <th className="py-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Jatuh Tempo</th>
                      <th className="py-3 text-right text-[10px] font-black uppercase tracking-widest text-slate-500">Nilai Invoice</th>
                      <th className="py-3 text-right text-[10px] font-black uppercase tracking-widest text-slate-500">Sudah Bayar</th>
                      <th className="py-3 text-right text-[10px] font-black uppercase tracking-widest text-slate-500">Retur</th>
                      <th className="py-3 text-right text-[10px] font-black uppercase tracking-widest text-slate-500">Outstanding</th>
                      <th className="py-3 text-center text-[10px] font-black uppercase tracking-widest text-slate-500">Aging</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.invoices.map((invoice) => (
                      <tr key={invoice.id} className="border-b border-slate-100 align-top">
                        <td className="py-4">
                          <div className="space-y-1">
                            <p className="font-black text-slate-900">{invoice.doc_number}</p>
                            <p className="text-xs text-slate-500">{invoice.source_label}</p>
                            {invoice.doc_href && (
                              <Link
                                href={invoice.doc_href}
                                target="_blank"
                                className="quick-bill-no-print inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:underline"
                              >
                                <FileText size={12} />
                                Buka invoice sumber
                              </Link>
                            )}
                          </div>
                        </td>
                        <td className="py-4 text-sm font-semibold text-slate-600">
                          {formatDate(invoice.due_date)}
                          <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
                            {invoice.days_overdue > 0 ? `${invoice.days_overdue} hari` : 'Current'}
                          </p>
                        </td>
                        <td className="py-4 text-right text-sm font-bold text-slate-700">{formatRupiah(invoice.grand_total)}</td>
                        <td className="py-4 text-right text-sm font-bold text-emerald-600">{formatRupiah(invoice.paid_amount)}</td>
                        <td className="py-4 text-right text-sm font-bold text-rose-500">{formatRupiah(invoice.returned_amount)}</td>
                        <td className="py-4 text-right text-base font-black tracking-tight text-slate-900">{formatRupiah(invoice.outstanding)}</td>
                        <td className="py-4 text-center">
                          <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase ${highlightClass(invoice.aging_bucket)}`}>
                            {invoice.aging_bucket}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="border-t border-slate-200 bg-slate-50 px-10 py-6">
              <div className="mb-4">
                <p className="text-sm font-black uppercase tracking-widest text-slate-900">Lampiran Dokumen</p>
                <p className="mt-1 text-xs font-medium text-slate-500">Daftar invoice sumber yang menjadi lampiran referensi penagihan.</p>
              </div>

              <div className="grid gap-3">
                {snapshot.invoices.map((invoice, index) => (
                  <div key={`${invoice.id}-attachment`} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Lampiran {index + 1}</p>
                      <p className="mt-1 text-sm font-black text-slate-900">{invoice.doc_number}</p>
                      <p className="mt-1 text-xs font-medium text-slate-500">
                        {invoice.source_label} • Due {formatDate(invoice.due_date)} • Outstanding {formatRupiah(invoice.outstanding)}
                      </p>
                    </div>
                    {invoice.doc_href && (
                      <Link
                        href={invoice.doc_href}
                        target="_blank"
                        className="quick-bill-no-print inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-[10px] font-black uppercase text-slate-700 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                      >
                        Buka Lampiran
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            </section>

            <footer className="border-t border-slate-200 px-10 py-5 text-center">
              <p className="text-[11px] font-semibold text-slate-500">
                Quick Bill ini dibuat otomatis dari Aging AR untuk kebutuhan penagihan. Validasi akhir tetap mengacu pada invoice sumber yang terlampir.
              </p>
            </footer>
          </article>
        </div>
      </div>
    </>
  )
}
