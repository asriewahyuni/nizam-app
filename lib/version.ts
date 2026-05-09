/**
 * NIZAM Full — Versi Resmi Produk
 *
 * Format: vC.M.A.P
 *   C = Core generation
 *   M = Module iteration
 *   A = Add-on iteration
 *   P = Patch
 *
 * Standar versioning: STANDAR_RESMI_VERSIONING_NIZAM_FULL.md
 */

export const NIZAM_VERSION = {
  core: 1,
  module: 1,
  addon: 0,
  patch: 0,
} as const

/** Versi lengkap internal: v1.1.0.0 */
export const NIZAM_VERSION_FULL = `v${NIZAM_VERSION.core}.${NIZAM_VERSION.module}.${NIZAM_VERSION.addon}.${NIZAM_VERSION.patch}`

/** Versi publik ringkas: v1.1.0 */
export const NIZAM_VERSION_SHORT = `v${NIZAM_VERSION.core}.${NIZAM_VERSION.module}.${NIZAM_VERSION.addon}`

/** Label siap pakai untuk UI */
export const NIZAM_VERSION_LABEL = `NIZAM ${NIZAM_VERSION_SHORT}`
