export const ACTIVE_ORG_COOKIE = 'nizam_active_org_id'
export const ACTIVE_BRANCH_COOKIE = 'nizam_active_branch_id'

export type AccessibleOrganization = {
  orgId: string
  role: string
  roleId: string | null
  joinedAt: string
  org: {
    id: string
    name: string
    slug: string
    logo_url: string | null
    settings: unknown
    is_active: boolean
  }
}

export type BranchSummary = {
  id: string
  org_id: string
  name: string
  code: string
  address: string | null
  is_active: boolean
}
