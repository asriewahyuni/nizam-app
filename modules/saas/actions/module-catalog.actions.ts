'use server'

import { queryPostgres } from '@/lib/db/postgres'
import { getInternalAuthSession } from '@/lib/auth/internal-auth.server'
import { revalidatePath } from 'next/cache'

export type SaasCustomModule = {
  id: string
  module_key: string
  name: string
  tagline: string
  description: string
  kind: 'vertical_module' | 'addon' | 'platform_core'
  required_core_family: 'lite' | 'starter' | 'full'
  default_price: number
  icon_name: string
  dependencies: string[]
  version: string
  changelog: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export async function getSaasCustomModules(): Promise<SaasCustomModule[]> {
  const { rows } = await queryPostgres(
    `SELECT * FROM public.saas_custom_modules ORDER BY kind, name`,
    []
  )
  return rows as SaasCustomModule[]
}

export async function upsertSaasCustomModule(payload: {
  id?: string
  module_key: string
  name: string
  tagline: string
  description: string
  kind: string
  required_core_family: string
  default_price: number
  icon_name: string
  dependencies: string[]
  version: string
  changelog?: string
}) {
  const session = await getInternalAuthSession()
  if (!session) return { error: 'Unauthorized' }

  const {
    id, module_key, name, tagline, description,
    kind, required_core_family, default_price,
    icon_name, dependencies, version, changelog,
  } = payload

  if (!module_key?.trim() || !name?.trim()) {
    return { error: 'Module key dan nama wajib diisi.' }
  }

  if (id) {
    await queryPostgres(
      `UPDATE public.saas_custom_modules SET
         module_key = $1, name = $2, tagline = $3, description = $4,
         kind = $5, required_core_family = $6, default_price = $7,
         icon_name = $8, dependencies = $9, version = $10, changelog = $11,
         updated_at = NOW()
       WHERE id = $12`,
      [module_key, name, tagline, description, kind, required_core_family,
       default_price, icon_name, dependencies, version, changelog ?? null, id]
    )
  } else {
    await queryPostgres(
      `INSERT INTO public.saas_custom_modules
         (module_key, name, tagline, description, kind, required_core_family,
          default_price, icon_name, dependencies, version, changelog, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (module_key) DO UPDATE SET
         name = EXCLUDED.name, tagline = EXCLUDED.tagline,
         description = EXCLUDED.description, kind = EXCLUDED.kind,
         required_core_family = EXCLUDED.required_core_family,
         default_price = EXCLUDED.default_price, icon_name = EXCLUDED.icon_name,
         dependencies = EXCLUDED.dependencies, version = EXCLUDED.version,
         changelog = EXCLUDED.changelog, updated_at = NOW()`,
      [module_key, name, tagline, description, kind, required_core_family,
       default_price, icon_name, dependencies, version, changelog ?? null,
       session.userId]
    )
  }

  revalidatePath('/saas/modul')
  return { success: true }
}

export async function toggleSaasCustomModuleStatus(id: string, isActive: boolean) {
  const session = await getInternalAuthSession()
  if (!session) return { error: 'Unauthorized' }

  await queryPostgres(
    `UPDATE public.saas_custom_modules SET is_active = $1, updated_at = NOW() WHERE id = $2`,
    [isActive, id]
  )

  revalidatePath('/saas/modul')
  return { success: true }
}

export async function deleteSaasCustomModule(id: string) {
  const session = await getInternalAuthSession()
  if (!session) return { error: 'Unauthorized' }

  await queryPostgres(
    `DELETE FROM public.saas_custom_modules WHERE id = $1`,
    [id]
  )

  revalidatePath('/saas/modul')
  return { success: true }
}
