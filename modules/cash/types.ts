import type { Account, CashFlowCategory } from '@/types/database.types'

// Shared cash module view-model types used by actions and dashboard pages.
export type CashAccountOption = Pick<Account, 'id' | 'code' | 'name' | 'type' | 'cash_flow_category'>

export type CashBankAccount = {
  id: string
  org_id: string
  branch_id: string | null
  account_id: string
  bank_name: string
  account_number: string | null
  account: CashAccountOption
  balances?: { balance: number }
  org_name?: string | null
  branch_name?: string | null
}

export type PlacementAccountOption = Pick<CashAccountOption, 'id' | 'code' | 'name'>

export type TransferCategoryOption = {
  id: string
  code: string
  name: string
  type: string
  cash_flow_category?: CashFlowCategory | null
}

export type ChildOrgSummary = {
  id: string
  name: string
}

export type CashViewMode = 'parent' | 'holding'

export type RecentTransactionOption = {
  id: string
  org_id: string
  branch_id: string | null
  bank_account_id: string
  transaction_date: string
  created_at?: string | null
  updated_at?: string | null
  reference_number?: string | null
  journal_entry_id?: string | null
  description: string
  amount: number
  type: string
  status: string
  bank_account: { bank_name?: string | null; account_number?: string | null } | null
  category: { name?: string | null; code?: string | null } | null
  org_name?: string | null
  branch_name?: string | null
}
