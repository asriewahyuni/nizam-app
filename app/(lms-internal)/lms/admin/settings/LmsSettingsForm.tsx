'use client'

import { useActionState } from 'react'
import { updateLmsBranding } from '@/modules/edu/actions/lms-commercial.actions'

export default function LmsSettingsForm({
  defaultName,
  defaultLogo,
}: {
  defaultName?: string
  defaultLogo?: string
}) {
  const [state, action, isPending] = useActionState(updateLmsBranding, null)

  return (
    <form action={action} className="space-y-4">
      {state?.success && (
        <div className="rounded-md bg-emerald-50 p-3 text-sm font-medium text-emerald-700">
          Pengaturan LMS berhasil disimpan!
        </div>
      )}
      {state?.error && (
        <div className="rounded-md bg-rose-50 p-3 text-sm font-medium text-rose-700">
          Error: {state.error}
        </div>
      )}

      <div className="space-y-1.5">
        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Nama Platform LMS (Opsional)
        </label>
        <input
          type="text"
          name="name"
          defaultValue={defaultName}
          placeholder="Misal: Akademi Nizam"
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-100"
        />
        <p className="text-[10px] text-slate-400">
          Jika dikosongkan, akan menggunakan nama organisasi dari ERP.
        </p>
      </div>

      <div className="space-y-1.5">
        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Logo URL (Opsional)
        </label>
        <input
          type="url"
          name="logoUrl"
          defaultValue={defaultLogo}
          placeholder="https://example.com/logo.png"
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-100"
        />
        <p className="text-[10px] text-slate-400">
          URL gambar untuk logo khusus LMS. Jika kosong akan memakai logo ERP.
        </p>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full sm:w-auto mt-2 rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white transition-all hover:bg-indigo-700 disabled:opacity-50"
      >
        {isPending ? 'Menyimpan...' : 'Simpan Perubahan'}
      </button>
    </form>
  )
}
