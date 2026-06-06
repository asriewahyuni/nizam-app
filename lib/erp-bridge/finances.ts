import { createJournalEntry } from '@/modules/accounting/actions/journal.actions'
import { queryPostgres } from '@/lib/db/postgres'

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
   * Fetch account id from `accounts` table by org_id + code.
   * Returns null if account not yet seeded — caller decides whether to skip or throw.
   */
  async getDefaultAccount(orgId: string, accountCode: string): Promise<string | null> {
    const { rows } = await queryPostgres(
      `SELECT id FROM accounts WHERE org_id = $1 AND code = $2 AND is_active = TRUE LIMIT 1`,
      [orgId, accountCode]
    )
    return (rows[0]?.id as string) ?? null
  }
}
