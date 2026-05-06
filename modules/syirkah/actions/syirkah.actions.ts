'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getProfitLoss } from '@/modules/accounting/actions/reports.actions'
import { createJournalEntry } from '@/modules/accounting/actions/journal.actions'
import {
  buildSyirkahDistributionContext,
  resolveSyirkahContractDistribution,
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
  core_cash_account_id?: string | null
  core_equity_account_id?: string | null
  core_journal_entry_id?: string | null
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

type SyirkahCoreJournalDetail = SyirkahCoreJournalSummary & {
  reference_type?: string | null
  lines: Array<{
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
    .select('account_id, debit, credit')
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
      account_id: String(line.account_id || ''),
      debit: toMoneyNumber(line.debit),
      credit: toMoneyNumber(line.credit),
    })),
  }
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

  const { data, error } = await supabase
    .from('syirkah_contracts')
    .upsert({
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
      updated_at: new Date().toISOString()
    })
    .select()
    .single()

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
  const { data: contract, error: fetchError } = await (supabase as any)
    .from('syirkah_contracts')
    .select('id, org_id, status, core_journal_entry_id')
    .eq('id', contractId)
    .eq('org_id', orgId)
    .maybeSingle()

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

    const contracts = await getSyirkahContracts(orgId)
    const distributionContext = buildSyirkahDistributionContext(contracts, netProfit)
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
      totalDebtAllocation: 0,
      totalCurrentDebt: 0,
      distributionContext: buildSyirkahDistributionContext([], 0),
      contracts: [],
      allMembers: []
    }
  }
}
