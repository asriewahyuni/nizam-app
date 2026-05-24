import { normalizeSaasEntitlementName, saasModuleCoversCapability } from '@/lib/saas/module-catalog'

type NavigationAccessInput = {
  userRole?: string | null
  permissions?: string[] | null
  enabledModules?: string[] | null
}

type LandingCandidate = {
  href: string
  permissionKey?: string
  moduleKey?: string
}

const DEFAULT_LANDING_CANDIDATES: LandingCandidate[] = [
  { href: '/dashboard', permissionKey: 'dashboard' },
  { href: '/pos', permissionKey: 'pos', moduleKey: 'POS' },
  { href: '/sales', permissionKey: 'sales', moduleKey: 'Sales' },
  { href: '/sales/quotations', permissionKey: 'quotation', moduleKey: 'Sales' },
  { href: '/contacts', permissionKey: 'crm', moduleKey: 'CRM' },
  { href: '/reports', permissionKey: 'reports', moduleKey: 'Reports' },
  { href: '/cash', permissionKey: 'bank', moduleKey: 'Finance' },
  { href: '/purchasing', permissionKey: 'purchasing', moduleKey: 'Purchasing' },
  { href: '/inventory', permissionKey: 'inventory', moduleKey: 'Inventory' },
  { href: '/hris', permissionKey: 'employees', moduleKey: 'HRIS' },
  { href: '/learning', permissionKey: 'learning', moduleKey: 'HRIS' },
  { href: '/construction', permissionKey: 'construction,project,services', moduleKey: 'Project & Construction' },
  { href: '/syirkah', permissionKey: 'syirkah', moduleKey: 'Syirkah' },
  { href: '/karyawan' },
  { href: '/profil-saya' },
]

function normalizeRole(value?: string | null) {
  return String(value || '').trim().toLowerCase()
}

function normalizePermissionList(permissions?: string[] | null) {
  return Array.isArray(permissions)
    ? permissions
        .filter((permission): permission is string => typeof permission === 'string')
        .map((permission) => permission.trim().toLowerCase())
        .filter(Boolean)
    : []
}

function isPosPermission(permission: string) {
  return /^pos($|[:._-])/.test(permission)
}

function normalizeEnabledModuleList(enabledModules?: string[] | null) {
  return Array.isArray(enabledModules)
    ? enabledModules
        .filter((moduleName): moduleName is string => typeof moduleName === 'string')
        .map((moduleName) => moduleName.trim())
        .filter(Boolean)
    : []
}

export function hasRolePermission(
  userRole: string | null | undefined,
  permissions: string[] | null | undefined,
  permissionKey?: string | null
) {
  const normalizedRole = normalizeRole(userRole)
  if (normalizedRole === 'owner' || normalizedRole === 'admin') return true

  const normalizedPermissionKey = String(permissionKey || '').trim().toLowerCase()
  if (!normalizedPermissionKey) return false

  const requiredPermissions = normalizedPermissionKey
    .split(',')
    .map((key) => key.trim())
    .filter(Boolean)

  if (!requiredPermissions.length) return false

  const normalizedPermissions = normalizePermissionList(permissions)
  return normalizedPermissions.some((permission) =>
    requiredPermissions.some((requiredPermission) => permission.includes(requiredPermission))
  )
}

export function hasPosOnlyAccess(
  userRole: string | null | undefined,
  permissions: string[] | null | undefined
) {
  const normalizedRole = normalizeRole(userRole)
  if (normalizedRole === 'owner' || normalizedRole === 'admin') return false

  const normalizedPermissions = normalizePermissionList(permissions)
  if (!normalizedPermissions.some(isPosPermission)) return false

  return normalizedPermissions.every(isPosPermission)
}

export function hasEnabledModuleAccess(
  enabledModules: string[] | null | undefined,
  moduleKey?: string | null
) {
  const normalizedModuleKey = String(moduleKey || '').trim()
  if (!normalizedModuleKey) return true

  const normalizedEnabledModules = normalizeEnabledModuleList(enabledModules)
  if (!normalizedEnabledModules.length) return true

  return normalizedEnabledModules.some((moduleName) => {
    const normalizedEnabled = normalizeSaasEntitlementName(moduleName)
    if (normalizedEnabled.toLowerCase() === normalizedModuleKey.toLowerCase()) {
      return true
    }

    return saasModuleCoversCapability(moduleName, normalizedModuleKey)
  })
}

export function resolveDefaultAuthorizedRoute(input: NavigationAccessInput) {
  const normalizedRole = normalizeRole(input.userRole)
  if (normalizedRole === 'owner' || normalizedRole === 'admin') {
    return '/dashboard'
  }

  if (hasPosOnlyAccess(input.userRole, input.permissions) && hasEnabledModuleAccess(input.enabledModules, 'POS')) {
    return '/pos'
  }

  for (const candidate of DEFAULT_LANDING_CANDIDATES) {
    if (candidate.permissionKey && !hasRolePermission(input.userRole, input.permissions, candidate.permissionKey)) {
      continue
    }

    if (candidate.moduleKey && !hasEnabledModuleAccess(input.enabledModules, candidate.moduleKey)) {
      continue
    }

    return candidate.href
  }

  return '/profil-saya'
}
