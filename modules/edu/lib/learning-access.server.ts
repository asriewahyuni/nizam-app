import { getSaasAssessorContext, type SaasAssessorContext } from '@/modules/edu/lib/assessment-access.server'
import { resolveLearningRoleAccess } from '@/modules/edu/lib/learning-access'

export type LearningAccessContext = {
  canRead: boolean
  canManage: boolean
  canReviewAssessments: boolean
  source: 'internal' | 'saas' | 'internal+saas' | null
  saasAssessor: SaasAssessorContext
}

/**
 * Menyatukan akses learning internal tenant dengan akses assessor SaaS.
 * Dengan ini modul kompetensi ERP bisa dikelola per entitas tanpa
 * memutus panel review yang sebelumnya dipakai tim SaaS.
 */
export async function getLearningAccessContext(input: {
  userRole?: string | null
  permissions?: string[] | null
  email?: string | null
}) {
  const roleAccess = resolveLearningRoleAccess(input.userRole, input.permissions)
  const saasAssessor = await getSaasAssessorContext({ email: input.email })
  const canReviewAssessments = roleAccess.canManage || saasAssessor.hasAccess

  let source: LearningAccessContext['source'] = null
  if (roleAccess.canManage && saasAssessor.hasAccess) {
    source = 'internal+saas'
  } else if (roleAccess.canManage) {
    source = 'internal'
  } else if (saasAssessor.hasAccess) {
    source = 'saas'
  }

  return {
    canRead: roleAccess.canRead,
    canManage: roleAccess.canManage,
    canReviewAssessments,
    source,
    saasAssessor,
  } satisfies LearningAccessContext
}
