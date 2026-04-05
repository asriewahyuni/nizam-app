import { createAdminClient } from '@/lib/supabase/server'

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

function buildProofFilePath(orgId: string, invoiceNumber: string, file: File) {
  const safeOrgId = sanitizeSegment(String(orgId || '').trim()) || 'org'
  const safeInvoiceNumber = sanitizeSegment(String(invoiceNumber || '').trim()) || 'invoice'
  const extFromName = file.name.includes('.')
    ? `.${file.name.split('.').pop()?.toLowerCase() || ''}`.replace(/\.+$/, '')
    : ''
  const extFromType = file.type.includes('/')
    ? `.${file.type.split('/').pop()?.toLowerCase() || ''}`.replace(/\.+$/, '')
    : ''
  const extension = extFromName || extFromType || '.bin'

  return `${safeOrgId}/${safeInvoiceNumber}-${Date.now()}${extension}`
}

export async function uploadBillingProofAsset(orgId: string, invoiceNumber: string, file: File) {
  if (file.size <= 0) {
    return { error: 'File bukti transfer kosong.' }
  }

  if (file.size > MAX_PROOF_SIZE_BYTES) {
    return { error: 'Ukuran file maksimal 5MB.' }
  }

  if (file.type && !ALLOWED_PROOF_TYPES.has(file.type)) {
    return { error: 'Format file harus JPG, PNG, WEBP, atau PDF.' }
  }

  const supabase = await createAdminClient()
  const filePath = buildProofFilePath(orgId, invoiceNumber, file)

  const { error: uploadError } = await supabase.storage
    .from('billing-proofs')
    .upload(filePath, file, {
      upsert: true,
      contentType: file.type || undefined,
    })

  if (uploadError) {
    return { error: uploadError.message }
  }

  const { data } = supabase.storage.from('billing-proofs').getPublicUrl(filePath)
  return { url: data.publicUrl }
}
