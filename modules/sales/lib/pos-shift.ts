/**
 * Shared helpers for POS shift configuration, default account routing,
 * and graceful fallback when the shift schema has not been migrated yet.
 */

export type PosShiftMethod = 'CASH' | 'TRANSFER' | 'QRIS'

export type PosShiftConfig = {
  requireOpenShift: boolean
  enableSettlement: boolean
  defaultRegisterCode: string
  varianceApprovalThreshold: number
}

export type PosAccountOption = {
  id?: string | null
  code?: string | null
  name?: string | null
}

type QueryError = {
  code?: string | null
  message?: string | null
}

function toSettingsRecord(settings: unknown): Record<string, unknown> {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return {}
  return settings as Record<string, unknown>
}

function readBooleanSetting(settings: unknown, key: string, fallback = false): boolean {
  const value = toSettingsRecord(settings)[key]
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (['1', 'true', 'yes', 'on', 'aktif', 'enabled'].includes(normalized)) return true
    if (['0', 'false', 'no', 'off', 'nonaktif', 'disabled'].includes(normalized)) return false
  }
  return fallback
}

function readStringSetting(settings: unknown, key: string, fallback = ''): string {
  const value = toSettingsRecord(settings)[key]
  return typeof value === 'string' ? value.trim() : fallback
}

function readNumberSetting(settings: unknown, key: string, fallback: number): number {
  const value = toSettingsRecord(settings)[key]
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function getPosShiftConfig(settings: unknown): PosShiftConfig {
  return {
    requireOpenShift: readBooleanSetting(settings, 'pos_require_open_shift', false),
    enableSettlement: readBooleanSetting(settings, 'pos_enable_shift_settlement', false),
    defaultRegisterCode: readStringSetting(settings, 'pos_default_register_code', 'REG-1') || 'REG-1',
    varianceApprovalThreshold: Math.max(0, readNumberSetting(settings, 'pos_variance_approval_threshold', 0)),
  }
}

export function isPosShiftFeatureEnabled(config: PosShiftConfig): boolean {
  return config.requireOpenShift || config.enableSettlement
}

export function isPosShiftSchemaMissing(error: QueryError | null | undefined): boolean {
  if (!error) return false

  const code = String(error.code || '')
  const message = String(error.message || '').toLowerCase()

  if (code === '42P01' || code === 'PGRST205' || code === 'PGRST204') {
    return true
  }

  return (
    (
      message.includes('pos_shift_sessions') ||
      message.includes('pos_shift_settlements') ||
      message.includes('pos_session_id') ||
      message.includes('pos_payment_method') ||
      message.includes('pos_amount_tendered') ||
      message.includes('pos_change_amount')
    ) &&
    (
      message.includes('does not exist') ||
      message.includes('schema cache') ||
      message.includes('undefined column') ||
      message.includes('could not find')
    )
  )
}

export function resolveDefaultPosAccount(
  accounts: PosAccountOption[],
  method: PosShiftMethod
): PosAccountOption | null {
  if (!Array.isArray(accounts) || accounts.length === 0) return null

  if (method === 'CASH') {
    return (
      accounts.find((account) => String(account.name || '').toLowerCase().includes('kas pos'))
      || accounts.find((account) => String(account.name || '').toLowerCase().includes('kas kasir'))
      || accounts.find((account) => String(account.code || '').startsWith('1101'))
      || accounts.find((account) => String(account.name || '').toLowerCase().includes('kas'))
      || null
    )
  }

  return (
    accounts.find((account) => String(account.name || '').toLowerCase().includes('qris'))
    || accounts.find((account) => String(account.name || '').toLowerCase().includes('edc'))
    || accounts.find((account) => String(account.name || '').toLowerCase().includes('bank'))
    || accounts.find((account) => String(account.code || '').startsWith('1102'))
    || accounts[0]
    || null
  )
}

export function resolveDefaultPosAccountId(
  accounts: PosAccountOption[],
  method: PosShiftMethod
): string {
  return String(resolveDefaultPosAccount(accounts, method)?.id || '')
}

