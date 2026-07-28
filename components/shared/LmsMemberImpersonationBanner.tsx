import { restoreLmsAdminSessionAction } from '@/modules/edu/actions/lms-member-impersonation.actions'
import { CornerUpLeft, ShieldCheck } from 'lucide-react'

interface LmsMemberImpersonationBannerProps {
  adminEmail: string
  memberName?: string | null
}

export function LmsMemberImpersonationBanner({
  adminEmail,
  memberName,
}: LmsMemberImpersonationBannerProps) {
  async function restoreAction() {
    'use server'
    await restoreLmsAdminSessionAction()
  }

  return (
    <div className="bg-indigo-950 px-4 py-2 flex items-center justify-between gap-4 print:hidden relative z-30 border-b border-indigo-200/10">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-400/10 border border-indigo-400/30 rounded-full shrink-0">
          <ShieldCheck size={12} className="text-indigo-300" />
          <span className="text-[10px] font-semibold text-indigo-300 uppercase tracking-wide leading-none">
            Mode Impersonasi
          </span>
        </div>
        <p className="text-[10px] font-bold uppercase tracking-wide text-indigo-100/80 leading-none truncate">
          {memberName ? `Login sebagai ${memberName}.` : 'Login sebagai member.'} Admin asal: {adminEmail}
        </p>
      </div>

      <form action={restoreAction}>
        <button
          type="submit"
          className="flex shrink-0 cursor-pointer items-center gap-2 px-3.5 py-1.5 bg-white/5 hover:bg-white/10 text-indigo-100 text-[10px] font-semibold uppercase tracking-wide rounded-lg transition-all border border-white/10 hover:border-indigo-300/40 active:scale-95 whitespace-nowrap"
        >
          <CornerUpLeft size={12} />
          Kembali ke Admin
        </button>
      </form>
    </div>
  )
}
