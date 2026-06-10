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

export interface RecordCOGSInput {
  orgId: string
  branchId?: string
  saleId: string
  saleDate: string
  saleNumber: string
  /** Items yang sold; hanya yang qty > 0 dan avgCost > 0 yang dicatat */
  lines: Array<{
    productId: string
    productName: string
    quantity: number
    avgCost: number
  }>
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
   * Mencatat HPP (Cost of Goods Sold) ke jurnal akuntansi saat penjualan diselesaikan.
   * Jurnal: DR HPP (kode 5021) / CR Persediaan (kode 1301)
   * Otomatis skip jika COGS JE sudah ada untuk saleId ini, atau jika total COGS = 0.
   */
  async recordCOGS(input: RecordCOGSInput): Promise<{ success: true } | { error: string }> {
    const { orgId, branchId, saleId, saleDate, saleNumber, lines } = input

    // Hanya proses item yang punya qty dan cost positif
    const valuableLines = lines.filter(l => l.quantity > 0 && l.avgCost > 0)
    if (valuableLines.length === 0) return { success: true }

    const totalCOGS = valuableLines.reduce((s, l) => s + l.quantity * l.avgCost, 0)
    if (totalCOGS <= 0) return { success: true }

    try {
      // Cek apakah COGS JE untuk saleId ini sudah ada (idempotent)
      const { rows: existingRows } = await queryPostgres(
        `SELECT id FROM journal_entries
         WHERE org_id = $1 AND reference_type = 'SALE_COGS' AND reference_id = $2
         LIMIT 1`,
        [orgId, saleId]
      )
      if (existingRows.length > 0) return { success: true }

      // Ambil akun HPP (kode 5021) dan Persediaan (kode 1301) untuk org ini
      const { rows: accountRows } = await queryPostgres(
        `SELECT id, code FROM accounts WHERE org_id = $1 AND code IN ('1301','5021') AND is_active = TRUE`,
        [orgId]
      )
      const hppAccount = accountRows.find(r => r.code === '5021')
      const persediaanAccount = accountRows.find(r => r.code === '1301')

      if (!hppAccount || !persediaanAccount) {
        // Tidak ada akun HPP/Persediaan → skip tanpa error (org mungkin belum setup CoA)
        return { success: true }
      }

      // Generate entry number: ambil max entry_number lalu +1
      const { rows: lastEntry } = await queryPostgres(
        `SELECT entry_number FROM journal_entries
         WHERE org_id = $1 AND entry_number ~ '^JE-[0-9]{4}-[0-9]+$'
         ORDER BY entry_number DESC LIMIT 1`,
        [orgId]
      )
      const lastNum = lastEntry.length > 0
        ? parseInt(lastEntry[0].entry_number.split('-').pop() ?? '0', 10)
        : 0
      const year = saleDate.slice(0, 4)
      const nextNum = String(lastNum + 1).padStart(6, '0')
      const entryNumber = `JE-${year}-${nextNum}`

      // Insert journal_entries
      const { rows: entryRows } = await queryPostgres(
        `INSERT INTO journal_entries
           (id, org_id, branch_id, entry_number, entry_date, description,
            reference_type, reference_id, status, is_auto, created_at, updated_at)
         VALUES
           (gen_random_uuid(), $1, $2, $3, $4::date,
            $5, 'SALE_COGS', $6, 'POSTED', TRUE, NOW(), NOW())
         RETURNING id`,
        [
          orgId,
          branchId ?? null,
          entryNumber,
          saleDate,
          `HPP Penjualan ${saleNumber} — ${valuableLines.length} item`,
          saleId,
        ]
      )
      const entryId = entryRows[0]?.id as string
      if (!entryId) return { error: 'Gagal membuat header jurnal HPP.' }

      // Insert journal_lines: satu baris HPP (debit) + satu baris Persediaan (credit)
      await queryPostgres(
        `INSERT INTO journal_lines (id, entry_id, account_id, debit, credit, memo)
         VALUES
           (gen_random_uuid(), $1, $2, $3, 0,    $4),
           (gen_random_uuid(), $1, $5, 0,    $3, $4)`,
        [
          entryId,
          hppAccount.id,
          Math.round(totalCOGS),
          persediaanAccount.id,
          `HPP ${saleNumber}`,
        ]
      )

      return { success: true }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return { error: `Gagal mencatat jurnal HPP: ${msg}` }
    }
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
