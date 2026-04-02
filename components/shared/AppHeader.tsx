'use client'

import { getInitials } from '@/lib/utils'
import { Building2, Bell, Coins, Menu, MapPin, ChevronDown, Sparkles } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import type { Organization } from '@/types/database.types'
import type { AiTokenHeaderSummary } from '@/modules/ai/lib/ai-token'
import type {
  AccessibleOrganization,
  BranchSummary,
} from '@/modules/organization/lib/org-context'
import {
  setActiveBranch,
  setActiveOrg,
} from '@/modules/organization/actions/org.actions'

interface AppHeaderProps {
  user: { fullName?: string; email: string }
  jobTitle?: string
  org: Organization
  organizations: AccessibleOrganization[]
  activeOrgId: string
  branches: BranchSummary[]
  activeBranchId: string | null
  allowAllBranchSelection?: boolean
  pendingApprovals?: number
  cashFlow?: any
  aiTokens?: AiTokenHeaderSummary | null
}

const ACTIVE_ORG_CHANGE_EVENT = 'nizam_active_org_change'
const ACTIVE_BRANCH_CHANGE_EVENT = 'nizam_active_branch_change'

export function AppHeader({
  user,
  jobTitle,
  org,
  organizations,
  activeOrgId,
  branches,
  activeBranchId,
  allowAllBranchSelection = true,
  pendingApprovals = 0,
  cashFlow,
  aiTokens,
}: AppHeaderProps) {
  const router = useRouter()
  const [isSwitchingContext, startContextTransition] = useTransition()
  const [isTokenPopupOpen, setIsTokenPopupOpen] = useState(false)
  const tokenPopupRef = useRef<HTMLDivElement | null>(null)

  const activeBranch = branches.find((branch) => branch.id === activeBranchId) || null

  const handleOrgChange = (orgId: string) => {
    if (orgId === activeOrgId) return

    startContextTransition(async () => {
      const result = await setActiveOrg(orgId)
      if ((result as any)?.error) {
        alert((result as any).error)
        return
      }

      window.dispatchEvent(new CustomEvent(ACTIVE_ORG_CHANGE_EVENT, { detail: { orgId } }))
      window.dispatchEvent(new CustomEvent(ACTIVE_BRANCH_CHANGE_EVENT, { detail: { orgId, branchId: null } }))
      router.refresh()
    })
  }

  const handleBranchChange = (branchId: string | null) => {
    startContextTransition(async () => {
      const result = await setActiveBranch(activeOrgId, branchId)
      if ((result as any)?.error) {
        alert((result as any).error)
        return
      }

      window.dispatchEvent(new CustomEvent(ACTIVE_BRANCH_CHANGE_EVENT, { detail: { orgId: activeOrgId, branchId } }))
      router.refresh()
    })
  }

  const initials = getInitials(user.fullName || user.email)
  const hasRequests = pendingApprovals > 0

  const tokenSummary = useMemo(() => ({
    balance: aiTokens?.balanceTokens || 0,
    threshold: aiTokens?.lowBalanceThreshold || 0,
    generationLeft: aiTokens?.estimatedGenerationLeft || 0,
    used: aiTokens?.totalUsedTokens || 0,
  }), [aiTokens])

  const isLowBalance = tokenSummary.threshold > 0 && tokenSummary.balance <= tokenSummary.threshold

  useEffect(() => {
    if (!isTokenPopupOpen) return

    const onClickOutside = (event: MouseEvent) => {
      const targetNode = event.target as Node
      if (!tokenPopupRef.current?.contains(targetNode)) {
        setIsTokenPopupOpen(false)
      }
    }

    window.addEventListener('mousedown', onClickOutside)
    return () => window.removeEventListener('mousedown', onClickOutside)
  }, [isTokenPopupOpen])

  return (
    <header className="h-16 flex items-center justify-between px-4 md:px-8 border-b border-slate-100 bg-white/80 backdrop-blur-md sticky top-0 z-30 print:hidden">
      <div className="flex items-center gap-2 md:gap-6">
        <button 
          onClick={() => window.dispatchEvent(new CustomEvent('nizam_sidebar_toggle'))}
          className="md:hidden p-2 text-slate-500 hover:bg-slate-50 rounded-xl"
        >
          <Menu size={20} />
        </button>

        <div className="flex items-center gap-4">
          <div className="relative group">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-xl shadow-sm cursor-default">
              <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-[#003366] shrink-0 shadow-sm">
                <Building2 size={14} />
              </div>
              <div className="flex flex-col overflow-hidden">
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter leading-none mb-0.5">Organisasi Aktif</span>
                <span className="text-xs font-black text-slate-900 leading-none truncate max-w-[140px]">{org.name}</span>
              </div>
              {organizations.length > 1 && <ChevronDown size={12} className="text-slate-400 ml-1" />}
            </div>

            {organizations.length > 1 && (
              <div className="absolute top-full left-0 mt-2 w-72 bg-white border border-slate-100 rounded-2xl shadow-2xl p-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                <div className="space-y-1 mt-1">
                  {organizations.map((membership) => (
                    <button
                      key={membership.orgId}
                      type="button"
                      disabled={isSwitchingContext}
                      onClick={() => handleOrgChange(membership.orgId)}
                      className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-left transition disabled:cursor-wait disabled:opacity-60 ${
                        activeOrgId === membership.orgId ? 'bg-slate-900 text-white' : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-black truncate">{membership.org.name}</div>
                        <div className={`text-[9px] font-black uppercase tracking-[0.18em] ${activeOrgId === membership.orgId ? 'text-slate-300' : 'text-slate-400'}`}>
                          {membership.role}
                        </div>
                      </div>
                      {activeOrgId === membership.orgId && (
                        <span className="text-[9px] font-black uppercase tracking-[0.18em]">Aktif</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="h-6 w-px bg-slate-100 hidden sm:block" />

          {/* Branch Switcher */}
          <div className="relative group">
            <div
              className="flex items-center gap-2 px-3 py-1.5 bg-[#003366]/5/50 border border-[#003366]/10 rounded-xl hover:bg-[#003366]/5 transition-all cursor-default shadow-sm"
            >
              <MapPin size={14} className="text-[#003366] shrink-0" />
              <div className="flex flex-col overflow-hidden">
                <span className="text-[9px] text-[#003366]/60 font-bold uppercase tracking-tighter leading-none mb-0.5">Unit Terpilih</span>
                <span className="text-xs font-black text-blue-900 leading-none truncate max-w-[150px]">
                  {activeBranch?.name || (allowAllBranchSelection ? 'Semua Unit' : 'Tidak Ada Unit')}
                </span>
              </div>
              <ChevronDown size={12} className="text-[#003366]/60 ml-1" />
            </div>

            <div className="absolute top-full left-0 mt-2 w-64 bg-white border border-slate-100 rounded-2xl shadow-2xl p-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
              <div className="space-y-1 mt-1">
                {allowAllBranchSelection && (
                  <button
                    type="button"
                    disabled={isSwitchingContext}
                    onClick={() => handleBranchChange(null)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition disabled:cursor-wait disabled:opacity-60 ${activeBranchId === null ? 'bg-[#003366] text-white' : 'hover:bg-slate-50 text-slate-700'}`}
                  >
                    <span className="text-xs font-bold truncate">Semua Unit</span>
                  </button>
                )}
                {branches.map(branch => (
                  <button
                    key={branch.id}
                    type="button"
                    disabled={isSwitchingContext}
                    onClick={() => handleBranchChange(branch.id)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition disabled:cursor-wait disabled:opacity-60 ${activeBranchId === branch.id ? 'bg-[#003366] text-white' : 'hover:bg-slate-50 text-slate-700'}`}
                  >
                    <span className="text-xs font-bold truncate">{branch.name}</span>
                  </button>
                ))}
                {branches.length === 0 && (
                  <div className="px-3 py-2.5 text-xs font-bold text-slate-400">
                    Belum ada unit yang bisa diakses.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div ref={tokenPopupRef} className="relative">
          <button
            type="button"
            onClick={() => setIsTokenPopupOpen((prev) => !prev)}
            className={`inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] transition-all ${
              isLowBalance
                ? 'border-amber-300 bg-amber-50 text-amber-700'
                : 'border-indigo-200 bg-indigo-50 text-indigo-700'
            }`}
          >
            <Coins size={14} />
            <span>AI {tokenSummary.balance.toLocaleString('id-ID')}</span>
          </button>

          {isTokenPopupOpen && (
            <div className="absolute right-0 top-full z-50 mt-2 w-[290px] rounded-3xl border border-slate-200 bg-white p-4 shadow-2xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">AI Token Wallet</div>
                  <div className="mt-1 text-xl font-black tracking-tight text-slate-900">{tokenSummary.balance.toLocaleString('id-ID')}</div>
                </div>
                <div className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${isLowBalance ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                  {isLowBalance ? 'Low' : 'Healthy'}
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">Estimasi Generate</div>
                  <div className="mt-1 text-sm font-black text-slate-900">{tokenSummary.generationLeft.toLocaleString('id-ID')}x</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">Total Terpakai</div>
                  <div className="mt-1 text-sm font-black text-slate-900">{tokenSummary.used.toLocaleString('id-ID')}</div>
                </div>
              </div>

              <p className="mt-3 text-[11px] font-medium leading-relaxed text-slate-500">
                {isLowBalance
                  ? 'Token AI menipis. Lanjutkan pekerjaan tanpa hambatan dengan top up token.'
                  : 'Token AI cukup untuk kebutuhan generate saat ini.'}
              </p>

              <Link
                href="/billing?section=ai-token"
                onClick={() => setIsTokenPopupOpen(false)}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-white hover:bg-indigo-600 transition-all"
              >
                <Sparkles size={12} />
                Top Up Token AI
              </Link>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 pr-6 border-r border-slate-100">
          <Link href="/accounting/approvals" className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all ${hasRequests ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-white border-slate-100 text-slate-400'}`}>
            <Bell size={16} />
            {hasRequests && <div className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] rounded-full bg-rose-500 border-2 border-white flex items-center justify-center text-[9px] font-black text-white">{pendingApprovals}</div>}
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-black text-slate-900 leading-tight tracking-tight">{user.fullName || user.email}</p>
            <p className="text-[10px] text-blue-600 font-bold leading-none mt-1 uppercase tracking-widest">{jobTitle || 'Enterprise Member'}</p>
          </div>
          <div className="w-9 h-9 rounded-full bg-slate-100 border-2 border-white shadow-sm flex items-center justify-center text-slate-600 text-xs font-bold ring-1 ring-slate-100 uppercase">
            {initials}
          </div>
        </div>
      </div>
    </header>
  )
}
