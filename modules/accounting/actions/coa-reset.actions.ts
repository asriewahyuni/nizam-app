'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { resetCoA } from './coa.actions'

export async function resetCoAAction() {
  const orgData = await getActiveOrg()
  if (!orgData) return redirect('/onboarding')

  // Guard: cek permission
  const hasPermission = orgData.permissions?.includes('manage_accounting') || orgData.role === 'admin'
  if (!hasPermission) {
    return { success: false, error: 'Anda tidak memiliki izin untuk reset CoA.' }
  }

  const result = await resetCoA(orgData.org.id)
  
  if (result.success) {
    revalidatePath('/settings/accounts', 'layout')
  }

  return result
}
