'use client'

import { formatRupiah, getInitials } from '@/lib/utils'
import { scheduleIdleTask } from '@/lib/browser/idle'
import { approvalSignalMatchesScope, subscribeApprovalSignal } from '@/lib/browser/approval-notifier'
import { Building2, Bell, Coins, Menu, MapPin, ChevronDown, Sparkles, Plus, CheckCircle2, AlertCircle, LoaderCircle, ShieldAlert, Layers, ArrowUpRight, GripVertical, Pencil, Trash2, Workflow, Command, Move, X, ZoomIn, ZoomOut, RotateCcw, Maximize2, Minimize2, Zap } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type DragEvent, type FormEvent, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from 'react'
import Link from 'next/link'
import type { Organization } from '@/types/database.types'
import type { AiTokenHeaderSummary } from '@/modules/ai/lib/ai-token'
import type { BSCDeckSummary } from '@/modules/accounting/actions/bsc.actions'
import type { DeckCashSummary } from '@/modules/accounting/actions/reports.actions'
import {
  getHeaderNavigationData,
  getHeaderPendingApprovals,
  getHeaderTokenSummary,
} from '@/modules/organization/actions/dashboard-shell.actions'
import { getOrganizationDeckData, type OrganizationDeckData } from '@/modules/organization/actions/org-deck.actions'
import { isPlatformAdminEmail } from '@/lib/saas/platform-admin'
import type {
  AccessibleOrganization,
  BranchSummary,
} from '@/modules/organization/lib/org-context'
import {
  createBranch,
  deleteChildOrganization,
  setActiveBranch,
  setActiveOrg,
  setOrganizationParent,
  updateChildOrganization,
} from '@/modules/organization/actions/org.actions'

interface AppHeaderProps {
  user: { fullName?: string; email: string }
  jobTitle?: string
  org: Organization
  organizations?: AccessibleOrganization[]
  activeOrgId: string
  branches?: BranchSummary[]
  activeBranchId: string | null
  activeBranch?: BranchSummary | null
  activeOrgRole?: string
  activeOrgParentId?: string | null
  activeOrgParentName?: string | null
  allowAllBranchSelection?: boolean
  canManageBranches?: boolean
  pendingApprovals?: number
  aiTokens?: AiTokenHeaderSummary | null
  orgBscSummaries?: Record<string, BSCDeckSummary>
  orgBranchesByOrgId?: Record<string, BranchSummary[]>
  orgCashSummaries?: Record<string, DeckCashSummary>
  branchCashSummaries?: Record<string, DeckCashSummary>
  planName?: string
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
const ORG_DECK_CARD_WIDTH = 272
const ORG_DECK_CARD_HEIGHT = 308
const ORG_DECK_CARD_EXPANDED_HEIGHT = 430
const ORG_DECK_BRANCH_CARD_WIDTH = 186
const ORG_DECK_BRANCH_CARD_HEIGHT = 160
const ORG_DECK_COLUMN_SPACING = 560
const ORG_DECK_MIN_ZOOM = 0.5
const ORG_DECK_MAX_ZOOM = 1.8
const ORG_DECK_ZOOM_STEP = 0.1
const EMPTY_BSC_SUMMARIES: Record<string, BSCDeckSummary> = {}
const EMPTY_BRANCH_MAP: Record<string, BranchSummary[]> = {}
const EMPTY_CASH_SUMMARIES: Record<string, DeckCashSummary> = {}
const EMPTY_ORGANIZATIONS: AccessibleOrganization[] = []
const EMPTY_BRANCHES: BranchSummary[] = []

type OrgDeckBranchNode = {
  key: string
  branch: BranchSummary
  orgId: string
  x: number
  y: number
}

type OrgDeckBranchOffset = {
  x: number
  y: number
}

type OrgDeckPosition = {
  x: number
  y: number
}

type OrgDeckPanState = {
  startClientX: number
  startClientY: number
  startScrollLeft: number
  startScrollTop: number
}

type OrgDeckLink = {
  childId: string
  parentId: string
}

function buildInitialOrgDeckPositions(
  organizations: AccessibleOrganization[],
  activeOrgId: string
): Record<string, OrgDeckPosition> {
  const positions: Record<string, OrgDeckPosition> = {}
  const knownOrgIds = new Set(organizations.map((membership) => membership.orgId))
  const childrenMap = new Map<string | null, AccessibleOrganization[]>()
  let verticalCursor = 72

  const pushChild = (parentId: string | null, membership: AccessibleOrganization) => {
    const current = childrenMap.get(parentId) || []
    current.push(membership)
    childrenMap.set(parentId, current)
  }

  organizations.forEach((membership) => {
    const parentId = membership.org.parent_org_id && knownOrgIds.has(membership.org.parent_org_id)
      ? membership.org.parent_org_id
      : null
    pushChild(parentId, membership)
  })

  childrenMap.forEach((group) => {
    group.sort((left, right) => {
      if (left.orgId === activeOrgId) return -1
      if (right.orgId === activeOrgId) return 1
      return left.org.name.localeCompare(right.org.name, 'id-ID')
    })
  })

  const placeNode = (membership: AccessibleOrganization, depth: number): number => {
    const children = childrenMap.get(membership.orgId) || []
    if (children.length === 0) {
      positions[membership.orgId] = {
        x: 72 + depth * ORG_DECK_COLUMN_SPACING,
        y: verticalCursor,
      }
      verticalCursor += 344
      return positions[membership.orgId].y
    }

    const childAnchors = children.map((child) => placeNode(child, depth + 1))
    const nodeY = Math.round((childAnchors[0] + childAnchors[childAnchors.length - 1]) / 2)
    positions[membership.orgId] = {
      x: 72 + depth * ORG_DECK_COLUMN_SPACING,
      y: nodeY,
    }
    return nodeY
  }

  const roots = childrenMap.get(null) || []
  roots.forEach((root, index) => {
    placeNode(root, 0)
    if (index < roots.length - 1) {
      verticalCursor += 36
    }
  })

  organizations.forEach((membership, index) => {
    if (!positions[membership.orgId]) {
      positions[membership.orgId] = {
        x: 72 + (index % 3) * ORG_DECK_COLUMN_SPACING,
        y: 72 + index * 344,
      }
    }
  })

  return positions
}

function buildOrgDeckLinks(organizations: AccessibleOrganization[]): OrgDeckLink[] {
  const knownOrgIds = new Set(organizations.map((membership) => membership.orgId))

  return organizations.flatMap((membership) => {
    const parentId = membership.org.parent_org_id
    if (!parentId || !knownOrgIds.has(parentId)) {
      return []
    }

    return [{
      childId: membership.orgId,
      parentId,
    }]
  })
}

function getOrgDeckCardHeight(isPerspectiveExpanded: boolean, bscIsReady: boolean) {
  return isPerspectiveExpanded && bscIsReady ? ORG_DECK_CARD_EXPANDED_HEIGHT : ORG_DECK_CARD_HEIGHT
}

function formatDeckMetricValue(value: number | null | undefined): string {
  const numericValue = Number(value ?? 0)
  if (!Number.isFinite(numericValue)) return 'Rp 0'

  const absoluteValue = Math.abs(numericValue)
  const sign = numericValue < 0 ? '-' : ''
  const shortFormatter = new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  })

  if (absoluteValue >= 1_000_000_000_000) {
    return `${sign}Rp ${shortFormatter.format(absoluteValue / 1_000_000_000_000)}T`
  }
  if (absoluteValue >= 1_000_000_000) {
    return `${sign}Rp ${shortFormatter.format(absoluteValue / 1_000_000_000)}M`
  }
  if (absoluteValue >= 1_000_000) {
    return `${sign}Rp ${shortFormatter.format(absoluteValue / 1_000_000)}jt`
  }
  if (absoluteValue >= 1_000) {
    return `${sign}Rp ${shortFormatter.format(absoluteValue / 1_000)}rb`
  }

  return `${sign}Rp ${Math.round(absoluteValue).toLocaleString('id-ID')}`
}

function getDeckMetricValueClass(valueLabel: string, compact: boolean): string {
  const length = valueLabel.length

  if (compact) {
    if (length >= 12) return 'text-[8px]'
    if (length >= 10) return 'text-[9px]'
    return 'text-[10px]'
  }

  if (length >= 14) return 'text-[9px]'
  if (length >= 11) return 'text-[10px]'
  return 'text-[11px]'
}

