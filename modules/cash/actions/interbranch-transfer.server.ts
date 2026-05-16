"use server";

import { connectPostgresClient } from "@/lib/db/postgres";
import type { BankAccount } from "@/types/database.types";

type BankAccountTransferRecord = Pick<
  BankAccount,
  "id" | "branch_id" | "account_id"
>;

type InterBranchTransferInput = {
  orgId: string;
  sourceBankAccount: BankAccountTransferRecord;
  targetBankAccount: BankAccountTransferRecord;
  transactionDate: string;
  description: string;
  amount: number;
  referenceNumber: string | null;
  createdBy?: string | null;
};

function readPostgresError(error: unknown) {
  return error instanceof Error
    ? error.message
    : String(error || "Unknown error");
}

// Mencatat transfer kas/bank antar unit dalam organisasi yang sama secara atomik.
// Setiap unit mendapatkan jurnal cabang masing-masing, memakai akun 1601 sebagai clearing antar unit
// sehingga laporan per-unit dan saldo konsolidasi tetap seimbang.
export async function createInterBranchBankTransfer(
  input: InterBranchTransferInput,
) {
  const client = await connectPostgresClient();

  try {
    await client.query("BEGIN");

    const clearingResult = await client.query<{ id: string }>(
      `
        SELECT id
        FROM public.accounts
        WHERE org_id = $1
          AND is_active = TRUE
          AND type = 'ASSET'
          AND (
            code = '1601'
            OR cash_flow_category = 'INVESTING'
            OR name ILIKE '%investasi%'
          )
          AND id <> $2
          AND id <> $3
        ORDER BY
          CASE WHEN code = '1601' THEN 0 ELSE 1 END,
          code ASC
        LIMIT 1
      `,
      [
        input.orgId,
        input.sourceBankAccount.account_id,
        input.targetBankAccount.account_id,
      ],
    );

    const clearingAccountId = clearingResult.rows[0]?.id;
    if (!clearingAccountId) {
      throw new Error(
        "Akun clearing antar unit belum tersedia. Sinkronkan CoA agar akun 1601 Investasi pada Entitas Anak / Unit tersedia.",
      );
    }

    const balanceResult = await client.query<{ balance: string | number }>(
      `
        SELECT
          CASE
            WHEN a.normal_balance = 'DEBIT'
              THEN COALESCE(SUM(scoped_lines.debit), 0) - COALESCE(SUM(scoped_lines.credit), 0)
            ELSE COALESCE(SUM(scoped_lines.credit), 0) - COALESCE(SUM(scoped_lines.debit), 0)
          END AS balance
        FROM public.accounts a
        LEFT JOIN (
          SELECT jl.account_id, jl.debit, jl.credit
          FROM public.journal_lines jl
          JOIN public.journal_entries je
            ON je.id = jl.entry_id
          WHERE je.org_id = $1
            AND je.branch_id = $2
            AND je.status = 'POSTED'
        ) AS scoped_lines
          ON scoped_lines.account_id = a.id
        WHERE a.id = $3
          AND a.org_id = $1
        GROUP BY a.id, a.normal_balance
      `,
      [
        input.orgId,
        input.sourceBankAccount.branch_id,
        input.sourceBankAccount.account_id,
      ],
    );

    const sourceBalance = Number(balanceResult.rows[0]?.balance || 0);
    if (sourceBalance < input.amount) {
      throw new Error(
        `Saldo kas unit sumber tidak mencukupi. Saldo tersedia ${sourceBalance}.`,
      );
    }

    const sourceTxResult = await client.query<{ id: string }>(
      `
        INSERT INTO public.bank_transactions (
          org_id, branch_id, bank_account_id, transaction_date, description,
          amount, type, category_id, reference_number, status, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, 'TRANSFER', $7, $8, 'DRAFT', $9)
        RETURNING id
      `,
      [
        input.orgId,
        input.sourceBankAccount.branch_id,
        input.sourceBankAccount.id,
        input.transactionDate,
        input.description,
        input.amount,
        clearingAccountId,
        input.referenceNumber,
        input.createdBy || null,
      ],
    );
    const sourceTransactionId = sourceTxResult.rows[0]?.id;

    const targetTxResult = await client.query<{ id: string }>(
      `
        INSERT INTO public.bank_transactions (
          org_id, branch_id, bank_account_id, transaction_date, description,
          amount, type, category_id, reference_number, status, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, 'IN', $7, $8, 'DRAFT', $9)
        RETURNING id
      `,
      [
        input.orgId,
        input.targetBankAccount.branch_id,
        input.targetBankAccount.id,
        input.transactionDate,
        input.description,
        input.amount,
        clearingAccountId,
        input.referenceNumber,
        input.createdBy || null,
      ],
    );
    const targetTransactionId = targetTxResult.rows[0]?.id;

    const sourceJournalResult = await client.query<{ id: string }>(
      `
        INSERT INTO public.journal_entries (
          org_id, branch_id, entry_date, description, reference_type,
          reference_id, status, is_auto, created_by
        ) VALUES ($1, $2, $3, $4, 'BANK_TRANSFER', $5, 'POSTED', TRUE, $6)
        RETURNING id
      `,
      [
        input.orgId,
        input.sourceBankAccount.branch_id,
        input.transactionDate,
        input.description,
        sourceTransactionId,
        input.createdBy || null,
      ],
    );
    const sourceJournalId = sourceJournalResult.rows[0]?.id;

    await client.query(
      `
        INSERT INTO public.journal_lines (entry_id, account_id, debit, credit, memo)
        VALUES
          ($1, $2, $3, 0, $4),
          ($1, $5, 0, $3, $4)
      `,
      [
        sourceJournalId,
        clearingAccountId,
        input.amount,
        input.description,
        input.sourceBankAccount.account_id,
      ],
    );

    const targetJournalResult = await client.query<{ id: string }>(
      `
        INSERT INTO public.journal_entries (
          org_id, branch_id, entry_date, description, reference_type,
          reference_id, status, is_auto, created_by
        ) VALUES ($1, $2, $3, $4, 'BANK_TRANSFER', $5, 'POSTED', TRUE, $6)
        RETURNING id
      `,
      [
        input.orgId,
        input.targetBankAccount.branch_id,
        input.transactionDate,
        input.description,
        targetTransactionId,
        input.createdBy || null,
      ],
    );
    const targetJournalId = targetJournalResult.rows[0]?.id;

    await client.query(
      `
        INSERT INTO public.journal_lines (entry_id, account_id, debit, credit, memo)
        VALUES
          ($1, $2, $3, 0, $4),
          ($1, $5, 0, $3, $4)
      `,
      [
        targetJournalId,
        input.targetBankAccount.account_id,
        input.amount,
        input.description,
        clearingAccountId,
      ],
    );

    await client.query(
      `
        UPDATE public.bank_transactions
        SET journal_entry_id = CASE id WHEN $1 THEN $2 WHEN $3 THEN $4 END,
            status = 'POSTED',
            updated_at = NOW()
        WHERE id IN ($1, $3)
      `,
      [
        sourceTransactionId,
        sourceJournalId,
        targetTransactionId,
        targetJournalId,
      ],
    );

    await client.query("COMMIT");

    return {
      success: true,
      data: {
        sourceTransactionId,
        targetTransactionId,
      },
    };
  } catch (error) {
    await client.query("ROLLBACK");
    return {
      error: `Gagal mencatat transfer antar unit: ${readPostgresError(error)}`,
    };
  } finally {
    client.release();
  }
}
