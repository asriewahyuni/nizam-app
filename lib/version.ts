/**
 * NIZAM Full — Versi Resmi Produk
 *
 * Format: vC.M.A.P
 *   C = Core generation
 *   M = Jumlah modul operasional yang tersedia (otomatis dari registry)
 *   A = Add-on iteration
 *   P = Patch
 *
 * Standar versioning: STANDAR_RESMI_VERSIONING_NIZAM_FULL.md
 */

import { OPERATIONAL_MODULES } from '@/modules/marketplace/lib/module-registry'

export const NIZAM_VERSION = {
  /** Core generation — naik jika fondasi platform berubah */
  core: 1,
  /** Module = jumlah modul operasional yang available di registry */
  module: OPERATIONAL_MODULES.length,
  /** Add-on iteration */
  addon: 0,
  /** Patch */
  patch: 0,
} as const

/** Versi lengkap internal: v1.6.0.0 */
export const NIZAM_VERSION_FULL = `v${NIZAM_VERSION.core}.${NIZAM_VERSION.module}.${NIZAM_VERSION.addon}.${NIZAM_VERSION.patch}`

/** Versi publik ringkas: v1.6.0 */
export const NIZAM_VERSION_SHORT = `v${NIZAM_VERSION.core}.${NIZAM_VERSION.module}.${NIZAM_VERSION.addon}`

/** Label siap pakai untuk UI — NIZAM v1.6.0 */
export const NIZAM_VERSION_LABEL = `NIZAM ${NIZAM_VERSION_SHORT}`
