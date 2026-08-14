import { normalizeSaasEntitlementName, saasModuleCoversCapability, saasModuleMatches } from '@/lib/saas/module-catalog'

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
  return /^pos($|[:._-])/.test(permission) || /^canvassing($|[:._-])/.test(permission)
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

  if (hasPosOnlyAccess(input.userRole, input.permissions)) {
    if (hasRolePermission(input.userRole, input.permissions, 'canvassing') && hasEnabledModuleAccess(input.enabledModules, 'Mobile Canvassing')) {
      return '/sales/co-sales'
    }
    if (hasEnabledModuleAccess(input.enabledModules, 'POS')) {
      return '/pos'
    }
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

// Extracted verbatim from app/(dashboard)/layout.tsx's inline route-module
// guard so a route can be moved out of that layout (e.g. into its own PWA
// shell) without losing its access control. Intentionally uses
// saasModuleMatches (exact alias match) rather than hasEnabledModuleAccess
// (which also allows broader saasModuleCoversCapability matches) to keep
// 100% identical behavior for the 25+ existing routeModuleMap entries.
export function checkModuleRouteAccess(input: {
  enabledModules?: string[] | null
  permissions?: string[] | null
  role?: string | null
  requiredModule: string
  aliases?: string[]
  permissionKeys?: string[]
}): boolean {
  const aliasList = input.aliases && input.aliases.length > 0 ? input.aliases : [input.requiredModule]
  const allNames = Array.from(new Set([input.requiredModule, ...aliasList])).map((s) => s.toLowerCase().trim())
  const enabledModules = input.enabledModules

  const isModulePaid = !enabledModules || enabledModules.length === 0
    ? true
    : enabledModules.some((m) => allNames.some((candidate) => saasModuleMatches(m, candidate)))

  if (!isModulePaid) return false

  const permissionKeys = input.permissionKeys || []
  if (permissionKeys.length === 0) return true

  return hasRolePermission(input.role, input.permissions, permissionKeys.join(','))
}
