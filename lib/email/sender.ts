import 'server-only'
const MAILKETING_API_URL = 'https://api.mailketing.co.id/api/v1/send'

type MailketingPayload = Record<string, unknown> | string

type MailketingSendInput = {
  fromName: string
  fromEmail?: string
  toEmail: string
  subject: string
  html: string
  attachments?: string[]
}

/**
 * Ambil konfigurasi Mailketing dari environment agar token tidak ditanam di kode.
 */
function getMailketingConfig() {
  const apiToken = String(process.env.MAILKETING_API_TOKEN || '').trim()
  const defaultFromEmail = String(process.env.MAILKETING_FROM_EMAIL || '').trim()

  if (!apiToken) {
    throw new Error('Missing MAILKETING_API_TOKEN')
  }

  if (!defaultFromEmail) {
    throw new Error('Missing MAILKETING_FROM_EMAIL')
  }

  return { apiToken, defaultFromEmail }
}

function parseMailketingPayload(rawPayload: string): MailketingPayload {
  const trimmedPayload = rawPayload.trim()
  if (!trimmedPayload) return ''

  try {
    return JSON.parse(trimmedPayload) as Record<string, unknown>
  } catch {
    return trimmedPayload
  }
}

function isMailketingFailure(payload: MailketingPayload) {
  if (!payload || typeof payload === 'string') return false

  const status = payload.status
  if (typeof status === 'boolean') return !status
  if (typeof status === 'string') {
    const normalizedStatus = status.trim().toLowerCase()
    if (['error', 'failed', 'false', '0'].includes(normalizedStatus)) return true
    if (['success', 'ok', 'true', '1', 'sent'].includes(normalizedStatus)) return false
  }

  const success = payload.success
  if (typeof success === 'boolean') return !success

  return false
}

function getMailketingErrorMessage(payload: MailketingPayload, fallbackStatus?: number) {
  if (typeof payload === 'string') {
    const message = payload.trim()
    if (message) return message
  }

  if (payload && typeof payload === 'object') {
    const directMessage = payload.message
    if (typeof directMessage === 'string' && directMessage.trim()) return directMessage.trim()

    const errorMessage = payload.error
    if (typeof errorMessage === 'string' && errorMessage.trim()) return errorMessage.trim()

    const responseMessage = payload.response
    if (typeof responseMessage === 'string' && responseMessage.trim()) return responseMessage.trim()
  }

  if (fallbackStatus) {
    return `Mailketing request failed with status ${fallbackStatus}`
  }

  return 'Unknown email delivery error'
}

/**
 * Helper umum untuk kirim email lewat API Mailketing.
 */
async function sendMailketingEmail(input: MailketingSendInput) {
  const { apiToken, defaultFromEmail } = getMailketingConfig()
  const toEmail = String(input.toEmail || '').trim()

  if (!toEmail) {
    throw new Error('Email penerima wajib diisi')
  }

  const params = new URLSearchParams({
    from_name: String(input.fromName || '').trim(),
    from_email: String(input.fromEmail || defaultFromEmail).trim(),
    recipient: toEmail,
    subject: String(input.subject || '').trim(),
    content: input.html,
    api_token: apiToken,
  })

  for (const [index, attachment] of (input.attachments || []).entries()) {
    const normalizedAttachment = String(attachment || '').trim()
    if (!normalizedAttachment) continue
    if (index >= 3) break
    params.set(`attach${index + 1}`, normalizedAttachment)
  }

  const response = await fetch(MAILKETING_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  })

  const rawPayload = await response.text()
  const payload = parseMailketingPayload(rawPayload)

  if (!response.ok || isMailketingFailure(payload)) {
    throw new Error(getMailketingErrorMessage(payload, response.status))
  }

  return payload
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  return 'Unknown email delivery error'
}

/**
 * Utilitas untuk mengirim Invoice / Tagihan ke email pelanggan
 */
export async function sendInvoiceEmail(toEmail: string, invoiceNumber: string, amount: number) {
  try {
    const data = await sendMailketingEmail({
      fromName: 'Nizam SaaS',
      toEmail,
      subject: `[Tagihan Baru] Invoice ${invoiceNumber} dari NIZAM`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #004AB8;">Halo! Anda memiliki rincian tagihan baru.</h2>
          <p>Terima kasih telah menggunakan NIZAM ERP Solution. Berikut adalah rincian tagihan Anda:</p>
          <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Nomor Invoice:</strong> ${invoiceNumber}</p>
            <p><strong>Total Tagihan:</strong> Rp ${amount.toLocaleString('id-ID')}</p>
          </div>
          <p>Silakan kunjungi dashboard Billing Anda untuk melakukan pembayaran.</p>
          <br/>
          <p>Salam hangat,<br/><strong>Tim Operasional NIZAM</strong></p>
        </div>
      `,
    })

    return { success: true, data }
  } catch (error) {
    return { error: getErrorMessage(error) }
  }
}

/**
 * Utilitas untuk mengirim Broadcast Promo ke Pengguna
 */
export async function sendPromoBroadcast(toEmail: string, promoTitle: string) {
  try {
    const data = await sendMailketingEmail({
      fromName: 'Promo Nizam',
      toEmail,
      subject: `🔥 Penawaran Spesial: ${promoTitle}!`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; text-align: center;">
          <h1 style="color: #E67E22;">${promoTitle}</h1>
          <p>Jangan lewatkan penawaran eksklusif bulan ini untuk pelanggan NIZAM ERP.</p>
          <a href="https://nizam.app/login" style="display: inline-block; padding: 12px 24px; background-color: #004AB8; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 20px;">
            Klaim Sekarang
          </a>
        </div>
      `,
    })

    return { success: true, data }
  } catch (error) {
    return { error: getErrorMessage(error) }
  }
}

/**
 * Utilitas untuk mengirim link reset password ke pengguna (Internal Auth)
 */
export async function sendPasswordResetEmailInternal(toEmail: string, resetLink: string) {
  try {
    const data = await sendMailketingEmail({
      fromName: 'Nizam Security',
      toEmail,
      subject: `[NIZAM] Permintaan Reset Password`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px;">
          <h2 style="color: #0F172A; text-align: center;">Reset Password Anda</h2>
          <p style="text-align: center; color: #475569;">Kami menerima permintaan untuk melakukan reset password pada akun Anda di ekosistem <strong>NIZAM</strong>.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" style="display: inline-block; padding: 14px 28px; background-color: #2563EB; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
              Ubah Password Sekarang
            </a>
          </div>
          <p style="font-size: 14px; color: #64748B;">Jika tombol di atas tidak berfungsi, *copy-paste* link berikut ke browser Anda:</p>
          <p style="font-size: 12px; color: #3B82F6; word-break: break-all;">${resetLink}</p>
          <hr style="border: 0; height: 1px; background: #E2E8F0; margin: 20px 0;" />
          <p style="font-size: 12px; color: #94A3B8; text-align: center;">Jika Anda tidak merasa meminta reset password ini, abaikan saja email ini. Link ini akan kadaluarsa dalam 1 jam.</p>
        </div>
      `,
    })

    return { success: true, data }
  } catch (error) {
    return { error: getErrorMessage(error) }
  }
}
