'use server'

import { revalidatePath } from 'next/cache'
import { getInternalAuthSession } from '@/lib/auth/internal-auth.server'
import { getPortalTenant } from '@/modules/member/lib/portal.server'
import {
  activateAffiliateProfile,
  requestAffiliatePayout,
} from '@/modules/ecommerce/lib/affiliate.server'

export async function activateMemberAffiliateAction(orgSlug: string) {
  const session = await getInternalAuthSession()
  if (!session?.user) {
    return { error: 'Anda harus login terlebih dahulu.' }
  }

  const tenant = await getPortalTenant(orgSlug)
  if (!tenant) {
    return { error: 'Tenant portal tidak ditemukan.' }
  }

  try {
    const profile = await activateAffiliateProfile(tenant.id, session.user.id)
    revalidatePath(`/member/${orgSlug}/afiliasi`)
    revalidatePath('/affiliate')
    return { success: true, referralCode: profile.referralCode }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Gagal mengaktifkan akun afiliasi.',
    }
  }
}

export async function requestMemberPayoutAction(
  orgSlug: string,
  amount: number,
  bankName: string,
  accountNumber: string,
  accountName: string,
) {
  const session = await getInternalAuthSession()
  if (!session?.user) {
    return { error: 'Anda harus login terlebih dahulu.' }
  }

  const tenant = await getPortalTenant(orgSlug)
  if (!tenant) {
    return { error: 'Tenant portal tidak ditemukan.' }
  }

  if (!bankName || !accountNumber || !accountName) {
    return { error: 'Informasi rekening bank wajib diisi lengkap.' }
  }

  try {
    const result = await requestAffiliatePayout({
      orgId: tenant.id,
      userId: session.user.id,
      amount,
      bankInfo: { bankName, accountNumber, accountName },
    })
    revalidatePath(`/member/${orgSlug}/afiliasi`)
    revalidatePath('/affiliate')
    return { success: true, payoutNumber: result.payoutNumber }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Gagal memproses pengajuan pencairan.',
    }
  }
}
