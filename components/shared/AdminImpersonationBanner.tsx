import { restorePlatformAdminSession } from '@/modules/auth/actions/auth.actions'
import { CornerUpLeft, ShieldCheck } from 'lucide-react'

interface AdminImpersonationBannerProps {
  adminEmail: string
  orgName?: string | null
}

export function AdminImpersonationBanner({
  adminEmail,
  orgName,
}: AdminImpersonationBannerProps) {
  async function restoreAction() {
    'use server'
    await restorePlatformAdminSession()
  }

  return (
    <div className="bg-emerald-950 px-4 py-2 flex items-center justify-between gap-4 print:hidden border-b border-emerald-200/10 relative z-20">
      <div className="flex items-center gap-4 min-w-0">
        <div className="flex items-center gap-2 px-3 py-1 bg-emerald-400/10 border border-emerald-400/30 rounded-full shrink-0">
          <ShieldCheck size={12} className="text-emerald-300" />
          <span className="text-[10px] font-semibold text-emerald-300 uppercase tracking-wide leading-none">
            IMPERSONATION MODE
          </span>
        </div>
        <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-100/80 leading-none truncate">
          {orgName ? `Anda sedang login sebagai tenant ${orgName}.` : 'Anda sedang login sebagai tenant.'} Admin asal: {adminEmail}
        </p>
      </div>

      <form action={restoreAction}>
        <button
          type="submit"
          className="flex items-center gap-2 px-4 py-1.5 bg-white/5 hover:bg-white/10 text-emerald-100 text-[10px] font-semibold uppercase tracking-wide rounded-lg transition-all border border-white/10 hover:border-emerald-300/40 active:scale-95 whitespace-nowrap"
        >
          <CornerUpLeft size={12} />
          Back to Admin
        </button>
      </form>
    </div>
  )
}
