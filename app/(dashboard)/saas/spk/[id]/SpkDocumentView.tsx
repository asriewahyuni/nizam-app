'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Printer, CheckCircle2, PlayCircle } from 'lucide-react'
import { issueSpkDocument, updateSpkStatus } from '@/modules/saas/actions/spk.actions'
import type { SpkDocument } from '@/modules/saas/actions/spk.actions'

type Props = { doc: SpkDocument }

function formatDate(d: string | null) {
  if (!d) return '____________________________'
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(d))
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Draft',
  ISSUED: 'Diterbitkan',
  IN_PROGRESS: 'Sedang Berjalan',
  COMPLETED: 'Selesai',
}
const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-600',
  ISSUED: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-amber-100 text-amber-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
}

export default function SpkDocumentView({ doc }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleIssue() {
    startTransition(async () => {
      await issueSpkDocument(doc.id)
      router.refresh()
    })
  }

  function handleStartWork() {
    startTransition(async () => {
      await updateSpkStatus(doc.id, 'IN_PROGRESS')
      router.refresh()
    })
  }

  function handleComplete() {
    startTransition(async () => {
      await updateSpkStatus(doc.id, 'COMPLETED')
      router.refresh()
    })
  }

  return (
    <>
      {/* Action bar — tersembunyi saat print */}
      <div className="print:hidden flex items-center justify-between gap-4 px-6 py-3 border-b border-slate-200 bg-white sticky top-0 z-10">
        <button onClick={() => router.push('/saas/spk')} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 cursor-pointer">
          <ArrowLeft size={16} /> Kembali
        </button>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_COLOR[doc.status]}`}>
            {STATUS_LABEL[doc.status]}
          </span>
          {doc.status === 'DRAFT' && (
            <button
              onClick={handleIssue}
              disabled={isPending}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
            >
              <CheckCircle2 size={14} /> Terbitkan
            </button>
          )}
          {doc.status === 'ISSUED' && (
            <button
              onClick={handleStartWork}
              disabled={isPending}
              className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50 cursor-pointer"
            >
              <PlayCircle size={14} /> Mulai Implementasi
            </button>
          )}
          {doc.status === 'IN_PROGRESS' && (
            <button
              onClick={handleComplete}
              disabled={isPending}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
            >
              <CheckCircle2 size={14} /> Selesai
            </button>
          )}
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            <Printer size={14} /> Print / PDF
          </button>
        </div>
      </div>

      {/* Dokumen — ini yang di-print */}
      <div className="min-h-screen bg-slate-100 print:bg-white py-10 print:py-0">
        <div className="mx-auto max-w-3xl bg-white shadow-sm print:shadow-none print:max-w-full px-14 py-12 print:px-16 print:py-12 text-slate-900">

          {/* Kop */}
          <div className="text-center border-b-2 border-slate-800 pb-4 mb-8">
            <h1 className="text-lg font-bold tracking-wide uppercase">Surat Perintah Kerja</h1>
            <h2 className="text-base font-semibold">Implementasi Sistem {doc.system_name}</h2>
            <p className="text-xs text-slate-500 mt-1">Nomor: {doc.document_number}</p>
          </div>

          {/* Pembuka */}
          <p className="text-sm leading-relaxed mb-6">
            Surat Perintah Kerja ini diterbitkan pada tanggal <strong>{formatDate(doc.issued_date)}</strong> sebagai
            instruksi resmi untuk melaksanakan pekerjaan implementasi sistem <strong>{doc.system_name}</strong> kepada:
          </p>

          {/* Pihak-pihak */}
          <div className="grid grid-cols-2 gap-6 mb-8 text-sm">
            <div className="border border-slate-200 rounded-lg p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Pihak Pertama (Pelaksana)</p>
              <p className="font-semibold">{doc.consultant_name || '____________________________'}</p>
              <p className="text-slate-500 text-xs mt-0.5">{doc.consultant_title || 'Implementation Consultant'}</p>
              <p className="text-slate-500 text-xs">PT Nizam Digital Solusi</p>
            </div>
            <div className="border border-slate-200 rounded-lg p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Pihak Kedua (Klien)</p>
              <p className="font-semibold">{doc.client_pic_name || '____________________________'}</p>
              <p className="text-slate-500 text-xs mt-0.5">{doc.client_pic_title || 'Pimpinan'}</p>
              <p className="text-slate-500 text-xs">{doc.org_name}</p>
            </div>
          </div>

          {/* Ruang lingkup pekerjaan */}
          <div className="mb-8">
            <h3 className="text-sm font-bold mb-3 uppercase tracking-wide">Ruang Lingkup Pekerjaan</h3>
            <p className="text-sm text-slate-600 mb-3">
              Pekerjaan yang harus dilaksanakan meliputi implementasi dan konfigurasi modul-modul berikut:
            </p>
            <div className="grid grid-cols-3 gap-2">
              {doc.modules_scope.map(m => (
                <div key={m} className="flex items-center gap-2 text-sm">
                  <span className="text-blue-500 font-bold">→</span>
                  <span>{m}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Timeline */}
          {(doc.start_date || doc.end_date) && (
            <div className="mb-8 rounded-lg border border-slate-200 p-4 bg-slate-50 text-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Timeline Implementasi</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-500">Rencana Mulai</p>
                  <p className="font-semibold">{formatDate(doc.start_date)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Rencana Selesai</p>
                  <p className="font-semibold">{formatDate(doc.end_date)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Ketentuan */}
          <div className="mb-8 text-sm leading-relaxed space-y-2">
            <h3 className="font-bold uppercase tracking-wide text-sm mb-2">Ketentuan Pelaksanaan</h3>
            <ol className="list-decimal list-inside space-y-1 text-slate-700">
              <li>Pekerjaan harus dilaksanakan sesuai standar implementasi yang ditetapkan.</li>
              <li>Setiap progres pekerjaan wajib dilaporkan kepada klien secara berkala.</li>
              <li>Setelah implementasi selesai, dilakukan UAT (User Acceptance Testing) bersama klien.</li>
              <li>Pekerjaan dinyatakan selesai setelah penandatanganan BAST oleh kedua pihak.</li>
            </ol>
            {doc.notes && <p className="text-slate-500 italic mt-3">{doc.notes}</p>}
          </div>

          {/* TTD */}
          <div className="grid grid-cols-2 gap-12 mt-12 text-sm text-center">
            <div>
              <p className="mb-1">Pihak Pertama</p>
              <div className="h-20 border-b border-slate-400 mx-8" />
              <p className="mt-2 font-semibold">{doc.consultant_name || '( ________________________ )'}</p>
              <p className="text-xs text-slate-500">{doc.consultant_title || 'Implementation Consultant'}</p>
            </div>
            <div>
              <p className="mb-1">Pihak Kedua</p>
              <div className="h-20 border-b border-slate-400 mx-8" />
              <p className="mt-2 font-semibold">{doc.client_pic_name || '( ________________________ )'}</p>
              <p className="text-xs text-slate-500">{doc.client_pic_title || 'Pimpinan'}</p>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-16 pt-4 border-t border-slate-200 text-center">
            <p className="text-[10px] text-slate-400">
              Dokumen ini diterbitkan secara resmi oleh sistem {doc.system_name} · {doc.document_number} · {formatDate(doc.issued_date)}
            </p>
          </div>

        </div>
      </div>

      <style>{`
        @media print {
          @page { margin: 1.5cm; size: A4; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </>
  )
}
