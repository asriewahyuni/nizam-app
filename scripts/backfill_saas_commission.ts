import * as nextEnvPkg from '@next/env'
const { loadEnvConfig } = nextEnvPkg.default || nextEnvPkg
loadEnvConfig(process.cwd())

import { createAdminClient } from '../lib/supabase/server'
import { getOperatorOrgId } from '../lib/saas/operator-pricing'
import { getActiveAccountsForOrg, resolveCashSettlementAccount, createAutoPostedJournal, toEntryDate } from '../modules/accounting/actions/journal.actions'

async function ensureOperatorCommissionJournal(
  admin: any,
  actorUserId: string,
  invoice: any,
  reseller: any,
  paymentMethod: string,
  operatorOrgId: string
) {
  const totalAmount = Number(invoice.amount || 0)
  if (totalAmount <= 0) return { success: true }

  let commAmount = 0
  if (String(reseller.commission_type).toUpperCase() === 'PERCENT') {
    commAmount = (totalAmount * Number(reseller.commission_value || 0)) / 100
  } else {
    commAmount = Number(reseller.commission_value || 0)
  }

  if (commAmount <= 0) return { success: true }

  const accounts = await getActiveAccountsForOrg(admin, operatorOrgId)
  
  const expenseAccount = accounts.find((a: any) => String(a.code) === '6005')
  const settlementAccount = resolveCashSettlementAccount(accounts, paymentMethod)

  if (!expenseAccount) return { error: 'No expense account' }
  if (!settlementAccount) return { error: 'No settlement account' }

  return createAutoPostedJournal(admin, {
    orgId: operatorOrgId,
    actorUserId,
    entryDate: toEntryDate(invoice.updated_at),
    description: `Pembayaran Komisi SaaS ${invoice.invoice_number}`,
    referenceType: 'SAAS_COMMISSION',
    referenceId: invoice.id,
    notes: `Pembayaran komisi reseller otomatis untuk mitra ${reseller.name}. Invoice: ${invoice.invoice_number}`,
    lines: [
      {
        account_id: expenseAccount.id,
        debit: commAmount,
        credit: 0,
        memo: `Beban Komisi ${reseller.name}`,
      },
      {
        account_id: settlementAccount.id,
        debit: 0,
        credit: commAmount,
        memo: `Pembayaran Komisi ${reseller.name}`,
      },
    ],
  })
}

async function run() {
  const admin = await createAdminClient()
  const operatorOrgId = 'f4455b6f-c7fc-4164-9732-a906bcce5e65'
  const actorId = '00000000-0000-0000-0000-000000000000'

  const { data: invoices } = await admin.from('saas_invoices').select('*').eq('status', 'PAID').not('reseller_id', 'is', null)

  console.log(`Found ${invoices?.length || 0} PAID invoices with reseller.`)

  for (const inv of invoices || []) {
    // Check if journal already exists
    const { data: existing } = await admin.from('journal_entries').select('id').eq('reference_id', inv.id).eq('reference_type', 'SAAS_COMMISSION')
    if (existing && existing.length > 0) {
      console.log(`Invoice ${inv.invoice_number} already has SAAS_COMMISSION journal.`)
      continue
    }

    const { data: reseller } = await admin.from('sales_resellers').select('*').eq('id', inv.reseller_id).single()
    if (!reseller) continue

    const res = await ensureOperatorCommissionJournal(admin, actorId, inv, reseller, inv.payment_method || 'MANUAL_TRANSFER', operatorOrgId)
    console.log(`Invoice ${inv.invoice_number} commission journal result:`, res)
  }
}

run().catch(console.error)
