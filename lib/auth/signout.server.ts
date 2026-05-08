import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { INTERNAL_AUTH_SESSION_COOKIE } from '@/lib/auth/internal-auth.shared'
import { createClient } from '@/lib/supabase/server'
import { ACTIVE_BRANCH_COOKIE, ACTIVE_ORG_COOKIE } from '@/modules/organization/lib/org-context'

const ADMIN_IMPERSONATION_COOKIE = 'nizam_admin_impersonation'
const DEMO_ORG_COOKIE = 'nizam_demo_org_id'

export const SIGNOUT_REDIRECT_URL = 'https://kliknizam.app'

/**
 * Best-effort signout for internal auth mode.
 * We still clear every local cookie even if session revocation fails so the
 * browser cannot keep navigating with stale auth state.
 */
export async function signOutServerSession() {
  const cookieStore = await cookies()

  try {
    const supabase = await createClient()
    await supabase.auth.signOut()
  } catch (error) {
    console.error('signOutServerSession: failed to revoke server session', error)
  }

  cookieStore.delete(INTERNAL_AUTH_SESSION_COOKIE)
  cookieStore.delete(DEMO_ORG_COOKIE)
  cookieStore.delete(ACTIVE_ORG_COOKIE)
  cookieStore.delete(ACTIVE_BRANCH_COOKIE)
  cookieStore.delete(ADMIN_IMPERSONATION_COOKIE)

  revalidatePath('/', 'layout')
}
