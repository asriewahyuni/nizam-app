// Upload dokumen Kojasmat — KTP, Passport, Surat Usaha, Proyeksi, dll.
import { NextRequest, NextResponse } from 'next/server'
import { uploadObjectToStorage } from '@/lib/storage/object-storage.server'

export const runtime = 'nodejs'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
const MAX_BYTES = 10 * 1024 * 1024  // 10 MB

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file')
    const orgId = String(formData.get('org_id') || '')
    const refType = String(formData.get('ref_type') || 'PENDAFTARAN')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 400 })
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Format tidak didukung. Gunakan JPG, PNG, atau PDF.' }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Ukuran file melebihi 10 MB.' }, { status: 400 })
    }

    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const key = `kojasmat/${refType.toLowerCase()}/${orgId}/${Date.now()}-${safe}`

    const buffer = Buffer.from(await file.arrayBuffer())
    await uploadObjectToStorage({ body: buffer, key, contentType: file.type })

    return NextResponse.json({ key, name: file.name, size: file.size, mime: file.type })
  } catch (err) {
    console.error('[kojasmat/upload]', err)
    return NextResponse.json({ error: 'Upload gagal. Coba lagi.' }, { status: 500 })
  }
}