export function AppHeader({
  user,
  jobTitle,
  org,
  organizations: initialOrganizations = EMPTY_ORGANIZATIONS,
  activeOrgId,
  branches: initialBranches = EMPTY_BRANCHES,
  activeBranchId,
  activeBranch: initialActiveBranch = null,
  activeOrgRole,
  activeOrgParentId = null,
  activeOrgParentName = null,
  allowAllBranchSelection = true,
  canManageBranches = false,
  pendingApprovals: initialPendingApprovals = 0,
  aiTokens: initialAiTokens = null,
  orgBscSummaries = EMPTY_BSC_SUMMARIES,
  orgBranchesByOrgId = EMPTY_BRANCH_MAP,
  orgCashSummaries = EMPTY_CASH_SUMMARIES,
  branchCashSummaries = EMPTY_CASH_SUMMARIES,
  planName,
}: AppHeaderProps) {
  const router = useRouter()
  const [isCreatingBranch, startCreateBranchTransition] = useTransition()
  const [isUpdatingHierarchy, startHierarchyTransition] = useTransition()
  const [pendingContextSwitch, setPendingContextSwitch] = useState<PendingContextSwitch | null>(null)
  const [isTokenPopupOpen, setIsTokenPopupOpen] = useState(false)
  const [isOrgMenuOpen, setIsOrgMenuOpen] = useState(false)
  const [isOrgDeckOpen, setIsOrgDeckOpen] = useState(false)
  const [orgFeedback, setOrgFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [draggingOrgId, setDraggingOrgId] = useState<string | null>(null)
  const [isBranchMenuOpen, setIsBranchMenuOpen] = useState(false)
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false)
  const [branchFeedback, setBranchFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [isLoadingOrgDeckData, startOrgDeckDataTransition] = useTransition()
  const [isLoadingNavigationContext, setIsLoadingNavigationContext] = useState(false)
  const [isLoadingTokenSummary, setIsLoadingTokenSummary] = useState(false)
  const [expandedDeckOrgIds, setExpandedDeckOrgIds] = useState<Record<string, boolean>>({})
  const [orgDeckBranchOffsets, setOrgDeckBranchOffsets] = useState<Record<string, OrgDeckBranchOffset>>({})
  const [orgDeckZoom, setOrgDeckZoom] = useState(1)
  const [isOrgDeckFullscreen, setIsOrgDeckFullscreen] = useState(false)
  const [organizations, setOrganizations] = useState<AccessibleOrganization[]>(initialOrganizations)
  const [branches, setBranches] = useState<BranchSummary[]>(initialBranches)
  const [headerPendingApprovals, setHeaderPendingApprovals] = useState(initialPendingApprovals)
  const [aiTokens, setAiTokens] = useState<AiTokenHeaderSummary | null>(initialAiTokens)
  const hasInitialOrgDeckData = Boolean(
    Object.keys(orgBranchesByOrgId).length ||
    Object.keys(orgBscSummaries).length ||
    Object.keys(orgCashSummaries).length ||
    Object.keys(branchCashSummaries).length
  )
  const [orgDeckData, setOrgDeckData] = useState<OrganizationDeckData>(() => ({
    orgBscSummaries,
    orgBranchesByOrgId,
    orgCashSummaries,
    branchCashSummaries,
  }))
  const [hasLoadedOrgDeckData, setHasLoadedOrgDeckData] = useState(hasInitialOrgDeckData)
  const [hasLoadedNavigationContext, setHasLoadedNavigationContext] = useState(
    initialOrganizations.length > 0 || initialBranches.length > 0
  )
  const initialOrgDeckPositions = useMemo(
    () => buildInitialOrgDeckPositions(organizations, activeOrgId),
    [organizations, activeOrgId]
  )
  const orgDeckLinks = useMemo(() => buildOrgDeckLinks(organizations), [organizations])
  const [orgDeckPositions, setOrgDeckPositions] = useState<Record<string, OrgDeckPosition>>(initialOrgDeckPositions)
  const tokenPopupRef = useRef<HTMLDivElement | null>(null)
  const orgMenuRef = useRef<HTMLDivElement | null>(null)
  const branchMenuRef = useRef<HTMLDivElement | null>(null)
  const orgDeckPanelRef = useRef<HTMLDivElement | null>(null)
  const orgDeckViewportRef = useRef<HTMLDivElement | null>(null)
  const orgDeckDragRef = useRef<{
    orgId: string
    startClientX: number
    startClientY: number
    originX: number
    originY: number
  } | null>(null)
  const orgDeckPanRef = useRef<OrgDeckPanState | null>(null)
  const orgDeckBranchDragRef = useRef<{
    key: string
    startClientX: number
    startClientY: number
    originX: number
    originY: number
  } | null>(null)

  const activeBranch = branches.find((branch) => branch.id === activeBranchId) || initialActiveBranch || null
  const isSwitchingContext = pendingContextSwitch !== null
  const bscPerspectiveMeta: Array<{
    key: keyof NonNullable<BSCDeckSummary['perspective_scores']>
    label: string
    accent: string
  }> = [
    { key: 'FINANCIAL', label: 'Financial', accent: 'bg-emerald-100 text-emerald-700' },
    { key: 'CUSTOMER', label: 'Customer', accent: 'bg-sky-100 text-sky-700' },
    { key: 'INTERNAL_PROCESS', label: 'Internal', accent: 'bg-amber-100 text-amber-700' },
    { key: 'LEARNING_GROWTH', label: 'Learning', accent: 'bg-fuchsia-100 text-fuchsia-700' },
  ]
  const cashMetricMeta: Array<{ key: keyof DeckCashSummary; label: string }> = [
    { key: 'cash', label: 'Kas' },
    { key: 'ocf', label: 'OCF' },
    { key: 'icf', label: 'ICF' },
    { key: 'fcf', label: 'FCF' },
  ]
  const orgDeckBscSummaries = orgDeckData.orgBscSummaries
  const orgDeckBranchesByOrgId = orgDeckData.orgBranchesByOrgId
  const orgDeckCashSummaries = orgDeckData.orgCashSummaries
  const orgDeckBranchCashSummaries = orgDeckData.branchCashSummaries

  const isLoadingNavRef = useRef(false)
  const isLoadingTokenRef = useRef(false)

  const loadNavigationContext = useCallback(async () => {
    if (hasLoadedNavigationContext || isLoadingNavRef.current) return

    isLoadingNavRef.current = true
    setIsLoadingNavigationContext(true)
    try {
      const navigationData = await getHeaderNavigationData(activeOrgId)
      setOrganizations(navigationData.organizations)
      setBranches(navigationData.branches)
      setHasLoadedNavigationContext(true)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal memuat organisasi dan unit.'
      setOrgFeedback({ type: 'error', message })
    } finally {
      isLoadingNavRef.current = false
      setIsLoadingNavigationContext(false)
    }
  }, [activeOrgId, hasLoadedNavigationContext])

  const loadTokenSummary = useCallback(async () => {
    if (aiTokens || isLoadingTokenRef.current) return

    isLoadingTokenRef.current = true
    setIsLoadingTokenSummary(true)
    try {
      const tokenSummary = await getHeaderTokenSummary(activeOrgId)
      setAiTokens(tokenSummary)
    } catch (error) {
      console.error('[AppHeader] Failed to load AI token summary:', error)
    } finally {
      isLoadingTokenRef.current = false
      setIsLoadingTokenSummary(false)
    }
  }, [activeOrgId, aiTokens])

  const prewarmNavigationContext = useCallback(() => {
    if (hasLoadedNavigationContext || isLoadingNavigationContext) return
    void loadNavigationContext()
  }, [hasLoadedNavigationContext, isLoadingNavigationContext, loadNavigationContext])

  const prewarmTokenSummary = useCallback(() => {
    if (aiTokens || isLoadingTokenSummary) return
    void loadTokenSummary()
  }, [aiTokens, isLoadingTokenSummary, loadTokenSummary])

  const handleOrgMenuToggle = useCallback(() => {
    setOrgFeedback(null)
    const next = !isOrgMenuOpen
    if (next) {
      void loadNavigationContext()
    }
    setIsOrgMenuOpen(next)
  }, [isOrgMenuOpen, loadNavigationContext])

  const handleBranchMenuToggle = useCallback(() => {
    setBranchFeedback(null)
    setIsQuickCreateOpen(false)
    const next = !isBranchMenuOpen
    if (next) {
      void loadNavigationContext()
    }
    setIsBranchMenuOpen(next)
  }, [isBranchMenuOpen, loadNavigationContext])

  const handleTokenPopupToggle = useCallback(() => {
    const next = !isTokenPopupOpen
    if (next) {
      void loadTokenSummary()
    }
    setIsTokenPopupOpen(next)
  }, [isTokenPopupOpen, loadTokenSummary])

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
    setIsOrgMenuOpen(false)
    window.dispatchEvent(new CustomEvent(ACTIVE_ORG_CHANGE_EVENT, { detail: { orgId } }))
    window.dispatchEvent(new CustomEvent(ACTIVE_BRANCH_CHANGE_EVENT, { detail: { orgId, branchId: result.branchId } }))
    router.refresh()
    setPendingContextSwitch(null)
  }

  const handleHierarchyDrop = (childOrgId: string, parentOrgId: string | null) => {
    if (!canManageAffiliates) return

    const normalizedChildId = String(childOrgId || '').trim()
    const normalizedParentId = String(parentOrgId || '').trim() || null

    if (!normalizedChildId) return
    if (normalizedParentId && normalizedParentId === normalizedChildId) return

    setDraggingOrgId(null)
    setOrgFeedback(null)
    startHierarchyTransition(async () => {
      const result: Awaited<ReturnType<typeof setOrganizationParent>> = await setOrganizationParent(
        normalizedChildId,
        normalizedParentId
      )
      if ('error' in result) {
        setOrgFeedback({ type: 'error', message: result.error })
        return
      }

      setOrgFeedback({
        type: 'success',
        message: normalizedParentId
          ? 'Hierarki organisasi berhasil diperbarui.'
          : 'Organisasi berhasil dipindahkan ke level ROOT.',
      })
      router.refresh()
    })
  }

  const handleEditChildFromMenu = (childOrgId: string, currentName: string) => {
    if (!canManageAffiliates || !activeOrgIsParent) return

    const nextNameRaw = window.prompt('Ubah nama anak perusahaan:', currentName)
    if (nextNameRaw === null) return
    const nextName = String(nextNameRaw || '').trim()
    if (!nextName) {
      setOrgFeedback({ type: 'error', message: 'Nama organisasi wajib diisi.' })
      return
    }
    if (nextName === currentName.trim()) return

    setOrgFeedback(null)
    startHierarchyTransition(async () => {
      const result: Awaited<ReturnType<typeof updateChildOrganization>> = await updateChildOrganization(childOrgId, nextName)
      if ('error' in result) {
        setOrgFeedback({ type: 'error', message: result.error ?? '' })
        return
      }

      setOrgFeedback({ type: 'success', message: 'Nama anak perusahaan berhasil diperbarui.' })
      router.refresh()
    })
  }

  const handleDeleteChildFromMenu = (childOrgId: string, childName: string) => {
    if (!canManageAffiliates || !activeOrgIsParent) return

    const agreed = window.confirm(
      `Hapus anak perusahaan "${childName}"?\nTindakan ini permanen dan seluruh data organisasi akan ikut terhapus.`
    )
    if (!agreed) return

    setOrgFeedback(null)
    startHierarchyTransition(async () => {
      const result: Awaited<ReturnType<typeof deleteChildOrganization>> = await deleteChildOrganization(childOrgId)
      if ('error' in result) {
        setOrgFeedback({ type: 'error', message: result.error ?? '' })
        return
      }

      setOrgFeedback({ type: 'success', message: 'Anak perusahaan berhasil dihapus.' })
      router.refresh()
    })
  }

  const handleDragStart = (event: DragEvent<HTMLElement>, orgId: string) => {
    if (!canManageAffiliates || isUpdatingHierarchy) {
      event.preventDefault()
      return
    }

    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', orgId)
    setDraggingOrgId(orgId)
  }

  const handleDragEnd = () => {
    setDraggingOrgId(null)
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

  const handleDeckBranchActivate = async (targetOrgId: string, targetBranchId: string) => {
    const targetBranches = orgDeckBranchesByOrgId[targetOrgId] || []
    const targetBranch = targetBranches.find((branch) => branch.id === targetBranchId)

    setPendingContextSwitch({
      kind: 'branch',
      orgId: targetOrgId,
      branchId: targetBranchId,
      label: targetBranch?.name || 'unit terpilih',
    })

    if (targetOrgId !== activeOrgId) {
      const orgResult: Awaited<ReturnType<typeof setActiveOrg>> = await setActiveOrg(targetOrgId)
      if ('error' in orgResult) {
        setPendingContextSwitch(null)
        alert(orgResult.error)
        return
      }

      window.dispatchEvent(new CustomEvent(ACTIVE_ORG_CHANGE_EVENT, { detail: { orgId: targetOrgId } }))
      window.dispatchEvent(
        new CustomEvent(ACTIVE_BRANCH_CHANGE_EVENT, {
          detail: { orgId: targetOrgId, branchId: orgResult.branchId },
        })
      )
    }

    const branchResult: Awaited<ReturnType<typeof setActiveBranch>> = await setActiveBranch(targetOrgId, targetBranchId)
    if ('error' in branchResult) {
      setPendingContextSwitch(null)
      alert(branchResult.error)
      return
    }

    setOrgFeedback(null)
    setBranchFeedback(null)
    setIsOrgDeckOpen(false)
    window.dispatchEvent(
      new CustomEvent(ACTIVE_BRANCH_CHANGE_EVENT, {
        detail: { orgId: targetOrgId, branchId: targetBranchId },
      })
    )
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
  const hasRequests = headerPendingApprovals > 0
  const isPlatformAdmin = isPlatformAdminEmail(user.email)
  const tokenSummary = useMemo(() => ({
    balance: aiTokens?.balanceTokens || 0,
    threshold: aiTokens?.lowBalanceThreshold || 0,
    generationLeft: aiTokens?.estimatedGenerationLeft || 0,
    used: aiTokens?.totalUsedTokens || 0,
  }), [aiTokens])

  const isLowBalance = tokenSummary.threshold > 0 && tokenSummary.balance <= tokenSummary.threshold

  // Sync ulang saat org/branch aktif berubah.
  // Pakai activeOrgId/activeBranchId (primitives) bukan object props agar tidak infinite re-render.
  useEffect(() => {
    setOrganizations(initialOrganizations)
    setBranches(initialBranches)
    setHasLoadedNavigationContext(initialOrganizations.length > 0 || initialBranches.length > 0)
    setHeaderPendingApprovals(initialPendingApprovals)
    setAiTokens(initialAiTokens)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrgId, activeBranchId])

  useEffect(() => {
    let isCancelled = false
    const cancelIdleTask = scheduleIdleTask(() => {
      void (async () => {
        try {
          const pendingCount = await getHeaderPendingApprovals(activeOrgId, activeBranchId)
          if (!isCancelled) {
            setHeaderPendingApprovals(pendingCount)
          }
        } catch (error) {
          if (!isCancelled) {
            console.error('[AppHeader] Failed to load approval badge:', error)
          }
        }
      })()
    })

    return () => {
      isCancelled = true
      cancelIdleTask()
    }
  }, [activeBranchId, activeOrgId])

  useEffect(() => {
    return subscribeApprovalSignal((signal) => {
      if (!approvalSignalMatchesScope(signal, activeOrgId, activeBranchId)) {
        return
      }

      setHeaderPendingApprovals(signal.pendingCount)
    })
  }, [activeBranchId, activeOrgId])

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
  const effectiveActiveOrgRole = activeOrganization?.role || activeOrgRole || 'member'
  const effectiveActiveOrgParentName = activeOrganization?.org.parent_org_name || activeOrgParentName
  const effectiveActiveOrgParentId = activeOrganization?.org.parent_org_id || activeOrgParentId
  const activeOrgIsParent = !effectiveActiveOrgParentId
  const activeOrgHierarchyLabel = effectiveActiveOrgParentName
    ? `↳ ${effectiveActiveOrgParentName}`
    : 'ROOT'
  const canManageAffiliates =
    effectiveActiveOrgRole === 'owner' || effectiveActiveOrgRole === 'admin'
  const orgChildrenCount = useMemo(() => {
    const counts: Record<string, number> = {}

    organizations.forEach((membership) => {
      const parentId = membership.org.parent_org_id
      if (!parentId) return
      counts[parentId] = (counts[parentId] || 0) + 1
    })

    return counts
  }, [organizations])
  const contextSwitchLabel = pendingContextSwitch
    ? pendingContextSwitch.kind === 'org'
      ? `Membuka ${pendingContextSwitch.label}...`
      : `Mengganti unit ke ${pendingContextSwitch.label}...`
    : null

  const openOrgDeck = useCallback(() => {
    void (async () => {
      setIsOrgMenuOpen(false)
      setOrgFeedback(null)
      setIsOrgDeckOpen(true)

      if (hasLoadedOrgDeckData) return

      startOrgDeckDataTransition(async () => {
        try {
          const navigationData = hasLoadedNavigationContext
            ? { organizations, branches }
            : await getHeaderNavigationData(activeOrgId)

          if (!hasLoadedNavigationContext) {
            setOrganizations(navigationData.organizations)
            setBranches(navigationData.branches)
            setHasLoadedNavigationContext(true)
          }

          const deckData = await getOrganizationDeckData(
            navigationData.organizations.map((membership) => membership.orgId)
          )
          setOrgDeckData(deckData)
          setHasLoadedOrgDeckData(true)
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Gagal memuat struktur lintas entitas.'
          setOrgFeedback({ type: 'error', message })
        }
      })
    })()
  }, [activeOrgId, branches, hasLoadedNavigationContext, hasLoadedOrgDeckData, organizations])

  const clampOrgDeckZoom = useCallback((nextZoom: number) => {
    if (!Number.isFinite(nextZoom)) return 1
    return Math.min(ORG_DECK_MAX_ZOOM, Math.max(ORG_DECK_MIN_ZOOM, Math.round(nextZoom * 100) / 100))
  }, [])

  const updateOrgDeckZoom = useCallback((nextZoom: number, focusPoint?: { clientX: number; clientY: number }) => {
    const clampedZoom = clampOrgDeckZoom(nextZoom)
    const viewport = orgDeckViewportRef.current

    if (!viewport) {
      setOrgDeckZoom(clampedZoom)
      return
    }

    const previousZoom = orgDeckZoom
    if (Math.abs(previousZoom - clampedZoom) < 0.001) return

    const rect = viewport.getBoundingClientRect()
    const offsetX = focusPoint ? focusPoint.clientX - rect.left : viewport.clientWidth / 2
    const offsetY = focusPoint ? focusPoint.clientY - rect.top : viewport.clientHeight / 2
    const contentX = (viewport.scrollLeft + offsetX) / previousZoom
    const contentY = (viewport.scrollTop + offsetY) / previousZoom

    setOrgDeckZoom(clampedZoom)

    window.requestAnimationFrame(() => {
      viewport.scrollLeft = Math.max(0, contentX * clampedZoom - offsetX)
      viewport.scrollTop = Math.max(0, contentY * clampedZoom - offsetY)
    })
  }, [clampOrgDeckZoom, orgDeckZoom])

  const resetOrgDeckView = useCallback(() => {
    setOrgDeckZoom(1)
    setOrgDeckPositions(initialOrgDeckPositions)
    setOrgDeckBranchOffsets({})
    window.requestAnimationFrame(() => {
      orgDeckViewportRef.current?.scrollTo({ left: 0, top: 0, behavior: 'smooth' })
    })
  }, [initialOrgDeckPositions])

  const toggleOrgDeckFullscreen = useCallback(async () => {
    const panel = orgDeckPanelRef.current
    if (!panel) return

    try {
      if (document.fullscreenElement === panel) {
        await document.exitFullscreen()
        return
      }

      await panel.requestFullscreen()
    } catch (error) {
      console.error('[AppHeader] Failed to toggle deck fullscreen:', error)
    }
  }, [])

  const closeOrgDeck = useCallback(() => {
    setIsOrgDeckOpen(false)
    orgDeckDragRef.current = null
    orgDeckBranchDragRef.current = null
    orgDeckPanRef.current = null

    const panel = orgDeckPanelRef.current
    if (document.fullscreenElement === panel) {
      void document.exitFullscreen().catch(() => {})
    }
  }, [])

  const handleOrgDeckViewportPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return

    const target = event.target as HTMLElement | null
    if (
      target?.closest('[data-deck-card]')
      || target?.closest('[data-deck-control]')
      || target?.closest('button, a, input, textarea, select, label')
    ) {
      return
    }

    const viewport = orgDeckViewportRef.current
    if (!viewport) return

    orgDeckPanRef.current = {
      startClientX: event.clientX,
      startClientY: event.clientY,
      startScrollLeft: viewport.scrollLeft,
      startScrollTop: viewport.scrollTop,
    }
  }, [])

  const handleOrgDeckViewportWheel = useCallback((event: ReactWheelEvent<HTMLDivElement>) => {
    if (!event.ctrlKey && !event.metaKey) return

    event.preventDefault()
    const direction = event.deltaY > 0 ? -1 : 1
    updateOrgDeckZoom(orgDeckZoom + direction * ORG_DECK_ZOOM_STEP, {
      clientX: event.clientX,
      clientY: event.clientY,
    })
  }, [orgDeckZoom, updateOrgDeckZoom])

  const handleOrgDeckPointerDown = (orgId: string, clientX: number, clientY: number) => {
    const origin = orgDeckPositions[orgId] || initialOrgDeckPositions[orgId]
    if (!origin) return

    orgDeckDragRef.current = {
      orgId,
      startClientX: clientX,
      startClientY: clientY,
      originX: origin.x,
      originY: origin.y,
    }
  }

  const handleOrgDeckBranchPointerDown = (branchKey: string, clientX: number, clientY: number) => {
    const origin = orgDeckBranchOffsets[branchKey] || { x: 0, y: 0 }

    orgDeckBranchDragRef.current = {
      key: branchKey,
      startClientX: clientX,
      startClientY: clientY,
      originX: origin.x,
      originY: origin.y,
    }
  }

  useEffect(() => {
    setOrgDeckPositions(initialOrgDeckPositions)
  }, [initialOrgDeckPositions])

  // Sync orgDeckData dari props awal. Deps pakai primitives agar tidak re-run tiap render.
  useEffect(() => {
    setOrgDeckData({
      orgBscSummaries,
      orgBranchesByOrgId,
      orgCashSummaries,
      branchCashSummaries,
    })
    setHasLoadedOrgDeckData(hasInitialOrgDeckData)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrgId])

  useEffect(() => {
    if (!isOrgDeckOpen) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isOrgDeckOpen])

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsOrgDeckFullscreen(document.fullscreenElement === orgDeckPanelRef.current)
    }

    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const isTypingTarget = Boolean(
        target?.isContentEditable ||
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT'
      )

      if (isTypingTarget) return

      if (event.key === 'Escape') {
        if (document.fullscreenElement === orgDeckPanelRef.current) return
        closeOrgDeck()
        return
      }

      if (event.shiftKey && event.key.toLowerCase() === 'd') {
        event.preventDefault()
        if (isOrgDeckOpen) {
          closeOrgDeck()
        } else {
          openOrgDeck()
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOrgDeckOpen, openOrgDeck, closeOrgDeck])

  useEffect(() => {
    if (!isOrgDeckOpen) return

    const onPointerMove = (event: PointerEvent) => {
      const dragState = orgDeckDragRef.current
      if (dragState) {
        const nextX = Math.max(24, dragState.originX + (event.clientX - dragState.startClientX))
        const nextY = Math.max(24, dragState.originY + (event.clientY - dragState.startClientY))

        setOrgDeckPositions((current) => ({
          ...current,
          [dragState.orgId]: { x: nextX, y: nextY },
        }))
        return
      }

      const branchDragState = orgDeckBranchDragRef.current
      if (branchDragState) {
        const nextOffsetX = branchDragState.originX + (event.clientX - branchDragState.startClientX)
        const nextOffsetY = branchDragState.originY + (event.clientY - branchDragState.startClientY)

        setOrgDeckBranchOffsets((current) => ({
          ...current,
          [branchDragState.key]: { x: nextOffsetX, y: nextOffsetY },
        }))
        return
      }

      const panState = orgDeckPanRef.current
      const viewport = orgDeckViewportRef.current
      if (!panState || !viewport) return

      viewport.scrollLeft = Math.max(0, panState.startScrollLeft - (event.clientX - panState.startClientX))
      viewport.scrollTop = Math.max(0, panState.startScrollTop - (event.clientY - panState.startClientY))
    }

    const stopDragging = () => {
      orgDeckDragRef.current = null
      orgDeckBranchDragRef.current = null
      orgDeckPanRef.current = null
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', stopDragging)
    window.addEventListener('pointercancel', stopDragging)

    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', stopDragging)
      window.removeEventListener('pointercancel', stopDragging)
    }
  }, [isOrgDeckOpen])

  const renderCashMetricGrid = (
    summary: DeckCashSummary | undefined,
    options: { active: boolean; compact?: boolean }
  ) => {
    const { active, compact = false } = options

    return (
      <div className={`grid grid-cols-2 ${compact ? 'gap-1.5' : 'gap-2 mt-1'}`}>
        {cashMetricMeta.map((metric) => {
          const rawValue = summary?.[metric.key] ?? 0
          const compactValueLabel = formatDeckMetricValue(rawValue)
          const fullValueLabel = formatRupiah(rawValue)
          const valueClassName = getDeckMetricValueClass(compactValueLabel, compact)

          return (
            <div
              key={metric.key}
              className={`min-w-0 rounded-2xl border ${compact ? 'px-2 py-1.5' : 'px-2.5 py-2'} ${
                active
                  ? 'border-white/10 bg-white/5 text-white'
                  : 'border-slate-200 bg-white text-slate-900'
              }`}
            >
              <div className={`truncate text-[9px] font-black uppercase tracking-[0.14em] ${
                active ? 'text-slate-300' : 'text-slate-400'
              }`}>
                {metric.label}
              </div>
              <div
                title={fullValueLabel}
                className={`mt-1 font-black leading-[1.1] tracking-tight tabular-nums ${valueClassName} ${
                  active ? 'text-white' : 'text-slate-900'
                }`}
              >
                {compactValueLabel}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  const orgDeckBranchNodes = useMemo(() => {
    const nodes: OrgDeckBranchNode[] = []

    organizations.forEach((membership) => {
      const orgPosition = orgDeckPositions[membership.orgId] || initialOrgDeckPositions[membership.orgId]
      const branchesForOrg = orgDeckBranchesByOrgId[membership.orgId] || []
      if (!orgPosition || branchesForOrg.length === 0) return

      const bscSummary = orgDeckBscSummaries[membership.orgId]
      const bscIsReady = bscSummary?.status === 'ready'
      const isPerspectiveExpanded = Boolean(expandedDeckOrgIds[membership.orgId])
      const orgCardHeight = getOrgDeckCardHeight(isPerspectiveExpanded, bscIsReady)
      const branchGapY = 14
      const startX = orgPosition.x + ORG_DECK_CARD_WIDTH + 34
      const totalHeight = branchesForOrg.length * ORG_DECK_BRANCH_CARD_HEIGHT + Math.max(0, branchesForOrg.length - 1) * branchGapY
      const startY = orgPosition.y + Math.max(10, (orgCardHeight - totalHeight) / 2)

      branchesForOrg.forEach((branch, index) => {
        nodes.push({
          key: `${membership.orgId}:${branch.id}`,
          branch,
          orgId: membership.orgId,
          x: Math.round(startX + (orgDeckBranchOffsets[`${membership.orgId}:${branch.id}`]?.x || 0)),
          y: Math.round(startY + index * (ORG_DECK_BRANCH_CARD_HEIGHT + branchGapY) + (orgDeckBranchOffsets[`${membership.orgId}:${branch.id}`]?.y || 0)),
        })
      })
    })

    return nodes
  }, [organizations, orgDeckPositions, initialOrgDeckPositions, orgDeckBranchesByOrgId, orgDeckBscSummaries, expandedDeckOrgIds, orgDeckBranchOffsets])

  const deckCanvasSize = useMemo(() => {
    const orgMaxX = Object.values(orgDeckPositions).reduce((current, position) => Math.max(current, position.x + ORG_DECK_CARD_WIDTH), 0)
    const orgMaxY = organizations.reduce((current, membership) => {
      const position = orgDeckPositions[membership.orgId] || initialOrgDeckPositions[membership.orgId]
      if (!position) return current
      const bscSummary = orgDeckBscSummaries[membership.orgId]
      const height = getOrgDeckCardHeight(Boolean(expandedDeckOrgIds[membership.orgId]), bscSummary?.status === 'ready')
      return Math.max(current, position.y + height)
    }, 0)

    const branchMaxX = orgDeckBranchNodes.reduce((current, node) => Math.max(current, node.x + ORG_DECK_BRANCH_CARD_WIDTH), 0)
    const branchMaxY = orgDeckBranchNodes.reduce((current, node) => Math.max(current, node.y + ORG_DECK_BRANCH_CARD_HEIGHT), 0)

    return {
      width: Math.max(1120, Math.max(orgMaxX, branchMaxX) + 180),
      height: Math.max(720, Math.max(orgMaxY, branchMaxY) + 180),
    }
  }, [organizations, orgDeckPositions, initialOrgDeckPositions, orgDeckBranchNodes, orgDeckBscSummaries, expandedDeckOrgIds])

  return (
    <>
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
              onClick={handleOrgMenuToggle}
              onMouseEnter={prewarmNavigationContext}
              onFocus={prewarmNavigationContext}
              onTouchStart={prewarmNavigationContext}
              onPointerDown={prewarmNavigationContext}
              className="group flex items-center gap-2.5 pl-2 pr-3 py-1.5 bg-gradient-to-br from-[#003366]/5 to-slate-50 border border-[#003366]/12 rounded-2xl shadow-sm hover:shadow-md hover:from-[#003366]/8 hover:to-slate-50 hover:border-[#003366]/20 transition-all duration-200 disabled:cursor-wait disabled:opacity-70"
            >
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#003366] to-[#0055aa] flex items-center justify-center text-white shrink-0 shadow-md">
                {pendingContextSwitch?.kind === 'org' ? <LoaderCircle size={13} className="animate-spin" /> : <Building2 size={13} />}
              </div>
              <div className="flex flex-col overflow-hidden">
                <span className="text-[8.5px] text-[#003366]/50 font-black uppercase tracking-[0.16em] leading-none mb-0.5">Organisasi</span>
                <span className="text-[12.5px] font-black text-slate-900 leading-none truncate max-w-[130px]">{org.name}</span>
                <span className="text-[8.5px] font-black uppercase tracking-[0.16em] text-[#003366]/60 mt-0.5 leading-none">
                  {effectiveActiveOrgRole} · {activeOrgIsParent ? 'Parent' : 'Child'}
                </span>
              </div>
              <ChevronDown size={11} className={`text-[#003366]/40 shrink-0 transition-transform duration-200 ${isOrgMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOrgMenuOpen && (
              <div className="absolute top-full left-0 mt-2 w-[340px] bg-white border border-slate-100 rounded-3xl shadow-2xl p-3 z-50">
                <div className="px-2 pt-1 pb-3 border-b border-slate-100">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Konteks Organisasi</div>
                  <div className="mt-1 text-sm font-black text-slate-900">{org.name}</div>
                  <div className="mt-1 text-[10px] font-black uppercase tracking-[0.14em] text-blue-700">
                    {activeOrgHierarchyLabel}
                  </div>
                  <p className="mt-1 text-[11px] font-medium leading-relaxed text-slate-500">
                    Pilih organisasi aktif sebelum memilih unit kerja. Setiap organisasi punya konteks unit, data, dan paketnya sendiri.
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${activeOrgIsParent ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>
                      {activeOrgIsParent ? 'Parent (Holding)' : 'Child (Anak Perusahaan)'}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-500">
                      {activeOrgIsParent
                        ? 'Bisa buka Laporan Konsolidasi'
                        : 'Laporan konsolidasi hanya dari Parent'}
                    </span>
                  </div>
                  {canManageAffiliates && (
                    <>
                      <div className="mt-3 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={openOrgDeck}
                          className="inline-flex items-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-blue-700 transition hover:bg-blue-100"
                        >
                          <Workflow size={13} />
                          Open Deck
                        </button>
                        <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">
                          <Command size={10} />
                          Shift + D
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <div className="mt-3">
                  <Link
                    href={activeOrgIsParent ? '/reports?consolidated=true' : '/reports'}
                    onClick={() => setIsOrgMenuOpen(false)}
                    className={`flex items-center justify-between gap-2 p-3 border rounded-2xl transition group ${
                      activeOrgIsParent
                        ? 'bg-blue-50/50 hover:bg-blue-50 border-blue-100'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                       <div className={`p-1.5 rounded-xl ${activeOrgIsParent ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-500'}`}>
                         <Layers size={14} />
                       </div>
                       <div className="flex flex-col">
                         <span className={`text-xs font-black leading-none ${activeOrgIsParent ? 'text-blue-900' : 'text-slate-700'}`}>
                           Laporan Gabungan Grup
                         </span>
                         <span className={`text-[9px] font-bold mt-1 uppercase tracking-wider ${activeOrgIsParent ? 'text-blue-600' : 'text-slate-500'}`}>
                           {activeOrgIsParent ? 'Khusus Parent (Holding)' : 'Mode Child: Entitas Tunggal'}
                         </span>
                       </div>
                    </div>
                    <ArrowUpRight size={14} className={`${activeOrgIsParent ? 'text-blue-400 group-hover:text-blue-600' : 'text-slate-400'} transition`} />
                  </Link>
                </div>

                <div className="space-y-1 mt-3">
                  {canManageAffiliates && (
                    <div
                      onDragOver={(event) => {
                        if (!draggingOrgId || isUpdatingHierarchy) return
                        event.preventDefault()
                        event.dataTransfer.dropEffect = 'move'
                      }}
                      onDrop={(event) => {
                        if (!canManageAffiliates || isUpdatingHierarchy) return
                        event.preventDefault()
                        const droppedOrgId = event.dataTransfer.getData('text/plain') || draggingOrgId
                        if (!droppedOrgId) return
                        handleHierarchyDrop(droppedOrgId, null)
                      }}
                      className={`rounded-2xl border border-dashed px-3 py-2.5 text-[10px] font-black uppercase tracking-[0.14em] transition ${
                        draggingOrgId && !isUpdatingHierarchy
                          ? 'border-blue-300 bg-blue-50 text-blue-700'
                          : 'border-slate-200 bg-slate-50 text-slate-500'
                      }`}
                    >
                      ROOT
                    </div>
                  )}

                  {organizations.map((membership) => {
                    const isPendingTarget = pendingContextSwitch?.kind === 'org' && pendingContextSwitch.orgId === membership.orgId
                    const isDraggingThis = draggingOrgId === membership.orgId
                    const canDropHere = Boolean(draggingOrgId && draggingOrgId !== membership.orgId && canManageAffiliates && !isUpdatingHierarchy)
                    const isDirectChildOfActiveParent = membership.org.parent_org_id === activeOrgId
                    const canRenderChildActions = canManageAffiliates && activeOrgIsParent && isDirectChildOfActiveParent

                    return (
                      <div
                        key={membership.orgId}
                        onDragOver={(event) => {
                          if (!canDropHere) return
                          event.preventDefault()
                          event.dataTransfer.dropEffect = 'move'
                        }}
                        onDrop={(event) => {
                          if (!canDropHere) return
                          event.preventDefault()
                          const droppedOrgId = event.dataTransfer.getData('text/plain') || draggingOrgId
                          if (!droppedOrgId || droppedOrgId === membership.orgId) return
                          handleHierarchyDrop(droppedOrgId, membership.orgId)
                        }}
                        className={`relative rounded-2xl transition ${
                          canDropHere ? 'ring-1 ring-blue-200 bg-blue-50/40' : ''
                        } ${isDraggingThis ? 'opacity-60' : ''}`}
                      >
                        <button
                          type="button"
                          disabled={isSwitchingContext || isUpdatingHierarchy}
                          onClick={() => handleOrgChange(membership.orgId)}
                          className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-2xl text-left transition disabled:cursor-wait disabled:opacity-60 ${
                            activeOrgId === membership.orgId ? 'bg-slate-900 text-white' : 'hover:bg-slate-50 text-slate-700'
                          } ${canManageAffiliates ? 'pr-10' : ''}`}
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-black truncate">{membership.org.name}</div>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                              <span className={`text-[9px] font-black uppercase tracking-[0.18em] ${activeOrgId === membership.orgId ? 'text-slate-300' : 'text-slate-400'}`}>
                                {membership.role}
                              </span>
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                                membership.org.parent_org_id
                                  ? activeOrgId === membership.orgId
                                    ? 'bg-orange-500/20 text-orange-200'
                                    : 'bg-orange-100 text-orange-700'
                                  : activeOrgId === membership.orgId
                                    ? 'bg-emerald-500/20 text-emerald-200'
                                    : 'bg-emerald-100 text-emerald-700'
                              }`}>
                                {membership.org.parent_org_id ? 'Child' : 'Parent'}
                              </span>
                            </div>
                            <div className={`text-[9px] font-semibold truncate mt-1 ${activeOrgId === membership.orgId ? 'text-slate-200' : 'text-slate-500'}`}>
                              {membership.org.parent_org_name
                                ? `↳ ${membership.org.parent_org_name}`
                                : 'ROOT'}
                            </div>
                          </div>
                          {isPendingTarget ? <LoaderCircle size={14} className="animate-spin" /> : activeOrgId === membership.orgId ? <CheckCircle2 size={14} /> : null}
                        </button>

                        {canManageAffiliates && (
                          <button
                            type="button"
                            draggable={!isUpdatingHierarchy && !isSwitchingContext}
                            onDragStart={(event) => handleDragStart(event, membership.orgId)}
                            onDragEnd={handleDragEnd}
                            onClick={(event) => event.stopPropagation()}
                            className={`absolute right-2 top-1/2 -translate-y-1/2 rounded-lg border p-1 transition ${
                              activeOrgId === membership.orgId
                                ? 'border-slate-600 bg-slate-700 text-slate-100'
                                : 'border-slate-200 bg-white text-slate-500 hover:text-blue-700'
                            }`}
                            title="Drag untuk ubah hierarki"
                          >
                            <GripVertical size={13} />
                          </button>
                        )}

                        {canRenderChildActions && (
                          <div className={`px-3 pb-2.5 pt-0.5 flex items-center gap-2 ${activeOrgId === membership.orgId ? 'bg-slate-900 rounded-b-2xl' : ''}`}>
                            <button
                              type="button"
                              disabled={isSwitchingContext || isUpdatingHierarchy}
                              onClick={(event) => {
                                event.preventDefault()
                                event.stopPropagation()
                                handleEditChildFromMenu(membership.orgId, membership.org.name)
                              }}
                              className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] transition disabled:cursor-wait disabled:opacity-60 ${
                                activeOrgId === membership.orgId
                                  ? 'border-slate-600 bg-slate-800 text-slate-100'
                                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              <Pencil size={10} />
                              Edit
                            </button>
                            <button
                              type="button"
                              disabled={isSwitchingContext || isUpdatingHierarchy}
                              onClick={(event) => {
                                event.preventDefault()
                                event.stopPropagation()
                                handleDeleteChildFromMenu(membership.orgId, membership.org.name)
                              }}
                              className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] transition disabled:cursor-wait disabled:opacity-60 ${
                                activeOrgId === membership.orgId
                                  ? 'border-rose-500/40 bg-rose-500/20 text-rose-100'
                                  : 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                              }`}
                            >
                              <Trash2 size={10} />
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                  {isLoadingNavigationContext && organizations.length === 0 && (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-4 text-[11px] font-bold text-slate-500">
                      Memuat organisasi yang bisa Anda akses...
                    </div>
                  )}
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
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {canManageAffiliates && (
                        <Link
                          href="/settings/sub-orgs"
                          onClick={() => setIsOrgMenuOpen(false)}
                          className="inline-flex items-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-3 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-blue-700 transition hover:bg-blue-100"
                        >
                          <Plus size={14} />
                          Tambah Anak Perusahaan
                        </Link>
                      )}
                    </div>
                    {canManageAffiliates && (
                      <Link
                        href="/settings/sub-orgs"
                        onClick={() => setIsOrgMenuOpen(false)}
                        className="text-[11px] font-black uppercase tracking-[0.14em] text-[#003366] hover:text-[#00264d]"
                      >
                        Kelola Anak Perusahaan
                      </Link>
                    )}
                  </div>

                  {canManageAffiliates && (
                    <p className="rounded-2xl border border-blue-100 bg-blue-50 px-3 py-2 text-[11px] font-semibold leading-relaxed text-blue-800">
                      Struktur entitas anak dikelola melalui menu <span className="font-black">Kelola Anak Perusahaan</span>.
                      Cabang tetap dibuat dari menu cabang dalam organisasi aktif, bukan dari area ini.
                    </p>
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
              onClick={handleBranchMenuToggle}
              onMouseEnter={prewarmNavigationContext}
              onFocus={prewarmNavigationContext}
              onTouchStart={prewarmNavigationContext}
              onPointerDown={prewarmNavigationContext}
              className="group flex items-center gap-2.5 pl-2 pr-3 py-1.5 bg-gradient-to-br from-emerald-50 to-teal-50/60 border border-emerald-200/70 rounded-2xl shadow-sm hover:shadow-md hover:from-emerald-50 hover:to-teal-50 hover:border-emerald-300/60 transition-all duration-200 disabled:cursor-wait disabled:opacity-70"
            >
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shrink-0 shadow-md">
                {pendingContextSwitch?.kind === 'branch'
                  ? <LoaderCircle size={13} className="animate-spin" />
                  : <MapPin size={13} />}
              </div>
              <div className="flex flex-col overflow-hidden">
                <span className="text-[8.5px] text-emerald-600/70 font-black uppercase tracking-[0.16em] leading-none mb-0.5">Unit Kerja</span>
                <span className="text-[12.5px] font-black text-slate-900 leading-none truncate max-w-[140px]">
                  {branchHeadline}
                </span>
                <span className="text-[8.5px] font-black uppercase tracking-[0.16em] text-emerald-600/60 mt-0.5 leading-none">
                  {branchCaption}
                </span>
              </div>
              <ChevronDown size={11} className={`text-emerald-500/60 shrink-0 transition-transform duration-200 ${isBranchMenuOpen ? 'rotate-180' : ''}`} />
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
                    {isLoadingNavigationContext ? 'Memuat unit yang bisa diakses...' : 'Belum ada unit yang bisa diakses.'}
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
        <div className="hidden sm:block">
          <VersionIntegrityButton />
        </div>

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
            onClick={handleTokenPopupToggle}
            onMouseEnter={prewarmTokenSummary}
            onFocus={prewarmTokenSummary}
            onTouchStart={prewarmTokenSummary}
            onPointerDown={prewarmTokenSummary}
            className={`inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] transition-all ${
              isLowBalance
                ? 'border-amber-300 bg-amber-50 text-amber-700'
                : 'border-indigo-200 bg-indigo-50 text-indigo-700'
            }`}
          >
            <Coins size={14} />
            <span>
              AI {isLoadingTokenSummary && !aiTokens ? '...' : tokenSummary.balance.toLocaleString('id-ID')}
            </span>
          </button>

          {isTokenPopupOpen && (
            <div className="absolute right-0 top-full z-50 mt-2 w-[290px] rounded-3xl border border-slate-200 bg-white p-4 shadow-2xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">AI Token Wallet</div>
                  <div className="mt-1 text-xl font-black tracking-tight text-slate-900">
                    {isLoadingTokenSummary && !aiTokens ? 'Memuat...' : tokenSummary.balance.toLocaleString('id-ID')}
                  </div>
                </div>
                <div className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${isLowBalance ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                  {isLowBalance ? 'Low' : 'Healthy'}
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">Estimasi Generate</div>
                  <div className="mt-1 text-sm font-black text-slate-900">
                    {isLoadingTokenSummary && !aiTokens ? '...' : `${tokenSummary.generationLeft.toLocaleString('id-ID')}x`}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">Total Terpakai</div>
                  <div className="mt-1 text-sm font-black text-slate-900">
                    {isLoadingTokenSummary && !aiTokens ? '...' : tokenSummary.used.toLocaleString('id-ID')}
                  </div>
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
          <Link href="/accounting/approvals" className={`relative w-9 h-9 rounded-xl border flex items-center justify-center transition-all ${hasRequests ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-white border-slate-100 text-slate-400'}`}>
            <Bell size={16} />
            {hasRequests && <div className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] rounded-full bg-rose-500 border-2 border-white flex items-center justify-center text-[9px] font-black text-white">{headerPendingApprovals}</div>}
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

      {isOrgDeckOpen && (
        <div className="fixed inset-0 z-[90]">
          <button
            type="button"
            aria-label="Tutup Open Deck"
            onClick={closeOrgDeck}
            className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm"
          />

          <div className="relative flex h-full items-center justify-center p-3 md:p-6">
            <div
              ref={orgDeckPanelRef}
              className="relative flex h-[calc(100vh-24px)] w-[calc(100vw-24px)] max-w-none flex-col overflow-hidden rounded-[30px] border border-white/70 bg-white shadow-2xl md:h-[calc(100vh-48px)] md:w-[calc(100vw-48px)] md:rounded-[36px]"
            >
              <div className="border-b border-slate-100 bg-[radial-gradient(circle_at_top_left,_rgba(191,219,254,0.32),_transparent_48%),linear-gradient(135deg,_rgba(248,250,252,0.98),_rgba(255,255,255,0.98))] px-5 py-4 md:px-7">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-blue-700">
                      <Workflow size={12} />
                      Open Deck
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">
                      <Command size={10} />
                      Shift + D
                    </span>
                    <h2 className="text-lg font-black tracking-tight text-slate-950 md:text-xl">
                      Struktur Grup
                    </h2>
                  </div>

                  <div data-deck-control className="flex flex-wrap items-center gap-2">
                    <div className="inline-flex items-center overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                      <button
                        type="button"
                        onClick={() => updateOrgDeckZoom(orgDeckZoom - ORG_DECK_ZOOM_STEP)}
                        disabled={orgDeckZoom <= ORG_DECK_MIN_ZOOM}
                        className="inline-flex h-10 w-10 items-center justify-center text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label="Zoom out"
                        title="Zoom out"
                      >
                        <ZoomOut size={14} />
                      </button>
                      <div className="min-w-[64px] border-x border-slate-200 px-3 text-center text-[11px] font-black text-slate-700">
                        {Math.round(orgDeckZoom * 100)}%
                      </div>
                      <button
                        type="button"
                        onClick={() => updateOrgDeckZoom(orgDeckZoom + ORG_DECK_ZOOM_STEP)}
                        disabled={orgDeckZoom >= ORG_DECK_MAX_ZOOM}
                        className="inline-flex h-10 w-10 items-center justify-center text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label="Zoom in"
                        title="Zoom in"
                      >
                        <ZoomIn size={14} />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={resetOrgDeckView}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50"
                      aria-label="Reset view"
                      title="Reset view"
                    >
                      <RotateCcw size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => void toggleOrgDeckFullscreen()}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50"
                      aria-label={isOrgDeckFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                      title={isOrgDeckFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                    >
                      {isOrgDeckFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                    </button>
                    {canManageAffiliates && (
                      <Link
                        href="/settings/sub-orgs"
                        onClick={closeOrgDeck}
                        className="inline-flex items-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-blue-700 transition hover:bg-blue-100"
                      >
                        <Plus size={12} />
                        Tambah
                      </Link>
                    )}
                    {canManageAffiliates && (
                      <Link
                        href="/settings/sub-orgs"
                        onClick={closeOrgDeck}
                        className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-700 transition hover:bg-slate-50"
                      >
                        Kelola
                        <ArrowUpRight size={12} />
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={closeOrgDeck}
                      className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-700 transition hover:bg-slate-50"
                    >
                      <X size={12} />
                      Tutup
                    </button>
                  </div>
                </div>
              </div>

              <div
                ref={orgDeckViewportRef}
                onPointerDown={handleOrgDeckViewportPointerDown}
                onWheel={handleOrgDeckViewportWheel}
                className={`flex-1 overflow-auto bg-[linear-gradient(rgba(226,232,240,0.55)_1px,transparent_1px),linear-gradient(90deg,rgba(226,232,240,0.55)_1px,transparent_1px)] bg-[size:28px_28px] ${orgDeckPanRef.current ? 'cursor-grabbing' : 'cursor-grab'}`}
              >
                <div
                  className="relative"
                  style={{
                    width: `${deckCanvasSize.width * orgDeckZoom}px`,
                    height: `${deckCanvasSize.height * orgDeckZoom}px`,
                  }}
                >
                  <div
                    style={{
                      width: `${deckCanvasSize.width}px`,
                      height: `${deckCanvasSize.height}px`,
                      transform: `scale(${orgDeckZoom})`,
                      transformOrigin: 'top left',
                    }}
                  >
                  {isLoadingOrgDeckData && !hasLoadedOrgDeckData && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/78 backdrop-blur-sm">
                      <div className="inline-flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[11px] font-black uppercase tracking-[0.14em] text-slate-600 shadow-lg">
                        <LoaderCircle size={14} className="animate-spin" />
                        Memuat struktur lintas entitas...
                      </div>
                    </div>
                  )}
                  <svg
                    className="pointer-events-none absolute inset-0"
                    width={deckCanvasSize.width}
                    height={deckCanvasSize.height}
                    viewBox={`0 0 ${deckCanvasSize.width} ${deckCanvasSize.height}`}
                    fill="none"
                  >
                    {orgDeckLinks.map((link) => {
                      const parentPosition = orgDeckPositions[link.parentId]
                      const childPosition = orgDeckPositions[link.childId]
                      if (!parentPosition || !childPosition) return null

                      const parentBsc = orgDeckBscSummaries[link.parentId]
                      const childBsc = orgDeckBscSummaries[link.childId]
                      const parentHeight = getOrgDeckCardHeight(Boolean(expandedDeckOrgIds[link.parentId]), parentBsc?.status === 'ready')
                      const childHeight = getOrgDeckCardHeight(Boolean(expandedDeckOrgIds[link.childId]), childBsc?.status === 'ready')
                      const startX = parentPosition.x + ORG_DECK_CARD_WIDTH
                      const startY = parentPosition.y + parentHeight / 2
                      const endX = childPosition.x
                      const endY = childPosition.y + childHeight / 2
                      const curveStrength = Math.max(84, (endX - startX) / 2)

                      return (
                        <path
                          key={`${link.parentId}-${link.childId}`}
                          d={`M ${startX} ${startY} C ${startX + curveStrength} ${startY}, ${endX - curveStrength} ${endY}, ${endX} ${endY}`}
                          stroke="rgba(59, 130, 246, 0.32)"
                          strokeWidth="3"
                          strokeLinecap="round"
                        />
                      )
                    })}
                    {orgDeckBranchNodes.map((node) => {
                      const orgPosition = orgDeckPositions[node.orgId] || initialOrgDeckPositions[node.orgId]
                      if (!orgPosition) return null

                      const bscSummary = orgDeckBscSummaries[node.orgId]
                      const orgCardHeight = getOrgDeckCardHeight(Boolean(expandedDeckOrgIds[node.orgId]), bscSummary?.status === 'ready')
                      const startX = orgPosition.x + ORG_DECK_CARD_WIDTH
                      const startY = orgPosition.y + orgCardHeight / 2
                      const endX = node.x
                      const endY = node.y + ORG_DECK_BRANCH_CARD_HEIGHT / 2
                      const midX = startX + Math.max(18, (endX - startX) / 2)

                      return (
                        <path
                          key={`branch-link-${node.key}`}
                          d={`M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`}
                          stroke="rgba(148, 163, 184, 0.42)"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                        />
                      )
                    })}
                  </svg>

                  {organizations.map((membership) => {
                    const position = orgDeckPositions[membership.orgId] || initialOrgDeckPositions[membership.orgId] || { x: 72, y: 72 }
                    const isActiveCard = membership.orgId === activeOrgId
                    const isPendingTarget = pendingContextSwitch?.kind === 'org' && pendingContextSwitch.orgId === membership.orgId
                    const childCount = orgChildrenCount[membership.orgId] || 0
                    const relationLabel = membership.org.parent_org_name ? `Child dari ${membership.org.parent_org_name}` : 'Root / Parent'
                    const bscSummary = orgDeckBscSummaries[membership.orgId]
                    const bscIsReady = bscSummary?.status === 'ready'
                    const bscHasError = bscSummary?.status === 'error'
                    const isPerspectiveExpanded = Boolean(expandedDeckOrgIds[membership.orgId])
                    const orgCardHeight = getOrgDeckCardHeight(isPerspectiveExpanded, bscIsReady)
                    const orgCashSummary = orgDeckCashSummaries[membership.orgId]

                    return (
                      <div
                        key={`deck-${membership.orgId}`}
                        data-deck-card="org"
                        className={`absolute w-[272px] rounded-[28px] border shadow-xl transition ${
                          isActiveCard
                            ? 'border-slate-900 bg-slate-950 text-white shadow-slate-900/20'
                            : 'border-slate-200 bg-white text-slate-900 shadow-slate-200/70'
                        }`}
                        style={{
                          left: `${position.x}px`,
                          top: `${position.y}px`,
                          minHeight: `${orgCardHeight}px`,
                        }}
                      >
                        <div
                          onPointerDown={(event) => {
                            if (event.button !== 0) return
                            handleOrgDeckPointerDown(membership.orgId, event.clientX, event.clientY)
                          }}
                          className={`flex cursor-grab items-center justify-between rounded-t-[28px] border-b px-4 py-3 active:cursor-grabbing ${
                            isActiveCard
                              ? 'border-white/10 bg-white/5'
                              : 'border-slate-100 bg-slate-50/80'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className={`text-[9px] font-black uppercase tracking-[0.18em] ${isActiveCard ? 'text-slate-300' : 'text-slate-400'}`}>
                              {membership.role}
                            </div>
                            <div className={`mt-1 text-[11px] font-semibold ${isActiveCard ? 'text-slate-200' : 'text-slate-500'}`}>
                              Geser kartu
                            </div>
                          </div>
                          <div className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] ${
                            isActiveCard
                              ? 'bg-white/10 text-white'
                              : 'bg-blue-50 text-blue-700'
                          }`}>
                            <Move size={10} />
                            Mindmap
                          </div>
                        </div>

                        <div className="space-y-4 p-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <div className={`flex h-10 w-10 items-center justify-center rounded-2xl border ${
                                isActiveCard
                                  ? 'border-white/10 bg-white/10 text-white'
                                  : 'border-slate-200 bg-slate-50 text-[#003366]'
                              }`}>
                                <Building2 size={18} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <div className="truncate text-sm font-black">{membership.org.name}</div>
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <div className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-black ${
                                      bscIsReady
                                        ? (bscSummary?.overall_score_100 ?? 0) >= 85
                                          ? isActiveCard
                                            ? 'bg-emerald-500/20 text-emerald-100'
                                            : 'bg-emerald-100 text-emerald-700'
                                          : (bscSummary?.overall_score_100 ?? 0) >= 70
                                            ? isActiveCard
                                              ? 'bg-blue-500/20 text-blue-100'
                                              : 'bg-blue-100 text-blue-700'
                                            : isActiveCard
                                              ? 'bg-amber-500/20 text-amber-100'
                                              : 'bg-amber-100 text-amber-700'
                                        : isActiveCard
                                          ? 'bg-white/10 text-slate-100'
                                          : 'bg-slate-100 text-slate-600'
                                    }`}>
                                      {bscIsReady ? `${bscSummary?.overall_score_100 ?? 0}` : 'BSC -'}
                                    </div>
                                    <button
                                      type="button"
                                      disabled={!bscIsReady}
                                      onClick={(event) => {
                                        event.stopPropagation()
                                        setExpandedDeckOrgIds((current) => ({
                                          ...current,
                                          [membership.orgId]: !current[membership.orgId],
                                        }))
                                      }}
                                      className={`inline-flex h-8 w-8 items-center justify-center rounded-xl border transition disabled:cursor-not-allowed disabled:opacity-40 ${
                                        isActiveCard
                                          ? 'border-white/10 bg-white/5 text-white hover:bg-white/10'
                                          : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                                      }`}
                                      aria-label="Tampilkan 4 perspektif BSC"
                                    >
                                      <ChevronDown size={14} className={`transition-transform ${isPerspectiveExpanded ? 'rotate-180' : ''}`} />
                                    </button>
                                  </div>
                                </div>
                                <div className={`mt-1 truncate text-[10px] font-bold uppercase tracking-[0.14em] ${
                                  isActiveCard ? 'text-slate-300' : 'text-slate-400'
                                }`}>
                                  {membership.org.slug}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] ${
                              membership.org.parent_org_id
                                ? isActiveCard
                                  ? 'bg-orange-500/20 text-orange-100'
                                  : 'bg-orange-100 text-orange-700'
                                : isActiveCard
                                  ? 'bg-emerald-500/20 text-emerald-100'
                                  : 'bg-emerald-100 text-emerald-700'
                            }`}>
                              {membership.org.parent_org_id ? 'Child' : 'Parent'}
                            </span>
                            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] ${
                              isActiveCard
                                ? 'bg-white/10 text-slate-100'
                                : 'bg-slate-100 text-slate-600'
                            }`}>
                              {childCount} anak
                            </span>
                          </div>

                          <div className={`rounded-2xl border px-3 py-2 text-[11px] font-semibold leading-relaxed ${
                            isActiveCard
                              ? 'border-white/10 bg-white/5 text-slate-200'
                              : 'border-slate-200 bg-slate-50 text-slate-600'
                          }`}>
                            {relationLabel}
                          </div>

                          <div className={`rounded-2xl border px-3 py-3 ${
                            isActiveCard
                              ? 'border-white/10 bg-white/5'
                              : 'border-slate-200 bg-slate-50'
                          }`}>
                            <div className={`mb-2 text-[9px] font-black uppercase tracking-[0.18em] ${
                              isActiveCard ? 'text-slate-300' : 'text-slate-400'
                            }`}>
                              Kas / Cash Flow
                            </div>
                            {renderCashMetricGrid(orgCashSummary, { active: isActiveCard })}
                          </div>

                          {bscIsReady && isPerspectiveExpanded && (
                            <div className={`grid grid-cols-2 gap-2 rounded-2xl border p-2 ${
                              isActiveCard
                                ? 'border-white/10 bg-white/5'
                                : 'border-slate-200 bg-slate-50'
                            }`}>
                              {bscPerspectiveMeta.map((perspective) => {
                                const perspectiveScore = bscSummary?.perspective_scores[perspective.key]

                                return (
                                  <div
                                    key={`${membership.orgId}-${perspective.key}`}
                                    className={`rounded-2xl border px-3 py-2 ${
                                      isActiveCard
                                        ? 'border-white/10 bg-white/5'
                                        : 'border-slate-200 bg-white'
                                    }`}
                                  >
                                    <div className={`inline-flex rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] ${perspective.accent}`}>
                                      {perspective.label}
                                    </div>
                                    <div className={`mt-2 text-lg font-black ${
                                      isActiveCard ? 'text-white' : 'text-slate-900'
                                    }`}>
                                      {perspectiveScore?.score_100 ?? 0}
                                    </div>
                                    <div className={`text-[10px] font-bold uppercase tracking-[0.14em] ${
                                      isActiveCard ? 'text-slate-300' : 'text-slate-500'
                                    }`}>
                                      {perspectiveScore?.score_4 ?? 0} / 4
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )}

                          {!bscIsReady && (
                            <div className={`text-[11px] font-semibold leading-relaxed ${
                              isActiveCard ? 'text-slate-300' : 'text-slate-500'
                            }`}>
                              {bscHasError
                                ? 'Ringkasan BSC belum bisa dibaca untuk organisasi ini.'
                                : 'Belum ada global score BSC yang siap ditampilkan.'}
                            </div>
                          )}

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={isActiveCard || isSwitchingContext}
                              onClick={() => {
                                closeOrgDeck()
                                void handleOrgChange(membership.orgId)
                              }}
                              className={`inline-flex flex-1 items-center justify-center gap-2 rounded-2xl px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] transition disabled:cursor-wait disabled:opacity-60 ${
                                isActiveCard
                                  ? 'bg-white/10 text-white'
                                  : 'bg-slate-900 text-white hover:bg-[#003366]'
                              }`}
                            >
                              {isPendingTarget ? <LoaderCircle size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                              {isActiveCard ? 'Sedang Aktif' : 'Aktifkan'}
                            </button>
                            {canManageAffiliates && (
                              <Link
                                href="/settings/sub-orgs"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  closeOrgDeck()
                                }}
                                className={`inline-flex items-center justify-center gap-2 rounded-2xl border px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] transition ${
                                  isActiveCard
                                    ? 'border-white/10 bg-white/5 text-white hover:bg-white/10'
                                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                                }`}
                              >
                                Atur
                                <ArrowUpRight size={12} />
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  {orgDeckBranchNodes.map((node) => {
                    const isActiveBranchCard = node.orgId === activeOrgId && node.branch.id === activeBranchId
                    const isParentOrgActive = node.orgId === activeOrgId
                    const isPendingBranchTarget =
                      pendingContextSwitch?.kind === 'branch' &&
                      pendingContextSwitch.orgId === node.orgId &&
                      pendingContextSwitch.branchId === node.branch.id
                    const branchCashSummary = orgDeckBranchCashSummaries[`${node.orgId}:${node.branch.id}`]

                    return (
                      <div
                        key={`branch-card-${node.key}`}
                        data-deck-card="branch"
                        role="button"
                        tabIndex={isActiveBranchCard || isSwitchingContext ? -1 : 0}
                        aria-disabled={isActiveBranchCard || isSwitchingContext}
                        onClick={() => {
                          if (isActiveBranchCard || isSwitchingContext) return
                          void handleDeckBranchActivate(node.orgId, node.branch.id)
                        }}
                        onKeyDown={(event) => {
                          if (isActiveBranchCard || isSwitchingContext) return
                          if (event.key !== 'Enter' && event.key !== ' ') return
                          event.preventDefault()
                          void handleDeckBranchActivate(node.orgId, node.branch.id)
                        }}
                        className={`absolute w-[186px] rounded-[22px] border text-left transition focus:outline-none focus:ring-4 focus:ring-blue-100 ${
                          isActiveBranchCard || isSwitchingContext
                            ? 'cursor-wait opacity-70'
                            : 'cursor-pointer'
                        } ${
                          isActiveBranchCard
                            ? 'border-[#003366] bg-[#003366] text-white shadow-lg shadow-[#003366]/20'
                            : isParentOrgActive
                              ? 'border-blue-200 bg-blue-50/90 text-slate-900 shadow-md shadow-blue-100/80 hover:border-blue-300 hover:bg-blue-100/80'
                              : 'border-slate-200 bg-white/96 text-slate-900 shadow-md shadow-slate-200/80 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                        style={{
                          left: `${node.x}px`,
                          top: `${node.y}px`,
                          minHeight: `${ORG_DECK_BRANCH_CARD_HEIGHT}px`,
                        }}
                      >
                        <div className="flex items-center gap-2 px-3 pt-3">
                          <div className={`flex h-9 w-9 items-center justify-center rounded-2xl border ${
                            isActiveBranchCard
                              ? 'border-white/10 bg-white/10 text-white'
                              : isParentOrgActive
                                ? 'border-blue-200 bg-white text-[#003366]'
                                : 'border-slate-200 bg-slate-50 text-slate-600'
                          }`}>
                            <MapPin size={14} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="truncate text-[11px] font-black uppercase tracking-[0.12em]">
                                  {node.branch.name}
                                </div>
                              </div>
                              <button
                                type="button"
                                onPointerDown={(event) => {
                                  event.preventDefault()
                                  event.stopPropagation()
                                  if (event.button !== 0) return
                                  handleOrgDeckBranchPointerDown(node.key, event.clientX, event.clientY)
                                }}
                                onClick={(event) => {
                                  event.preventDefault()
                                  event.stopPropagation()
                                }}
                                className={`inline-flex h-7 w-7 items-center justify-center rounded-lg border ${
                                  isActiveBranchCard
                                    ? 'border-white/10 bg-white/10 text-white'
                                    : 'border-slate-200 bg-white/80 text-slate-500 hover:text-blue-700'
                                }`}
                                aria-label="Geser kartu unit"
                              >
                                <Move size={11} />
                              </button>
                            </div>
                            <div className={`mt-1 flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.14em] ${
                              isActiveBranchCard
                                ? 'text-slate-200'
                                : 'text-slate-500'
                            }`}>
                              <span>{node.branch.code}</span>
                              {isPendingBranchTarget && <LoaderCircle size={10} className="animate-spin" />}
                              {isActiveBranchCard && <span className="rounded-full bg-white/10 px-2 py-0.5 text-white">Aktif</span>}
                              {!isActiveBranchCard && !isPendingBranchTarget && <span>Aktifkan</span>}
                            </div>
                          </div>
                        </div>
                        <div className="px-3 pb-3">
                          {renderCashMetricGrid(branchCashSummary, { active: isActiveBranchCard, compact: true })}
                        </div>
                      </div>
                    )
                  })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
