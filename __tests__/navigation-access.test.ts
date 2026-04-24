import { describe, expect, it } from 'vitest'

import {
  hasEnabledModuleAccess,
  hasPosOnlyAccess,
  hasRolePermission,
  resolveDefaultAuthorizedRoute,
} from '@/modules/organization/lib/navigation-access'

describe('navigation access helpers', () => {
  it('requires explicit dashboard permission for non-admin users', () => {
    expect(hasRolePermission('staff', ['pos:read', 'pos:write'], 'dashboard')).toBe(false)
    expect(hasRolePermission('staff', ['dashboard:read'], 'dashboard')).toBe(true)
  })

  it('keeps owner and admin access unrestricted', () => {
    expect(hasRolePermission('owner', [], 'dashboard')).toBe(true)
    expect(hasRolePermission('admin', [], 'syirkah')).toBe(true)
  })

  it('checks module entitlement before exposing specialized routes', () => {
    expect(hasEnabledModuleAccess(['POS', 'Sales'], 'Syirkah')).toBe(false)
    expect(hasEnabledModuleAccess(['Syirkah'], 'Syirkah')).toBe(true)
  })

  it('routes POS-only users away from dashboard to POS', () => {
    expect(resolveDefaultAuthorizedRoute({
      userRole: 'staff',
      permissions: ['pos:read', 'pos:write'],
      enabledModules: ['POS'],
    })).toBe('/pos')
  })

  it('detects POS-only roles without blocking POS plus other permissions', () => {
    expect(hasPosOnlyAccess('staff', ['pos:read', 'pos:write'])).toBe(true)
    expect(hasPosOnlyAccess('staff', ['pos:read', 'sales:read'])).toBe(false)
    expect(hasPosOnlyAccess('owner', ['pos:read', 'pos:write'])).toBe(false)
  })

  it('falls back to profile when no module permission is granted', () => {
    expect(resolveDefaultAuthorizedRoute({
      userRole: 'staff',
      permissions: [],
      enabledModules: ['POS'],
    })).toBe('/profil-saya')
  })
})
