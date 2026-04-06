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

export async function sendPasswordResetLinkEmail(toEmail: string, resetUrl: string) {
  try {
    const resend = getResendClient()
    const data = await resend.emails.send({
      from: 'Nizam SaaS <team-noreply@nizam.xales.id>',
      to: [toEmail],
      subject: 'Reset Password NIZAM',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #004AB8;">Reset password akun Anda</h2>
          <p>Kami menerima permintaan untuk mengganti password akun NIZAM Anda.</p>
          <p>Klik tombol di bawah ini untuk membuat password baru:</p>
          <p style="margin: 24px 0;">
            <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #004AB8; color: #fff; text-decoration: none; border-radius: 8px; font-weight: bold;">Buat Password Baru</a>
          </p>
          <p>Jika Anda tidak meminta reset password, abaikan email ini.</p>
        </div>
      `,
    })
    return { success: true, data }
  } catch (error) {
    return { error: getErrorMessage(error) }
  }
}
