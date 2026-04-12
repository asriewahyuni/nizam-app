import 'server-only'
import { Resend } from 'resend';

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY

  if (!apiKey) {
    throw new Error('Missing RESEND_API_KEY')
  }

  return new Resend(apiKey)
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
    const resend = getResendClient()
    const data = await resend.emails.send({
      from: 'Nizam SaaS <team-noreply@nizam.xales.id>', // Pastikan domain ini verified di Resend
      to: [toEmail],
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
    });
    return { success: true, data };
  } catch (error) {
    return { error: getErrorMessage(error) };
  }
}

/**
 * Utilitas untuk mengirim Broadcast Promo ke Pengguna
 */
export async function sendPromoBroadcast(toEmail: string, promoTitle: string) {
  try {
    const resend = getResendClient()
    const data = await resend.emails.send({
      from: 'Promo Nizam <team-noreply@nizam.xales.id>',
      to: [toEmail],
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
    });
    return { success: true, data };
  } catch (error) {
    return { error: getErrorMessage(error) };
  }
}

/**
 * Utilitas untuk mengirim link reset password ke pengguna (Internal Auth)
 */
export async function sendPasswordResetEmailInternal(toEmail: string, resetLink: string) {
  try {
    const resend = getResendClient()
    const data = await resend.emails.send({
      from: 'Nizam Security <team-noreply@nizam.xales.id>',
      to: [toEmail],
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
    });
    return { success: true, data };
  } catch (error) {
    return { error: getErrorMessage(error) };
  }
}
