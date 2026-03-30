export const PLATFORM_ADMIN_EMAILS = [
  'bob@executive.id',
]

export function isPlatformAdminEmail(email?: string | null) {
  if (!email) return false

  const normalized = email.toLowerCase().trim()
  return PLATFORM_ADMIN_EMAILS.includes(normalized)
}
