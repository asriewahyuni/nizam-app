import { createAdminClient } from '@/lib/supabase/server'

const MAX_SCREENSHOT_SIZE_BYTES = 5 * 1024 * 1024
const ALLOWED_SCREENSHOT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
])

function sanitizeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
}

function buildScreenshotPath(userId: string, orgId: string, file: File) {
  const safeUserId = sanitizeSegment(String(userId || '').trim()) || 'user'
  const safeOrgId = sanitizeSegment(String(orgId || '').trim()) || 'org'
  const extFromName = file.name.includes('.')
    ? `.${file.name.split('.').pop()?.toLowerCase() || ''}`.replace(/\.+$/, '')
    : ''
  const extFromType = file.type.includes('/')
    ? `.${file.type.split('/').pop()?.toLowerCase() || ''}`.replace(/\.+$/, '')
    : ''
  const extension = extFromName || extFromType || '.bin'

  return `${safeUserId}/support-tickets/${safeOrgId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}${extension}`
}

export async function uploadSupportTicketScreenshot(userId: string, orgId: string, file: File) {
  if (file.size <= 0) {
    return { error: 'File screenshot kosong.' }
  }

  if (file.size > MAX_SCREENSHOT_SIZE_BYTES) {
    return { error: 'Ukuran screenshot maksimal 5MB.' }
  }

  if (file.type && !ALLOWED_SCREENSHOT_TYPES.has(file.type)) {
    return { error: 'Format screenshot tidak didukung. Gunakan JPG, PNG, WEBP, GIF, atau HEIC.' }
  }

  const supabase = await createAdminClient()
  const filePath = buildScreenshotPath(userId, orgId, file)

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
