import { getAdminImpersonationState } from '@/modules/auth/actions/auth.actions'
import { hasSaasAssessorAccess } from '@/modules/saas/lib/assessor-access.server'

type AssessorActorInput = {
  email?: string | null
  impersonationEmail?: string | null
}

export type SaasAssessorContext = {
  hasAccess: boolean
  email: string | null
  source: 'direct' | 'impersonation' | null
}

export async function getSaasAssessorContext(input: AssessorActorInput): Promise<SaasAssessorContext> {
  const directEmail = String(input.email || '').trim()
  if (await hasSaasAssessorAccess(directEmail)) {
    return {
      hasAccess: true,
      email: directEmail,
      source: 'direct',
    }
  }

  const fallbackImpersonation = input.impersonationEmail === undefined
    ? await getAdminImpersonationState()
    : null
  const impersonationEmail = String(input.impersonationEmail ?? fallbackImpersonation?.email ?? '').trim()
  if (await hasSaasAssessorAccess(impersonationEmail)) {
    return {
      hasAccess: true,
      email: impersonationEmail,
      source: 'impersonation',
    }
  }

  return {
    hasAccess: false,
    email: null,
    source: null,
  }
}
