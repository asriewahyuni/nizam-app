'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { resetCoA } from './coa.actions'

export async function resetCoAAction() {
  const orgData = await getActiveOrg()
  if (!orgData) return redirect('/onboarding')

  // Guard: cek permission
  const role = String(orgData.role || '').toLowerCase()
  const hasPermission = role === 'owner' || role === 'admin' || orgData.permissions?.includes('manage_accounting')
  if (!hasPermission) {
    return { success: false, error: 'Hanya owner atau admin yang dapat mereset CoA.' }
  }

  const result = await resetCoA(orgData.org.id)
  
  if (result.success) {
    revalidatePath('/settings/accounts', 'layout')
  }

  return result
}
