import { describe, expect, it } from 'vitest'

import {
  buildSyirkahDistributionContext,
  getSyirkahContractEstimatedNetProfit,
  resolveSyirkahContractDistribution,
  resolveSyirkahContractDistributionStatus,
} from '@/modules/syirkah/lib/syirkah.utils'

describe('syirkah distribution helpers', () => {
  it('waits until there is an active or completed contract', () => {
    const context = buildSyirkahDistributionContext([
      { id: 'akad-1', status: 'DRAFT' },
      { id: 'akad-2', status: 'SIGNING' },
    ], 1250000)

    expect(context.mode).toBe('WAITING_ACTIVE_CONTRACT')
    expect(context.activeContractIds).toEqual([])
    expect(getSyirkahContractEstimatedNetProfit(context, 'akad-1')).toBeNull()
    expect(resolveSyirkahContractDistributionStatus(context, 'akad-1', 'DRAFT')).toBe('WAITING_ACTIVE')
  })

  it('allocates the net profit only when a single contract is active', () => {
    const context = buildSyirkahDistributionContext([
      { id: 'akad-1', status: 'ACTIVE' },
      { id: 'akad-2', status: 'DRAFT' },
    ], 2500000)

    expect(context.mode).toBe('SINGLE_ACTIVE_CONTRACT')
    expect(getSyirkahContractEstimatedNetProfit(context, 'akad-1')).toBe(2500000)
    expect(getSyirkahContractEstimatedNetProfit(context, 'akad-2')).toBeNull()
    expect(resolveSyirkahContractDistributionStatus(context, 'akad-1', 'ACTIVE')).toBe('ESTIMATED')
    expect(resolveSyirkahContractDistributionStatus(context, 'akad-2', 'DRAFT')).toBe('WAITING_ACTIVE')
  })

  it('blocks per-contract auto allocation when multiple contracts are active', () => {
    const context = buildSyirkahDistributionContext([
      { id: 'akad-1', status: 'ACTIVE' },
      { id: 'akad-2', status: 'COMPLETED' },
    ], 3100000)

    expect(context.mode).toBe('MULTIPLE_ACTIVE_CONTRACTS')
    expect(getSyirkahContractEstimatedNetProfit(context, 'akad-1')).toBeNull()
    expect(resolveSyirkahContractDistributionStatus(context, 'akad-1', 'ACTIVE')).toBe('MULTIPLE_ACTIVE_UNALLOCATED')
    expect(resolveSyirkahContractDistributionStatus(context, 'akad-2', 'COMPLETED')).toBe('MULTIPLE_ACTIVE_UNALLOCATED')
  })

  it('prefers manual profit-sharing allocation over organization net profit', () => {
    const context = buildSyirkahDistributionContext([
      { id: 'akad-1', status: 'ACTIVE', profit_sharing_allocation: 3500000 },
    ], 11000000)

    expect(resolveSyirkahContractDistribution(context, {
      id: 'akad-1',
      status: 'ACTIVE',
      profit_sharing_allocation: 3500000,
    })).toEqual({
      status: 'ESTIMATED',
      source: 'MANUAL_ALLOCATION',
      baseAmount: 3500000,
      message: 'Pembagian akad ini memakai nominal alokasi bagi hasil manual, bukan seluruh laba bersih organisasi.',
    })
  })
})
