/**
 * Module Server Pengaturan Notifikasi WhatsApp (Dripsender) per-Tenant.
 * API key disimpan terenkripsi per organisasi di organizations.settings,
 * bukan environment variable global — tiap org bisa punya akun Dripsender sendiri.
 */
import 'server-only'

import { queryPostgres } from '@/lib/db/postgres'
import { decryptSecret, encryptSecret } from './secret-crypto.server'

export type TenantWhatsappConfig = {
  provider: 'DRIPSENDER'
  dripsenderApiKey: string
  enabled: boolean
}

export const DEFAULT_TENANT_WHATSAPP_CONFIG: TenantWhatsappConfig = {
  provider: 'DRIPSENDER',
  dripsenderApiKey: '',
  enabled: false,
}

export async function getTenantWhatsappSettings(
  orgId: string,
): Promise<TenantWhatsappConfig> {
  const { rows } = await queryPostgres<{ settings: Record<string, unknown> }>(
    `SELECT settings FROM public.organizations WHERE id = $1::uuid LIMIT 1`,
    [orgId],
  )

  const orgSettings = rows[0]?.settings || {}
  const rawConfig = (orgSettings.whatsapp_settings && typeof orgSettings.whatsapp_settings === 'object'
    ? orgSettings.whatsapp_settings
    : {}) as Record<string, unknown>

  return {
    provider: 'DRIPSENDER',
    dripsenderApiKey: decryptSecret(String(rawConfig.dripsenderApiKey || '')),
    enabled: Boolean(rawConfig.enabled),
  }
}

export async function saveTenantWhatsappSettings(
  orgId: string,
  input: TenantWhatsappConfig,
) {
  const safeConfig = {
    provider: input.provider,
    dripsenderApiKey: encryptSecret(input.dripsenderApiKey),
    enabled: input.enabled,
    updatedAt: new Date().toISOString(),
  }

  await queryPostgres(
    `UPDATE public.organizations
     SET settings = jsonb_set(
       COALESCE(settings, '{}'::jsonb),
       '{whatsapp_settings}',
       $2::jsonb
     ),
     updated_at = NOW()
     WHERE id = $1::uuid`,
    [orgId, JSON.stringify(safeConfig)],
  )

  return getTenantWhatsappSettings(orgId)
}

export async function sendTenantTestWhatsappAction(
  orgId: string,
  targetPhone: string,
) {
  const config = await getTenantWhatsappSettings(orgId)
  const phone = String(targetPhone || '').trim()

  if (!phone) {
    return { error: 'Nomor WhatsApp tujuan uji coba wajib diisi.' }
  }
  if (!config.dripsenderApiKey) {
    return { error: 'API key Dripsender belum diisi.' }
  }

  try {
    const cleanPhone = phone.replace(/\D/g, '')
    const normalizedPhone = cleanPhone.startsWith('08')
      ? '62' + cleanPhone.slice(1)
      : cleanPhone

    const response = await fetch('https://api.dripsender.id/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: config.dripsenderApiKey,
        phone: normalizedPhone,
        text: 'Uji coba notifikasi WhatsApp dari Nizam LMS. Jika Anda menerima pesan ini, integrasi Dripsender sudah aktif dan benar.',
      }),
    })
    const payload = await response.json().catch(() => ({} as Record<string, unknown>))
    if (!response.ok || payload?.success === false || payload?.status === false) {
      return { error: String(payload?.message || `Dripsender HTTP ${response.status}`) }
    }
    return { success: true }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Gagal mengirim pesan uji coba.' }
  }
}
