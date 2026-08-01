'use server'

import { createHash, randomUUID } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { queryPostgres } from '@/lib/db/postgres'
import { revalidatePath } from 'next/cache'
import { getDateInTimeZone } from '@/lib/utils'
import { getProfitLoss } from '@/modules/accounting/actions/reports.actions'
import { createJournalEntry } from '@/modules/accounting/actions/journal.actions'
import {
  buildSyirkahDistributionContext,
  resolveSyirkahContractDistribution,
  type SyirkahContractDistributionResolution,
} from '@/modules/syirkah/lib/syirkah.utils'
import { SYIRKAH_PROFIT_SHARING_EQUITY_CODE } from '@/modules/accounting/lib/shariah-coa'
import type { Account } from '@/types/database.types'

// ─── Types ─────────────────────────────────────────────────────────────────

export type SyirkahMemberRole = 'PEMODAL' | 'PENGELOLA' | 'PEMODAL_PENGELOLA'
export type SyirkahContractStatus = 'DRAFT' | 'SIGNING' | 'ACTIVE' | 'COMPLETED'

export type SyirkahMemberPayload = {
  id?: string
  member_name: string
  role: SyirkahMemberRole
  nik?: string
  address?: string
  phone?: string
  email?: string
  responsibility?: string
  profit_share_percentage?: number
  capital_contribution?: number
}

export type SyirkahWitnessPayload = {
  id?: string
  witness_name: string
  gender: 'LAKI-LAKI' | 'PEREMPUAN'
  nik?: string
  address?: string
  phone?: string
}

export type SyirkahCoreJournalSummary = {
  id: string
  entry_number: string
  status: string
  entry_date: string
  description: string
  notes?: string | null
}

type SyirkahCoreContractRow = {
  id: string
  org_id: string
  title: string
  status: SyirkahContractStatus
  contract_type?: string | null
  start_date?: string | null
  end_date?: string | null
  core_cash_account_id?: string | null
  core_equity_account_id?: string | null
  core_journal_entry_id?: string | null
  profit_sharing_allocation?: number | null
  profit_sharing_cash_account_id?: string | null
  profit_sharing_journal_entry_id?: string | null
}

type SyirkahCoreMemberRow = {
  id: string
  member_name: string
  role: string
  capital_contribution?: number | null
}

type SyirkahCoreResolvedAccounts = {
  cashAccount: Account
  equityAccount: Account
}

type SyirkahCoreSyncOptions = {
  skipRevalidate?: boolean
}

type SyirkahProfitSharingSyncOptions = SyirkahCoreSyncOptions & {
  /** Periode bagi hasil yang diposting, format YYYY-MM. Default: bulan berjalan (WIB). */
  period?: string
}

export type SyirkahProfitSharingHistoryRow = {
  id: string
  entry_number: string
  entry_date: string
  status: string
  /** null untuk jurnal lama sebelum fitur period ditambahkan */
  period: string | null
  amount: number
  source: string | null
}

type SyirkahCoreJournalDetail = SyirkahCoreJournalSummary & {
  reference_type?: string | null
  lines: Array<{
    id: string
    account_id: string
    debit: number
    credit: number
  }>
}

const SYIRKAH_DEFAULT_CASH_CODES = ['1103', '1101', '1102', '1105'] as const
const SYIRKAH_MEMBER_ROLES: SyirkahMemberRole[] = ['PEMODAL', 'PENGELOLA', 'PEMODAL_PENGELOLA']
const SYIRKAH_CONTRACT_STATUSES: SyirkahContractStatus[] = ['DRAFT', 'SIGNING', 'ACTIVE', 'COMPLETED']

function normalizeComparableText(value: unknown, mode: 'upper' | 'lower' = 'upper') {
  const normalized = String(value || '').trim().replace(/\s+/g, ' ')
  if (!normalized) return ''
  return mode === 'lower' ? normalized.toLowerCase() : normalized.toUpperCase()
}

function normalizeComparablePhone(value: unknown) {
  return String(value || '').replace(/\D+/g, '')
}

function isUniqueConstraintError(error: { code?: string | null; message?: string | null } | null | undefined) {
  if (!error) return false
  const code = String(error.code || '')
  const message = String(error.message || '').toLowerCase()
  return code === '23505' || message.includes('duplicate key')
}

function toMoneyNumber(value: unknown) {
  const parsed = Number(value ?? 0)
  if (!Number.isFinite(parsed)) return 0
  return Math.round(parsed * 100) / 100
}

function isSameMoneyValue(left: unknown, right: unknown) {
  return Math.abs(toMoneyNumber(left) - toMoneyNumber(right)) <= 0.01
}

function isMissingColumnError(
  error: { code?: string | null; message?: string | null } | null | undefined,
  columnName: string
) {
  if (!error) return false

  const code = String(error.code || '')
  const message = String(error.message || '').toLowerCase()
  const normalizedColumn = columnName.toLowerCase()

  if (code === 'PGRST204' || code === '42703') {
    return message.includes(normalizedColumn) || message.includes('schema cache')
  }

  return message.includes(normalizedColumn) && message.includes('column')
}

function isInvalidEnumValueError(message: unknown, enumName: string, enumValue: string) {
  const normalizedMessage = String(message || '').toLowerCase()
  return (
    normalizedMessage.includes('invalid input value for enum')
    && normalizedMessage.includes(enumName.toLowerCase())
    && normalizedMessage.includes(enumValue.toLowerCase())
  )
}

function isReferenceConstraintError(error: unknown, constraintName = 'uq_journal_ref_per_org') {
  const normalizedMessage = String(error || '').toLowerCase()
  return (
    normalizedMessage.includes('duplicate key')
    && normalizedMessage.includes(constraintName.toLowerCase())
  )
}

const SYIRKAH_PROFIT_SHARING_PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/

function currentSyirkahProfitSharingPeriod() {
  return getDateInTimeZone('Asia/Jakarta', new Date()).slice(0, 7)
}

function resolveSyirkahProfitSharingPeriod(rawPeriod?: unknown): { period: string } | { error: string } {
  const currentPeriod = currentSyirkahProfitSharingPeriod()
  const normalized = String(rawPeriod || '').trim()

  if (!normalized) return { period: currentPeriod }
  if (!SYIRKAH_PROFIT_SHARING_PERIOD_PATTERN.test(normalized)) {
    return { error: 'Format periode bagi hasil tidak valid. Gunakan format YYYY-MM.' }
  }
  if (normalized > currentPeriod) {
    return { error: 'Periode bagi hasil belum bisa diposting untuk bulan yang akan datang.' }
  }

  return { period: normalized }
}

/** Turunkan reference_id deterministik dari (contractId, period) agar tiap periode punya jurnal terpisah, memanfaatkan unique constraint uq_journal_ref_per_org yang sudah ada di journal_entries. */
function deriveSyirkahProfitSharingReferenceId(contractId: string, period: string) {
  const hash = createHash('sha256').update(`syirkah_profit_sharing:${contractId}:${period}`).digest('hex')
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    hash.slice(12, 16),
    hash.slice(16, 20),
    hash.slice(20, 32),
  ].join('-')
}

function formatSyirkahDateOnly(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseSyirkahDateOnly(value: unknown): string | null {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null
    return formatSyirkahDateOnly(value)
  }

  const raw = String(value || '').trim()
  if (!raw) return null

  const datePrefix = raw.match(/^(\d{4}-\d{2}-\d{2})(?:[T\s]|$)/)
  if (datePrefix) return datePrefix[1]

  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return null

  return formatSyirkahDateOnly(parsed)
}

function normalizeSyirkahDate(value: unknown) {
  return parseSyirkahDateOnly(value) || formatSyirkahDateOnly(new Date())
}

function normalizeOptionalSyirkahDate(value: unknown) {
  if (value == null) return null
  if (typeof value === 'string' && !value.trim()) return null
  return parseSyirkahDateOnly(value)
}

function normalizeSyirkahMemberRole(value: unknown): SyirkahMemberRole {
  const normalized = String(value || '').trim().toUpperCase()
  return (SYIRKAH_MEMBER_ROLES.find((role) => role === normalized) || 'PENGELOLA') as SyirkahMemberRole
}

function normalizeSyirkahContractStatus(value: unknown): SyirkahContractStatus {
  const normalized = String(value || '').trim().toUpperCase()
  return (SYIRKAH_CONTRACT_STATUSES.find((status) => status === normalized) || 'DRAFT') as SyirkahContractStatus
}

function hasSyirkahMemberIdentityMatch(
  existing: Partial<SyirkahMemberPayload>,
  incoming: Partial<SyirkahMemberPayload>
) {
  const existingNik = normalizeComparableText(existing.nik)
  const incomingNik = normalizeComparableText(incoming.nik)
  if (existingNik && incomingNik && existingNik === incomingNik) return true

  const existingEmail = normalizeComparableText(existing.email, 'lower')
  const incomingEmail = normalizeComparableText(incoming.email, 'lower')
  if (existingEmail && incomingEmail && existingEmail === incomingEmail) return true

  const existingPhone = normalizeComparablePhone(existing.phone)
  const incomingPhone = normalizeComparablePhone(incoming.phone)
  const existingName = normalizeComparableText(existing.member_name)
  const incomingName = normalizeComparableText(incoming.member_name)
  if (existingPhone && incomingPhone && existingPhone === incomingPhone && existingName && existingName === incomingName) {
    return true
  }

  return false
}

