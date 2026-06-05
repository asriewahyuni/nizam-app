import { createJournalEntry } from '@/modules/accounting/actions/journal.actions'
import { createClient } from '@/lib/supabase/server'

export interface RecordRevenueInput {
  orgId: string
  branchId?: string
  amount: number
  date: string
  description: string
  referenceType: string // e.g., 'CARGO_RECEIPT', 'FLEET_TICKET'
  referenceId: string
  // For revenue, we usually Debit: Cash/Bank, Credit: Revenue
  debitAccountId: string
  creditAccountId: string
  autoPost?: boolean
}

export interface RecordExpenseInput {
  orgId: string
  branchId?: string
  amount: number
  date: string
  description: string
  referenceType: string // e.g., 'FLEET_MAINTENANCE'
  referenceId: string
  // For expense, we usually Debit: Expense, Credit: Cash/Bank
  debitAccountId: string
  creditAccountId: string
  autoPost?: boolean
}

export const ERPBridge = {
  /**
   * Automatically records revenue into the General Ledger.
   * This is a mandatory call for any feature that accepts payments to prevent Silos.
   */
  async recordRevenue(input: RecordRevenueInput) {
    if (input.amount <= 0) return { success: true } // Nothing to record

    const { orgId, branchId, amount, date, description, referenceType, referenceId, debitAccountId, creditAccountId, autoPost = true } = input

    return await createJournalEntry({
      org_id: orgId,
      branch_id: branchId,
      entry_date: date,
      description: description,
      reference_type: referenceType,
      reference_id: referenceId,
      auto_post: autoPost,
      lines: [
        { account_id: debitAccountId, debit: amount, credit: 0, memo: description },
        { account_id: creditAccountId, debit: 0, credit: amount, memo: description }
      ]
    })
  },

  /**
   * Automatically records expenses into the General Ledger.
   * This is a mandatory call for any feature that records operational costs (e.g. maintenance).
   */
  async recordExpense(input: RecordExpenseInput) {
    if (input.amount <= 0) return { success: true }

    const { orgId, branchId, amount, date, description, referenceType, referenceId, debitAccountId, creditAccountId, autoPost = true } = input

    return await createJournalEntry({
      org_id: orgId,
      branch_id: branchId,
      entry_date: date,
      description: description,
      reference_type: referenceType,
      reference_id: referenceId,
      auto_post: autoPost,
      lines: [
        { account_id: debitAccountId, debit: amount, credit: 0, memo: description },
        { account_id: creditAccountId, debit: 0, credit: amount, memo: description }
      ]
    })
  },
  
  /**
   * Helper to fetch default system accounts (e.g., '1-10001' for Kas Kecil)
   * This can be expanded to dynamically query `chart_of_accounts` based on predefined mapping codes.
   */
  async getDefaultAccount(orgId: string, accountCode: string) {
    const supabase = await createClient()
    const { data } = await supabase
      .from('chart_of_accounts')
      .select('id, name')
      .eq('org_id', orgId)
      .eq('account_code', accountCode)
      .maybeSingle()
    
    return data?.id || null
  }
}
