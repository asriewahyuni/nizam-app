import { createAdminClient } from '@/lib/supabase/server'
import { TRAINING_ASSESSMENTS } from '@/modules/edu/lib/training-assessment-mvp'
import { getTrainingCourseBySlug } from '@/modules/edu/lib/training-center-mvp'
import { getBranches, getChildOrgs } from '@/modules/organization/actions/org.actions'
import { getCurrentAccessibleBranch } from '@/modules/organization/lib/branch-access.server'
import type { BranchSummary } from '@/modules/organization/lib/org-context'

type OrganizationInput = {
  id: string
  name: string
  parent_org_id?: string | null
}

type EmployeeScopeRow = {
  org_id?: string | null
  branch_id?: string | null
  user_id?: string | null
}

type SubmissionScopeRow = {
  org_id?: string | null
  course_slug?: string | null
  participant_user_id?: string | null
  status?: string | null
}

type AssessmentScopeRow = {
  org_id?: string | null
  course_slug?: string | null
  decision?: string | null
}

type ChildOrgRow = {
  id?: string | null
  name?: string | null
  parent_org_id?: string | null
}

type OrgCounter = {
  employeeCount: number
  pendingAnswerCount: number
  reviewedAnswerCount: number
  finalAssessmentCount: number
  competentCount: number
  notYetCompetentCount: number
}

type BranchCounter = {
  employeeCount: number
  pendingAnswerCount: number
  reviewedAnswerCount: number
}

function normalizeText(value: unknown) {
  return String(value || '').trim()
}

function branchMetricKey(orgId: string, branchId: string) {
  return `${orgId}::${branchId}`
}

function createEmptyOrgCounter(): OrgCounter {
  return {
    employeeCount: 0,
    pendingAnswerCount: 0,
    reviewedAnswerCount: 0,
    finalAssessmentCount: 0,
    competentCount: 0,
    notYetCompetentCount: 0,
  }
}

function createEmptyBranchCounter(): BranchCounter {
  return {
    employeeCount: 0,
    pendingAnswerCount: 0,
    reviewedAnswerCount: 0,
  }
}

function ensureOrgCounter(counters: Map<string, OrgCounter>, orgId: string) {
  const existing = counters.get(orgId)
  if (existing) return existing
  const created = createEmptyOrgCounter()
  counters.set(orgId, created)
  return created
}

function ensureBranchCounter(counters: Map<string, BranchCounter>, key: string) {
  const existing = counters.get(key)
  if (existing) return existing
  const created = createEmptyBranchCounter()
  counters.set(key, created)
  return created
}

function normalizeOrganizationKind(org: OrganizationInput, childCount: number) {
  if (normalizeText(org.parent_org_id)) return 'CHILD' as const
  if (childCount > 0) return 'PARENT' as const
  return 'STANDALONE' as const
}

function buildOrgCard(input: {
  orgId: string
  orgName: string
  kind: 'PARENT' | 'CHILD' | 'STANDALONE'
  branchCount: number
  counters: OrgCounter
  isCurrent: boolean
}) {
  return {
    orgId: input.orgId,
    orgName: input.orgName,
    kind: input.kind,
    branchCount: input.branchCount,
    employeeCount: input.counters.employeeCount,
    pendingAnswerCount: input.counters.pendingAnswerCount,
    reviewedAnswerCount: input.counters.reviewedAnswerCount,
    finalAssessmentCount: input.counters.finalAssessmentCount,
    competentCount: input.counters.competentCount,
    notYetCompetentCount: input.counters.notYetCompetentCount,
    isCurrent: input.isCurrent,
  }
}

function buildUnitCard(input: {
  orgId: string
  branch: BranchSummary
  counters: BranchCounter
  isActive: boolean
}) {
  return {
    orgId: input.orgId,
    branchId: input.branch.id,
    branchName: input.branch.name,
    branchCode: input.branch.code,
    employeeCount: input.counters.employeeCount,
    pendingAnswerCount: input.counters.pendingAnswerCount,
    reviewedAnswerCount: input.counters.reviewedAnswerCount,
    isActive: input.isActive,
  }
}

/**
 * Menyusun dashboard manajemen kompetensi per parent, child, dan unit aktif.
 * Fokus utamanya adalah memberi ringkasan internal tenant ERP tanpa
 * mencampurkan konteks workspace SaaS assessor lama.
 */
