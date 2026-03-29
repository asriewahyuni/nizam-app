import React from 'react'
import { createClient } from '@/lib/supabase/server'
import AbsClient from './AbsClient'
import { redirect } from 'next/navigation'
import { getSession } from '@/modules/auth/actions/auth.actions'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'

export type VoucherStatus = {
  isValid: boolean
  isExpired: boolean
  isLimitReached: boolean
  expiresAt: string | null
  code: string
}

export default async function AbsLandingPage() {
  const supabase = await createClient()
  const session = await getSession()
  const activeOrg = await getActiveOrg()

  // 1. Jika sudah punya organisasi, langsung ke dashboard saja
  if (session && activeOrg) {
    redirect('/dashboard')
  }

  // 2. Cek Status Voucher ABS2024
  const { data: voucher } = await (supabase as any)
    .from('saas_vouchers')
    .select('*')
    .eq('code', 'ABS2024')
    .maybeSingle()

  const status: VoucherStatus = {
    code: 'ABS2024',
    isValid: !!voucher && (voucher as any).is_active,
    isExpired: voucher ? new Date((voucher as any).expires_at) < new Date() : true,
    isLimitReached: voucher ? (voucher as any).uses_count >= (voucher as any).max_uses : true,
    expiresAt: voucher ? (voucher as any).expires_at : null
  }

  return <AbsClient status={status} />
}
