/**
 * Adapter Mailketing, Fonnte, Dripsender, dan SMS HTTP. Kredensial hanya dibaca
 * di server.
 */
import { sendSystemEmail } from '@/lib/email/sender'
import { queryPostgres } from '@/lib/db/postgres'
import type {
  NotificationDeliveryInput,
  NotificationProvider,
} from './notification-provider'

function requiredEnv(name: string) {
  const value = String(process.env[name] || '').trim()
  if (!value) throw new Error(`Konfigurasi ${name} belum tersedia.`)
  return value
}

async function responsePayload(response: Response): Promise<Record<string, unknown>> {
  const raw = await response.text()
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : { value: parsed as unknown }
  } catch {
    return { raw: raw.slice(0, 2_000) }
  }
}

export class MailketingNotificationProvider implements NotificationProvider {
  readonly code = 'MAILKETING'

  async send(input: NotificationDeliveryInput) {
    const result = await sendSystemEmail({
      fromName: String(process.env.MAILKETING_FROM_NAME || 'CORe Islamic Economics'),
      toEmail: input.recipient,
      subject: input.subject || 'Pemberitahuan akun',
      html: input.body,
    })
    if ('error' in result) throw new Error(result.error)
    const data = result.data && typeof result.data === 'object'
      ? result.data as Record<string, unknown>
      : { response: result.data }
    return {
      providerCode: this.code,
      providerMessageId: String(data.id || data.message_id || '') || null,
      state: 'SENT' as const,
      response: data,
    }
  }
}

export class FonnteNotificationProvider implements NotificationProvider {
  readonly code = 'FONNTE'

  async send(input: NotificationDeliveryInput) {
    const connection = await queryPostgres<{ bridge_token: string }>(
      `SELECT bridge_token
       FROM public.wacrm_connections
       WHERE org_id = $1::uuid AND status = 'connected'
       ORDER BY updated_at DESC
       LIMIT 1`,
      [input.orgId],
    )
    const token = connection.rows[0]?.bridge_token
      || String(process.env.FONNTE_API_TOKEN || '').trim()
    if (!token) throw new Error('Koneksi Fonnte organisasi belum tersedia.')
    const response = await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: {
        Authorization: token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        target: input.recipient,
        message: input.body,
        countryCode: '62',
      }),
    })
    const payload = await responsePayload(response)
    if (!response.ok || payload.status === false) {
      throw new Error(String(payload.reason || payload.message || `Fonnte HTTP ${response.status}`))
    }
    return {
      providerCode: this.code,
      providerMessageId: String(payload.id || payload.message_id || '') || null,
      state: 'SENT' as const,
      response: payload,
    }
  }
}

export class DripsenderNotificationProvider implements NotificationProvider {
  readonly code = 'DRIPSENDER'

  async send(input: NotificationDeliveryInput) {
    const endpoint = requiredEnv('DRIPSENDER_API_URL')
    const token = requiredEnv('DRIPSENDER_API_TOKEN')
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': input.idempotencyKey,
      },
      body: JSON.stringify({
        phone: input.recipient,
        message: input.body,
      }),
    })
    const payload = await responsePayload(response)
    if (!response.ok || payload.success === false) {
      throw new Error(String(payload.message || `Dripsender HTTP ${response.status}`))
    }
    return {
      providerCode: this.code,
      providerMessageId: String(payload.id || payload.message_id || '') || null,
      state: 'SENT' as const,
      response: payload,
    }
  }
}

export class SmsHttpNotificationProvider implements NotificationProvider {
  readonly code = 'SMS_HTTP'

  async send(input: NotificationDeliveryInput) {
    const endpoint = requiredEnv('COREISEC_SMS_API_URL')
    const token = requiredEnv('COREISEC_SMS_API_TOKEN')
    const sender = String(process.env.COREISEC_SMS_SENDER || 'CORE').trim()
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': input.idempotencyKey,
      },
      body: JSON.stringify({
        recipient: input.recipient,
        message: input.body,
        sender,
      }),
    })
    const payload = await responsePayload(response)
    if (!response.ok || payload.success === false) {
      throw new Error(String(payload.message || `SMS HTTP ${response.status}`))
    }
    return {
      providerCode: this.code,
      providerMessageId: String(payload.id || payload.message_id || '') || null,
      state: 'SENT' as const,
      response: payload,
    }
  }
}

export function getNotificationProvider(channel: string, providerCode?: string | null) {
  const provider = String(providerCode || '').trim().toUpperCase()
  if (channel === 'EMAIL' || provider === 'MAILKETING') {
    return new MailketingNotificationProvider()
  }
  if (provider === 'DRIPSENDER') return new DripsenderNotificationProvider()
  if (channel === 'WHATSAPP' || provider === 'FONNTE') {
    return new FonnteNotificationProvider()
  }
  if (channel === 'SMS' || provider === 'SMS_HTTP') {
    return new SmsHttpNotificationProvider()
  }
  throw new Error(`Adapter notifikasi ${provider || channel} belum tersedia.`)
}
