/**
 * Module Server Pengaturan Notifikasi Email & Provider (SMTP Custom / Mailketing API) per-Tenant.
 * Mendukung pembacaan, pengisolasian kredensial per organisasi, dan pengiriman email teruji.
 */
import 'server-only'

import { queryPostgres } from '@/lib/db/postgres'
import { sendSystemEmail } from '@/lib/email/sender'
import { decryptSecret, encryptSecret } from './secret-crypto.server'

export type TenantEmailConfig = {
  provider: 'MAILKETING' | 'SMTP'
  fromName: string
  fromEmail: string
  // Custom SMTP Settings
  smtpHost: string
  smtpPort: number
  smtpUser: string
  smtpPass: string
  smtpSecure: boolean
  // Custom Mailketing API Settings
  mailketingApiToken: string
  mailketingFromEmail: string
  // Trigger Switches
  triggers: {
    orderCreated: boolean
    orderPaid: boolean
    accountClaim: boolean
    certificateIssued: boolean
    affiliatePayout: boolean
  }
}

export const DEFAULT_TENANT_EMAIL_CONFIG: TenantEmailConfig = {
  provider: 'MAILKETING',
  fromName: 'CORe Islamic Economics',
  fromEmail: 'info@kliknizam.app',
  smtpHost: '',
  smtpPort: 587,
  smtpUser: '',
  smtpPass: '',
  smtpSecure: true,
  mailketingApiToken: '',
  mailketingFromEmail: '',
  triggers: {
    orderCreated: true,
    orderPaid: true,
    accountClaim: true,
    certificateIssued: true,
    affiliatePayout: true,
  },
}

export async function getTenantEmailSettings(
  orgId: string,
): Promise<TenantEmailConfig> {
  const { rows } = await queryPostgres<{ settings: Record<string, unknown> }>(
    `SELECT settings FROM public.organizations WHERE id = $1::uuid LIMIT 1`,
    [orgId],
  )

  const orgSettings = rows[0]?.settings || {}
  const rawConfig = (orgSettings.email_settings && typeof orgSettings.email_settings === 'object'
    ? orgSettings.email_settings
    : {}) as Record<string, unknown>

  const rawTriggers = (rawConfig.triggers && typeof rawConfig.triggers === 'object'
    ? rawConfig.triggers
    : {}) as Record<string, unknown>

  return {
    provider: rawConfig.provider === 'SMTP' ? 'SMTP' : 'MAILKETING',
    fromName: String(rawConfig.fromName || DEFAULT_TENANT_EMAIL_CONFIG.fromName),
    fromEmail: String(rawConfig.fromEmail || DEFAULT_TENANT_EMAIL_CONFIG.fromEmail),
    smtpHost: String(rawConfig.smtpHost || ''),
    smtpPort: Number(rawConfig.smtpPort || 587),
    smtpUser: String(rawConfig.smtpUser || ''),
    smtpPass: decryptSecret(String(rawConfig.smtpPass || '')),
    smtpSecure: rawConfig.smtpSecure !== false,
    mailketingApiToken: decryptSecret(String(rawConfig.mailketingApiToken || '')),
    mailketingFromEmail: String(rawConfig.mailketingFromEmail || ''),
    triggers: {
      orderCreated: rawConfig.triggers ? Boolean(rawTriggers.orderCreated) : true,
      orderPaid: rawConfig.triggers ? Boolean(rawTriggers.orderPaid) : true,
      accountClaim: rawConfig.triggers ? Boolean(rawTriggers.accountClaim) : true,
      certificateIssued: rawConfig.triggers ? Boolean(rawTriggers.certificateIssued) : true,
      affiliatePayout: rawConfig.triggers ? Boolean(rawTriggers.affiliatePayout) : true,
    },
  }
}

export async function saveTenantEmailSettings(
  orgId: string,
  input: TenantEmailConfig,
) {
  const encSmtpPass = encryptSecret(input.smtpPass)
  const encMailketingToken = encryptSecret(input.mailketingApiToken)

  const safeConfig = {
    provider: input.provider,
    fromName: input.fromName,
    fromEmail: input.fromEmail,
    smtpHost: input.smtpHost,
    smtpPort: input.smtpPort,
    smtpUser: input.smtpUser,
    smtpPass: encSmtpPass,
    smtpSecure: input.smtpSecure,
    mailketingApiToken: encMailketingToken,
    mailketingFromEmail: input.mailketingFromEmail,
    triggers: input.triggers,
    updatedAt: new Date().toISOString(),
  }

  await queryPostgres(
    `UPDATE public.organizations
     SET settings = jsonb_set(
       COALESCE(settings, '{}'::jsonb),
       '{email_settings}',
       $2::jsonb
     ),
     updated_at = NOW()
     WHERE id = $1::uuid`,
    [orgId, JSON.stringify(safeConfig)],
  )

  return getTenantEmailSettings(orgId)
}

export async function sendTenantTestEmailAction(
  orgId: string,
  targetEmail: string,
) {
  const config = await getTenantEmailSettings(orgId)
  const toEmail = String(targetEmail || '').trim()

  if (!toEmail) {
    return { error: 'Email tujuan uji coba wajib diisi.' }
  }

  const subject = `[Uji Coba SMTP/Email] Verifikasi Pengiriman ${config.fromName}`
  const html = `
    <div style="font-family: Arial, sans-serif; padding: 20px; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px;">
      <h2 style="color: #16a34a; text-align: center;">✅ Uji Coba Pengiriman Email Berhasil!</h2>
      <p>Halo Admin, ini adalah pesan uji coba dari sistem LMS <strong>${config.fromName}</strong>.</p>
      <div style="background-color: #f8fafc; padding: 16px; border-radius: 8px; margin: 20px 0; border: 1px solid #cbd5e1; font-size: 13px;">
        <p style="margin: 4px 0;"><strong>Provider Terpasang:</strong> ${config.provider}</p>
        <p style="margin: 4px 0;"><strong>Pengirim:</strong> ${config.fromName} &lt;${config.fromEmail}&gt;</p>
        <p style="margin: 4px 0;"><strong>Waktu Kirim:</strong> ${new Date().toLocaleString('id-ID')}</p>
      </div>
      <p style="font-size: 12px; color: #64748b; text-align: center;">Sistem Notifikasi LMS Nizam ERP</p>
    </div>
  `

  const result = await sendSystemEmail({
    fromName: config.fromName,
    fromEmail: config.fromEmail,
    toEmail,
    subject,
    html,
  })

  if ('error' in result) {
    return { error: `Pengiriman email uji coba gagal: ${result.error}` }
  }

  return { success: true }
}
