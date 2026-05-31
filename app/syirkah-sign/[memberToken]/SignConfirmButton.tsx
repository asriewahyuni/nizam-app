'use client'

import { useState } from 'react'
import { signSyirkahMember } from '@/modules/syirkah/actions/syirkah.actions'
import { CheckCircle, Loader2, PenLine } from 'lucide-react'

export default function SignConfirmButton({ memberToken, memberName }: {
  memberToken: string
  memberName: string
}) {
  const [loading, setLoading] = useState(false)
  const { confirm, ConfirmUI } = useConfirm()
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const handleSign = async () => {
    if (!await confirm(`Anda akan menandatangani akad syirkah ini sebagai ${memberName}.\n\nYakin melanjutkan?`)) return
    setLoading(true)
    setError('')
    try {
      const result = await signSyirkahMember(memberToken)
      if ('error' in result) {
        setError(result.error || 'Terjadi kesalahan')
      } else {
        setDone(true)
      }
    } catch (e: any) {
      setError(e.message || 'Terjadi kesalahan')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-4 py-4">
        <CheckCircle size={56} className="text-emerald-500" />
        <h3 className="text-xl font-black text-emerald-800">Tanda Tangan Berhasil!</h3>
        <p className="text-sm text-slate-500 text-center">Tanda tangan digital Anda telah dicatat dalam sistem Nizam ERP. Halaman ini dapat ditutup.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <div className="px-4 py-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700 font-medium">
          {error}
        </div>
      )}
      <button
        onClick={handleSign}
        disabled={loading}
        className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-blue-600 text-white font-black text-lg rounded-2xl hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-60 shadow-lg shadow-blue-600/20"
      >
        {loading ? (
          <><Loader2 size={22} className="animate-spin" /> Memproses...</>
        ) : (
          <><PenLine size={22} /> Saya Setuju &amp; Tandatangani</>
        )}
      </button>
      <p className="text-xs text-center text-slate-400">
        Tanda tangan ini bersifat sah secara digital dan dicatat di sistem Nizam ERP.
      </p>
      {ConfirmUI}
    </div>
  )
}