function buildSyirkahMemberFingerprint(payload: Partial<SyirkahMemberPayload> & { role?: unknown }) {
  return [
    normalizeComparableText(payload.member_name),
    normalizeSyirkahMemberRole(payload.role),
    normalizeComparableText(payload.nik),
    normalizeComparableText(payload.address),
    normalizeComparablePhone(payload.phone),
    normalizeComparableText(payload.email, 'lower'),
    normalizeComparableText(payload.responsibility),
    toMoneyNumber(payload.profit_share_percentage).toFixed(2),
    toMoneyNumber(payload.capital_contribution).toFixed(2),
  ].join('|')
}

async function resolveExistingSyirkahMemberId(
  supabase: any,
  contractId: string,
  payload: SyirkahMemberPayload
) {
  const { data, error } = await (supabase as any)
    .from('syirkah_members')
    .select('id, member_name, role, nik, address, phone, email, responsibility, profit_share_percentage, capital_contribution')
    .eq('contract_id', contractId)
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error('Gagal memeriksa duplikasi pihak bersyirkah: ' + error.message)
  }

  const rows = (data as Array<Partial<SyirkahMemberPayload> & { id?: string; role?: unknown }> | null) || []
  const matchedByIdentity = rows.find((row) => hasSyirkahMemberIdentityMatch(row, payload))
  if (matchedByIdentity?.id) return String(matchedByIdentity.id)

  const fingerprint = buildSyirkahMemberFingerprint(payload)
  const matchedByFingerprint = rows.find((row) => buildSyirkahMemberFingerprint(row) === fingerprint)
  if (matchedByFingerprint?.id) return String(matchedByFingerprint.id)

  return null
}

function hasSyirkahWitnessIdentityMatch(
  existing: Partial<SyirkahWitnessPayload>,
  incoming: Partial<SyirkahWitnessPayload>
) {
  const existingNik = normalizeComparableText(existing.nik)
  const incomingNik = normalizeComparableText(incoming.nik)
  if (existingNik && incomingNik && existingNik === incomingNik) return true

  const existingPhone = normalizeComparablePhone(existing.phone)
  const incomingPhone = normalizeComparablePhone(incoming.phone)
  const existingName = normalizeComparableText(existing.witness_name)
  const incomingName = normalizeComparableText(incoming.witness_name)
  if (existingPhone && incomingPhone && existingPhone === incomingPhone && existingName && existingName === incomingName) {
    return true
  }

  return false
}

function buildSyirkahWitnessFingerprint(payload: Partial<SyirkahWitnessPayload>) {
  return [
    normalizeComparableText(payload.witness_name),
    normalizeComparableText(payload.gender),
    normalizeComparableText(payload.nik),
    normalizeComparableText(payload.address),
    normalizeComparablePhone(payload.phone),
  ].join('|')
}

async function resolveExistingSyirkahWitnessId(
  supabase: any,
  contractId: string,
  payload: SyirkahWitnessPayload
) {
  const { data, error } = await (supabase as any)
    .from('syirkah_witnesses')
    .select('id, witness_name, gender, nik, address, phone')
    .eq('contract_id', contractId)
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error('Gagal memeriksa duplikasi saksi syirkah: ' + error.message)
  }

  const rows = (data as Array<Partial<SyirkahWitnessPayload> & { id?: string }> | null) || []
  const matchedByIdentity = rows.find((row) => hasSyirkahWitnessIdentityMatch(row, payload))
  if (matchedByIdentity?.id) return String(matchedByIdentity.id)

  const fingerprint = buildSyirkahWitnessFingerprint(payload)
  const matchedByFingerprint = rows.find((row) => buildSyirkahWitnessFingerprint(row) === fingerprint)
  if (matchedByFingerprint?.id) return String(matchedByFingerprint.id)

  return null
}

function isSyirkahCapitalPostingAllowed(status: unknown) {
  const normalized = normalizeSyirkahContractStatus(status)
  return normalized === 'ACTIVE' || normalized === 'COMPLETED'
}

function getSyirkahEquityPreferredCodes(contractType: unknown) {
  const normalizedType = String(contractType || '').trim().toLowerCase()
  if (normalizedType === 'syirkah mudharabah') {
    return ['3110', '3001', '3120']
  }

  return ['3120', '3001', '3110']
}

function pickPreferredAccountByCodes(accounts: Account[], preferredCodes: readonly string[]) {
  for (const code of preferredCodes) {
    const matched = accounts.find((account) => String(account.code || '').trim() === code)
    if (matched) return matched
  }

  return null
}

function buildSyirkahCapitalDescription(contractTitle: unknown) {
  const title = String(contractTitle || '').trim() || 'Akad Syirkah'
  return `Modal Syirkah: ${title}`
}

function buildSyirkahCapitalNotes(contract: SyirkahCoreContractRow, members: SyirkahCoreMemberRow[], totalCapital: number) {
  const positiveContributors = members
    .filter((member) => toMoneyNumber(member.capital_contribution) > 0)
    .map((member) => `${member.member_name} (${member.role}): ${toMoneyNumber(member.capital_contribution).toFixed(2)}`)

  return [
    '[AUTO_SYIRKAH_CAPITAL]',
    `contract_id=${contract.id}`,
    `contract_type=${String(contract.contract_type || 'SYIRKAH').trim() || 'SYIRKAH'}`,
    `total_capital=${totalCapital.toFixed(2)}`,
    positiveContributors.length > 0
      ? `contributors=${positiveContributors.join(' | ')}`
      : 'contributors=-',
  ].join('\n')
}

function buildSyirkahProfitSharingDescription(contractTitle: unknown) {
  const title = String(contractTitle || '').trim() || 'Akad Syirkah'
  return `Bagi Hasil Syirkah: ${title}`
}

function buildSyirkahProfitSharingNotes(
  contract: SyirkahCoreContractRow,
  distribution: SyirkahContractDistributionResolution,
  amount: number,
  period: string
) {
  return [
    '[AUTO_SYIRKAH_PROFIT_SHARING]',
    `contract_id=${contract.id}`,
    `contract_type=${String(contract.contract_type || 'SYIRKAH').trim() || 'SYIRKAH'}`,
    `distribution_period=${period}`,
    `distribution_source=${distribution.source}`,
    `distribution_status=${distribution.status}`,
    `distribution_amount=${amount.toFixed(2)}`,
  ].join('\n')
}

function isSyirkahProfitSharingJournalNotes(notes: unknown, contractId: string) {
  const normalizedNotes = String(notes || '')
  if (!normalizedNotes.includes('[AUTO_SYIRKAH_PROFIT_SHARING]')) return false
  return normalizedNotes.includes(`contract_id=${contractId}`)
}

function isSyirkahProfitSharingJournalNotesForPeriod(notes: unknown, contractId: string, period: string) {
  if (!isSyirkahProfitSharingJournalNotes(notes, contractId)) return false
  return String(notes || '').includes(`distribution_period=${period}`)
}

function parseSyirkahProfitSharingNotesTags(notes: unknown) {
  const normalizedNotes = String(notes || '')
  const extract = (key: string) => {
    const match = normalizedNotes.match(new RegExp(`^${key}=(.*)$`, 'm'))
    return match ? match[1].trim() : null
  }

  return {
    contractId: extract('contract_id'),
    period: extract('distribution_period'),
    source: extract('distribution_source'),
    status: extract('distribution_status'),
    amount: toMoneyNumber(extract('distribution_amount')),
  }
}

async function resolveSyirkahCoreAccounts(
  supabase: any,
  contract: SyirkahCoreContractRow
): Promise<{ data: SyirkahCoreResolvedAccounts | null; error?: string }> {
  const { data, error } = await (supabase as any)
    .from('accounts')
    .select('*')
    .eq('org_id', contract.org_id)
    .eq('is_active', true)
    .order('code', { ascending: true })

  if (error) {
    return { data: null, error: 'Gagal membaca akun Core: ' + error.message }
  }

  const accounts = (data as Account[] | null) || []
  const cashAccounts = accounts.filter((account) => account.type === 'ASSET' && String(account.code || '').startsWith('11'))
  const equityAccounts = accounts.filter((account) => account.type === 'EQUITY' && String(account.code || '').startsWith('3'))

  const explicitCashAccount = contract.core_cash_account_id
    ? accounts.find((account) => account.id === contract.core_cash_account_id) || null
    : null
  if (contract.core_cash_account_id && !explicitCashAccount) {
    return { data: null, error: 'Akun penerima modal Core tidak ditemukan atau sudah nonaktif.' }
  }
  if (explicitCashAccount && (explicitCashAccount.type !== 'ASSET' || !String(explicitCashAccount.code || '').startsWith('11'))) {
    return { data: null, error: 'Akun penerima modal Core harus memakai akun kas/bank (kode 11xx).' }
  }

  const explicitEquityAccount = contract.core_equity_account_id
    ? accounts.find((account) => account.id === contract.core_equity_account_id) || null
    : null
  if (contract.core_equity_account_id && !explicitEquityAccount) {
    return { data: null, error: 'Akun modal syirkah Core tidak ditemukan atau sudah nonaktif.' }
  }
  if (explicitEquityAccount && explicitEquityAccount.type !== 'EQUITY') {
    return { data: null, error: 'Akun modal syirkah Core harus berasal dari kelompok ekuitas (3xxx).' }
  }
  if (explicitEquityAccount && String(explicitEquityAccount.code || '').trim() === SYIRKAH_PROFIT_SHARING_EQUITY_CODE) {
    return { data: null, error: 'Akun Bagi Hasil Syirkah tidak bisa dipakai sebagai akun setoran modal akad.' }
  }

  const cashAccount = explicitCashAccount || pickPreferredAccountByCodes(cashAccounts, SYIRKAH_DEFAULT_CASH_CODES) || cashAccounts[0] || null
  if (!cashAccount) {
    return { data: null, error: 'Belum ada akun kas/bank aktif (11xx) untuk menerima modal syirkah di Core.' }
  }

  const selectableEquityAccounts = equityAccounts.filter(
    (account) => String(account.code || '').trim() !== SYIRKAH_PROFIT_SHARING_EQUITY_CODE
  )

  const equityAccount = explicitEquityAccount
    || pickPreferredAccountByCodes(selectableEquityAccounts, getSyirkahEquityPreferredCodes(contract.contract_type))
    || selectableEquityAccounts[0]
    || null
  if (!equityAccount) {
    return { data: null, error: 'Belum ada akun ekuitas aktif (3xxx) untuk modal syirkah di Core.' }
  }

  if (cashAccount.id === equityAccount.id) {
    return { data: null, error: 'Akun penerima modal dan akun modal syirkah tidak boleh sama.' }
  }

  return {
    data: {
      cashAccount,
      equityAccount,
    },
  }
}

