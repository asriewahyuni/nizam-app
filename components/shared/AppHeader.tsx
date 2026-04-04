'use client'

import { getInitials } from '@/lib/utils'
import { Building2, Bell, Coins, Menu, MapPin, ChevronDown, Sparkles, Plus, CheckCircle2, AlertCircle, LoaderCircle, ShieldAlert } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, useTransition, type FormEvent } from 'react'
import Link from 'next/link'
import type { Organization } from '@/types/database.types'
import type { AiTokenHeaderSummary } from '@/modules/ai/lib/ai-token'
import { isPlatformAdminEmail } from '@/lib/saas/platform-admin'
import type {
  AccessibleOrganization,
  BranchSummary,
} from '@/modules/organization/lib/org-context'
import {
  createBranch,
  createOrganizationQuick,
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
  canManageBranches?: boolean
  pendingApprovals?: number
  cashFlow?: unknown
  aiTokens?: AiTokenHeaderSummary | null
}

type PendingContextSwitch =
  | {
      kind: 'org'
      orgId: string
      branchId?: string | null
      label: string
    }
  | {
      kind: 'branch'
      orgId: string
      branchId: string | null
      label: string
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
  canManageBranches = false,
  pendingApprovals = 0,
  aiTokens,
}: AppHeaderProps) {
  const router = useRouter()
  const [isCreatingOrg, startCreateOrgTransition] = useTransition()
  const [isCreatingBranch, startCreateBranchTransition] = useTransition()
  const [pendingContextSwitch, setPendingContextSwitch] = useState<PendingContextSwitch | null>(null)
  const [isTokenPopupOpen, setIsTokenPopupOpen] = useState(false)
  const [isOrgMenuOpen, setIsOrgMenuOpen] = useState(false)
  const [isQuickCreateOrgOpen, setIsQuickCreateOrgOpen] = useState(false)
  const [orgFeedback, setOrgFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [isBranchMenuOpen, setIsBranchMenuOpen] = useState(false)
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false)
  const [branchFeedback, setBranchFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const tokenPopupRef = useRef<HTMLDivElement | null>(null)
  const orgMenuRef = useRef<HTMLDivElement | null>(null)
  const branchMenuRef = useRef<HTMLDivElement | null>(null)

  const activeBranch = branches.find((branch) => branch.id === activeBranchId) || null
  const isSwitchingContext = pendingContextSwitch !== null

  const handleOrgChange = async (orgId: string) => {
    if (orgId === activeOrgId) return

    const targetOrg = organizations.find((membership) => membership.orgId === orgId)
    setPendingContextSwitch({
      kind: 'org',
      orgId,
      label: targetOrg?.org.name || 'organisasi terpilih',
    })

    const result: Awaited<ReturnType<typeof setActiveOrg>> = await setActiveOrg(orgId)
    if ('error' in result) {
      setPendingContextSwitch(null)
      alert(result.error)
      return
    }

    setPendingContextSwitch({
      kind: 'org',
      orgId,
      branchId: result.branchId,
      label: targetOrg?.org.name || 'organisasi terpilih',
    })
    setOrgFeedback(null)
    setIsQuickCreateOrgOpen(false)
    setIsOrgMenuOpen(false)
    window.dispatchEvent(new CustomEvent(ACTIVE_ORG_CHANGE_EVENT, { detail: { orgId } }))
    window.dispatchEvent(new CustomEvent(ACTIVE_BRANCH_CHANGE_EVENT, { detail: { orgId, branchId: result.branchId } }))
    router.refresh()
    setPendingContextSwitch(null)
  }

  const handleCreateOrganization = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const form = event.currentTarget
    const formData = new FormData(form)
    setOrgFeedback(null)

    startCreateOrgTransition(async () => {
      const result: Awaited<ReturnType<typeof createOrganizationQuick>> = await createOrganizationQuick(formData)
      if ('error' in result) {
        setOrgFeedback({ type: 'error', message: result.error })
        return
      }

      const createdOrgId = result.orgId || null
      const createdBranchId = result.branchId || null
      if (createdOrgId) {
        window.dispatchEvent(new CustomEvent(ACTIVE_ORG_CHANGE_EVENT, { detail: { orgId: createdOrgId } }))
        window.dispatchEvent(
          new CustomEvent(ACTIVE_BRANCH_CHANGE_EVENT, {
            detail: { orgId: createdOrgId, branchId: createdBranchId },
          })
        )
      }

      setOrgFeedback({ type: 'success', message: 'Organisasi baru dibuat dan langsung dijadikan konteks aktif.' })
      setIsQuickCreateOrgOpen(false)
      setIsOrgMenuOpen(false)
      form.reset()
      router.refresh()
    })
  }

  const handleBranchChange = async (branchId: string | null) => {
    const targetBranchLabel = branchId
      ? branches.find((branch) => branch.id === branchId)?.name || 'unit terpilih'
      : 'Semua Unit'

    setPendingContextSwitch({
      kind: 'branch',
      orgId: activeOrgId,
      branchId,
      label: targetBranchLabel,
    })

    const result: Awaited<ReturnType<typeof setActiveBranch>> = await setActiveBranch(activeOrgId, branchId)
    if ('error' in result) {
      setPendingContextSwitch(null)
      alert(result.error)
      return
    }

    setBranchFeedback(null)
    setIsQuickCreateOpen(false)
    setIsBranchMenuOpen(false)
    window.dispatchEvent(new CustomEvent(ACTIVE_BRANCH_CHANGE_EVENT, { detail: { orgId: activeOrgId, branchId } }))
    router.refresh()
    setPendingContextSwitch(null)
  }

  const handleCreateBranch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const form = event.currentTarget
    const formData = new FormData(event.currentTarget)
    setBranchFeedback(null)

    startCreateBranchTransition(async () => {
      const result: Awaited<ReturnType<typeof createBranch>> = await createBranch(activeOrgId, formData)
      if ('error' in result) {
        setBranchFeedback({ type: 'error', message: result.error })
        return
      }

      const createdBranchId = result.branchId || null
      if (createdBranchId) {
        window.dispatchEvent(
          new CustomEvent(ACTIVE_BRANCH_CHANGE_EVENT, {
            detail: { orgId: activeOrgId, branchId: createdBranchId },
          })
        )
      }

      setBranchFeedback({ type: 'success', message: 'Unit baru dibuat dan langsung dijadikan unit aktif.' })
      setIsQuickCreateOpen(false)
      setIsBranchMenuOpen(false)
      form.reset()
      router.refresh()
    })
  }

  const initials = getInitials(user.fullName || user.email)
  const hasRequests = pendingApprovals > 0
  const isPlatformAdmin = isPlatformAdminEmail(user.email)

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

  useEffect(() => {
    if (!isOrgMenuOpen) return

    const onClickOutside = (event: MouseEvent) => {
      const targetNode = event.target as Node
      if (!orgMenuRef.current?.contains(targetNode)) {
        setIsOrgMenuOpen(false)
        setIsQuickCreateOrgOpen(false)
        setOrgFeedback(null)
      }
    }

    window.addEventListener('mousedown', onClickOutside)
    return () => window.removeEventListener('mousedown', onClickOutside)
  }, [isOrgMenuOpen])

  useEffect(() => {
    if (!isBranchMenuOpen) return

    const onClickOutside = (event: MouseEvent) => {
      const targetNode = event.target as Node
      if (!branchMenuRef.current?.contains(targetNode)) {
        setIsBranchMenuOpen(false)
        setIsQuickCreateOpen(false)
        setBranchFeedback(null)
      }
    }

    window.addEventListener('mousedown', onClickOutside)
    return () => window.removeEventListener('mousedown', onClickOutside)
  }, [isBranchMenuOpen])

  const branchHeadline = activeBranch?.name || (allowAllBranchSelection ? 'Semua Unit' : branches[0]?.name || 'Pilih Unit')
  const branchCaption = activeBranch
    ? activeBranch.code
    : allowAllBranchSelection
      ? branches.length > 1
        ? 'Mode agregat read-only'
        : 'Tidak ada unit aktif'
      : 'Transaksi butuh unit aktif'
  const activeOrganization = organizations.find((membership) => membership.orgId === activeOrgId) || null
  const contextSwitchLabel = pendingContextSwitch
    ? pendingContextSwitch.kind === 'org'
      ? `Membuka ${pendingContextSwitch.label}...`
      : `Mengganti unit ke ${pendingContextSwitch.label}...`
    : null

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
          {contextSwitchLabel && (
            <div className="hidden lg:flex items-center gap-2 rounded-2xl border border-sky-200 bg-sky-50 px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-sky-700">
              <LoaderCircle size={12} className="animate-spin" />
              <span>{contextSwitchLabel}</span>
            </div>
          )}

          <div ref={orgMenuRef} className="relative">
            <button
              type="button"
              disabled={isSwitchingContext}
              onClick={() => {
                setOrgFeedback(null)
                setIsQuickCreateOrgOpen(false)
                setIsOrgMenuOpen((prev) => !prev)
              }}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-xl shadow-sm hover:bg-slate-100/70 transition-all disabled:cursor-wait disabled:opacity-70"
            >
              <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-[#003366] shrink-0 shadow-sm">
                {pendingContextSwitch?.kind === 'org' ? <LoaderCircle size={14} className="animate-spin" /> : <Building2 size={14} />}
              </div>
              <div className="flex flex-col overflow-hidden">
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter leading-none mb-0.5">Organisasi Aktif</span>
                <span className="text-xs font-black text-slate-900 leading-none truncate max-w-[140px]">{org.name}</span>
                <span className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400 mt-1 leading-none">
                  {activeOrganization?.role || 'member'}
                </span>
              </div>
              <ChevronDown size={12} className={`text-slate-400 ml-1 transition-transform ${isOrgMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOrgMenuOpen && (
              <div className="absolute top-full left-0 mt-2 w-[340px] bg-white border border-slate-100 rounded-3xl shadow-2xl p-3 z-50">
                <div className="px-2 pt-1 pb-3 border-b border-slate-100">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Konteks Organisasi</div>
                  <div className="mt-1 text-sm font-black text-slate-900">{org.name}</div>
                  <p className="mt-1 text-[11px] font-medium leading-relaxed text-slate-500">
                    Pilih organisasi aktif sebelum memilih unit kerja. Setiap organisasi punya konteks unit, data, dan paketnya sendiri.
                  </p>
                </div>

                <div className="space-y-1 mt-3">
                  {organizations.map((membership) => {
                    const isPendingTarget = pendingContextSwitch?.kind === 'org' && pendingContextSwitch.orgId === membership.orgId

                    return (
                      <button
                        key={membership.orgId}
                        type="button"
                        disabled={isSwitchingContext || isCreatingOrg}
                        onClick={() => handleOrgChange(membership.orgId)}
                        className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-2xl text-left transition disabled:cursor-wait disabled:opacity-60 ${
                          activeOrgId === membership.orgId ? 'bg-slate-900 text-white' : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-black truncate">{membership.org.name}</div>
                          <div className={`text-[9px] font-black uppercase tracking-[0.18em] ${activeOrgId === membership.orgId ? 'text-slate-300' : 'text-slate-400'}`}>
                            {membership.role}
                          </div>
                        </div>
                        {isPendingTarget ? <LoaderCircle size={14} className="animate-spin" /> : activeOrgId === membership.orgId ? <CheckCircle2 size={14} /> : null}
                      </button>
                    )
                  })}
                </div>

                {orgFeedback && (
                  <div className={`mt-3 flex items-start gap-2 rounded-2xl border px-3 py-2.5 text-[11px] font-bold ${
                    orgFeedback.type === 'success'
                      ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
                      : 'border-rose-100 bg-rose-50 text-rose-700'
                  }`}>
                    {orgFeedback.type === 'success' ? <CheckCircle2 size={14} className="shrink-0 mt-0.5" /> : <AlertCircle size={14} className="shrink-0 mt-0.5" />}
                    <span>{orgFeedback.message}</span>
                  </div>
                )}

                <div className="mt-3 border-t border-slate-100 pt-3 space-y-2">
                  <button
                    type="button"
                    onClick={() => {
                      setOrgFeedback(null)
                      setIsQuickCreateOrgOpen((prev) => !prev)
                    }}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-3 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-slate-700 hover:bg-slate-50 transition-all"
                  >
                    <Plus size={14} />
                    Tambah Org
                  </button>

                  {isQuickCreateOrgOpen && (
                    <form onSubmit={handleCreateOrganization} className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <input
                        name="name"
                        required
                        placeholder="Nama organisasi"
                        className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-900 outline-none focus:border-slate-900"
                      />
                      <button
                        type="submit"
                        disabled={isCreatingOrg || isSwitchingContext}
                        className="w-full rounded-2xl bg-slate-900 px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.16em] text-white hover:bg-[#003366] transition-all disabled:cursor-wait disabled:opacity-60"
                      >
                        {isCreatingOrg ? 'Membuat Org...' : 'Buat Dan Aktifkan'}
                      </button>
                    </form>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="h-6 w-px bg-slate-100 hidden sm:block" />

          {/* Branch Switcher */}
          <div ref={branchMenuRef} className="relative">
            <button
              type="button"
              disabled={isSwitchingContext}
              onClick={() => {
                setBranchFeedback(null)
                setIsQuickCreateOpen(false)
                setIsBranchMenuOpen((prev) => !prev)
              }}
              className="flex items-center gap-2 px-3 py-1.5 bg-[#003366]/5/50 border border-[#003366]/10 rounded-xl hover:bg-[#003366]/5 transition-all shadow-sm disabled:cursor-wait disabled:opacity-70"
            >
              {pendingContextSwitch?.kind === 'branch'
                ? <LoaderCircle size={14} className="text-[#003366] shrink-0 animate-spin" />
                : <MapPin size={14} className="text-[#003366] shrink-0" />}
              <div className="flex flex-col overflow-hidden">
                <span className="text-[9px] text-[#003366]/60 font-bold uppercase tracking-tighter leading-none mb-0.5">Unit Terpilih</span>
                <span className="text-xs font-black text-blue-900 leading-none truncate max-w-[150px]">
                  {branchHeadline}
                </span>
                <span className="text-[9px] font-black uppercase tracking-[0.18em] text-[#003366]/45 mt-1 leading-none">
                  {branchCaption}
                </span>
              </div>
              <ChevronDown size={12} className={`text-[#003366]/60 ml-1 transition-transform ${isBranchMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {isBranchMenuOpen && (
              <div className="absolute top-full left-0 mt-2 w-[320px] bg-white border border-slate-100 rounded-3xl shadow-2xl p-3 z-50">
                <div className="px-2 pt-1 pb-3 border-b border-slate-100">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Konteks Unit</div>
                  <div className="mt-1 text-sm font-black text-slate-900">
                    {activeBranch?.name || (allowAllBranchSelection ? 'Semua Unit' : 'Belum ada unit aktif')}
                  </div>
                  <p className="mt-1 text-[11px] font-medium leading-relaxed text-slate-500">
                    {activeBranch
                      ? 'Semua transaksi baru akan dibuat atas nama unit ini.'
                      : allowAllBranchSelection
                        ? 'Mode Semua Unit cocok untuk membaca ringkasan lintas unit. Pilih satu unit untuk membuat transaksi baru.'
                        : 'Pilih satu unit yang dapat Anda akses untuk memulai transaksi baru.'}
                  </p>
                </div>

                <div className="space-y-1 mt-3">
                {allowAllBranchSelection && (
                  <button
                    type="button"
                    disabled={isSwitchingContext || isCreatingBranch}
                    onClick={() => handleBranchChange(null)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-2xl transition disabled:cursor-wait disabled:opacity-60 ${activeBranchId === null ? 'bg-[#003366] text-white' : 'hover:bg-slate-50 text-slate-700'}`}
                    >
                      <div className="text-left">
                        <div className="text-xs font-bold truncate">Semua Unit</div>
                        <div className={`text-[9px] font-black uppercase tracking-[0.16em] ${activeBranchId === null ? 'text-white/70' : 'text-slate-400'}`}>
                          Read-only agregat
                        </div>
                      </div>
                    {pendingContextSwitch?.kind === 'branch' && pendingContextSwitch.branchId === null
                      ? <LoaderCircle size={14} className="animate-spin" />
                      : activeBranchId === null
                        ? <CheckCircle2 size={14} />
                        : null}
                  </button>
                )}
                {branches.map((branch) => {
                  const isPendingTarget = pendingContextSwitch?.kind === 'branch' && pendingContextSwitch.branchId === branch.id

                  return (
                    <button
                      key={branch.id}
                      type="button"
                      disabled={isSwitchingContext || isCreatingBranch}
                      onClick={() => handleBranchChange(branch.id)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-2xl transition disabled:cursor-wait disabled:opacity-60 ${activeBranchId === branch.id ? 'bg-[#003366] text-white' : 'hover:bg-slate-50 text-slate-700'}`}
                    >
                      <div className="text-left min-w-0">
                        <div className="text-xs font-bold truncate">{branch.name}</div>
                        <div className={`text-[9px] font-black uppercase tracking-[0.16em] ${activeBranchId === branch.id ? 'text-white/70' : 'text-slate-400'}`}>
                          {branch.code}
                        </div>
                      </div>
                      {isPendingTarget ? <LoaderCircle size={14} className="animate-spin" /> : activeBranchId === branch.id ? <CheckCircle2 size={14} /> : null}
                    </button>
                  )
                })}
                {branches.length === 0 && (
                  <div className="px-3 py-4 rounded-2xl bg-amber-50 border border-amber-100 text-xs font-bold text-amber-700">
                    Belum ada unit yang bisa diakses.
                  </div>
                )}
                </div>

                {branchFeedback && (
                  <div className={`mt-3 flex items-start gap-2 rounded-2xl border px-3 py-2.5 text-[11px] font-bold ${
                    branchFeedback.type === 'success'
                      ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
                      : 'border-rose-100 bg-rose-50 text-rose-700'
                  }`}>
                    {branchFeedback.type === 'success' ? <CheckCircle2 size={14} className="shrink-0 mt-0.5" /> : <AlertCircle size={14} className="shrink-0 mt-0.5" />}
                    <span>{branchFeedback.message}</span>
                  </div>
                )}

                {canManageBranches && (
                  <div className="mt-3 border-t border-slate-100 pt-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setBranchFeedback(null)
                          setIsQuickCreateOpen((prev) => !prev)
                        }}
                        className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-3 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-slate-700 hover:bg-slate-50 transition-all"
                      >
                        <Plus size={14} />
                        Tambah Unit
                      </button>
                      <Link
                        href="/settings/branches"
                        onClick={() => setIsBranchMenuOpen(false)}
                        className="text-[11px] font-black uppercase tracking-[0.14em] text-[#003366] hover:text-[#00264d]"
                      >
                        Kelola Unit
                      </Link>
                    </div>

                    {isQuickCreateOpen && (
                      <form onSubmit={handleCreateBranch} className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        <input
                          name="name"
                          required
                          placeholder="Nama unit"
                          className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-900 outline-none focus:border-[#003366]"
                        />
                        <input
                          name="code"
                          required
                          placeholder="Kode unit"
                          className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold uppercase text-slate-900 outline-none focus:border-[#003366]"
                        />
                        <textarea
                          name="address"
                          placeholder="Alamat operasional"
                          className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#003366] min-h-[72px]"
                        />
                        <button
                          type="submit"
                          disabled={isCreatingBranch || isSwitchingContext}
                          className="w-full rounded-2xl bg-slate-900 px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.16em] text-white hover:bg-[#003366] transition-all disabled:cursor-wait disabled:opacity-60"
                        >
                          {isCreatingBranch ? 'Membuat Unit...' : 'Buat Dan Aktifkan'}
                        </button>
                      </form>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-6">
        {isPlatformAdmin && (
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-amber-700 transition-all hover:border-amber-300 hover:bg-amber-100"
          >
            <ShieldAlert size={14} />
            <span className="hidden sm:inline">SaaS Admin</span>
          </Link>
        )}

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
