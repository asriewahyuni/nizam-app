import { describe, expect, it } from 'vitest'

import {
  isPlatformAdminEmail,
  isSaasAssessorEmail,
  isSaasMemberEmail,
} from '@/lib/saas/platform-admin'

describe('SaaS platform access helpers', () => {
  it('keeps explicit platform admin access narrow', () => {
    expect(isPlatformAdminEmail('bob@executive.id')).toBe(true)
    expect(isPlatformAdminEmail('assessor@executive.id')).toBe(false)
  })

  it('keeps SaaS membership separate from explicit assessor assignment', () => {
    expect(isSaasMemberEmail('assessor@executive.id')).toBe(true)
    expect(isSaasMemberEmail('assessor@nizam.id')).toBe(true)
    expect(isSaasAssessorEmail('assessor@executive.id')).toBe(false)
    expect(isSaasAssessorEmail('bob@executive.id')).toBe(true)
    expect(isSaasAssessorEmail('owner@tenant.test')).toBe(false)
  })
})