async function resolveSyirkahProfitSharingAccounts(
  supabase: any,
  contract: SyirkahCoreContractRow
): Promise<{ data: SyirkahCoreResolvedAccounts | null; error?: string }> {
  const { data, error } = await (supabase as any)
    .from('accounts')
    .select('*')
    .eq('org_id', contract.org_id)
    .eq('is_active', true)
    .order('code', { ascending: true })

  if (error) {
    return { data: null, error: 'Gagal membaca akun Core: ' + error.message }
  }

  const accounts = (data as Account[] | null) || []
  const cashAccounts = accounts.filter((account) => account.type === 'ASSET' && String(account.code || '').startsWith('11'))
  const profitSharingAccount = accounts.find(
    (account) =>
      account.type === 'EQUITY'
      && String(account.code || '').trim() === SYIRKAH_PROFIT_SHARING_EQUITY_CODE
  ) || null

  const explicitCashAccountId = contract.profit_sharing_cash_account_id || contract.core_cash_account_id || null
  const explicitCashAccount = explicitCashAccountId
    ? accounts.find((account) => account.id === explicitCashAccountId) || null
    : null

  if (explicitCashAccountId && !explicitCashAccount) {
    return { data: null, error: 'Akun pembayaran bagi hasil Core tidak ditemukan atau sudah nonaktif.' }
  }

  if (explicitCashAccount && (explicitCashAccount.type !== 'ASSET' || !String(explicitCashAccount.code || '').startsWith('11'))) {
    return { data: null, error: 'Akun pembayaran bagi hasil harus memakai akun kas/bank (kode 11xx).' }
  }

  const cashAccount = explicitCashAccount || pickPreferredAccountByCodes(cashAccounts, SYIRKAH_DEFAULT_CASH_CODES) || cashAccounts[0] || null
  if (!cashAccount) {
    return { data: null, error: 'Belum ada akun kas/bank aktif (11xx) untuk pembayaran bagi hasil syirkah di Core.' }
  }

  if (!profitSharingAccount) {
    // Auto-inject akun syirkah (termasuk 3130) jika belum ada, lalu coba lagi
    try {
      await queryPostgres('SELECT public.inject_shariah_coa($1)', [contract.org_id])
      const { data: retryData } = await (supabase as any)
        .from('accounts')
        .select('id, code, name, type, normal_balance, is_active')
        .eq('org_id', contract.org_id)
        .eq('code', SYIRKAH_PROFIT_SHARING_EQUITY_CODE)
        .eq('is_active', true)
        .single()
      if (!retryData) {
        return { data: null, error: 'Akun 3130 - Bagi Hasil Syirkah belum tersedia. Hubungi administrator untuk menginisiasi CoA syirkah.' }
      }
      return {
        data: {
          cashAccount: cashAccount!,
          equityAccount: retryData as Account,
        },
      }
    } catch {
      return { data: null, error: 'Akun 3130 - Bagi Hasil Syirkah belum tersedia atau belum aktif di CoA Core.' }
    }
  }

  if (cashAccount.id === profitSharingAccount.id) {
    return { data: null, error: 'Akun pembayaran bagi hasil dan akun bagi hasil syirkah tidak boleh sama.' }
  }

  return {
    data: {
      cashAccount,
      equityAccount: profitSharingAccount,
    },
  }
}

async function loadSyirkahProfitSharingContractCompat(
  supabase: any,
  contractId: string
): Promise<{ contract: SyirkahCoreContractRow | null; hasDedicatedColumns: boolean; error?: string }> {
  const baseSelect = 'id, org_id, title, status, contract_type, start_date, end_date, core_cash_account_id, profit_sharing_allocation'
  const extendedSelect = `${baseSelect}, profit_sharing_cash_account_id, profit_sharing_journal_entry_id`

  const normalizeContract = (
    row: Record<string, unknown> | null | undefined,
    hasDedicatedColumns: boolean
  ): SyirkahCoreContractRow | null => {
    if (!row?.id) return null

    return {
      id: String(row.id),
      org_id: String(row.org_id || ''),
      title: String(row.title || ''),
      status: normalizeSyirkahContractStatus(row.status),
      contract_type: row.contract_type ? String(row.contract_type) : null,
      start_date: row.start_date ? String(row.start_date) : null,
      end_date: row.end_date ? String(row.end_date) : null,
      core_cash_account_id: row.core_cash_account_id ? String(row.core_cash_account_id) : null,
      profit_sharing_allocation: toMoneyNumber(row.profit_sharing_allocation),
      profit_sharing_cash_account_id:
        hasDedicatedColumns && row.profit_sharing_cash_account_id ? String(row.profit_sharing_cash_account_id) : null,
      profit_sharing_journal_entry_id:
        hasDedicatedColumns && row.profit_sharing_journal_entry_id ? String(row.profit_sharing_journal_entry_id) : null,
    }
  }

  const { data: contractWithDedicatedColumns, error: contractWithDedicatedColumnsError } = await (supabase as any)
    .from('syirkah_contracts')
    .select(extendedSelect)
    .eq('id', contractId)
    .single()

  if (!contractWithDedicatedColumnsError) {
    return {
      contract: normalizeContract(contractWithDedicatedColumns as Record<string, unknown>, true),
      hasDedicatedColumns: true,
    }
  }

  const missingDedicatedColumns =
    isMissingColumnError(contractWithDedicatedColumnsError, 'profit_sharing_cash_account_id')
    || isMissingColumnError(contractWithDedicatedColumnsError, 'profit_sharing_journal_entry_id')

  if (!missingDedicatedColumns) {
    return {
      contract: null,
      hasDedicatedColumns: true,
      error: 'Gagal membaca akad syirkah: ' + (contractWithDedicatedColumnsError.message || JSON.stringify(contractWithDedicatedColumnsError)),
    }
  }

  const { data: legacyContract, error: legacyContractError } = await (supabase as any)
    .from('syirkah_contracts')
    .select(baseSelect)
    .eq('id', contractId)
    .single()

  if (legacyContractError) {
    return {
      contract: null,
      hasDedicatedColumns: false,
      error: 'Gagal membaca akad syirkah: ' + (legacyContractError.message || JSON.stringify(legacyContractError)),
    }
  }

  return {
    contract: normalizeContract(legacyContract as Record<string, unknown>, false),
    hasDedicatedColumns: false,
  }
}

async function getSyirkahCoreJournalDetail(
  supabase: any,
  entryId: string,
  orgId: string
): Promise<SyirkahCoreJournalDetail | null> {
  const { data: entry, error: entryError } = await (supabase as any)
    .from('journal_entries')
    .select('id, entry_number, status, entry_date, description, notes, reference_type')
    .eq('id', entryId)
    .eq('org_id', orgId)
    .maybeSingle()

  if (entryError || !entry?.id) return null

  const { data: lines, error: linesError } = await (supabase as any)
    .from('journal_lines')
    .select('id, account_id, debit, credit')
    .eq('entry_id', entryId)

  if (linesError) return null

  return {
    id: String(entry.id),
    entry_number: String(entry.entry_number || ''),
    status: String(entry.status || ''),
    entry_date: String(entry.entry_date || ''),
    description: String(entry.description || ''),
    notes: entry.notes ? String(entry.notes) : null,
    reference_type: entry.reference_type ? String(entry.reference_type) : null,
    lines: ((lines as Array<Record<string, unknown>> | null) || []).map((line) => ({
      id: String(line.id || ''),
      account_id: String(line.account_id || ''),
      debit: toMoneyNumber(line.debit),
      credit: toMoneyNumber(line.credit),
    })),
  }
}

async function findSyirkahProfitSharingJournalForPeriod(
  supabase: any,
  contract: Pick<SyirkahCoreContractRow, 'id' | 'org_id'>,
  period: string
): Promise<SyirkahCoreJournalDetail | null> {
  const periodReferenceId = deriveSyirkahProfitSharingReferenceId(contract.id, period)

  const { data, error } = await (supabase as any)
    .from('journal_entries')
    .select('id, status, notes, reference_type')
    .eq('org_id', contract.org_id)
    .eq('reference_id', periodReferenceId)
    .order('created_at', { ascending: false })
    .limit(5)

  if (error) return null

  const rows = (data as Array<Record<string, unknown>> | null) || []
  const filteredRows = rows.filter((row) => {
    const referenceType = String(row.reference_type || '').trim().toUpperCase()
    return (
      referenceType === 'SYIRKAH_PROFIT_SHARING'
      || referenceType === 'MANUAL'
      || isSyirkahProfitSharingJournalNotesForPeriod(row.notes, contract.id, period)
    )
  })

  const preferredRow =
    filteredRows.find((row) =>
      String(row.status || '').trim().toUpperCase() !== 'VOIDED'
      && isSyirkahProfitSharingJournalNotesForPeriod(row.notes, contract.id, period)
    )
    || filteredRows.find((row) =>
      String(row.status || '').trim().toUpperCase() !== 'VOIDED'
      && String(row.reference_type || '').trim().toUpperCase() === 'SYIRKAH_PROFIT_SHARING'
    )
    || filteredRows.find((row) =>
      String(row.status || '').trim().toUpperCase() !== 'VOIDED'
      && String(row.reference_type || '').trim().toUpperCase() === 'MANUAL'
    )
    || filteredRows.find((row) => String(row.status || '').trim().toUpperCase() !== 'VOIDED')
    || filteredRows.find((row) => isSyirkahProfitSharingJournalNotesForPeriod(row.notes, contract.id, period))
    || filteredRows[0]
    || null

  if (!preferredRow?.id) return null

  return getSyirkahCoreJournalDetail(supabase, String(preferredRow.id), contract.org_id)
}

