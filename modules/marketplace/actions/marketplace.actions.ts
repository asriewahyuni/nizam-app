'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getModuleByKey } from '@/modules/marketplace/lib/module-registry'

/**
 * Dapatkan semua instance modul untuk org aktif.
 */
export async function getOrgModuleInstances(orgId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('org_module_instances')
    .select('*')
    .eq('org_id', orgId)

  if (error) return []
  return data
}

/**
 * Dapatkan status satu modul spesifik.
 */
export async function getModuleInstanceStatus(orgId: string, moduleKey: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('org_module_instances')
    .select('*')
    .eq('org_id', orgId)
    .eq('module_key', moduleKey)
    .single()

  return data ?? null
}

/**
 * Dapatkan harga modul operasional dari saas_packages.
 * Return: Record<moduleKey, price> atau {} jika belum diset.
 * Diambil dari paket yang paling lengkap (untuk referensi harga listing).
 */
export async function getOperationalModulePricing(): Promise<Record<string, number>> {
  const supabase = await createClient()
  // Ambil paket dengan operational_prices terlengkap (non-empty)
  const { data } = await supabase
    .from('saas_packages')
    .select('operational_prices')
    .not('operational_prices', 'eq', '{}')
    .order('price', { ascending: false })
    .limit(1)
    .single()

  return (data?.operational_prices as Record<string, number>) ?? {}
}

/**
 * Aktifkan sebuah modul untuk org.
 * - Business type → swap dengan business type existing (hanya 1 aktif)
 * - Add-on → multi-aktif, tidak kena swap
 * - Pillar/core → selalu aktif (tidak perlu aktivasi manual)
 * - Tambahkan ke enabled_modules
 */
export async function activateModule(moduleKey: string) {
  const orgData = await getActiveOrg()
  if (!orgData) throw new Error('Not authenticated')

  const supabase = await createClient()

  // Cek requirements
  const modDef = getModuleByKey(moduleKey)
  if (modDef?.requires && modDef.requires.length > 0) {
    const enabledModules = orgData.enabledModules ?? []
    const unmet = modDef.requires.filter(req => !enabledModules.some(m => m.toLowerCase().replace(/\s+/g, '') === req.toLowerCase().replace(/\s+/g, '')))
    if (unmet.length > 0) {
      throw new Error(`Syarat belum terpenuhi: Modul ${unmet.join(', ')} harus diaktifkan terlebih dahulu.`)
    }
  }

  // ── SWAP LOGIC: Hanya business_type yang di-swap ──
  // Add-on (isAddon) bisa multi-aktif, tidak kena swap.
  // Pillar/core modules juga bebas multi-aktif.
  if (modDef && modDef.category === 'business_type') {
    // Cari business type lain yang sedang aktif (PENDING, ONBOARDING, atau READY)
    const { data: allInstances } = await supabase
      .from('org_module_instances')
      .select('id, module_key')
      .eq('org_id', orgData.org.id)
      .in('status', ['PENDING', 'ONBOARDING', 'READY'])

    if (allInstances && allInstances.length > 0) {
      for (const instance of allInstances) {
        if (instance.module_key === moduleKey) continue
        const otherModDef = getModuleByKey(instance.module_key)
        if (otherModDef && otherModDef.category === 'business_type') {
          // Swap out: deactivate business type yang lama
          await supabase
            .from('org_module_instances')
            .update({ status: 'DISABLED' })
            .eq('id', instance.id)

          await supabase.rpc('remove_enabled_module', {
            p_org_id: orgData.org.id,
            p_module_key: instance.module_key,
          })
        }
      }
    }
  }

  // Cek apakah sebelumnya DISABLED
  const { data: existing } = await supabase
    .from('org_module_instances')
    .select('id, status')
    .eq('org_id', orgData.org.id)
    .eq('module_key', moduleKey)
    .single()

  if (existing) {
    // Re-aktifkan: kembali ke PENDING
    await supabase
      .from('org_module_instances')
      .update({ status: 'PENDING' })
      .eq('id', existing.id)
  } else {
    // Insert baru
    const { error } = await supabase
      .from('org_module_instances')
      .insert({ org_id: orgData.org.id, module_key: moduleKey, status: 'PENDING' })
    if (error) throw new Error(error.message)
  }

  // Tambahkan ke enabled_modules (idempotent via RPC)
  await supabase.rpc('append_enabled_module', {
    p_org_id: orgData.org.id,
    p_module_key: moduleKey,
  })

  // ── Ensure use_custom_modules = true ─────────────────────────────────────
  // Operational modules are stored in org.enabled_modules array.
  // use_custom_modules must be true for getActiveOrg() to read enabled_modules
  // instead of relying only on saas_packages plan modules.
  // This applies to both main and child orgs.
  if (!orgData.org.settings?.use_custom_modules) {
    const currentSettings = (orgData.org.settings && typeof orgData.org.settings === 'object')
      ? orgData.org.settings
      : {}
    await supabase
      .from('organizations')
      .update({ settings: { ...currentSettings, use_custom_modules: true } })
      .eq('id', orgData.org.id)
  }

  revalidatePath('/marketplace')

  return { success: true, redirectUrl: `/marketplace/setup/${encodeURIComponent(moduleKey)}` }
}


