'use client'

import { signOut } from '@/modules/auth/actions/auth.actions'
import { getInitials, formatRupiah } from '@/lib/utils'
import { LogOut, Building2, Bell, ShieldCheck, Shield, Triangle, Sparkles, Menu, MapPin, ChevronDown, Plus } from 'lucide-react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import type { Organization } from '@/types/database.types'

interface AppHeaderProps {
  user: { fullName?: string; email: string }
  jobTitle?: string
  org: Organization
  branches: any[]
  pendingApprovals?: number
  cashFlow?: any
}

function AppHeaderImplementation({ user, jobTitle, org, branches, pendingApprovals = 0, cashFlow }: AppHeaderProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const activeBranchId = searchParams.get('branchId') || branches[0]?.id || null
  const activeBranch = branches.find(b => b.id === activeBranchId) || branches[0]

  const handleBranchChange = (branchId: string) => {
    const params = new URLSearchParams(searchParams)
    params.set('branchId', branchId)
    router.push(`${pathname}?${params.toString()}`)
  }

  const displayName = user.fullName || user.email
  const initials = getInitials(displayName)
  const hasRequests = pendingApprovals > 0

  const netChange = cashFlow?.netChange || 0
  const trend = cashFlow?.netChangeTrend || 'NEUTRAL'
  const percent = cashFlow?.changePercent || 0

  return (
    <header className="h-16 flex items-center justify-between px-4 md:px-8 border-b border-slate-100 bg-white/80 backdrop-blur-md sticky top-0 z-30 print:hidden">
      <div className="flex items-center gap-2 md:gap-6">
        {/* Mobile Toggle */}
        <button 
          onClick={() => window.dispatchEvent(new CustomEvent('nizam_sidebar_toggle'))}
          className="md:hidden p-2 text-slate-500 hover:bg-slate-50 rounded-xl"
        >
          <Menu size={20} />
        </button>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-xl shadow-sm hover:bg-slate-100 transition-colors cursor-pointer group">
            <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-[#003366] shrink-0 shadow-sm">
              <Building2 size={14} strokeWidth={2} />
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter leading-none mb-0.5">Organisasi</span>
              <span className="text-xs font-black text-slate-900 leading-none truncate max-w-[120px]">{org.name}</span>
            </div>
          </div>

          <div className="h-6 w-px bg-slate-100 hidden sm:block" />

          {/* Branch Switcher */}
          <div className="relative group">
            <div 
              onClick={() => handleBranchChange(branches[0]?.id)} 
              className="flex items-center gap-2 px-3 py-1.5 bg-[#003366]/5/50 border border-[#003366]/10 rounded-xl hover:bg-[#003366]/5 transition-all cursor-pointer shadow-sm active:scale-95"
            >
              <MapPin size={14} className="text-[#003366] shrink-0" />
              <div className="flex flex-col overflow-hidden">
                <span className="text-[9px] text-[#003366]/60 font-bold uppercase tracking-tighter leading-none mb-0.5">Unit Terpilih</span>
                <span className="text-xs font-black text-blue-900 leading-none truncate max-w-[150px]">
                  {activeBranch?.name || 'Pilih Unit'}
                </span>
              </div>
              <ChevronDown size={12} className="text-[#003366]/60 ml-1" />
            </div>

            {/* Dropdown Menu (Hidden by default, shown on group hover/click implementation could be more complex but let's keep it clean for foundation) */}
            <div className="absolute top-full left-0 mt-2 w-64 bg-white border border-slate-100 rounded-2xl shadow-2xl p-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
              <p className="px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Ganti Unit Bisnis / Cabang</p>
              <div className="space-y-1 mt-1">
                {branches.map(branch => (
                  <button 
                    key={branch.id} 
                    onClick={() => handleBranchChange(branch.id)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all ${activeBranchId === branch.id ? 'bg-[#003366] text-white' : 'hover:bg-slate-50 text-slate-700'}`}
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      <Building2 size={12} className={activeBranchId === branch.id ? 'text-blue-200' : 'text-slate-400'} />
                      <span className="text-xs font-bold truncate">{branch.name}</span>
                    </div>
                    {activeBranchId === branch.id && <Shield size={10} className="text-white" />}
                  </button>
                ))}
              </div>
              <div className="mt-2 pt-2 border-t border-slate-50">
                <Link href="/settings/branches" className="flex items-center justify-center gap-2 w-full py-2 text-[10px] font-black text-[#003366] hover:bg-[#003366]/5 rounded-lg uppercase tracking-tighter">
                  <Plus size={10} /> Kelola Semua Unit
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Financial Ticker (Running Text) */}
        {cashFlow && (
          <div className="hidden lg:flex items-center gap-4 px-4 py-1.5 bg-slate-50 rounded-full border border-slate-100 overflow-hidden max-w-[400px]">
            <div className="flex items-center gap-2 animate-marquee whitespace-nowrap">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">LIVE CASH FLOW:</span>
              <span className={`text-xs font-black ${netChange >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {formatRupiah(netChange)}
              </span>
              <div className="flex items-center gap-1">
                 <Triangle 
                    size={8} 
                    fill="currentColor" 
                    className={`${trend === 'UP' ? 'text-emerald-500' : 'text-rose-500 rotate-180'}`} 
                 />
                 <span className={`text-[10px] font-black ${trend === 'UP' ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {Math.abs(percent).toFixed(1)}%
                 </span>
              </div>
              <span className="text-slate-200">|</span>
              <span className={`text-[9px] font-bold uppercase flex items-center gap-1 ${cashFlow.ocf < 0 ? 'text-rose-500' : 'text-slate-400'}`}>
                OCF: {formatRupiah(cashFlow.ocf)}
              </span>
            </div>
            
            <style jsx>{`
              @keyframes marquee {
                0% { transform: translateX(10%); }
                100% { transform: translateX(-10%); }
              }
              .animate-marquee {
                animation: marquee 10s linear infinite alternate;
              }
            `}</style>
          </div>
        )}
      </div>

      {/* Right: user avatar + actions + sign out */}
      <div className="flex items-center gap-6">
        {/* Action Shortcuts */}
        <div className="flex items-center gap-2 pr-6 border-r border-slate-100">
          <Link 
            href="/accounting/approvals" 
            className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all shadow-sm group relative ${
              hasRequests 
                ? 'bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100 hover:border-rose-300' 
                : 'bg-white border-slate-100 text-slate-400 hover:text-[#003366] hover:bg-[#003366]/5 hover:border-[#003366]/10'
            }`}
            title="Approval Center"
          >
            <Bell size={16} strokeWidth={2} />
            {hasRequests && (
              <div className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] rounded-full bg-rose-500 border-2 border-white flex items-center justify-center text-[9px] font-black text-white px-1 shadow-sm ring-2 ring-rose-100 animate-pulse">
                {pendingApprovals}
              </div>
            )}
          </Link>

          <button 
            onClick={() => window.dispatchEvent(new CustomEvent('nizam_toggle_tour'))}
            className="w-9 h-9 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 hover:text-[#003366] hover:bg-[#003366]/5 hover:border-[#003366]/10 transition-all shadow-sm group"
            title="Buka Petunjuk (Tour)"
          >
            <Sparkles size={16} strokeWidth={2} className="group-hover:rotate-12 transition-transform" />
          </button>

          <Link 
            href="/settings/audit" 
            className="w-9 h-9 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 hover:border-emerald-100 transition-all shadow-sm group"
            title="Audit Logs"
          >
            <ShieldCheck size={16} strokeWidth={2} />
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-black text-slate-900 leading-tight tracking-tight">{user.fullName || user.email}</p>
            <p className="text-[10px] text-blue-600 font-bold leading-none mt-1 uppercase tracking-widest">{jobTitle || 'Enterprise Member'}</p>
          </div>

          {/* Avatar */}
          <div className="w-9 h-9 rounded-full bg-slate-100 border-2 border-white shadow-sm flex items-center justify-center text-slate-600 text-xs font-bold ring-1 ring-slate-100 uppercase">
            {initials}
          </div>
        </div>
      </div>
    </header>
  )
}

export function AppHeader(props: AppHeaderProps) {
  return (
    <Suspense fallback={<div className="h-16 border-b border-slate-100 bg-white/80 animate-pulse" />}>
      <AppHeaderImplementation {...props} />
    </Suspense>
  )
}
