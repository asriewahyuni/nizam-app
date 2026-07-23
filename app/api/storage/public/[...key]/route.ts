import { NextRequest, NextResponse } from 'next/server'

import {
  createSignedStorageGetUrl,
  decodeStorageKeySegments,
  isObjectStorageConfigured,
  isPublicAvatarStorageKey,
  isPublicLogoStorageKey,
  isPublicReceiptStorageKey,
  isPublicLmsMediaStorageKey,
} from '@/lib/storage/object-storage.server'
import { isPublicThemeAssetStorageKey } from '@/modules/ecommerce/lib/ecommerce.server'

export const runtime = 'nodejs'

/**
 * Route publik untuk logo yang disimpan private di bucket Railway.
 * Browser diarahkan ke signed URL agar file tetap diambil langsung dari bucket.
 */
export async function GET(_request: NextRequest, context: { params: Promise<{ key?: string[] }> }) {
  try {
  if (!isObjectStorageConfigured()) {
    return NextResponse.json({ error: 'Bucket Railway belum dikonfigurasi.' }, { status: 404 })
  }

  const { key: keySegments } = await context.params
  const key = decodeStorageKeySegments(keySegments)

  // Tautan LMS lama dialihkan ke route yang memeriksa akses, bukan ke bucket.
  if (key && isPublicLmsMediaStorageKey(key)) {
    const safePath = key
      .split('/')
      .filter(Boolean)
      .map((segment) => encodeURIComponent(segment))
      .join('/')
    return NextResponse.redirect(new URL(`/api/storage/lms/${safePath}`, _request.url), 307)
  }

  if (!key || (
    !isPublicLogoStorageKey(key) &&
    !isPublicThemeAssetStorageKey(key) &&
    !isPublicReceiptStorageKey(key) &&
    !isPublicAvatarStorageKey(key)
  )) {
    return NextResponse.json({ error: 'File tidak ditemukan.' }, { status: 404 })
  }

  const signedUrl = await createSignedStorageGetUrl(key, {
    expiresInSeconds: 60 * 60,
  })

  return NextResponse.redirect(signedUrl, {
    status: 307,
    headers: {
      'Cache-Control': 'public, max-age=300, s-maxage=300',
    },
  })
  } catch (err) {
    console.warn("[storage/public] Error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
