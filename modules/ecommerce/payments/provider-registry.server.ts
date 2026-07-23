/**
 * Registri provider pembayaran. Kredensial dibaca dari environment server dan
 * tidak pernah dikirim ke browser atau disimpan sebagai teks biasa.
 */
import 'server-only'

import type { PaymentProvider } from './payment-provider'
import { ManualPaymentProvider } from './manual.provider'
import { MootaPaymentProvider } from './moota.provider'
import { DuitkuPaymentProvider } from './duitku.provider'

function requiredEnv(name: string) {
  const value = String(process.env[name] || '').trim()
  if (!value) throw new Error(`Konfigurasi ${name} belum tersedia.`)
  return value
}

export function getPaymentProvider(providerCode: string): PaymentProvider {
  const normalized = providerCode.trim().toUpperCase()

  if (normalized === 'MANUAL') {
    return new ManualPaymentProvider({
      bankName: requiredEnv('COREISEC_MANUAL_BANK_NAME'),
      accountNumber: requiredEnv('COREISEC_MANUAL_BANK_ACCOUNT_NUMBER'),
      accountHolder: requiredEnv('COREISEC_MANUAL_BANK_ACCOUNT_HOLDER'),
      instructions: process.env.COREISEC_MANUAL_PAYMENT_INSTRUCTIONS,
    })
  }

  if (normalized === 'MOOTA') {
    return new MootaPaymentProvider({
      bankName: requiredEnv('COREISEC_MOOTA_BANK_NAME'),
      accountNumber: requiredEnv('COREISEC_MOOTA_BANK_ACCOUNT_NUMBER'),
      accountHolder: requiredEnv('COREISEC_MOOTA_BANK_ACCOUNT_HOLDER'),
      webhookSecret: requiredEnv('COREISEC_MOOTA_WEBHOOK_SECRET'),
    })
  }

  if (normalized === 'DUITKU') {
    return new DuitkuPaymentProvider({
      merchantCode: requiredEnv('DUITKU_MERCHANT_CODE'),
      apiKey: requiredEnv('DUITKU_API_KEY'),
      sandbox: String(process.env.DUITKU_SANDBOX || 'true').toLowerCase() !== 'false',
    })
  }

  throw new Error(`Provider pembayaran ${providerCode} tidak didukung.`)
}
