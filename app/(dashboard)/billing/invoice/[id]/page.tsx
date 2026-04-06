'use client'

import React, { useEffect, useState } from 'react'
import { Printer, ArrowLeft, Mail, Phone, MapPin, Building2, CreditCard } from 'lucide-react'
import { formatRupiah } from '@/lib/utils'
import { useParams, useRouter } from 'next/navigation'
import { getBillingInvoicePrintData } from '@/modules/organization/actions/billing.actions'

function extractInvoiceNote(rawDescription: string | null | undefined) {
  const normalizedDescription = String(rawDescription || '').replace(/\\n/g, '\n')
  const blockMatch = normalizedDescription.match(/(?:^|\n)(Catatan(?:\s+tambahan|\s+penawaran|\s+invoice)?|Note)\s*[:\-]?\s*([\s\S]*)$/i)
  if (blockMatch?.[2]) return blockMatch[2].trim()
  return ''
}

export default function InvoicePrintPage() {
  const params = useParams()
  const router = useRouter()
  const [invoice, setInvoice] = useState<any>(null)
  const [saasConfig, setSaasConfig] = useState<any>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      const invoiceId = Array.isArray(params.id) ? params.id[0] : params.id
      const result = await getBillingInvoicePrintData(String(invoiceId || ''))

      if ('error' in result) {
        setInvoice(null)
      } else {
        setInvoice(result.invoice)
        setSaasConfig(result.saasConfig || {})
      }
      setLoading(false)
    }
    fetchData()
  }, [params.id])

  const handlePrint = () => {
    window.print()
  }

  if (loading) return <div className="p-12 text-center text-slate-400 font-bold animate-pulse">Memuat Invoice...</div>
  if (!invoice) return <div className="p-12 text-center text-rose-500 font-bold italic">Invoice Tidak Ditemukan.</div>

  const bank = saasConfig.bank_info || {}
  const support = saasConfig.support_info || {}
  const invoiceNote = extractInvoiceNote(invoice.item_description)
  const orgSettings = invoice.organization?.settings || {}
  const companyProfile = {
    name: orgSettings.brand_name || invoice.organization?.name || bank.name || 'Perusahaan',
    logo: invoice.organization?.logo_url || '/logo.png',
    address: orgSettings.company_address || 'Alamat perusahaan belum diatur.',
    email: orgSettings.email || invoice.organization?.owner_email || 'billing@nizam.com',
    hotline: orgSettings.hotline || support.wa || '',
    website: orgSettings.website || '',
  }

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4; margin: 12mm; }
          body {
            background: #fff !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          body * { visibility: hidden !important; }
          #invoice-card, #invoice-card * { visibility: visible !important; }
          #invoice-card {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            max-width: none;
            margin: 0;
            padding: 0;
            border: none;
            box-shadow: none;
            overflow: visible;
            background: #fff;
          }
          .invoice-no-print { display: none !important; }
        }
      `}</style>

      <div className="min-h-screen bg-slate-50 py-10 px-4 print:bg-white print:p-0">
        <div className="max-w-4xl mx-auto space-y-5">
          <div className="flex items-center justify-between invoice-no-print">
            <button onClick={() => router.back()} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-bold transition-all">
              <ArrowLeft size={18} /> Kembali
            </button>
            <button onClick={handlePrint} className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-slate-800 transition-all">
              <Printer size={16} /> Print / PDF
            </button>
          </div>

          <article id="invoice-card" className="bg-white rounded-[32px] border border-slate-200 shadow-md overflow-hidden print:rounded-none print:border-none print:shadow-none print:text-[11px]">
            <header className="px-10 py-8 border-b-2 border-slate-900">
              <div className="flex items-start justify-between gap-8">
                <div className="flex items-start gap-4">
                  <img src={companyProfile.logo} alt="Logo Perusahaan" className="w-14 h-14 object-contain" />
                  <div className="space-y-1.5">
                    <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">{companyProfile.name}</h1>
                    <p className="text-xs font-semibold text-slate-600 flex items-center gap-2">
                      <MapPin size={12} className="text-slate-400" /> {companyProfile.address}
                    </p>
                    <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold text-slate-500">
                      <span className="inline-flex items-center gap-1.5"><Mail size={11} /> {companyProfile.email}</span>
                      {companyProfile.hotline && <span className="inline-flex items-center gap-1.5"><Phone size={11} /> {companyProfile.hotline}</span>}
                      {companyProfile.website && <span>{companyProfile.website}</span>}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <h2 className="text-4xl font-black text-slate-900 tracking-tight">INVOICE</h2>
                  <p className="text-sm font-black text-slate-700 mt-2">{invoice.invoice_number}</p>
                  <p className="text-xs font-semibold text-slate-500 mt-1">
                    Tanggal: {new Date(invoice.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>
              </div>
            </header>

            <section className="px-10 py-6 border-b border-slate-200 grid grid-cols-2 gap-10">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Tagihan Untuk</p>
                <p className="text-lg font-black text-slate-900">{invoice.organization?.name || '-'}</p>
                <p className="text-xs text-slate-500 mt-1">Organisasi terdaftar pada platform</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Status</p>
                <span className={`inline-flex px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${invoice.status === 'PAID' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                  {invoice.status === 'PAID' ? 'Lunas' : 'Menunggu Pembayaran'}
                </span>
                <p className="text-xs font-semibold text-slate-500 mt-2">
                  Batas Waktu: {new Date(invoice.due_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>
            </section>

            <section className="px-10 py-6">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-slate-300">
                    <th className="py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Deskripsi</th>
                    <th className="py-3 text-right text-[10px] font-black text-slate-500 uppercase tracking-widest w-24">Qty</th>
                    <th className="py-3 text-right text-[10px] font-black text-slate-500 uppercase tracking-widest w-56">Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-slate-100">
                    <td className="py-5">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-100 text-slate-700 rounded-lg">
                          <Building2 size={18} />
                        </div>
                        <div>
                          <p className="font-black text-slate-900">{invoice.item_name || 'Layanan Berlangganan'}</p>
                          <p className="text-xs text-slate-500">SaaS Subscription</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-5 text-right font-bold text-slate-700">1</td>
                    <td className="py-5 text-right font-black text-slate-900">{formatRupiah(invoice.amount)}</td>
                  </tr>
                </tbody>
              </table>
            </section>

            <section className="px-10 py-6 bg-slate-50 border-t border-slate-200 grid grid-cols-[1.2fr_0.8fr] gap-8">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-3">
                  <CreditCard size={12} /> Pembayaran Transfer
                </p>
                <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{bank.bank || '-'}</p>
                  <p className="text-xl font-black text-slate-900 font-mono">{bank.account || '-'}</p>
                  <p className="text-xs font-semibold text-slate-500">a.n {bank.name || companyProfile.name}</p>
                </div>
                {invoiceNote && (
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Catatan</p>
                    <p className="mt-2 whitespace-pre-line text-xs font-semibold leading-relaxed text-slate-600">{invoiceNote}</p>
                  </div>
                )}
              </div>

              <div className="space-y-2 self-end">
                <div className="flex items-center justify-between text-sm font-semibold text-slate-600">
                  <span>Subtotal</span>
                  <span>{formatRupiah(invoice.amount)}</span>
                </div>
                <div className="flex items-center justify-between text-sm font-semibold text-slate-600">
                  <span>Pajak</span>
                  <span>{formatRupiah(0)}</span>
                </div>
                <div className="border-t border-slate-300 pt-2 flex items-center justify-between">
                  <span className="text-sm font-black text-slate-900 uppercase tracking-wider">Grand Total</span>
                  <span className="text-xl font-black text-slate-900">{formatRupiah(invoice.amount)}</span>
                </div>
              </div>
            </section>

            <footer className="px-10 py-5 text-center">
              <p className="text-[11px] font-semibold text-slate-500">
                Dokumen ini diterbitkan otomatis oleh sistem dan sah sebagai bukti transaksi resmi.
              </p>
            </footer>
          </article>
        </div>
      </div>
    </>
  )
}
