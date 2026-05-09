/**
 * NIZAM Full — Versi Resmi Produk
 *
 * Format: vC.M.A.P
 *   C = Core generation
 *   M = Jumlah modul operasional yang tersedia (otomatis dari registry)
 *   A = Jumlah add-on yang sudah dirilis (otomatis dari registry)
 *   P = Patch count sejak add-on bump terakhir (otomatis dari version log)
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

/** Versi lengkap internal: v1.6.0.3 */
export const NIZAM_VERSION_FULL = `v${NIZAM_VERSION.core}.${NIZAM_VERSION.module}.${NIZAM_VERSION.addon}.${NIZAM_VERSION.patch}`

/** Versi publik ringkas: v1.6.0 */
export const NIZAM_VERSION_SHORT = `v${NIZAM_VERSION.core}.${NIZAM_VERSION.module}.${NIZAM_VERSION.addon}`

/** Label siap pakai untuk UI — NIZAM v1.6.0 (P3) */
export const NIZAM_VERSION_LABEL =
  NIZAM_VERSION.patch > 0
    ? `NIZAM ${NIZAM_VERSION_SHORT} (P${NIZAM_VERSION.patch})`
    : `NIZAM ${NIZAM_VERSION_SHORT}`
