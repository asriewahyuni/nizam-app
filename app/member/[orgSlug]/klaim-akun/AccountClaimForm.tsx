'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { KeyRound, ShieldCheck } from 'lucide-react'
import {
  claimMemberAccount,
  type AccountClaimState,
} from '@/modules/member/actions/account-claim.actions'

const initialState: AccountClaimState = {}

export default function AccountClaimForm({
  orgSlug,
  token,
}: {
  orgSlug: string
  token: string
}) {
  const [state, action, pending] = useActionState(claimMemberAccount, initialState)

  if (state.success) {
    return (
      <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-950">
        <div className="flex items-center gap-3 font-bold">
          <ShieldCheck aria-hidden="true" size={20} />
          Akun berhasil diaktifkan
        </div>
        <p className="mt-3 leading-7">
          Anda sudah masuk. Course yang dibeli dapat dibuka dari halaman Kelas Saya.
        </p>
        <Link
          href={`/member/${orgSlug}/kelas`}
          className="mt-5 inline-flex min-h-11 cursor-pointer items-center rounded-xl bg-emerald-800 px-5 font-semibold text-white transition-colors duration-200 hover:bg-emerald-900 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200"
        >
          Buka Kelas Saya
        </Link>
      </div>
    )
  }

  return (
    <form action={action} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <input type="hidden" name="orgSlug" value={orgSlug} />
      <input type="hidden" name="token" value={token} />
      <div className="flex size-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
        <KeyRound aria-hidden="true" size={22} />
      </div>
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-950">Aktifkan akun belajar</h1>
        <p className="mt-2 leading-7 text-slate-600">
          Buat password baru untuk mengakses semua course dari pembelian Anda.
        </p>
      </div>
      <label className="block text-sm font-semibold text-slate-700">
        Password baru
        <input
          name="password"
          type="password"
          minLength={8}
          required
          autoComplete="new-password"
          className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-4 outline-none transition-colors duration-200 focus:border-emerald-700 focus:ring-4 focus:ring-emerald-100"
        />
      </label>
      <label className="block text-sm font-semibold text-slate-700">
        Ulangi password
        <input
          name="passwordConfirmation"
          type="password"
          minLength={8}
          required
          autoComplete="new-password"
          className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-4 outline-none transition-colors duration-200 focus:border-emerald-700 focus:ring-4 focus:ring-emerald-100"
        />
      </label>
      {state.error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800">
          {state.error}
        </div>
      )}
      <button
        type="submit"
        disabled={pending || !token}
        className="min-h-12 w-full cursor-pointer rounded-xl bg-emerald-800 px-5 font-bold text-white transition-colors duration-200 hover:bg-emerald-900 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? 'Mengaktifkan…' : 'Aktifkan akun'}
      </button>
    </form>
  )
}
