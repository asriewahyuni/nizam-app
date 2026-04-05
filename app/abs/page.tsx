import React from 'react'
import AbsClient from './AbsClient'
import { redirect } from 'next/navigation'
import { getSession } from '@/modules/auth/actions/auth.actions'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { prisma } from '@/lib/prisma'

export type VoucherStatus = {
  isValid: boolean
  isExpired: boolean
  isLimitReached: boolean
  expiresAt: string | null
  code: string
}

export default async function AbsLandingPage() {
  const session = await getSession()
  const activeOrg = await getActiveOrg()

  // 1. Jika sudah punya organisasi, langsung ke dashboard saja
  if (session && activeOrg) {
    redirect('/dashboard')
  }

  // 2. Cek Status Voucher ABS2024
  const voucher = await prisma.saas_vouchers.findFirst({
    where: {
      code: 'ABS2024',
    },
    select: {
      is_active: true,
      expires_at: true,
      uses_count: true,
      max_uses: true,
    },
  })

  const status: VoucherStatus = {
    code: 'ABS2024',
    isValid: Boolean(voucher?.is_active),
    isExpired: voucher?.expires_at ? voucher.expires_at < new Date() : true,
    isLimitReached: voucher ? Number(voucher.uses_count || 0) >= Number(voucher.max_uses || 0) : true,
    expiresAt: voucher?.expires_at ? voucher.expires_at.toISOString() : null,
  }

  return <AbsClient status={status} />
}
