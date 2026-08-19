'use client'

import React from 'react'
import { Printer, X, CheckCircle2 } from 'lucide-react'
import { formatRupiah, formatDate } from '@/lib/utils'
import { angkaKeTerbilang } from '@/lib/utils/terbilang'

interface JournalVoucherPrintProps {
  entry: {
    id?: string
    entry_number: string
    entry_date: string | Date | null
    description?: string | null
    reference_type?: string | null
    notes?: string | null
    status?: string | null
    journal_lines?: Array<{
      id?: string
      account_id?: string
      accounts?: { code?: string; name?: string }
      account_code?: string
      account_name?: string
      debit?: number | string
      credit?: number | string
      memo?: string | null
    }>
  }
  orgName?: string
  branchName?: string | null
  onClose: () => void
}

export function JournalVoucherPrint({
  entry,
  orgName = 'Nizam ERP Organization',
  branchName,
  onClose,
}: JournalVoucherPrintProps) {
  const lines = entry.journal_lines || []
  const totalDebit = lines.reduce((sum, l) => sum + Number(l.debit || 0), 0)
  const totalCredit = lines.reduce((sum, l) => sum + Number(l.credit || 0), 0)
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 print:p-0 print:bg-white print:static print:inset-auto">
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 10mm 12mm; }
          html, body {
            background: #fff !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          body * {
            visibility: hidden !important;
          }
          #voucher-print-area, #voucher-print-area * {
            visibility: visible !important;
          }
          #voucher-print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            overflow: visible !important;
            background: #fff !important;
          }
          .voucher-no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Control Bar (Hidden on Print) */}
      <div className="fixed top-4 right-4 z-[110] flex items-center gap-3 print:hidden voucher-no-print">
        <button
          type="button"
          onClick={handlePrint}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xl transition-all cursor-pointer"
        >
          <Printer size={15} />
          <span>Cetak Dokumen (Print / PDF)</span>
        </button>
        <button
          type="button"
          onClick={onClose}
          className="p-2.5 rounded-xl bg-white/90 hover:bg-white text-slate-700 shadow-xl transition-all cursor-pointer"
          title="Tutup Pratinjau Cetak"
        >
          <X size={18} />
        </button>
      </div>

      {/* Printable Sheet (Standard A4 / Letter) */}
      <div
        id="voucher-print-area"
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl p-8 sm:p-12 print:shadow-none print:border-0 print:p-6 print:max-w-none text-slate-900"
      >
        {/* Header Kop */}
        <div className="border-b-2 border-slate-900 pb-4 mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-xl font-extrabold tracking-tight uppercase text-slate-900">{orgName}</h1>
            {branchName && (
              <p className="text-xs font-semibold text-slate-600">Cabang: {branchName}</p>
            )}
            <p className="text-[10px] text-slate-400 font-medium">Sistem Enterprise Resource Planning (ERP)</p>
          </div>
          <div className="text-right">
            <h2 className="text-lg font-black tracking-wider uppercase text-blue-900">BUKTI JURNAL UMUM</h2>
            <p className="text-xs font-mono font-bold text-slate-700 mt-0.5">NO: {entry.entry_number}</p>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs mb-6 print:bg-slate-50">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Tanggal Transaksi</span>
            <span className="font-bold text-slate-800">
              {entry.entry_date ? formatDate(entry.entry_date) : '-'}
            </span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Tipe Referensi</span>
            <span className="font-bold text-slate-800 uppercase">
              {entry.reference_type?.replaceAll('_', ' ') || 'JURNAL UMUM'}
            </span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Status Jurnal</span>
            <span className="font-bold text-emerald-700 uppercase">
              {entry.status || 'POSTED'}
            </span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Keseimbangan</span>
            <span className="font-bold text-blue-700 uppercase">
              {isBalanced ? '✓ SEIMBANG (BALANCED)' : '⚠ TIDAK SEIMBANG'}
            </span>
          </div>
        </div>

        {/* Deskripsi */}
        <div className="mb-6">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Deskripsi / Perihal:</span>
          <p className="text-sm font-semibold text-slate-800 bg-slate-50/50 p-3 rounded-lg border border-slate-100 print:bg-slate-50">
            {entry.description || '-'}
          </p>
        </div>

        {/* Table Lines */}
        <div className="mb-6">
          <table className="w-full text-left border-collapse border border-slate-300 text-xs">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300">
                <th className="p-2.5 border-r border-slate-300 w-12 text-center font-bold text-slate-700">No</th>
                <th className="p-2.5 border-r border-slate-300 w-32 font-bold text-slate-700">Kode Akun</th>
                <th className="p-2.5 border-r border-slate-300 font-bold text-slate-700">Nama Akun & Keterangan</th>
                <th className="p-2.5 border-r border-slate-300 w-36 text-right font-bold text-slate-700">Debit (Rp)</th>
                <th className="p-2.5 w-36 text-right font-bold text-slate-700">Kredit (Rp)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {lines.map((line, idx) => {
                const debit = Number(line.debit || 0)
                const credit = Number(line.credit || 0)
                const accCode = line.accounts?.code || line.account_code || '-'
                const accName = line.accounts?.name || line.account_name || '-'
                return (
                  <tr key={line.id || idx} className="hover:bg-slate-50">
                    <td className="p-2.5 border-r border-slate-200 text-center font-medium text-slate-500">{idx + 1}</td>
                    <td className="p-2.5 border-r border-slate-200 font-mono font-bold text-blue-900">{accCode}</td>
                    <td className="p-2.5 border-r border-slate-200 font-medium text-slate-800">
                      <div>{accName}</div>
                      {line.memo && (
                        <div className="text-[10px] text-slate-500 italic mt-0.5">{line.memo}</div>
                      )}
                    </td>
                    <td className="p-2.5 border-r border-slate-200 text-right tabular-nums font-semibold text-slate-900">
                      {debit > 0 ? formatRupiah(debit) : '-'}
                    </td>
                    <td className="p-2.5 text-right tabular-nums font-semibold text-slate-900">
                      {credit > 0 ? formatRupiah(credit) : '-'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 border-t-2 border-slate-400 font-bold text-slate-900">
                <td colSpan={3} className="p-3 text-right uppercase tracking-wider text-xs">Total :</td>
                <td className="p-3 border-r border-slate-300 text-right tabular-nums text-xs font-extrabold text-emerald-800">
                  {formatRupiah(totalDebit)}
                </td>
                <td className="p-3 text-right tabular-nums text-xs font-extrabold text-rose-800">
                  {formatRupiah(totalCredit)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Terbilang Box */}
        <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-200 text-xs mb-8 print:bg-slate-50 print:border-slate-300">
          <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider block mb-1">
            Terbilang (Nilai Transaksi):
          </span>
          <p className="font-serif italic font-bold text-slate-800 text-sm capitalize">
            {angkaKeTerbilang(totalDebit || totalCredit)} Rupiah
          </p>
        </div>

        {/* 3-Column Authorization Signature Boxes */}
        <div className="grid grid-cols-3 gap-6 pt-4 border-t border-slate-200 text-center text-xs">
          <div className="space-y-16">
            <p className="font-bold text-slate-600 uppercase tracking-wide text-[10px]">Dibuat Oleh:</p>
            <div className="border-b border-slate-400 w-3/4 mx-auto" />
            <p className="text-[10px] text-slate-400 italic">( Staff / Pembuat )</p>
          </div>
          <div className="space-y-16">
            <p className="font-bold text-slate-600 uppercase tracking-wide text-[10px]">Diperiksa Oleh:</p>
            <div className="border-b border-slate-400 w-3/4 mx-auto" />
            <p className="text-[10px] text-slate-400 italic">( Akuntan / Supervisor )</p>
          </div>
          <div className="space-y-16">
            <p className="font-bold text-slate-600 uppercase tracking-wide text-[10px]">Disetujui Oleh:</p>
            <div className="border-b border-slate-400 w-3/4 mx-auto" />
            <p className="text-[10px] text-slate-400 italic">( Direktur / Manager Keuangan )</p>
          </div>
        </div>

        {/* Footer Note */}
        <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between text-[9px] text-slate-400">
          <span>Dicetak otomatis melalui Nizam ERP</span>
          <span>Halaman 1 dari 1</span>
        </div>
      </div>
    </div>
  )
}
