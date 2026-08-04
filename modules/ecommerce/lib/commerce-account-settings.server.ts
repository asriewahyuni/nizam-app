/**
 * Pengaturan pemetaan akun COA per Cabang untuk modul Commerce/LMS.
 * Dibaca oleh finalizePaidCommerceOrder saat menandai order lunas (manual
 * maupun via gateway) untuk menentukan akun kas/bank, pendapatan, pajak,
 * diskon, biaya gateway, dan komisi afiliasi yang dipakai di jurnal.
 */
import 'server-only'

import { queryPostgres } from '@/lib/db/postgres'

export type CommerceBranchAccountSettings = {
  branchId: string
  bankAccountId: string | null
  cashAccountId: string | null
  revenueAccountId: string | null
  taxPayableAccountId: string | null
  discountAccountId: string | null
  gatewayFeeAccountId: string | null
  affiliateCommissionExpenseAccountId: string | null
  affiliateCommissionPayableAccountId: string | null
  refundAccountId: string | null
}

export type CommerceAccountSettingsBranch = {
  id: string
  name: string
  code: string
  isComplete: boolean
  settings: CommerceBranchAccountSettings
}

export type CommerceAccountOption = {
  id: string
  code: string
  name: string
  type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE'
}

export type CommerceBankAccountOption = {
  id: string
  branchId: string
  label: string
  accountId: string | null
}

export type CommerceAccountSettingsData = {
  branches: CommerceAccountSettingsBranch[]
  accounts: CommerceAccountOption[]
  bankAccounts: CommerceBankAccountOption[]
}

function emptySettings(branchId: string): CommerceBranchAccountSettings {
  return {
    branchId,
    bankAccountId: null,
    cashAccountId: null,
    revenueAccountId: null,
    taxPayableAccountId: null,
    discountAccountId: null,
    gatewayFeeAccountId: null,
    affiliateCommissionExpenseAccountId: null,
    affiliateCommissionPayableAccountId: null,
    refundAccountId: null,
  }
}

export async function getCommerceAccountSettingsData(orgId: string): Promise<CommerceAccountSettingsData> {
  const [branchRows, settingRows, accountRows, bankAccountRows] = await Promise.all([
    queryPostgres<{ id: string; name: string; code: string }>(
      `SELECT id::text, name, code FROM public.branches
       WHERE org_id = $1::uuid AND is_active = TRUE ORDER BY name ASC`,
      [orgId],
    ),
    queryPostgres<{
      branch_id: string
      bank_account_id: string | null
      cash_account_id: string | null
      revenue_account_id: string | null
      tax_payable_account_id: string | null
      discount_account_id: string | null
      gateway_fee_account_id: string | null
      affiliate_commission_expense_account_id: string | null
      affiliate_commission_payable_account_id: string | null
      refund_account_id: string | null
    }>(
      `SELECT
         branch_id::text,
         bank_account_id::text, cash_account_id::text, revenue_account_id::text,
         tax_payable_account_id::text, discount_account_id::text, gateway_fee_account_id::text,
         affiliate_commission_expense_account_id::text, affiliate_commission_payable_account_id::text,
         refund_account_id::text
       FROM public.commerce_branch_account_settings
       WHERE org_id = $1::uuid`,
      [orgId],
    ),
    queryPostgres<{ id: string; code: string; name: string; type: CommerceAccountOption['type'] }>(
      `SELECT id::text, code, name, type FROM public.accounts
       WHERE org_id = $1::uuid AND is_active = TRUE ORDER BY code ASC`,
      [orgId],
    ),
    queryPostgres<{ id: string; branch_id: string; bank_name: string; account_number: string | null; account_holder: string | null; account_id: string | null }>(
      `SELECT id::text, branch_id::text, bank_name, account_number, account_holder, account_id::text
       FROM public.bank_accounts
       WHERE org_id = $1::uuid AND is_active = TRUE ORDER BY bank_name ASC`,
      [orgId],
    ),
  ])

  const settingsByBranch = new Map(
    settingRows.rows.map((row) => [row.branch_id, {
      branchId: row.branch_id,
      bankAccountId: row.bank_account_id,
      cashAccountId: row.cash_account_id,
      revenueAccountId: row.revenue_account_id,
      taxPayableAccountId: row.tax_payable_account_id,
      discountAccountId: row.discount_account_id,
      gatewayFeeAccountId: row.gateway_fee_account_id,
      affiliateCommissionExpenseAccountId: row.affiliate_commission_expense_account_id,
      affiliateCommissionPayableAccountId: row.affiliate_commission_payable_account_id,
      refundAccountId: row.refund_account_id,
    } satisfies CommerceBranchAccountSettings]),
  )

  const branches: CommerceAccountSettingsBranch[] = branchRows.rows.map((branch) => {
    const settings = settingsByBranch.get(branch.id) || emptySettings(branch.id)
    const isComplete = Boolean(
      settings.bankAccountId
      && (settings.cashAccountId || settings.bankAccountId)
      && settings.revenueAccountId,
    )
    return { id: branch.id, name: branch.name, code: branch.code, isComplete, settings }
  })

  return {
    branches,
    accounts: accountRows.rows,
    bankAccounts: bankAccountRows.rows.map((row) => ({
      id: row.id,
      branchId: row.branch_id,
      accountId: row.account_id,
      label: [row.bank_name, row.account_number, row.account_holder].filter(Boolean).join(' • '),
    })),
  }
}

