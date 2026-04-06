import { createAdminClient } from '@/lib/supabase/server'

const MAX_RECEIPT_SIZE_BYTES = 5 * 1024 * 1024
const ALLOWED_RECEIPT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
])

function sanitizeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
}

function buildReceiptPath(userId: string, file: File) {
  const safeUserId = sanitizeSegment(String(userId || '').trim()) || 'user'
  const extFromName = file.name.includes('.')
    ? `.${file.name.split('.').pop()?.toLowerCase() || ''}`.replace(/\.+$/, '')
    : ''
  const extFromType = file.type.includes('/')
    ? `.${file.type.split('/').pop()?.toLowerCase() || ''}`.replace(/\.+$/, '')
    : ''
  const extension = extFromName || extFromType || '.bin'

  return `${safeUserId}/reimbursements/${Date.now()}-${Math.random().toString(36).slice(2, 8)}${extension}`
}

export async function uploadReimbursementReceipt(userId: string, file: File) {
  if (file.size <= 0) {
    return { error: 'File tidak valid.' }
  }

  if (file.size > MAX_RECEIPT_SIZE_BYTES) {
    return { error: 'Ukuran file maksimal 5MB.' }
  }

  if (file.type && !ALLOWED_RECEIPT_TYPES.has(file.type)) {
    return { error: 'Format file harus JPG, PNG, WEBP, GIF, atau PDF.' }
  }

  const supabase = await createAdminClient()
  const filePath = buildReceiptPath(userId, file)

  const { error: uploadError } = await supabase.storage
    .from('receipts')
    .upload(filePath, file, {
      upsert: false,
      contentType: file.type || undefined,
    })

  if (uploadError) {
    return { error: uploadError.message }
  }

  const { data } = supabase.storage.from('receipts').getPublicUrl(filePath)
  return { url: data.publicUrl }
}
