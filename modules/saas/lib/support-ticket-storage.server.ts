import { sanitizeUploadSegment, uploadPublicFile } from '@/lib/storage/public-upload'

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

export async function uploadSupportTicketScreenshot(userId: string, orgId: string, file: File): Promise<{ url?: string; error?: string }> {
  if (file.size <= 0) {
    return { error: 'File screenshot kosong.' }
  }

  if (file.size > MAX_SCREENSHOT_SIZE_BYTES) {
    return { error: 'Ukuran screenshot maksimal 5MB.' }
  }

  if (file.type && !ALLOWED_SCREENSHOT_TYPES.has(file.type)) {
    return { error: 'Format screenshot tidak didukung. Gunakan JPG, PNG, WEBP, GIF, atau HEIC.' }
  }

  try {
    return await uploadPublicFile({
      folder: `receipts/${sanitizeUploadSegment(userId) || 'user'}/support-tickets/${sanitizeUploadSegment(orgId) || 'org'}`,
      file,
      fileName: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    })
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Gagal mengunggah screenshot.' }
  }
}
