import { sanitizeUploadSegment, uploadPublicFile } from '@/lib/storage/public-upload'

const MAX_PROOF_SIZE_BYTES = 5 * 1024 * 1024
const ALLOWED_PROOF_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
])

function sanitizeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
}

export async function uploadBillingProofAsset(orgId: string, invoiceNumber: string, file: File): Promise<{ url?: string; error?: string }> {
  if (file.size <= 0) {
    return { error: 'File bukti transfer kosong.' }
  }

  if (file.size > MAX_PROOF_SIZE_BYTES) {
    return { error: 'Ukuran file maksimal 5MB.' }
  }

  if (file.type && !ALLOWED_PROOF_TYPES.has(file.type)) {
    return { error: 'Format file harus JPG, PNG, WEBP, atau PDF.' }
  }

  try {
    return await uploadPublicFile({
      folder: `billing-proofs/${sanitizeUploadSegment(orgId) || 'org'}`,
      file,
      fileName: `${sanitizeSegment(invoiceNumber) || 'invoice'}-${Date.now()}`,
    })
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Gagal mengunggah bukti transfer.' }
  }
}
