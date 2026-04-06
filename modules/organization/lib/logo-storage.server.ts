import { sanitizeUploadSegment, uploadPublicFile } from '@/lib/storage/public-upload'

export async function uploadOrganizationLogoAsset(orgId: string, file: File): Promise<{ url?: string; error?: string }> {
  try {
    return await uploadPublicFile({
      folder: `brand_assets/${sanitizeUploadSegment(orgId) || 'org'}`,
      file,
      fileName: `logo-${Date.now()}`,
    })
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Gagal mengunggah logo.' }
  }
}
