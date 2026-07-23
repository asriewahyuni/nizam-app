'use client'

/**
 * Pengelolaan sertifikat terbit: pencabutan dan penerbitan ulang ber-audit.
 */
import { useState, useTransition } from 'react'
import { Ban, LoaderCircle, RefreshCw, ShieldCheck } from 'lucide-react'
import {
  reissueCertificateAction,
  revokeCertificateAction,
  type CertificateAdminRecord,
} from '@/modules/lms/actions/certificate.actions'

export default function CertificateRecordsManager({
  orgSlug,
  initialRecords,
}: {
  orgSlug: string
  initialRecords: CertificateAdminRecord[]
}) {
  const [isPending, startTransition] = useTransition()
  const [records, setRecords] = useState(initialRecords)
  const [revokingId, setRevokingId] = useState('')
  const [reason, setReason] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  function reissue(record: CertificateAdminRecord) {
    if (!record.enrollmentId) return
    setMessage('')
    setError('')
    startTransition(async () => {
      const response = await reissueCertificateAction(record.enrollmentId!, orgSlug)
      if ('error' in response && response.error) {
        setError(response.error)
        return
      }
      setRecords((current) => current.map((item) => (
        item.id === record.id
          ? { ...item, status: 'ACTIVE', revision: item.revision + 1 }
          : item
      )))
      setMessage(`Sertifikat ${record.certificateNumber} berhasil diterbitkan ulang.`)
    })
  }

  function revoke(record: CertificateAdminRecord) {
    if (!reason.trim()) {
      setError('Alasan pencabutan wajib diisi agar audit dapat dipertanggungjawabkan.')
      return
    }
    setMessage('')
    setError('')
    startTransition(async () => {
      const response = await revokeCertificateAction(record.id, reason, orgSlug)
      if ('error' in response && response.error) {
        setError(response.error)
        return
      }
      setRecords((current) => current.map((item) => (
        item.id === record.id ? { ...item, status: 'REVOKED' } : item
      )))
      setRevokingId('')
      setReason('')
      setMessage(`Sertifikat ${record.certificateNumber} telah dicabut.`)
    })
  }

  if (records.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600">
        Belum ada sertifikat yang diterbitkan.
      </div>
    )
  }

  return (
    <div>
      {message && (
        <p className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-800" role="alert">
          {error}
        </p>
      )}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[820px] border-collapse text-left text-sm">
          <thead className="bg-emerald-950 text-emerald-50">
            <tr>
              <th className="px-4 py-3 font-semibold">Nomor</th>
              <th className="px-4 py-3 font-semibold">Peserta dan program</th>
              <th className="px-4 py-3 font-semibold">Terbit</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 text-right font-semibold">Tindakan</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => (
              <tr key={record.id} className="border-t border-slate-100 align-top">
                <td className="px-4 py-4">
                  <p className="font-mono text-xs font-semibold text-slate-800">
                    {record.certificateNumber}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">Revisi {record.revision}</p>
                </td>
                <td className="px-4 py-4">
                  <p className="font-semibold text-slate-900">{record.participantName}</p>
                  <p className="mt-1 text-xs text-slate-500">{record.courseTitle}</p>
                </td>
                <td className="px-4 py-4 text-slate-600">
                  {new Date(record.issueDate).toLocaleDateString('id-ID')}
                </td>
                <td className="px-4 py-4">
                  <span className={`inline-flex min-h-8 items-center gap-2 rounded-full px-3 text-xs font-bold ${
                    record.status === 'ACTIVE'
                      ? 'bg-emerald-50 text-emerald-900'
                      : 'bg-red-50 text-red-900'
                  }`}>
                    <ShieldCheck aria-hidden="true" size={15} />
                    {record.status}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => reissue(record)}
                      disabled={isPending || !record.enrollmentId}
                      className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-slate-300 px-3 text-xs font-bold text-slate-700 transition-colors duration-200 hover:border-emerald-400 hover:bg-emerald-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isPending
                        ? <LoaderCircle aria-hidden="true" className="animate-spin motion-reduce:animate-none" size={16} />
                        : <RefreshCw aria-hidden="true" size={16} />}
                      Terbitkan ulang
                    </button>
                    {record.status === 'ACTIVE' && (
                      <button
                        type="button"
                        onClick={() => {
                          setRevokingId(record.id)
                          setReason('')
                          setError('')
                        }}
                        disabled={isPending}
                        className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-3 text-xs font-bold text-red-700 transition-colors duration-200 hover:bg-red-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-red-200 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Ban aria-hidden="true" size={16} />
                        Cabut
                      </button>
                    )}
                  </div>
                  {revokingId === record.id && (
                    <div className="mt-3 ml-auto max-w-sm rounded-xl border border-red-200 bg-red-50 p-3">
                      <label className="block">
                        <span className="text-xs font-bold text-red-900">
                          Alasan pencabutan
                        </span>
                        <textarea
                          rows={2}
                          value={reason}
                          onChange={(event) => setReason(event.target.value)}
                          className="mt-1 w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm outline-none focus:border-red-500 focus:ring-4 focus:ring-red-100"
                        />
                      </label>
                      <div className="mt-2 flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setRevokingId('')}
                          className="min-h-11 cursor-pointer rounded-lg px-3 text-xs font-bold text-slate-700 hover:bg-white focus:outline-none focus-visible:ring-4 focus-visible:ring-slate-200"
                        >
                          Batal
                        </button>
                        <button
                          type="button"
                          onClick={() => revoke(record)}
                          disabled={isPending}
                          className="min-h-11 cursor-pointer rounded-lg bg-red-700 px-3 text-xs font-bold text-white hover:bg-red-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-red-200 disabled:cursor-not-allowed disabled:bg-slate-300"
                        >
                          Konfirmasi pencabutan
                        </button>
                      </div>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