/**
 * Install CoA untuk sebuah modul dengan memanggil SQL injection function.
 */
export async function installModuleCoa(moduleKey: string) {
  const orgData = await getActiveOrg()
  if (!orgData) throw new Error('Not authenticated')

  const moduleDef = getModuleByKey(moduleKey)
  if (!moduleDef?.coaInjectionFn) {
    await markCoaInstalled(orgData.org.id, moduleKey)
    return { success: true, skipped: true }
  }

  const supabase = await createClient()

  // Gunakan queryPostgres langsung untuk menghindari masalah resolusi tipe argumen named parameters di PostgreSQL
  try {
    const { queryPostgres } = await import('@/lib/db/postgres')
    await queryPostgres(`SELECT public."${moduleDef.coaInjectionFn}"($1::uuid)`, [orgData.org.id])
  } catch (err: any) {
    throw new Error(err.message || 'Gagal menginstal Chart of Accounts untuk modul ini')
  }

  await markCoaInstalled(orgData.org.id, moduleKey)
  revalidatePath('/lms/onboarding')
  return { success: true }
}

/**
 * Update settings awal modul.
 */
export async function saveModuleSettings(moduleKey: string, settings: Record<string, any>) {
  const orgData = await getActiveOrg()
  if (!orgData) throw new Error('Not authenticated')

  const supabase = await createClient()

  // Pastikan row instance ada — jika modul diaktifkan via plan tanpa activateModule()
  // update akan silent no-op (0 rows) tanpa ini
  const { data: existing } = await supabase
    .from('org_module_instances')
    .select('id')
    .eq('org_id', orgData.org.id)
    .eq('module_key', moduleKey)
    .maybeSingle()

  if (!existing) {
    await supabase
      .from('org_module_instances')
      .insert({ org_id: orgData.org.id, module_key: moduleKey, status: 'PENDING' })
    await supabase.rpc('append_enabled_module', {
      p_org_id: orgData.org.id,
      p_module_key: moduleKey,
    })
  }

  const { error } = await supabase
    .from('org_module_instances')
    .update({ settings: JSON.stringify(settings), status: 'ONBOARDING' })
    .eq('org_id', orgData.org.id)
    .eq('module_key', moduleKey)

  if (error) throw new Error(error.message)

  revalidatePath('/lms/onboarding')
  return { success: true }
}

/**
 * Tandai modul sebagai READY (onboarding selesai).
 */
export async function completeModuleOnboarding(moduleKey: string) {
  const orgData = await getActiveOrg()
  if (!orgData) throw new Error('Not authenticated')

  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('org_module_instances')
    .select('id')
    .eq('org_id', orgData.org.id)
    .eq('module_key', moduleKey)
    .maybeSingle()

  if (!existing) {
    await supabase
      .from('org_module_instances')
      .insert({ org_id: orgData.org.id, module_key: moduleKey, status: 'PENDING' })
    await supabase.rpc('append_enabled_module', {
      p_org_id: orgData.org.id,
      p_module_key: moduleKey,
    })
  }

  const { error } = await supabase
    .from('org_module_instances')
    .update({
      status: 'READY',
      ready_at: new Date().toISOString(),
    })
    .eq('org_id', orgData.org.id)
    .eq('module_key', moduleKey)

  if (error) throw new Error(error.message)

  revalidatePath('/marketplace')
  revalidatePath('/lms/onboarding')
  revalidatePath('/', 'layout')
  return { success: true }
}

/**
 * Nonaktifkan sebuah modul operasional.
 * - Status → DISABLED
 * - Hapus dari enabled_modules (tidak tampil di sidebar)
 * Data tidak dihapus — dapat diaktifkan kembali.
 */
export async function deactivateModule(moduleKey: string) {
  const orgData = await getActiveOrg()
  if (!orgData) throw new Error('Not authenticated')

  const supabase = await createClient()

  // 1. Update status ke DISABLED
  const { error } = await supabase
    .from('org_module_instances')
    .update({ status: 'DISABLED' })
    .eq('org_id', orgData.org.id)
    .eq('module_key', moduleKey)

  if (error) throw new Error(error.message)

  // 2. Hapus dari enabled_modules via RPC
  await supabase.rpc('remove_enabled_module', {
    p_org_id: orgData.org.id,
    p_module_key: moduleKey,
  })

  revalidatePath('/marketplace')

  return { success: true, redirectUrl: '/marketplace' }
}

// ── Internal helpers ─────────────────────────────────────────────────────────

async function markCoaInstalled(orgId: string, moduleKey: string) {
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('org_module_instances')
    .select('id')
    .eq('org_id', orgId)
    .eq('module_key', moduleKey)
    .maybeSingle()

  if (!existing) {
    await supabase
      .from('org_module_instances')
      .insert({ org_id: orgId, module_key: moduleKey, status: 'PENDING' })
  }

  await supabase
    .from('org_module_instances')
    .update({ coa_installed: true })
    .eq('org_id', orgId)
    .eq('module_key', moduleKey)
}
