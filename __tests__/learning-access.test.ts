import { describe, expect, it } from 'vitest'

import { resolveLearningRoleAccess } from '@/modules/edu/lib/learning-access'

describe('resolveLearningRoleAccess', () => {
  it('grants read access for learning readers', () => {
    expect(resolveLearningRoleAccess('staff', ['learning:read'])).toEqual({
      canRead: true,
      canManage: false,
    })
  })

  it('grants read and manage access for learning writers', () => {
    expect(resolveLearningRoleAccess('staff', ['learning:write'])).toEqual({
      canRead: true,
      canManage: true,
    })
  })

  it('keeps owner access unrestricted', () => {
    expect(resolveLearningRoleAccess('owner', [])).toEqual({
      canRead: true,
      canManage: true,
    })
  })

  it('denies access when no learning permission is present', () => {
    expect(resolveLearningRoleAccess('staff', ['sales:read'])).toEqual({
      canRead: false,
      canManage: false,
    })
  })
})
