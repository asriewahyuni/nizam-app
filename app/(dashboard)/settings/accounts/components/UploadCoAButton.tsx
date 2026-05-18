'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function UploadCoAButton() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // Reset input agar file yang sama bisa diupload ulang
    e.target.value = ''

    setStatus('uploading')
    setMessage('')

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('/api/accounting/coa/upload', {
        method: 'POST',
        body: formData,
      })
      const json = await res.json()

      if (json.success) {
        setStatus('success')
        setMessage(json.message || 'CoA berhasil diimport')
        router.refresh()
      } else {
        setStatus('error')
        setMessage(json.error || 'Gagal mengimport CoA')
      }
    } catch {
      setStatus('error')
      setMessage('Gagal menghubungi server')
    }

    // Reset status setelah 4 detik
    setTimeout(() => {
      setStatus('idle')
      setMessage('')
    }, 4000)
  }

  return (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={handleFileChange}
      />

      <a
        href="/templates/CoA_Template_NIZAM.xlsx"
        download
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 transition-all"
        title="Unduh template CoA standar PSAK Nizam (.xlsx)"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        Unduh Template
      </a>

      <button
        type="button"
        disabled={status === 'uploading'}
        onClick={() => inputRef.current?.click()}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
        title="Upload CoA dari file Excel (.xlsx)"
      >
        {status === 'uploading' ? (
          <>
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Mengupload...
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Upload CoA
          </>
        )}
      </button>

      {message && (
        <span
          className={`text-xs font-medium px-2 py-1 rounded-lg ${
            status === 'success'
              ? 'bg-green-50 text-green-700'
              : 'bg-red-50 text-red-700'
          }`}
        >
          {message}
        </span>
      )}
    </div>
  )
}
