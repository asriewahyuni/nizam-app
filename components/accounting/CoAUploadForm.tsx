'use client'

import { useState, useRef } from 'react'
import { Upload, Loader2, CheckCircle2, AlertCircle, FileSpreadsheet, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error'

interface Props {
  orgId: string
  onSuccess?: () => void
}

export function CoAUploadForm({ orgId, onSuccess }: Props) {
  const [status, setStatus] = useState<UploadStatus>('idle')
  const [message, setMessage] = useState<string>('')
  const [fileName, setFileName] = useState<string>('')
  const [details, setDetails] = useState<{ inserted?: number; updated?: number } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleFileChange(file: File) {
    if (!file) return

    // Validate file type
    if (!file.type.includes('spreadsheet') && !file.type.includes('excel')) {
      setStatus('error')
      setMessage('File harus berformat Excel (.xlsx)')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setStatus('error')
      setMessage('Ukuran file tidak boleh lebih dari 5MB')
      return
    }

    setFileName(file.name)
    setStatus('uploading')
    setMessage('Sedang mengunggah...')

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/accounting/coa/upload', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (result.success) {
        setStatus('success')
        setMessage(result.message || 'CoA berhasil diunggah')
        setDetails({
          inserted: result.insertedCount,
          updated: result.updatedCount,
        })
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
        setTimeout(() => {
          onSuccess?.()
        }, 2000)
      } else {
        setStatus('error')
        setMessage(result.error || 'Gagal mengunggah CoA')
        setDetails(null)
      }
    } catch (error: any) {
      setStatus('error')
      setMessage(error.message || 'Terjadi kesalahan saat mengunggah')
      setDetails(null)
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.currentTarget.classList.add('border-blue-500', 'bg-blue-50')
  }

  function handleDragLeave(e: React.DragEvent) {
    e.currentTarget.classList.remove('border-blue-500', 'bg-blue-50')
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    e.currentTarget.classList.remove('border-blue-500', 'bg-blue-50')
    const file = e.dataTransfer.files[0]
    if (file) {
      handleFileChange(file)
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      handleFileChange(file)
    }
  }

  function resetForm() {
    setStatus('idle')
    setMessage('')
    setFileName('')
    setDetails(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="w-full space-y-4">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className="relative border-2 border-dashed border-slate-300 rounded-2xl p-8 transition-all hover:border-slate-400 cursor-pointer"
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={handleFileSelect}
          disabled={status === 'uploading'}
          className="hidden"
        />

        <div className="flex flex-col items-center justify-center gap-3">
          <div className="p-3 bg-blue-100 rounded-xl">
            <FileSpreadsheet className="w-6 h-6 text-blue-600" />
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-slate-900">Unggah File CoA (Excel)</p>
            <p className="text-xs text-slate-500 mt-1">Drag dan drop file Excel atau klik untuk memilih</p>
            <p className="text-xs text-slate-400 mt-2">Format: xlsx | Ukuran maks: 5MB</p>
          </div>
        </div>
      </div>

      {/* File being uploaded */}
      <AnimatePresence>
        {fileName && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200"
          >
            <FileSpreadsheet className="w-4 h-4 text-slate-600 shrink-0" />
            <span className="text-sm font-medium text-slate-700 truncate flex-1">{fileName}</span>
            {status !== 'uploading' && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  resetForm()
                }}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Status messages */}
      <AnimatePresence>
        {status !== 'idle' && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={`flex items-start gap-3 p-4 rounded-xl border ${
              status === 'uploading'
                ? 'bg-blue-50 border-blue-200'
                : status === 'success'
                ? 'bg-emerald-50 border-emerald-200'
                : 'bg-red-50 border-red-200'
            }`}
          >
            {status === 'uploading' && (
              <>
                <Loader2 className="w-5 h-5 text-blue-600 shrink-0 animate-spin" />
                <p className="text-sm text-blue-700">{message}</p>
              </>
            )}
            {status === 'success' && (
              <>
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-bold text-emerald-900">{message}</p>
                  {details && (
                    <p className="text-xs text-emerald-700 mt-1">
                      {details.inserted > 0 && `${details.inserted} akun baru`}
                      {details.inserted > 0 && details.updated > 0 && ' • '}
                      {details.updated > 0 && `${details.updated} akun diperbarui`}
                    </p>
                  )}
                </div>
              </>
            )}
            {status === 'error' && (
              <>
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                <p className="text-sm text-red-700">{message}</p>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Format template info */}
      <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
        <p className="text-xs font-bold text-slate-700">Format Excel yang dibutuhkan:</p>
        <div className="text-xs text-slate-600 space-y-1 ml-3">
          <p>• <strong>code</strong> - Kode akun (wajib)</p>
          <p>• <strong>name</strong> - Nama akun (wajib)</p>
          <p>• <strong>type</strong> - Tipe: ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE (wajib)</p>
          <p>• <strong>normal_balance</strong> - Saldo normal: DEBIT atau CREDIT (wajib)</p>
          <p>• <strong>parent_code</strong> - Kode akun parent untuk sub-akun (opsional)</p>
          <p>• <strong>description</strong> - Deskripsi akun (opsional)</p>
        </div>
      </div>
    </div>
  )
}
