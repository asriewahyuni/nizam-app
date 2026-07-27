import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { maskDisplayName } from '../modules/ecommerce/lib/affiliate.server'

describe('LMS Affiliate System Logic', () => {
  describe('maskDisplayName', () => {
    it('should mask full names properly for leaderboard privacy', () => {
      expect(maskDisplayName('Indra Yuliawan')).toBe('Indra Y.***')
      expect(maskDisplayName('Handitya Pradana Putra')).toBe('Handitya P.***')
      expect(maskDisplayName('Meilina')).toBe('Mei***')
      expect(maskDisplayName('Budi')).toBe('Bud***')
      expect(maskDisplayName('')).toBe('Mitra A.***')
      expect(maskDisplayName(null)).toBe('Mitra A.***')
    })
  })
})
