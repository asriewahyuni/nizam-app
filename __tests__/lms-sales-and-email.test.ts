import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { DEFAULT_TENANT_EMAIL_CONFIG } from '../modules/notifications/email-settings.server'

describe('LMS Sales and Email Settings Logic', () => {
  it('should have correct default tenant email configuration and triggers', () => {
    expect(DEFAULT_TENANT_EMAIL_CONFIG.provider).toBe('MAILKETING')
    expect(DEFAULT_TENANT_EMAIL_CONFIG.triggers.orderCreated).toBe(true)
    expect(DEFAULT_TENANT_EMAIL_CONFIG.triggers.orderPaid).toBe(true)
    expect(DEFAULT_TENANT_EMAIL_CONFIG.triggers.accountClaim).toBe(true)
    expect(DEFAULT_TENANT_EMAIL_CONFIG.triggers.certificateIssued).toBe(true)
    expect(DEFAULT_TENANT_EMAIL_CONFIG.triggers.affiliatePayout).toBe(true)
  })
})
