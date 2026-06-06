// Buat signed URL sementara untuk melihat dokumen Kojasmat dari S3
import { NextRequest, NextResponse } from 'next/server'
import { createSignedStorageGetUrl } from '@/lib/storage/object-storage.server'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('key')
  if (!key || !key.startsWith('kojasmat/')) {
    return NextResponse.json({ error: 'Key tidak valid' }, { status: 400 })
  }
  try {
    const url = await createSignedStorageGetUrl(key, { contentDisposition: 'inline' })
    return NextResponse.json({ url })
  } catch {
    return NextResponse.json({ error: 'Tidak dapat mengakses file' }, { status: 500 })
  }
}
