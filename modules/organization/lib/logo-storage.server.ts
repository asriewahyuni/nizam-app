import { createAdminClient } from '@/lib/supabase/server'

function buildLogoFilePath(orgId: string, file: File) {
  const safeOrgId = String(orgId || '').trim()
  const extFromName = file.name.includes('.')
    ? `.${file.name.split('.').pop()?.toLowerCase() || ''}`.replace(/\.+$/, '')
    : ''
  const extFromType = file.type.includes('/')
    ? `.${file.type.split('/').pop()?.toLowerCase() || ''}`.replace(/\.+$/, '')
    : ''
  const extension = extFromName || extFromType
  return `${safeOrgId}/logo-${Date.now()}${extension}`
}

export async function uploadOrganizationLogoAsset(orgId: string, file: File) {
  const supabase = await createAdminClient()
  const filePath = buildLogoFilePath(orgId, file)

  const { error: uploadError } = await supabase.storage
    .from('brand_assets')
    .upload(filePath, file, {
      upsert: true,
      contentType: file.type || undefined,
    })

  if (uploadError) {
    return { error: uploadError.message }
  }

  const { data } = supabase.storage.from('brand_assets').getPublicUrl(filePath)
  return { url: data.publicUrl }
}
