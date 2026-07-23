'use client'

import { useActionState } from 'react'
import { CheckCircle2, ScanLine } from 'lucide-react'
import { checkInWithAttendanceToken } from '@/modules/lms/actions/attendance.actions'

export default function AttendanceCheckInForm({
  orgSlug,
  sessionId,
  token,
}: {
  orgSlug: string
  sessionId: string
  token: string
}) {
  const [state, action, pending] = useActionState(checkInWithAttendanceToken, {})
  return (
    <form action={action} className="mt-7">
      <input type="hidden" name="orgSlug" value={orgSlug} />
      <input type="hidden" name="sessionId" value={sessionId} />
      <input type="hidden" name="token" value={token} />
      {state.error && (
        <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-900">
          {state.error}
        </p>
      )}
      {state.success ? (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl bg-emerald-50 p-4 text-emerald-950"
        >
          <CheckCircle2 aria-hidden="true" className="mt-0.5 shrink-0" />
          <p className="font-semibold">{state.message}</p>
        </div>
      ) : (
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-orange-600 px-5 font-bold text-white transition-colors duration-200 hover:bg-orange-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-200 disabled:cursor-wait disabled:opacity-60"
        >
          <ScanLine aria-hidden="true" size={20} />
          {pending ? 'Mencatat kehadiran...' : 'Konfirmasi kehadiran'}
        </button>
      )}
    </form>
  )
}
