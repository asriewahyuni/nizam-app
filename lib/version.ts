/**
 * NIZAM Full — Versi Resmi Produk
 *
 * Format: NC.M.A.P
 *   C = Core generation
 *   M = Jumlah modul operasional yang tersedia (otomatis dari registry)
 *   A = Jumlah add-on yang sudah dirilis (otomatis dari registry)
 *   P = Patch count (otomatis dari version log)
 *
 * Standar versioning: STANDAR_RESMI_VERSIONING_NIZAM_FULL.md
 */

import { OPERATIONAL_MODULES } from '@/modules/marketplace/lib/module-registry'
import { RELEASED_ADDON_COUNT } from '@/lib/addon-registry'
import { getPatchCount } from '@/lib/version-log'

export const NIZAM_VERSION = {
  /** Core generation — naik jika fondasi platform berubah */
  core: 1,
  /** Module = jumlah modul operasional yang available di registry */
  module: OPERATIONAL_MODULES.length,
  /** Add-on = jumlah add-on yang sudah dirilis */
  addon: RELEASED_ADDON_COUNT,
  /** Patch = auto-count dari version log */
  patch: getPatchCount(),
} as const

/** Versi lengkap internal: N1.6.3.1 */
export const NIZAM_VERSION_FULL = `N${NIZAM_VERSION.core}.${NIZAM_VERSION.module}.${NIZAM_VERSION.addon}.${NIZAM_VERSION.patch}`

/** Versi publik ringkas: N1.6.3 */
export const NIZAM_VERSION_SHORT = `N${NIZAM_VERSION.core}.${NIZAM_VERSION.module}.${NIZAM_VERSION.addon}`

/** Label siap pakai untuk UI — NIZAM N1.6.3.1 */
export const NIZAM_VERSION_LABEL = `NIZAM ${NIZAM_VERSION_FULL}`