export async function getCompetencyManagementDashboard(org: OrganizationInput) {
  const admin = await createAdminClient()
  const currentOrgId = normalizeText(org.id)
  const currentOrgName = normalizeText(org.name) || 'Organisasi Aktif'
  const currentBranches = await getBranches(currentOrgId)
  const activeBranch = await getCurrentAccessibleBranch(currentOrgId)
  const childOrgs = normalizeText(org.parent_org_id)
    ? []
    : ((await getChildOrgs(currentOrgId)) as ChildOrgRow[])
        .filter((child) => normalizeText(child?.id))

  const childOrgIds = childOrgs.map((child) => normalizeText(child.id)).filter(Boolean)
  const scopeOrgIds = [currentOrgId, ...childOrgIds]
  const childBranchMap = new Map<string, BranchSummary[]>()
  const orgCounters = new Map<string, OrgCounter>()
  const branchCounters = new Map<string, BranchCounter>()
  const employeeByUserId = new Map<string, { orgId: string; branchId: string | null }>()
  const currentOrgCourseCounters = new Map<string, OrgCounter>()

  let parentOrgName: string | null = null
  if (normalizeText(org.parent_org_id)) {
    const { data: parentOrgRow } = await admin
      .from('organizations')
      .select('name')
      .eq('id', normalizeText(org.parent_org_id))
      .maybeSingle()

    parentOrgName = parentOrgRow?.name ? String(parentOrgRow.name) : null
  }

  if (childOrgIds.length > 0) {
    const { data: childBranchRows } = await admin
      .from('branches')
      .select('id, org_id, name, code, address, is_active')
      .in('org_id', childOrgIds)
      .eq('is_active', true)
      .order('name', { ascending: true })

    ;((Array.isArray(childBranchRows) ? childBranchRows : []) as BranchSummary[]).forEach((branch) => {
      const orgId = normalizeText(branch.org_id)
      const bucket = childBranchMap.get(orgId) || []
      bucket.push({
        id: normalizeText(branch.id),
        org_id: orgId,
        name: normalizeText(branch.name),
        code: normalizeText(branch.code),
        address: branch.address ? String(branch.address) : null,
        is_active: Boolean(branch.is_active),
      })
      childBranchMap.set(orgId, bucket)
    })
  }

  const [employeeResponse, submissionResponse, assessmentResponse] = await Promise.all([
    admin
      .from('employees')
      .select('org_id, branch_id, user_id')
      .in('org_id', scopeOrgIds),
    admin
      .from('training_course_answer_submissions')
      .select('org_id, course_slug, participant_user_id, status')
      .in('org_id', scopeOrgIds),
    admin
      .from('training_course_assessments')
      .select('org_id, course_slug, decision')
      .in('org_id', scopeOrgIds),
  ])

  const employeeRows = (Array.isArray(employeeResponse.data) ? employeeResponse.data : []) as EmployeeScopeRow[]
  employeeRows.forEach((row) => {
    const orgId = normalizeText(row.org_id)
    if (!orgId) return

    const orgCounter = ensureOrgCounter(orgCounters, orgId)
    orgCounter.employeeCount += 1

    const branchId = normalizeText(row.branch_id)
    if (branchId) {
      const counter = ensureBranchCounter(branchCounters, branchMetricKey(orgId, branchId))
      counter.employeeCount += 1
    }

    const userId = normalizeText(row.user_id)
    if (userId) {
      employeeByUserId.set(userId, {
        orgId,
        branchId: branchId || null,
      })
    }
  })

  const submissionRows = (Array.isArray(submissionResponse.data) ? submissionResponse.data : []) as SubmissionScopeRow[]
  submissionRows.forEach((row) => {
    const orgId = normalizeText(row.org_id)
    const courseSlug = normalizeText(row.course_slug)
    if (!orgId) return

    const orgCounter = ensureOrgCounter(orgCounters, orgId)
    const courseCounter = ensureOrgCounter(currentOrgCourseCounters, courseSlug || '__unknown__')
    const isReviewed = normalizeText(row.status).toUpperCase() === 'REVIEWED'

    if (isReviewed) {
      orgCounter.reviewedAnswerCount += 1
    } else {
      orgCounter.pendingAnswerCount += 1
    }

    if (orgId === currentOrgId && courseSlug) {
      if (isReviewed) {
        courseCounter.reviewedAnswerCount += 1
      } else {
        courseCounter.pendingAnswerCount += 1
      }
    }

    const participantUserId = normalizeText(row.participant_user_id)
    const employee = participantUserId ? employeeByUserId.get(participantUserId) : null
    if (!employee || employee.orgId !== currentOrgId || !employee.branchId) return

    const branchCounter = ensureBranchCounter(
      branchCounters,
      branchMetricKey(currentOrgId, employee.branchId),
    )
    if (isReviewed) {
      branchCounter.reviewedAnswerCount += 1
    } else {
      branchCounter.pendingAnswerCount += 1
    }
  })

  const assessmentRows = (Array.isArray(assessmentResponse.data) ? assessmentResponse.data : []) as AssessmentScopeRow[]
  assessmentRows.forEach((row) => {
    const orgId = normalizeText(row.org_id)
    const courseSlug = normalizeText(row.course_slug)
    if (!orgId) return

    const orgCounter = ensureOrgCounter(orgCounters, orgId)
    orgCounter.finalAssessmentCount += 1

    const isCompetent = normalizeText(row.decision).toUpperCase() === 'COMPETENT'
    if (isCompetent) {
      orgCounter.competentCount += 1
    } else {
      orgCounter.notYetCompetentCount += 1
    }

    if (orgId === currentOrgId && courseSlug) {
      const courseCounter = ensureOrgCounter(currentOrgCourseCounters, courseSlug)
      courseCounter.finalAssessmentCount += 1
      if (isCompetent) {
        courseCounter.competentCount += 1
      } else {
        courseCounter.notYetCompetentCount += 1
      }
    }
  })

  const organizationKind = normalizeOrganizationKind(org, childOrgIds.length)
  const currentOrgCard = buildOrgCard({
    orgId: currentOrgId,
    orgName: currentOrgName,
    kind: organizationKind,
    branchCount: currentBranches.length,
    counters: ensureOrgCounter(orgCounters, currentOrgId),
    isCurrent: true,
  })

  const childOrganizationCards = childOrgs.map((child) => {
    const orgId = normalizeText(child.id)
    return buildOrgCard({
      orgId,
      orgName: normalizeText(child.name) || 'Anak Perusahaan',
      kind: 'CHILD',
      branchCount: (childBranchMap.get(orgId) || []).length,
      counters: ensureOrgCounter(orgCounters, orgId),
      isCurrent: false,
    })
  })

  const unitCards = currentBranches.map((branch) =>
    buildUnitCard({
      orgId: currentOrgId,
      branch,
      counters: ensureBranchCounter(branchCounters, branchMetricKey(currentOrgId, branch.id)),
      isActive: activeBranch?.id === branch.id,
    }),
  )

  const courseSummaries = TRAINING_ASSESSMENTS.map((assessment) => {
    const course = getTrainingCourseBySlug(assessment.courseSlug)
    const courseCounter = ensureOrgCounter(currentOrgCourseCounters, assessment.courseSlug)
    return {
      courseSlug: assessment.courseSlug,
      title: course?.title || assessment.documentTitle,
      levelCode: course?.levelCode || 'LEVEL',
      audience: course?.audience || 'Internal tenant',
      status: course?.status || 'LIVE',
      participantHref: `/learning/course/${assessment.courseSlug}/assessment/participant`,
      reviewerHref: `/learning/course/${assessment.courseSlug}/assessment`,
      syllabusHref: `/learning/course/${assessment.courseSlug}`,
      pendingAnswerCount: courseCounter.pendingAnswerCount,
      reviewedAnswerCount: courseCounter.reviewedAnswerCount,
      finalAssessmentCount: courseCounter.finalAssessmentCount,
      competentCount: courseCounter.competentCount,
      notYetCompetentCount: courseCounter.notYetCompetentCount,
    }
  })

  return {
    organizationKind,
    parentOrgName,
    currentOrg: currentOrgCard,
    childOrganizations: childOrganizationCards,
    activeUnit: activeBranch
      ? {
          id: activeBranch.id,
          name: activeBranch.name,
          code: activeBranch.code,
        }
      : null,
    unitCards,
    courseSummaries,
  }
}
