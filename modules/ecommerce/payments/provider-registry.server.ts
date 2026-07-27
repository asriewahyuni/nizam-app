/**
 * Registri provider pembayaran. Kredensial dibaca dari environment server dan
 * tidak pernah dikirim ke browser atau disimpan sebagai teks biasa.
 */
import 'server-only'

import { queryPostgres } from '@/lib/db/postgres'
import type { PaymentProvider } from './payment-provider'
import { ManualPaymentProvider } from './manual.provider'
import { MootaPaymentProvider } from './moota.provider'
import { DuitkuPaymentProvider } from './duitku.provider'

function requiredEnv(name: string) {
  const value = String(process.env[name] || '').trim()
  if (!value) throw new Error(`Konfigurasi ${name} belum tersedia.`)
  return value
}

export type ManualProviderContext = {
  orgId: string
  storeId?: string | null
}

async function resolveManualTransferAccount(context?: ManualProviderContext) {
  if (!context?.orgId || !context?.storeId) {
    return { bankName: '', accountNumber: '', accountHolder: '' }
  }
  const result = await queryPostgres<{
    bank_name: string
    account_number: string
    account_holder: string | null
  }>(
    `SELECT bank.bank_name, bank.account_number, bank.account_holder
     FROM public.stores store
     JOIN public.bank_accounts bank
       ON bank.id = store.bank_account_id AND bank.org_id = store.org_id
     WHERE store.id = $1::uuid AND store.org_id = $2::uuid
     LIMIT 1`,
    [context.storeId, context.orgId],
  )
  const row = result.rows[0]
  if (!row) return { bankName: '', accountNumber: '', accountHolder: '' }
  return {
    bankName: row.bank_name,
    accountNumber: row.account_number,
    accountHolder: row.account_holder || '',
  }
}

export async function getPaymentProvider(
  providerCode: string,
  context?: ManualProviderContext,
): Promise<PaymentProvider> {
  const normalized = providerCode.trim().toUpperCase()

  if (normalized === 'MANUAL') {
    const account = await resolveManualTransferAccount(context)
    return new ManualPaymentProvider({
      bankName: account.bankName,
      accountNumber: account.accountNumber,
      accountHolder: account.accountHolder,
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
