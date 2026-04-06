import { sanitizeUploadSegment, uploadPublicFile } from '@/lib/storage/public-upload'

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

export async function uploadReimbursementReceipt(userId: string, file: File): Promise<{ url?: string; error?: string }> {
  if (file.size <= 0) {
    return { error: 'File tidak valid.' }
  }

  if (file.size > MAX_RECEIPT_SIZE_BYTES) {
    return { error: 'Ukuran file maksimal 5MB.' }
  }

  if (file.type && !ALLOWED_RECEIPT_TYPES.has(file.type)) {
    return { error: 'Format file harus JPG, PNG, WEBP, GIF, atau PDF.' }
  }

  try {
    return await uploadPublicFile({
      folder: `receipts/${sanitizeUploadSegment(userId) || 'user'}/reimbursements`,
      file,
      fileName: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    })
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Gagal mengunggah bukti reimbursement.' }
  }
}
