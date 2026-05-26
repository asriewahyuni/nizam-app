export default function DashboardLoading() {
  return (
    <div className="space-y-6 p-6">
      <div className="h-24 animate-pulse rounded-xl border border-slate-200 bg-gradient-to-r from-slate-100 via-white to-slate-100" />
      <div className="grid gap-4 md:grid-cols-3">
        <div className="h-36 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
        <div className="h-36 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
        <div className="h-36 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
      </div>
      <div className="h-[420px] animate-pulse rounded-[32px] border border-slate-200 bg-slate-100" />
    </div>
  )
}
