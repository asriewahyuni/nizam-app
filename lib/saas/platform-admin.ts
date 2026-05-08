export const PLATFORM_ADMIN_EMAILS = [
  'bob@executive.id',
]

const SAAS_MEMBER_EMAIL_DOMAINS = [
  'executive.id',
  'nizam.id',
]

export function isPlatformAdminEmail(email?: string | null) {
  if (!email) return false

  const normalized = email.toLowerCase().trim()
  return PLATFORM_ADMIN_EMAILS.includes(normalized)
}

export function isSaasMemberEmail(email?: string | null) {
  if (!email) return false

  const normalized = email.toLowerCase().trim()
  return (
    isPlatformAdminEmail(normalized) ||
    SAAS_MEMBER_EMAIL_DOMAINS.some((domain) => normalized.endsWith(`@${domain}`))
  )
}

export function isSaasAssessorEmail(email?: string | null) {
  return isPlatformAdminEmail(email)
}