export type SaveCommerceBranchAccountSettingsInput = {
  branchId: string
  bankAccountId: string
  revenueAccountId: string
  cashAccountId?: string | null
  taxPayableAccountId?: string | null
  discountAccountId?: string | null
  gatewayFeeAccountId?: string | null
  affiliateCommissionExpenseAccountId?: string | null
  affiliateCommissionPayableAccountId?: string | null
  refundAccountId?: string | null
}

export async function saveCommerceBranchAccountSettings(
  orgId: string,
  input: SaveCommerceBranchAccountSettingsInput,
): Promise<void> {
  if (!input.branchId) throw new Error('Cabang wajib dipilih.')
  if (!input.bankAccountId) throw new Error('Rekening penerimaan wajib dipilih.')
  if (!input.revenueAccountId) throw new Error('Akun pendapatan wajib dipilih.')

  const branchCheck = await queryPostgres<{ id: string }>(
    `SELECT id::text FROM public.branches WHERE id = $1::uuid AND org_id = $2::uuid LIMIT 1`,
    [input.branchId, orgId],
  )
  if (!branchCheck.rows[0]) throw new Error('Cabang tidak ditemukan.')

  const bankCheck = await queryPostgres<{ id: string }>(
    `SELECT id::text FROM public.bank_accounts
     WHERE id = $1::uuid AND org_id = $2::uuid AND branch_id = $3::uuid LIMIT 1`,
    [input.bankAccountId, orgId, input.branchId],
  )
  if (!bankCheck.rows[0]) throw new Error('Rekening penerimaan tidak valid untuk Cabang ini.')

  const optionalAccountIds = [
    input.cashAccountId,
    input.revenueAccountId,
    input.taxPayableAccountId,
    input.discountAccountId,
    input.gatewayFeeAccountId,
    input.affiliateCommissionExpenseAccountId,
    input.affiliateCommissionPayableAccountId,
    input.refundAccountId,
  ].filter((value): value is string => Boolean(value))

  if (optionalAccountIds.length > 0) {
    const accountCheck = await queryPostgres<{ id: string }>(
      `SELECT id::text FROM public.accounts WHERE org_id = $1::uuid AND id = ANY($2::uuid[])`,
      [orgId, optionalAccountIds],
    )
    const validIds = new Set(accountCheck.rows.map((row) => row.id))
    const invalid = optionalAccountIds.find((id) => !validIds.has(id))
    if (invalid) throw new Error('Salah satu akun COA yang dipilih tidak valid untuk organisasi ini.')
  }

  await queryPostgres(
    `INSERT INTO public.commerce_branch_account_settings (
       org_id, branch_id, bank_account_id, cash_account_id, revenue_account_id,
       tax_payable_account_id, discount_account_id, gateway_fee_account_id,
       affiliate_commission_expense_account_id, affiliate_commission_payable_account_id,
       refund_account_id
     )
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6::uuid, $7::uuid, $8::uuid, $9::uuid, $10::uuid, $11::uuid)
     ON CONFLICT (org_id, branch_id) DO UPDATE SET
       bank_account_id = EXCLUDED.bank_account_id,
       cash_account_id = EXCLUDED.cash_account_id,
       revenue_account_id = EXCLUDED.revenue_account_id,
       tax_payable_account_id = EXCLUDED.tax_payable_account_id,
       discount_account_id = EXCLUDED.discount_account_id,
       gateway_fee_account_id = EXCLUDED.gateway_fee_account_id,
       affiliate_commission_expense_account_id = EXCLUDED.affiliate_commission_expense_account_id,
       affiliate_commission_payable_account_id = EXCLUDED.affiliate_commission_payable_account_id,
       refund_account_id = EXCLUDED.refund_account_id,
       updated_at = NOW()`,
    [
      orgId,
      input.branchId,
      input.bankAccountId,
      input.cashAccountId || null,
      input.revenueAccountId,
      input.taxPayableAccountId || null,
      input.discountAccountId || null,
      input.gatewayFeeAccountId || null,
      input.affiliateCommissionExpenseAccountId || null,
      input.affiliateCommissionPayableAccountId || null,
      input.refundAccountId || null,
    ],
  )
}