export async function getSyirkahProfitSharingHistory(
  orgId: string,
  contractId: string
): Promise<SyirkahProfitSharingHistoryRow[]> {
  const supabase = await createClient()

  const { data, error } = await (supabase as any)
    .from('journal_entries')
    .select('id, entry_number, entry_date, status, notes')
    .eq('org_id', orgId)
    .ilike('notes', '%[AUTO_SYIRKAH_PROFIT_SHARING]%')
    .ilike('notes', `%contract_id=${contractId}%`)
    .neq('status', 'VOIDED')
    .order('entry_date', { ascending: false })
    .limit(100)

  if (error) return []

  const rows = (data as Array<Record<string, unknown>> | null) || []
  return rows.map((row) => {
    const tags = parseSyirkahProfitSharingNotesTags(row.notes)
    return {
      id: String(row.id),
      entry_number: String(row.entry_number || ''),
      entry_date: String(row.entry_date || ''),
      status: String(row.status || ''),
      period: tags.period,
      amount: tags.amount,
      source: tags.source,
    }
  })
}

function isSyirkahCoreJournalAligned(
  journal: SyirkahCoreJournalDetail | null,
  params: {
    entryDate: string
    description: string
    notes: string
    cashAccountId: string
    equityAccountId: string
    totalCapital: number
  }
) {
  if (!journal) return false
  if (journal.status === 'VOIDED') return false
  if (String(journal.reference_type || '').trim() !== 'SYIRKAH_CAPITAL') return false
  if (String(journal.entry_date || '').trim() !== params.entryDate) return false
  if (String(journal.description || '').trim() !== params.description) return false
  if (String(journal.notes || '').trim() !== params.notes) return false
  if (journal.lines.length !== 2) return false

  const cashLine = journal.lines.find((line) => line.account_id === params.cashAccountId) || null
  const equityLine = journal.lines.find((line) => line.account_id === params.equityAccountId) || null

  if (!cashLine || !equityLine) return false
  if (!isSameMoneyValue(cashLine.debit, params.totalCapital) || !isSameMoneyValue(cashLine.credit, 0)) return false
  if (!isSameMoneyValue(equityLine.credit, params.totalCapital) || !isSameMoneyValue(equityLine.debit, 0)) return false

  return true
}

function isSyirkahProfitSharingJournalAligned(
  journal: SyirkahCoreJournalDetail | null,
  params: {
    entryDate: string
    description: string
    notes: string
    cashAccountId: string
    profitSharingAccountId: string
    amount: number
    referenceType?: string | null
    allowLegacyManualReferenceType?: boolean
  }
) {
  if (!journal) return false
  if (journal.status === 'VOIDED') return false
  const actualReferenceType = String(journal.reference_type || '').trim().toUpperCase()
  const expectedReferenceType = String(params.referenceType || '').trim().toUpperCase()
  if (expectedReferenceType && actualReferenceType !== expectedReferenceType) {
    if (!(params.allowLegacyManualReferenceType && actualReferenceType === 'MANUAL')) {
      return false
    }
  }
  if (String(journal.entry_date || '').trim() !== params.entryDate) return false
  if (String(journal.description || '').trim() !== params.description) return false
  if (String(journal.notes || '').trim() !== params.notes) return false
  if (journal.lines.length !== 2) return false

  const profitSharingLine = journal.lines.find((line) => line.account_id === params.profitSharingAccountId) || null
  const cashLine = journal.lines.find((line) => line.account_id === params.cashAccountId) || null

  if (!profitSharingLine || !cashLine) return false
  if (!isSameMoneyValue(profitSharingLine.debit, params.amount) || !isSameMoneyValue(profitSharingLine.credit, 0)) return false
  if (!isSameMoneyValue(cashLine.credit, params.amount) || !isSameMoneyValue(cashLine.debit, 0)) return false

  return true
}

async function cleanupSyirkahCoreJournal(
  supabase: any,
  params: {
    orgId: string
    entryId: string
    userId: string | null
    reason: string
  }
) {
  const { data: entry, error: entryError } = await (supabase as any)
    .from('journal_entries')
    .select('id, status')
    .eq('id', params.entryId)
    .eq('org_id', params.orgId)
    .maybeSingle()

  if (entryError) {
    return { error: 'Gagal membaca jurnal Core syirkah: ' + entryError.message }
  }

  if (!entry?.id) return { success: true }

  const status = String(entry.status || '')
  if (status === 'DRAFT') {
    const { error: deleteError } = await (supabase as any)
      .from('journal_entries')
      .delete()
      .eq('id', params.entryId)
      .eq('org_id', params.orgId)
      .eq('status', 'DRAFT')

    if (deleteError) {
      return { error: 'Gagal menghapus draft jurnal Core syirkah: ' + deleteError.message }
    }

    return { success: true }
  }

  if (status === 'VOIDED') {
    return { success: true }
  }

  const { error: voidError } = await (supabase as any)
    .from('journal_entries')
    .update({
      status: 'VOIDED',
      voided_at: new Date().toISOString(),
      voided_by: params.userId || null,
      void_reason: params.reason,
    })
    .eq('id', params.entryId)
    .eq('org_id', params.orgId)
    .eq('status', 'POSTED')

  if (voidError) {
    return { error: 'Gagal membatalkan jurnal Core syirkah sebelumnya: ' + voidError.message }
  }

  return { success: true }
}

// ─── FETCH ──────────────────────────────────────────────────────────────────

export async function getSyirkahContracts(orgId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('syirkah_contracts')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Failed to fetch syirkah contracts:', error)
    return []
  }

  return data
}

export async function getSyirkahContractById(id: string, orgId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('syirkah_contracts')
    .select('*')
    .eq('id', id)
    .eq('org_id', orgId)
    .single()

  if (error) {
    console.error('Failed to fetch syirkah contract by id:', error)
    return null
  }

  return data
}

export async function getSyirkahContractByToken(token: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('syirkah_contracts')
    .select(`
      *,
      organizations(name),
      syirkah_members(*)
    `)
    .eq('qr_token', token)
    .single()

  if (error) {
    console.error('Failed to fetch syirkah contract by token:', error)
    return null
  }

  return data
}

export async function getSyirkahMembers(contractId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('syirkah_members')
    .select('*')
    .eq('contract_id', contractId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Failed to fetch syirkah members:', error)
    return []
  }

  return data
}

export async function getSyirkahCoreJournal(entryId: string, orgId: string): Promise<SyirkahCoreJournalSummary | null> {
  const supabase = await createClient()
  const data = await getSyirkahCoreJournalDetail(supabase, entryId, orgId)

  if (!data) return null

  return {
    id: data.id,
    entry_number: data.entry_number,
    status: data.status,
    entry_date: data.entry_date,
    description: data.description,
    notes: data.notes,
  }
}

// ─── UPSERT ─────────────────────────────────────────────────────────────────

export async function upsertSyirkahContract(orgId: string, payload: any) {
  const supabase = await createClient()
  const normalizedStatus = normalizeSyirkahContractStatus(payload.status)
  // Kolom JSONB di Railway/pg driver harus dikirim sebagai JSON string —
  // `pg` tidak otomatis serialize object ke jsonb, sehingga PostgreSQL mendapat
  // tipe "unknown" dan error. Dengan JSON.stringify, nilai dikirim sebagai text
  // yang PostgreSQL cast implisit ke jsonb.
  const toJsonbString = (value: unknown): string | null => {
    if (value == null) return null
    try {
      return JSON.stringify(value)
    } catch {
      return null
    }
  }

  const upsertPayload = {
    ...(payload.id ? { id: payload.id } : {}),
    org_id: orgId,
    title: payload.title,
    description: payload.description ?? null,
    contract_type: payload.contract_type || 'Syirkah Mudharabah',
    business_name: payload.business_name ?? null,
    business_description: payload.business_description ?? null,
    business_document_url: payload.business_document_url ?? null,
    duration_months: payload.duration_months || 12,
    debt_allocation: payload.debt_allocation || 0,
    current_debt: payload.current_debt || 0,
    profit_sharing_allocation: payload.profit_sharing_allocation || 0,
    status: normalizedStatus,
    start_date: normalizeOptionalSyirkahDate(payload.start_date),
    end_date: normalizeOptionalSyirkahDate(payload.end_date),
    // Kolom JSONB — harus dikirim sebagai JSON string agar pg driver + PostgreSQL bisa parse
    clauses: toJsonbString(payload.clauses),
    signed_by: toJsonbString(payload.signed_by),
    signed_at: payload.signed_at ?? null,
    wizard_step: payload.wizard_step ?? null,
    ...(Object.prototype.hasOwnProperty.call(payload, 'core_cash_account_id')
      ? { core_cash_account_id: payload.core_cash_account_id || null }
      : {}),
    ...(Object.prototype.hasOwnProperty.call(payload, 'core_equity_account_id')
      ? { core_equity_account_id: payload.core_equity_account_id || null }
      : {}),
    ...(Object.prototype.hasOwnProperty.call(payload, 'profit_sharing_cash_account_id')
      ? { profit_sharing_cash_account_id: payload.profit_sharing_cash_account_id || null }
      : {}),
    updated_at: new Date().toISOString()
  }

  let { data, error } = await supabase
    .from('syirkah_contracts')
    .upsert(upsertPayload)
    .select()
    .single()

  if (error && isMissingColumnError(error, 'profit_sharing_cash_account_id')) {
    const legacyUpsertPayload = { ...upsertPayload }
    delete legacyUpsertPayload.profit_sharing_cash_account_id
    const retryResult = await supabase
      .from('syirkah_contracts')
      .upsert(legacyUpsertPayload)
      .select()
      .single()

    data = retryResult.data
    error = retryResult.error
  }

  if (error) {
    throw new Error('Gagal menyimpan akad syirkah: ' + error.message)
  }

  revalidatePath('/syirkah')
  return data
}

