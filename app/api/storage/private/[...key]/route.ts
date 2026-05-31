import { NextRequest, NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'
import {
  createSignedStorageGetUrl,
  decodeStorageKeySegments,
  isObjectStorageConfigured,
  isPrivateExportStorageKey,
} from '@/lib/storage/object-storage.server'
import {
  getPrivateEcommerceProofOrgId,
  isPrivateEcommercePaymentProofStorageKey,
} from '@/modules/ecommerce/lib/ecommerce.server'

export const runtime = 'nodejs'

/**
 * Route private untuk file export agar hanya member organisasi yang bisa mengunduh.
 */
export async function GET(_request: NextRequest, context: {
  try { params: Promise<{ key?: string[] }> }) {
  if (!isObjectStorageConfigured()) {
    return NextResponse.json({ error: 'Bucket Railway belum dikonfigurasi.' }, { status: 404 })
  }

  const { key: keySegments } = await context.params
  const key = decodeStorageKeySegments(keySegments)

  if (!key || (!isPrivateExportStorageKey(key) && !isPrivateEcommercePaymentProofStorageKey(key))) {
    return NextResponse.json({ error: 'File tidak ditemukan.' }, { status: 404 })
  }

  const orgId = isPrivateEcommercePaymentProofStorageKey(key)
    ? getPrivateEcommerceProofOrgId(key)
    : extractOrgIdFromStorageKey(key)
  if (!orgId) {
    return NextResponse.json({ error: 'File tidak valid.' }, { status: 400 })
  }

  const supabase = await createClient()
  const db = supabase
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: member } = await db
    .from('org_members')
    .select('org_id')
    .eq('org_id', orgId)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!member) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const signedUrl = await createSignedStorageGetUrl(key, {
    expiresInSeconds: 60 * 10,
  })

  return NextResponse.redirect(signedUrl, {
    status: 307,
    headers: {
      'Cache-Control': 'private, no-store',
    },
  })
}

function extractOrgIdFromStorageKey(key: string): string | null {
  const parts = key.split('/').filter(Boolean)
  return parts.length >= 2 ? parts[1] : null
  } catch (err) {
    console.warn("[storage/private] Error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
