/**
 * Server actions admin untuk manajemen afiliasi dan pencairan dana
 * (referensi Sejoli wp-admin/admin.php?page=sejoli-affiliates).
 */
'use server'

import { revalidatePath } from 'next/cache'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import {
  approveAffiliatePayout,
  rejectAffiliatePayout,
  setAffiliateProfileStatus,
} from '@/modules/ecommerce/lib/affiliate.server'

async function requireAdminOrgId() {
  const orgData = await getActiveOrg()
  if (!orgData?.org?.id) throw new Error('Sesi tidak valid.')
  if (!['owner', 'admin', 'manager'].includes(orgData.role)) {
    throw new Error('Hanya admin yang dapat mengelola afiliasi.')
  }
  return orgData.org.id
}

export async function setAffiliateStatusAction(
  affiliateProfileId: string,
  status: 'ACTIVE' | 'SUSPENDED' | 'REJECTED',
) {
  try {
    const orgId = await requireAdminOrgId()
    await setAffiliateProfileStatus(orgId, affiliateProfileId, status)
    revalidatePath('/lms/admin/afiliasi')
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Gagal mengubah status afiliasi.',
    }
  }
}

export async function approveAffiliatePayoutAction(payoutId: string) {
  try {
    const orgId = await requireAdminOrgId()
    await approveAffiliatePayout(orgId, payoutId)
    revalidatePath('/lms/admin/afiliasi')
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Gagal menyetujui pencairan dana.',
    }
  }
}

export async function rejectAffiliatePayoutAction(payoutId: string) {
  try {
    const orgId = await requireAdminOrgId()
    await rejectAffiliatePayout(orgId, payoutId)
    revalidatePath('/lms/admin/afiliasi')
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Gagal menolak pencairan dana.',
    }
  }
}