export async function upsertSyirkahMember(contractId: string, payload: SyirkahMemberPayload) {
  const supabase = await createClient()
  const normalizedRole = normalizeSyirkahMemberRole(payload.role)
  let resolvedId = payload.id || null

  if (!resolvedId) {
    resolvedId = await resolveExistingSyirkahMemberId(supabase, contractId, payload)
  }

  const persistMember = async (id: string | null) => {
    return supabase
      .from('syirkah_members')
      .upsert({
        ...(id ? { id } : {}),
        contract_id: contractId,
        member_name: payload.member_name,
        role: normalizedRole,
        nik: payload.nik,
        address: payload.address,
        phone: payload.phone,
        email: payload.email,
        responsibility: payload.responsibility,
        profit_share_percentage: payload.profit_share_percentage || 0,
        capital_contribution: payload.capital_contribution || 0,
        updated_at: new Date().toISOString()
      })
      .select()
      .single()
  }

  let { data, error } = await persistMember(resolvedId)

  if (error && isUniqueConstraintError(error) && !resolvedId) {
    resolvedId = await resolveExistingSyirkahMemberId(supabase, contractId, payload)
    if (resolvedId) {
      const retryResult = await persistMember(resolvedId)
      data = retryResult.data
      error = retryResult.error
    }
  }

  if (error) {
    throw new Error('Gagal menyimpan pihak bersyirkah: ' + error.message)
  }

  revalidatePath(`/syirkah/${contractId}`)
  return data
}

export async function deleteSyirkahMember(id: string, contractId: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('syirkah_members')
    .delete()
    .eq('id', id)

  if (error) {
    throw new Error('Gagal menghapus pihak bersyirkah: ' + error.message)
  }

  revalidatePath(`/syirkah/${contractId}`)
  return true
}

/**
 * Hapus akad syirkah beserta anggota dan saksinya.
 * Hanya diizinkan untuk akad berstatus DRAFT.
 * Jika ada journal Core yang tertaut, akan di-void/hapus terlebih dahulu.
 */
export async function deleteSyirkahContract(contractId: string, orgId: string) {
  const supabase = await createClient()

  // Ambil data kontrak
  let hasDedicatedProfitSharingColumns = true
  let { data: contract, error: fetchError } = await (supabase as any)
    .from('syirkah_contracts')
    .select('id, org_id, status, core_journal_entry_id, profit_sharing_journal_entry_id')
    .eq('id', contractId)
    .eq('org_id', orgId)
    .maybeSingle()

  if (fetchError && isMissingColumnError(fetchError, 'profit_sharing_journal_entry_id')) {
    hasDedicatedProfitSharingColumns = false
    const retryResult = await (supabase as any)
      .from('syirkah_contracts')
      .select('id, org_id, status, core_journal_entry_id')
      .eq('id', contractId)
      .eq('org_id', orgId)
      .maybeSingle()

    contract = retryResult.data
    fetchError = retryResult.error
  }

  if (fetchError) {
    return { error: 'Gagal membaca data akad: ' + fetchError.message }
  }

  if (!contract?.id) {
    return { error: 'Akad tidak ditemukan.' }
  }

  // Jika akad memiliki jurnal tercatat, void jurnal tersebut terlebih dahulu
  if (contract.core_journal_entry_id) {
    const { data: { user } } = await supabase.auth.getUser()
    const cleanupResult = await cleanupSyirkahCoreJournal(supabase, {
      orgId,
      entryId: contract.core_journal_entry_id,
      userId: user?.id || null,
      reason: 'Syirkah dihapus oleh pengguna.',
    })
    
    if ('error' in cleanupResult) {
      return { error: 'Gagal membersihkan jurnal terkait sebelum menghapus akad: ' + cleanupResult.error }
    }
  }

  // Akad dihapus permanen: bersihkan SEMUA jurnal bagi hasil lintas periode, bukan cuma periode berjalan.
  const allProfitSharingJournalIds = new Set<string>()
  if (hasDedicatedProfitSharingColumns && contract.profit_sharing_journal_entry_id) {
    allProfitSharingJournalIds.add(String(contract.profit_sharing_journal_entry_id))
  }
  if (contract?.id && contract?.org_id) {
    const profitSharingHistory = await getSyirkahProfitSharingHistory(String(contract.org_id), String(contract.id))
    for (const row of profitSharingHistory) {
      allProfitSharingJournalIds.add(row.id)
    }
  }

  if (allProfitSharingJournalIds.size > 0) {
    const { data: { user } } = await supabase.auth.getUser()
    for (const entryId of allProfitSharingJournalIds) {
      const cleanupResult = await cleanupSyirkahCoreJournal(supabase, {
        orgId,
        entryId,
        userId: user?.id || null,
        reason: 'Syirkah dihapus oleh pengguna.',
      })

      if ('error' in cleanupResult) {
        return { error: 'Gagal membersihkan jurnal bagi hasil sebelum menghapus akad: ' + cleanupResult.error }
      }
    }
  }

  // Hapus anggota & saksi (cascade seharusnya menangani ini, tapi eksplisit lebih aman)
  await (supabase as any).from('syirkah_members').delete().eq('contract_id', contractId)
  await (supabase as any).from('syirkah_witnesses').delete().eq('contract_id', contractId)

  // Hapus kontrak
  const { error: deleteError } = await (supabase as any)
    .from('syirkah_contracts')
    .delete()
    .eq('id', contractId)
    .eq('org_id', orgId)

  if (deleteError) {
    return { error: 'Gagal menghapus akad: ' + deleteError.message }
  }

  revalidatePath('/syirkah')
  return { success: true }
}

/**
 * Sinkronkan total modal syirkah ke jurnal Core accounting.
 * Jurnal dibuat sebagai:
 *   Dr akun kas/bank penerima modal
 *   Cr akun modal syirkah / ekuitas
 */
