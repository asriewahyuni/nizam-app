import { describe, expect, it } from 'vitest'

import { getPosShiftConfig, isPosShiftSchemaMissing, resolveDefaultPosAccountId } from '@/modules/sales/lib/pos-shift'

describe('pos shift helpers', () => {
  it('parses shift settings safely from organization settings json', () => {
    const config = getPosShiftConfig({
      pos_require_open_shift: true,
      pos_enable_shift_settlement: 'true',
      pos_default_register_code: 'KASIR-01',
      pos_variance_approval_threshold: '150000',
    })

    expect(config).toEqual({
      requireOpenShift: true,
      enableSettlement: true,
      defaultRegisterCode: 'KASIR-01',
      varianceApprovalThreshold: 150000,
    })
  })

  it('falls back to legacy-safe defaults when settings are absent', () => {
    expect(getPosShiftConfig(null)).toEqual({
      requireOpenShift: false,
      enableSettlement: false,
      defaultRegisterCode: 'REG-1',
      varianceApprovalThreshold: 0,
    })
  })

  it('resolves default cash and digital accounts without crashing', () => {
    const accounts = [
      { id: 'acc-cash', code: '1101-01', name: 'Kas POS Depan' },
      { id: 'acc-bank', code: '1102-01', name: 'Bank Operasional' },
    ]

    expect(resolveDefaultPosAccountId(accounts, 'CASH')).toBe('acc-cash')
    expect(resolveDefaultPosAccountId(accounts, 'TRANSFER')).toBe('acc-bank')
    expect(resolveDefaultPosAccountId(accounts, 'QRIS')).toBe('acc-bank')
  })

  it('detects missing shift schema from postgres errors', () => {
    expect(isPosShiftSchemaMissing({
      code: '42P01',
      message: 'relation "public.pos_shift_sessions" does not exist',
    })).toBe(true)

    expect(isPosShiftSchemaMissing({
      code: 'PGRST204',
      message: "Could not find the 'pos_session_id' column of 'sales' in the schema cache",
    })).toBe(true)
  })
})

