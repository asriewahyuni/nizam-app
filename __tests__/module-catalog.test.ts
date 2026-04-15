import { describe, expect, it } from 'vitest'

import { normalizeSaasEntitlementName, saasModuleMatches } from '@/lib/saas/module-catalog'

describe('SaaS module catalog', () => {
  it('normalizes Syirkah aliases into one entitlement', () => {
    expect(normalizeSaasEntitlementName('Syirkah')).toBe('Syirkah')
    expect(normalizeSaasEntitlementName('Akad Syirkah')).toBe('Syirkah')
    expect(saasModuleMatches('Akad Syirkah', 'Syirkah')).toBe(true)
  })

  it('normalizes API integration aliases into one entitlement', () => {
    expect(normalizeSaasEntitlementName('Integrasi API')).toBe('Integrasi API')
    expect(normalizeSaasEntitlementName('API & Integrasi')).toBe('Integrasi API')
    expect(saasModuleMatches('API & Integrasi', 'Integrasi API')).toBe(true)
  })
})