export async function syncSyirkahCapitalToCore(
  contractId: string,
  options: SyirkahCoreSyncOptions = {}
) {
  const supabase = await createClient()
  const shouldRevalidate = !options.skipRevalidate
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.id) {
    return { error: 'Tidak terautentikasi.' }
  }

  const { data: contract, error: contractError } = await (supabase as any)
    .from('syirkah_contracts')
    .select('id, org_id, title, status, contract_type, start_date, core_cash_account_id, core_equity_account_id, core_journal_entry_id')
    .eq('id', contractId)
    .single()

  if (contractError) {
    console.error('[syncSyirkahCapitalToCore] contractError:', contractError)
    return { error: 'Gagal membaca akad syirkah: ' + (contractError.message || JSON.stringify(contractError)) }
  }

  if (!contract?.id) {
    return { error: 'Akad syirkah tidak ditemukan (id tidak sesuai).' }
  }

  const normalizedContract: SyirkahCoreContractRow = {
    id: String(contract.id),
    org_id: String(contract.org_id),
    title: String(contract.title || ''),
    status: normalizeSyirkahContractStatus(contract.status),
    contract_type: contract.contract_type ? String(contract.contract_type) : null,
    start_date: contract.start_date ? String(contract.start_date) : null,
    core_cash_account_id: contract.core_cash_account_id ? String(contract.core_cash_account_id) : null,
    core_equity_account_id: contract.core_equity_account_id ? String(contract.core_equity_account_id) : null,
    core_journal_entry_id: contract.core_journal_entry_id ? String(contract.core_journal_entry_id) : null,
  }

  if (!isSyirkahCapitalPostingAllowed(normalizedContract.status)) {
    if (normalizedContract.core_journal_entry_id) {
      const cleanupResult = await cleanupSyirkahCoreJournal(supabase, {
        orgId: normalizedContract.org_id,
        entryId: normalizedContract.core_journal_entry_id,
        userId: user?.id ? String(user.id) : null,
        reason: 'SYNC_SYIRKAH_CAPITAL_NOT_EFFECTIVE',
      })

      if ('error' in cleanupResult) {
        return cleanupResult
      }
    }

    const { error: updateError } = await (supabase as any)
      .from('syirkah_contracts')
      .update({
        core_journal_entry_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', normalizedContract.id)
      .eq('org_id', normalizedContract.org_id)

    if (updateError) {
      return { error: 'Gagal membersihkan tautan jurnal Core syirkah: ' + updateError.message }
    }

    if (shouldRevalidate) {
      revalidatePath('/accounting/journal')
      revalidatePath('/syirkah')
      revalidatePath(`/syirkah/${contractId}`)
    }
    return {
      success: true,
      skipped: true,
      message: 'Pencatatan modal syirkah baru dibuat setelah akad berstatus ACTIVE.',
    }
  }

  const { data: members, error: membersError } = await (supabase as any)
    .from('syirkah_members')
    .select('id, member_name, role, capital_contribution')
    .eq('contract_id', contractId)
    .order('created_at', { ascending: true })

  if (membersError) {
    return { error: 'Gagal membaca anggota syirkah: ' + membersError.message }
  }

  const normalizedMembers: SyirkahCoreMemberRow[] = ((members as Array<Record<string, unknown>> | null) || []).map((member) => ({
    id: String(member.id || ''),
    member_name: String(member.member_name || ''),
    role: String(member.role || ''),
    capital_contribution: toMoneyNumber(member.capital_contribution),
  }))

  const totalCapital = normalizedMembers.reduce((sum, member) => sum + toMoneyNumber(member.capital_contribution), 0)
  const hasCapital = totalCapital > 0.009

  if (!hasCapital) {
    if (normalizedContract.core_journal_entry_id) {
      const cleanupResult = await cleanupSyirkahCoreJournal(supabase, {
        orgId: normalizedContract.org_id,
        entryId: normalizedContract.core_journal_entry_id,
        userId: String(user.id),
        reason: 'SYNC_SYIRKAH_CAPITAL_ZERO',
      })

      if ('error' in cleanupResult) {
        return cleanupResult
      }
    }

    const { error: updateError } = await (supabase as any)
      .from('syirkah_contracts')
      .update({
        core_journal_entry_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', normalizedContract.id)
      .eq('org_id', normalizedContract.org_id)

    if (updateError) {
      return { error: 'Gagal memperbarui status Core syirkah: ' + updateError.message }
    }

    if (shouldRevalidate) {
      revalidatePath('/accounting/journal')
      revalidatePath('/syirkah')
      revalidatePath(`/syirkah/${contractId}`)
    }
    return {
      success: true,
      skipped: true,
      message: 'Belum ada modal syirkah yang perlu dicatat ke Core.',
    }
  }

  const resolvedAccounts = await resolveSyirkahCoreAccounts(supabase, normalizedContract)
  if (resolvedAccounts.error || !resolvedAccounts.data) {
    return { error: resolvedAccounts.error || 'Akun Core syirkah belum siap.' }
  }

  const { cashAccount, equityAccount } = resolvedAccounts.data
  const entryDate = normalizeSyirkahDate(normalizedContract.start_date)
  const description = buildSyirkahCapitalDescription(normalizedContract.title)
  const notes = buildSyirkahCapitalNotes(normalizedContract, normalizedMembers, totalCapital)
  const existingJournal = normalizedContract.core_journal_entry_id
    ? await getSyirkahCoreJournalDetail(supabase, normalizedContract.core_journal_entry_id, normalizedContract.org_id)
    : null

  if (isSyirkahCoreJournalAligned(existingJournal, {
    entryDate,
    description,
    notes,
    cashAccountId: cashAccount.id,
    equityAccountId: equityAccount.id,
    totalCapital,
  })) {
    if (
      normalizedContract.core_cash_account_id !== cashAccount.id
      || normalizedContract.core_equity_account_id !== equityAccount.id
    ) {
      const { error: updateError } = await (supabase as any)
        .from('syirkah_contracts')
        .update({
          core_cash_account_id: cashAccount.id,
          core_equity_account_id: equityAccount.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', normalizedContract.id)
        .eq('org_id', normalizedContract.org_id)

      if (updateError) {
        return { error: 'Gagal menyimpan mapping akun Core syirkah: ' + updateError.message }
      }
    }

    if (shouldRevalidate) {
      revalidatePath('/syirkah')
      revalidatePath(`/syirkah/${contractId}`)
    }
    return {
      success: true,
      skipped: true,
      entryId: existingJournal?.id || normalizedContract.core_journal_entry_id || null,
      entryNumber: existingJournal?.entry_number || null,
      message: 'Pencatatan modal syirkah di Core sudah sinkron.',
    }
  }

  const createResult = await createJournalEntry({
    org_id: normalizedContract.org_id,
    allow_org_scope: true,
    entry_date: entryDate,
    description,
    reference_type: 'SYIRKAH_CAPITAL',
    notes,
    auto_post: true,
    skipRevalidate: options.skipRevalidate,
    lines: [
      {
        account_id: cashAccount.id,
        debit: totalCapital,
        credit: 0,
        memo: 'Setoran modal syirkah ke rekening penerima',
      },
      {
        account_id: equityAccount.id,
        debit: 0,
        credit: totalCapital,
        memo: `Modal syirkah untuk ${normalizedContract.title || 'akad syirkah'}`,
      },
    ],
  })

  if ((createResult as any).error || !(createResult as any).entryId) {
    return { error: (createResult as any).error || 'Gagal membuat jurnal Core syirkah.' }
  }

  const newEntryId = String((createResult as any).entryId)
  const newEntryNumber = String((createResult as any).entryNumber || '')

  const { error: linkError } = await (supabase as any)
    .from('syirkah_contracts')
    .update({
      core_cash_account_id: cashAccount.id,
      core_equity_account_id: equityAccount.id,
      core_journal_entry_id: newEntryId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', normalizedContract.id)
    .eq('org_id', normalizedContract.org_id)

  if (linkError) {
    await cleanupSyirkahCoreJournal(supabase, {
      orgId: normalizedContract.org_id,
      entryId: newEntryId,
      userId: String(user.id),
      reason: 'SYNC_SYIRKAH_CAPITAL_LINK_FAILED',
    })
    return { error: 'Gagal menautkan jurnal Core ke akad syirkah: ' + linkError.message }
  }

  if (normalizedContract.core_journal_entry_id && normalizedContract.core_journal_entry_id !== newEntryId) {
    const cleanupPreviousResult = await cleanupSyirkahCoreJournal(supabase, {
      orgId: normalizedContract.org_id,
      entryId: normalizedContract.core_journal_entry_id,
      userId: String(user.id),
      reason: 'SYNC_SYIRKAH_CAPITAL_REPLACED',
    })

    if ('error' in cleanupPreviousResult) {
      await (supabase as any)
        .from('syirkah_contracts')
        .update({
          core_journal_entry_id: normalizedContract.core_journal_entry_id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', normalizedContract.id)
        .eq('org_id', normalizedContract.org_id)

      await cleanupSyirkahCoreJournal(supabase, {
        orgId: normalizedContract.org_id,
        entryId: newEntryId,
        userId: String(user.id),
        reason: 'SYNC_SYIRKAH_CAPITAL_REVERT',
      })

      return cleanupPreviousResult
    }
  }

  if (shouldRevalidate) {
    revalidatePath('/accounting/journal')
    revalidatePath('/syirkah')
    revalidatePath(`/syirkah/${contractId}`)
  }
  return {
    success: true,
    entryId: newEntryId,
    entryNumber: newEntryNumber || null,
    message: 'Modal syirkah berhasil disinkronkan ke jurnal Core.',
  }
}

/**
 * Sinkronkan bagi hasil syirkah ke jurnal Core accounting.
 * Jurnal dibuat sebagai:
 *   Dr 3130 Bagi Hasil Syirkah
 *   Cr akun kas/bank pembayaran bagi hasil
 */
export async function syncSyirkahProfitSharingToCore(
  contractId: string,
  options: SyirkahProfitSharingSyncOptions = {}
) {
  const supabase = await createClient()
  const shouldRevalidate = !options.skipRevalidate
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.id) {
    return { error: 'Tidak terautentikasi.' }
  }

  const resolvedPeriod = resolveSyirkahProfitSharingPeriod(options.period)
  if ('error' in resolvedPeriod) {
    return { error: resolvedPeriod.error }
  }
  const period = resolvedPeriod.period
  const isCurrentPeriod = period === currentSyirkahProfitSharingPeriod()

  const contractResult = await loadSyirkahProfitSharingContractCompat(supabase, contractId)
  if (contractResult.error) {
    console.error('[syncSyirkahProfitSharingToCore] contractError:', contractResult.error)
    return { error: contractResult.error }
  }

  const normalizedContract = contractResult.contract
  const hasDedicatedColumns = contractResult.hasDedicatedColumns

  if (!normalizedContract?.id) {
    return { error: 'Akad syirkah tidak ditemukan (id tidak sesuai).' }
  }

  const periodReferenceId = deriveSyirkahProfitSharingReferenceId(normalizedContract.id, period)

  let cachedExistingJournal: SyirkahCoreJournalDetail | null | undefined
  const getExistingProfitSharingJournal = async () => {
    if (cachedExistingJournal !== undefined) return cachedExistingJournal

    if (isCurrentPeriod && normalizedContract.profit_sharing_journal_entry_id) {
      cachedExistingJournal = await getSyirkahCoreJournalDetail(
        supabase,
        normalizedContract.profit_sharing_journal_entry_id,
        normalizedContract.org_id
      )
      if (cachedExistingJournal) return cachedExistingJournal
    }

    cachedExistingJournal = await findSyirkahProfitSharingJournalForPeriod(supabase, normalizedContract, period)
    return cachedExistingJournal
  }

  const persistProfitSharingLink = async (entryId: string | null) => {
    if (!hasDedicatedColumns) return { success: true as const }
    // Kolom profit_sharing_journal_entry_id hanya boleh menunjuk ke jurnal periode berjalan;
    // sinkron untuk periode lain tidak boleh menimpa pointer "current" ini.
    if (!isCurrentPeriod) return { success: true as const }

    const { error: updateError } = await (supabase as any)
      .from('syirkah_contracts')
      .update({
        profit_sharing_cash_account_id: cashAccount.id,
        profit_sharing_journal_entry_id: entryId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', normalizedContract.id)
      .eq('org_id', normalizedContract.org_id)

    if (updateError) {
      return { error: updateError.message || 'Gagal menyimpan tautan jurnal bagi hasil.' }
    }

    return { success: true as const }
  }

  const clearLinkedJournal = async (reason: string, message: string) => {
    const existingJournal = await getExistingProfitSharingJournal()

    if (existingJournal?.id) {
      const cleanupResult = await cleanupSyirkahCoreJournal(supabase, {
        orgId: normalizedContract.org_id,
        entryId: existingJournal.id,
        userId: String(user.id),
        reason,
      })

      if ('error' in cleanupResult) {
        return cleanupResult
      }
    }

    if (hasDedicatedColumns) {
      const { error: updateError } = await (supabase as any)
        .from('syirkah_contracts')
        .update({
          profit_sharing_journal_entry_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', normalizedContract.id)
        .eq('org_id', normalizedContract.org_id)

      if (updateError) {
        return { error: 'Gagal membersihkan tautan jurnal bagi hasil syirkah: ' + updateError.message }
      }
    }

    if (shouldRevalidate) {
      revalidatePath('/accounting/journal')
      revalidatePath('/syirkah')
      revalidatePath(`/syirkah/${contractId}`)
    }

    return {
      success: true,
      skipped: true,
      period,
      message,
    }
  }

  if (!isSyirkahCapitalPostingAllowed(normalizedContract.status)) {
    return clearLinkedJournal(
      'SYNC_SYIRKAH_PROFIT_SHARING_NOT_EFFECTIVE',
      'Posting bagi hasil baru dibuat setelah akad berstatus ACTIVE atau COMPLETED.'
    )
  }

  const pnl = await getProfitLoss(normalizedContract.org_id, '2000-01-01')
  const contracts = await getSyirkahContracts(normalizedContract.org_id)
  const distributionContext = buildSyirkahDistributionContext(contracts as any[], pnl.netProfit || 0)
  const distributionTarget =
    (Array.isArray(contracts) ? contracts.find((item: any) => String(item?.id || '').trim() === normalizedContract.id) : null)
    || normalizedContract
  const distribution = resolveSyirkahContractDistribution(distributionContext, distributionTarget)
  const distributionAmount = toMoneyNumber(distribution.baseAmount)

  if (distribution.baseAmount == null || distributionAmount <= 0) {
    const skipMsg = distribution.source === 'ORG_NET_PROFIT'
      ? 'Laba bersih organisasi saat ini Rp 0. Isi kolom "Alokasi Bagi Hasil" di halaman detail akad, lalu posting ulang.'
      : distribution.message || 'Belum ada nominal bagi hasil positif yang bisa diposting ke Core.'
    return clearLinkedJournal('SYNC_SYIRKAH_PROFIT_SHARING_EMPTY', skipMsg)
  }

  const resolvedAccounts = await resolveSyirkahProfitSharingAccounts(supabase, normalizedContract)
  if (resolvedAccounts.error || !resolvedAccounts.data) {
    return { error: resolvedAccounts.error || 'Akun Core bagi hasil syirkah belum siap.' }
  }

  const { cashAccount, equityAccount } = resolvedAccounts.data
  const existingJournal = await getExistingProfitSharingJournal()
  // Tanggal jurnal mengikuti tanggal 1 dari periode yang diposting, supaya guard periode
  // fiskal yang sudah ditutup mengevaluasi periode yang relevan (bukan selalu "hari ini").
  const entryDate = normalizeSyirkahDate(`${period}-01`)
  const description = buildSyirkahProfitSharingDescription(normalizedContract.title)
  const notes = buildSyirkahProfitSharingNotes(normalizedContract, distribution, distributionAmount, period)

  if (isSyirkahProfitSharingJournalAligned(existingJournal, {
    entryDate,
    description,
    notes,
    cashAccountId: cashAccount.id,
    profitSharingAccountId: equityAccount.id,
    amount: distributionAmount,
    referenceType: 'SYIRKAH_PROFIT_SHARING',
    allowLegacyManualReferenceType: true,
  })) {
    if (
      hasDedicatedColumns
      && (
        normalizedContract.profit_sharing_cash_account_id !== cashAccount.id
        || normalizedContract.profit_sharing_journal_entry_id !== (existingJournal?.id || null)
      )
    ) {
      const persistResult = await persistProfitSharingLink(existingJournal?.id || null)
      if ('error' in persistResult) {
        return { error: 'Gagal menyimpan rekening pembayaran bagi hasil: ' + persistResult.error }
      }
    }

    if (shouldRevalidate) {
      revalidatePath('/syirkah')
      revalidatePath(`/syirkah/${contractId}`)
    }

    return {
      success: true,
      skipped: true,
      entryId: existingJournal?.id || normalizedContract.profit_sharing_journal_entry_id || null,
      entryNumber: existingJournal?.entry_number || null,
      period,
      message: `Posting bagi hasil syirkah periode ${period} di Core sudah sinkron.`,
    }
  }

  // Kebijakan: setiap posting bagi hasil yang tidak persis sama dengan jurnal yang sudah ada
  // WAJIB menjadi jurnal baru dengan tanggal & created_at sendiri — tidak boleh menimpa baris
  // journal_lines yang sudah POSTED (pernah terjadi: dua bagi hasil berbeda di periode yang
  // sama saling menimpa dan salah satunya hilang tanpa jejak). Kalau sudah ada jurnal untuk
  // periode ini, reference_id dibuat unik per-posting supaya tidak bentrok dengan yang lama.
  const newReferenceId = existingJournal?.id ? randomUUID() : periodReferenceId

  const buildProfitSharingJournalPayload = (useLegacyReferenceType = false) => ({
    org_id: normalizedContract.org_id,
    allow_org_scope: true,
    entry_date: entryDate,
    description,
    ...(useLegacyReferenceType ? {} : { reference_type: 'SYIRKAH_PROFIT_SHARING' as const }),
    reference_id: newReferenceId,
    notes,
    auto_post: true,
    skipRevalidate: options.skipRevalidate,
    lines: [
      {
        account_id: equityAccount.id,
        debit: distributionAmount,
        credit: 0,
        memo: `Pembebanan bagi hasil syirkah untuk ${normalizedContract.title || 'akad syirkah'}`,
      },
      {
        account_id: cashAccount.id,
        debit: 0,
        credit: distributionAmount,
        memo: 'Pembayaran bagi hasil syirkah melalui rekening kas/bank',
      },
    ],
  })

  let createResult = await createJournalEntry(buildProfitSharingJournalPayload(!hasDedicatedColumns))
  if (
    (createResult as any).error
    && hasDedicatedColumns
    && isInvalidEnumValueError((createResult as any).error, 'journal_reference_type', 'SYIRKAH_PROFIT_SHARING')
  ) {
    createResult = await createJournalEntry(buildProfitSharingJournalPayload(true))
  }

  // Race condition: dua request nyaris bersamaan bisa berebut reference_id yang sama.
  // Jangan menimpa jurnal yang menang duluan — coba lagi sekali dengan reference_id baru.
  if ((createResult as any).error && isReferenceConstraintError((createResult as any).error)) {
    createResult = await createJournalEntry({
      ...buildProfitSharingJournalPayload(!hasDedicatedColumns),
      reference_id: randomUUID(),
    })
  }

  if ((createResult as any).error || !(createResult as any).entryId) {
    return { error: (createResult as any).error || 'Gagal membuat jurnal bagi hasil syirkah.' }
  }

  const newEntryId = String((createResult as any).entryId)
  const newEntryNumber = String((createResult as any).entryNumber || '')

  const persistResult = await persistProfitSharingLink(newEntryId)
  if ('error' in persistResult) {
    await cleanupSyirkahCoreJournal(supabase, {
      orgId: normalizedContract.org_id,
      entryId: newEntryId,
      userId: String(user.id),
      reason: 'SYNC_SYIRKAH_PROFIT_SHARING_LINK_FAILED',
    })
    return { error: 'Gagal menautkan jurnal bagi hasil ke akad syirkah: ' + persistResult.error }
  }

  // Catatan: jurnal bagi hasil periode ini yang sudah ada sebelumnya (jika ada) SENGAJA
  // tidak disentuh/di-void di sini. Setiap posting adalah transaksi bagi hasil tersendiri
  // dengan tanggal dan nomor jurnalnya sendiri — kalau ada yang keliru, harus di-void manual
  // lewat halaman Jurnal dengan alasan yang jelas, bukan otomatis ditimpa/dihapus oleh sync ini.

  // Anti-silo: catat ke bank_transactions agar Kas & Bank bisa melacak arus keluar ini.
  // Status RECONCILED agar trigger auto-journal tidak aktif (jurnal sudah dibuat di atas).
  try {
    const { data: bankAccountRow } = await (supabase as any)
      .from('bank_accounts')
      .select('id')
      .eq('org_id', normalizedContract.org_id)
      .eq('account_id', cashAccount.id)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()

    if (bankAccountRow?.id) {
      await (supabase as any).from('bank_transactions').insert({
        org_id: normalizedContract.org_id,
        bank_account_id: bankAccountRow.id,
        transaction_date: entryDate,
        description,
        amount: distributionAmount,
        type: 'OUT',
        category_id: equityAccount.id,
        journal_entry_id: newEntryId,
        status: 'RECONCILED',
      })
    }
  } catch {
    // Bank transactions creation tidak wajib; jurnal sudah dibuat
  }

  if (shouldRevalidate) {
    revalidatePath('/cash')
    revalidatePath('/accounting/journal')
    revalidatePath('/syirkah')
    revalidatePath(`/syirkah/${contractId}`)
  }

  return {
    success: true,
    entryId: newEntryId,
    entryNumber: newEntryNumber || null,
    amount: distributionAmount,
    period,
    message: `Bagi hasil syirkah periode ${period} berhasil diposting ke jurnal Core.`,
  }
}

// ─── WITNESSES ───────────────────────────────────────────────────────────────

export async function getSyirkahWitnesses(contractId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('syirkah_witnesses')
    .select('*')
    .eq('contract_id', contractId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Failed to fetch syirkah witnesses:', error)
    return []
  }
  return data
}

export async function upsertSyirkahWitness(contractId: string, payload: SyirkahWitnessPayload) {
  const supabase = await createClient()
  let resolvedId = payload.id || null

  if (!resolvedId) {
    resolvedId = await resolveExistingSyirkahWitnessId(supabase, contractId, payload)
  }

  const persistWitness = async (id: string | null) => {
    return supabase
      .from('syirkah_witnesses')
      .upsert({
        ...(id ? { id } : {}),
        contract_id: contractId,
        witness_name: payload.witness_name,
        gender: payload.gender,
        nik: payload.nik,
        address: payload.address,
        phone: payload.phone,
        updated_at: new Date().toISOString()
      })
      .select()
      .single()
  }

  let { data, error } = await persistWitness(resolvedId)

  if (error && isUniqueConstraintError(error) && !resolvedId) {
    resolvedId = await resolveExistingSyirkahWitnessId(supabase, contractId, payload)
    if (resolvedId) {
      const retryResult = await persistWitness(resolvedId)
      data = retryResult.data
      error = retryResult.error
    }
  }

  if (error) {
    throw new Error('Gagal menyimpan saksi: ' + error.message)
  }

  revalidatePath(`/syirkah/${contractId}`)
  return data
}

export async function deleteSyirkahWitness(id: string, contractId: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('syirkah_witnesses')
    .delete()
    .eq('id', id)

  if (error) {
    throw new Error('Gagal menghapus saksi: ' + error.message)
  }

  revalidatePath(`/syirkah/${contractId}`)
  return true
}

/**
 * Dipanggil dari halaman publik /syirkah-sign/[token] untuk saksi
 */
export async function signSyirkahWitness(witnessToken: string) {
  const supabase = await createClient()

  const { data: witness, error: wErr } = await supabase
    .from('syirkah_witnesses')
    .select('*, contract_id')
    .eq('sign_token', witnessToken)
    .single()

  if (wErr || !witness) {
    return { error: 'Token saksi tidak valid.' }
  }

  if (witness.signed_at) {
    return { error: 'Anda sudah menyaksikan akad ini sebelumnya.' }
  }

  const { error: updateErr } = await supabase
    .from('syirkah_witnesses')
    .update({ signed_at: new Date().toISOString() })
    .eq('id', witness.id)

  if (updateErr) {
    return { error: 'Gagal menyimpan kesaksian: ' + updateErr.message }
  }

  revalidatePath(`/syirkah/${witness.contract_id}`)
  return { success: true, witness }
}

export async function getSyirkahWitnessBySignToken(token: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('syirkah_witnesses')
    .select(`*, syirkah_contracts(*, organizations(name))`)
    .eq('sign_token', token)
    .single()

  if (error) return null
  return data
}

// ─── SIGN CONTRACT ───────────────────────────────────────────────────────────

/**
 * Dipanggil dari halaman publik /syirkah-sign/[memberToken]
 * Mencatat tanda tangan digital anggota berdasarkan sign_token unik.
 */
export async function signSyirkahMember(memberToken: string) {
  const supabase = await createClient()

  // Cari member berdasarkan sign_token
  const { data: member, error: memberErr } = await supabase
    .from('syirkah_members')
    .select('*, contract_id')
    .eq('sign_token', memberToken)
    .single()

  if (memberErr || !member) {
    return { error: 'Token tanda tangan tidak valid atau sudah kedaluwarsa.' }
  }

  if (member.signed_at) {
    return { error: 'Anda sudah menandatangani akad ini sebelumnya.' }
  }

  // Catat tanda tangan
  const { error: updateErr } = await supabase
    .from('syirkah_members')
    .update({ signed_at: new Date().toISOString() })
    .eq('id', member.id)

  if (updateErr) {
    return { error: 'Gagal menyimpan tanda tangan: ' + updateErr.message }
  }

  // Cek apakah semua anggota sudah TTD
  const { data: allMembers } = await supabase
    .from('syirkah_members')
    .select('signed_at')
    .eq('contract_id', member.contract_id)

  const allSigned = allMembers?.every((m: any) => m.signed_at != null)
  if (allSigned) {
    await supabase
      .from('syirkah_contracts')
      .update({
        signed_at: new Date().toISOString(),
        status: 'ACTIVE'
      })
      .eq('id', member.contract_id)
  } else {
    await supabase
      .from('syirkah_contracts')
      .update({
        status: 'SIGNING'
      })
      .eq('id', member.contract_id)
  }

  revalidatePath(`/syirkah/${member.contract_id}`)
  return { success: true, member, allSigned }
}

/**
 * Ambil data member berdasarkan sign_token untuk halaman publik sign.
 */
export async function getSyirkahMemberBySignToken(token: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('syirkah_members')
    .select(`
      *,
      syirkah_contracts(*, organizations(name))
    `)
    .eq('sign_token', token)
    .single()

  if (error) return null
  return data
}


// ─── DASHBOARD ──────────────────────────────────────────────────────────────

export async function getSyirkahDashboardData(orgId: string) {
  try {
    // Ambil all-time Net Profit untuk dasbor Syirkah
    const pnl = await getProfitLoss(orgId, '2000-01-01')
    const netProfit = pnl.netProfit || 0

    // Hitung total aset dan modal syirkah mudharabah (3110) untuk cek capital preservation
    const capitalRows = await queryPostgres<{ total_assets: string; modal_syirkah: string }>(`
      SELECT
        COALESCE(SUM(CASE
          WHEN a.type = 'ASSET' AND a.normal_balance = 'DEBIT'
          THEN GREATEST(jl_agg.total_debit - jl_agg.total_credit, 0)
          WHEN a.type = 'ASSET' AND a.normal_balance = 'CREDIT'
          THEN GREATEST(jl_agg.total_credit - jl_agg.total_debit, 0)
          ELSE 0
        END), 0) AS total_assets,
        COALESCE(SUM(CASE
          WHEN a.code = '3110'
          THEN GREATEST(jl_agg.total_credit - jl_agg.total_debit, 0)
          ELSE 0
        END), 0) AS modal_syirkah
      FROM accounts a
      LEFT JOIN (
        SELECT jl.account_id,
          COALESCE(SUM(CASE WHEN je.status = 'POSTED' THEN jl.debit ELSE 0 END), 0) AS total_debit,
          COALESCE(SUM(CASE WHEN je.status = 'POSTED' THEN jl.credit ELSE 0 END), 0) AS total_credit
        FROM journal_lines jl
        JOIN journal_entries je ON je.id = jl.entry_id AND je.org_id = $1
        GROUP BY jl.account_id
      ) jl_agg ON jl_agg.account_id = a.id
      WHERE a.org_id = $1 AND a.is_active = true
    `, [orgId])

    const totalAssets = Number(capitalRows[0]?.total_assets || 0)
    const totalModalSyirkah = Number(capitalRows[0]?.modal_syirkah || 0)

    const contracts = await getSyirkahContracts(orgId)
    const distributionContext = buildSyirkahDistributionContext(contracts, netProfit, totalAssets, totalModalSyirkah)
    const membersByContract = await Promise.all(
      contracts.map((c: any) => getSyirkahMembers(c.id))
    )

    const totalDebtAllocation = contracts.reduce((acc: number, c: any) => acc + Number(c.debt_allocation || 0), 0)
    const totalCurrentDebt = contracts.reduce((acc: number, c: any) => acc + Number(c.current_debt || 0), 0)

    const allMembers = contracts.map((c: any, i: number) => {
      const parts = membersByContract[i]
      const distribution = resolveSyirkahContractDistribution(distributionContext, c)
      const estimatedNetProfit = distribution.baseAmount
      const distributionStatus = distribution.status

      return {
        contractId: c.id,
        contractTitle: c.title,
        distributionStatus,
        distributionSource: distribution.source,
        distributionMessage: distribution.message,
        estimatedNetProfit,
        members: parts.map((p: any) => ({
          ...p,
          estimatedProfitAmount:
            estimatedNetProfit == null
              ? null
              : (estimatedNetProfit * Number(p.profit_share_percentage || 0)) / 100
        }))
      }
    })

    return {
      netProfit,
      totalAssets,
      totalModalSyirkah,
      totalDebtAllocation,
      totalCurrentDebt,
      distributionContext,
      contracts,
      allMembers
    }
  } catch (error) {
    console.error('Failed to get syirkah dashboard data', error)
    return {
      netProfit: 0,
      totalAssets: 0,
      totalModalSyirkah: 0,
      totalDebtAllocation: 0,
      totalCurrentDebt: 0,
      distributionContext: buildSyirkahDistributionContext([], 0),
      contracts: [],
      allMembers: []
    }
  }
}

// ── Adendum: Alokasi Hutang ───────────────────────────────────────────────────

export async function updateSyirkahDebtAllocation(
  contractId: string,
  orgId: string,
  debtAllocation: number,
  currentDebt: number
) {
  const supabase = await createClient()
  const { error } = await (supabase as any)
    .from('syirkah_contracts')
    .update({
      debt_allocation: debtAllocation,
      current_debt:    currentDebt,
      updated_at:      new Date().toISOString(),
    })
    .eq('id', contractId)
    .eq('org_id', orgId)

  if (error) throw new Error(error.message || 'Gagal menyimpan adendum hutang.')
  revalidatePath(`/syirkah/${contractId}`)
}
