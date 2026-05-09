// NIZAM Full Version Management System
// Format: vC.M.A.P (Core.Module.AddOn.Patch)

export const NIZAM_VERSION = {
  // Full version identifier
  full: 'v1.2.0.0',

  // Semantic components
  core: 1,
  module: 2,
  addon: 0,
  patch: 0,

  // Public-facing short version
  short: 'v1.2.0',

  // Release metadata
  releaseDate: '2026-05-09',
  codeName: 'LMS & Module Expansion',

  // Version category (CORE | MODULE | ADDON | PATCH)
  category: 'MODULE',

  // Major changes in this version
  changes: [
    'LMS (Learning Management System) modul baru - Academy/EDU',
    'HRIS Competency Training - capability training di HR Core',
    'Bengkel Motor (Workshop Operations) - Service Operations vertical',
    'Child CoA & Consolidation Mapping - Accounting enhancement',
    'Marketplace module - Module activation/deactivation',
    'SaaS Settings - Operator pricing configuration',
    'Syirkah profit sharing core posting'
  ],

  // Baseline modules included
  modules: [
    'Job Management',
    'Fleet & Rental',
    'LMS / Academy (NEW)',
    'HRIS Core',
    'Accounting (Finance Core)',
    'Cash Management',
    'Syirkah'
  ]
}

// Helper functions
export function getVersionInfo() {
  return {
    full: NIZAM_VERSION.full,
    short: NIZAM_VERSION.short,
    codeName: NIZAM_VERSION.codeName,
    releaseDate: NIZAM_VERSION.releaseDate,
    category: NIZAM_VERSION.category
  }
}

export function isVersionOrNewer(targetVersion: string): boolean {
  // Compare versions - simple string comparison for now
  // Format: v1.2.0.0
  const parseVersion = (v: string) => {
    const parts = v.replace('v', '').split('.')
    return {
      core: parseInt(parts[0]),
      module: parseInt(parts[1]),
      addon: parseInt(parts[2]),
      patch: parseInt(parts[3] || '0')
    }
  }

  const current = parseVersion(NIZAM_VERSION.full)
  const target = parseVersion(targetVersion)

  if (current.core > target.core) return true
  if (current.core < target.core) return false
  if (current.module > target.module) return true
  if (current.module < target.module) return false
  if (current.addon > target.addon) return true
  if (current.addon < target.addon) return false
  return current.patch >= target.patch
}

export function getVersionSemver(): string {
  // Convert NIZAM versioning to npm semver format
  return `${NIZAM_VERSION.core}.${NIZAM_VERSION.module}.${NIZAM_VERSION.addon}`
}
