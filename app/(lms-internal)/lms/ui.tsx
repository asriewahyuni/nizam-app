import type { ReactNode } from 'react'

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-12 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-white ring-1 ring-slate-200">
        <div className="size-5 rounded-md border-2 border-dashed border-slate-300" />
      </div>
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <p className="mx-auto mt-1 max-w-sm text-xs text-slate-500">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}

export function StatusBadge({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={
        'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1 ring-inset ' +
        className
      }
    >
      {children}
    </span>
  )
}

export const statusColor = (s: string) => {
  switch (s) {
    case 'OPEN':
      return 'bg-emerald-100 text-emerald-700 ring-emerald-600/20'
    case 'ONGOING':
      return 'bg-sky-100 text-sky-700 ring-sky-600/20'
    case 'CLOSED':
      return 'bg-slate-100 text-slate-600 ring-slate-500/20'
    default:
      return 'bg-slate-100 text-slate-600 ring-slate-500/20'
  }
}

export const modeColor = (m: string) => {
  switch (m) {
    case 'ONLINE':
      return 'bg-indigo-50 text-indigo-700 ring-indigo-600/20'
    case 'OFFLINE':
      return 'bg-amber-50 text-amber-700 ring-amber-600/20'
    case 'HYBRID':
      return 'bg-blue-50 text-blue-700 ring-blue-600/20'
    default:
      return 'bg-slate-100 text-slate-600 ring-slate-500/20'
  }
}

export const formatIDR = (n: number) =>
  n === 0 ? 'Gratis (Internal)' : `Rp ${n.toLocaleString('id-ID')}`
