'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getModuleByKey } from '@/modules/marketplace/lib/module-registry'

/**
 * Dapatkan semua instance modul untuk org aktif.
 * Menggunakan queryPostgres langsung untuk bypass RLS (tabel pakai RLS berbasis auth.uid()).
 */
export async function getOrgModuleInstances(orgId: string) {
  const { queryPostgres } = await import('@/lib/db/postgres')
  const result = await queryPostgres(
    `SELECT * FROM org_module_instances WHERE org_id = $1`,
    [orgId]
  )
  return result.rows ?? []
}

/**
 * Dapatkan status satu modul spesifik.
 * Menggunakan queryPostgres langsung untuk bypass RLS (tabel pakai RLS berbasis auth.uid()).
 */
export async function getModuleInstanceStatus(orgId: string, moduleKey: string) {
  const { queryPostgres } = await import('@/lib/db/postgres')
  const result = await queryPostgres(
    `SELECT * FROM org_module_instances WHERE org_id = $1 AND module_key = $2 LIMIT 1`,
    [orgId, moduleKey]
  )
  return result.rows?.[0] ?? null
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

  // Gunakan queryPostgres langsung untuk bypass RLS (org_module_instances punya RLS berbasis auth.uid())
  const { queryPostgres } = await import('@/lib/db/postgres')

  // Upsert org_module_instances — jika sudah ada update ke PENDING, jika belum insert baru
  await queryPostgres(
    `INSERT INTO org_module_instances (org_id, module_key, status, settings)
     VALUES ($1, $2, 'PENDING', '{}'::jsonb)
     ON CONFLICT (org_id, module_key)
     DO UPDATE SET status = CASE WHEN org_module_instances.status = 'DISABLED' THEN 'PENDING' ELSE org_module_instances.status END`,
    [orgData.org.id, moduleKey]
  )

  // ── Pastikan use_custom_modules = true dan seed enabled_modules ────────────
  // getActiveOrg() hanya membaca org.enabled_modules ketika use_custom_modules = true.
  // Jika belum aktif, seed enabled_modules dengan semua modul plan saat ini terlebih dahulu
  // agar modul dari saas_packages tidak hilang saat kita beralih ke custom modules.
  const orgSettings = (orgData.org.settings && typeof orgData.org.settings === 'object')
    ? orgData.org.settings as Record<string, any>
    : {}

  if (!orgSettings.use_custom_modules) {
    const currentModules = orgData.enabledModules ?? []
    await queryPostgres(
      `UPDATE organizations
       SET enabled_modules = $1::text[],
           settings = settings || '{"use_custom_modules": true}'::jsonb
       WHERE id = $2`,
      [currentModules, orgData.org.id]
    )
  }

  // Tambahkan modul baru ke enabled_modules (idempotent, langsung via queryPostgres)
  await queryPostgres(
    `UPDATE organizations
     SET enabled_modules = array_append(COALESCE(enabled_modules, '{}'), $1::text)
     WHERE id = $2
       AND NOT ($1::text = ANY(COALESCE(enabled_modules, '{}')))`,
    [moduleKey, orgData.org.id]
  )

  // Core/pillar module langsung READY — tidak perlu onboarding manual
  if (modDef?.isCore) {
    await queryPostgres(
      `INSERT INTO org_module_instances (org_id, module_key, status, ready_at, settings)
       VALUES ($1, $2, 'READY', NOW(), '{}'::jsonb)
       ON CONFLICT (org_id, module_key)
       DO UPDATE SET status = 'READY', ready_at = NOW()`,
      [orgData.org.id, moduleKey]
    )
    revalidatePath('/marketplace')
    revalidatePath('/dashboard')
    redirect('/marketplace')
  }

  revalidatePath('/marketplace')
  revalidatePath('/dashboard')
  redirect(`/marketplace/setup/${encodeURIComponent(moduleKey)}`)
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
  const { error } = await supabase
    .from('org_module_instances')
    .update({ settings, status: 'ONBOARDING' })
    .eq('org_id', orgData.org.id)
    .eq('module_key', moduleKey)

  if (error) throw new Error(error.message)

  // Tidak perlu revalidatePath — client langsung pindah step via state lokal
  return { success: true }
}

/**
 * Tandai modul sebagai READY (onboarding selesai).
 */
export async function completeModuleOnboarding(moduleKey: string) {
  const orgData = await getActiveOrg()
  if (!orgData) throw new Error('Not authenticated')

  // Gunakan queryPostgres langsung untuk bypass RLS (org_module_instances punya RLS berbasis auth.uid())
  const { queryPostgres } = await import('@/lib/db/postgres')
  await queryPostgres(
    `INSERT INTO org_module_instances (org_id, module_key, status, ready_at, settings)
     VALUES ($1, $2, 'READY', NOW(), '{}'::jsonb)
     ON CONFLICT (org_id, module_key)
     DO UPDATE SET status = 'READY', ready_at = NOW()`,
    [orgData.org.id, moduleKey]
  )

  // Hanya invalidate marketplace agar modul tampil sebagai READY.
  revalidatePath('/marketplace')
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
  revalidatePath('/dashboard')
  redirect('/marketplace')
}

// ── Internal helpers ─────────────────────────────────────────────────────────

async function markCoaInstalled(orgId: string, moduleKey: string) {
  const supabase = await createClient()
  await supabase
    .from('org_module_instances')
    .update({ coa_installed: true })
    .eq('org_id', orgId)
    .eq('module_key', moduleKey)
}
