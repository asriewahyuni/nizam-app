/**
 * Version Log — NIZAM Full
 *
 * Satu-satunya tempat mencatat perubahan versi.
 * Patch count = jumlah entry type 'patch' sejak bump terakhir.
 *
 * Aturan:
 * - entry type 'core' → reset M, A, P = 0
 * - entry type 'module' → reset A, P = 0
 * - entry type 'addon' → reset P = 0
 * - entry type 'patch' → increment P
 *
 * Cara pakai:
 *   1. Setelah melakukan perubahan, tambah entry baru di bawah.
 *   2. Jangan ubah entry lama (immutable).
 *   3. Urutkan dari TERBARU ke TERLAMA.
 */

export type VersionLogEntryType = 'core' | 'module' | 'addon' | 'patch'

export interface VersionLogEntry {
  /** Tanggal dalam format YYYY-MM-DD */
  date: string
  /** Tipe perubahan */
  type: VersionLogEntryType
  /** Label singkat (maks 1 baris) */
  label: string
  /** Deskripsi detail (boleh multi-baris) */
  description: string
  /** Pelaku (default: 'system') */
  by?: string
}

// ═════════════════════════════════════════════════════════════════════════════
// VERSION LOG — ENTRIES PALING ATAS = PALING BARU
// ═════════════════════════════════════════════════════════════════════════════

export const VERSION_LOG: VersionLogEntry[] = [
  // ── v1.6.0.x — (patch auto-count) ─────────────────────────────────────
  {
    date: '2026-05-09',
    type: 'patch',
    label: 'Add-on registry + auto-count versioning',
    description: 'Buat lib/addon-registry.ts sebagai sumber kebenaran add-on. ' +
      'Add-on count otomatis dari RELEASED_ADDON_COUNT (filter a.released). ' +
      'Saat ini semua add-on masih planned (A=0).',
    by: 'system',
  },
  {
    date: '2026-05-09',
    type: 'patch',
    label: 'Version changelog + patch auto-count',
    description: 'Buat lib/version-log.ts dengan VERSION_LOG entries. ' +
      'Patch count = jumlah entry type patch sejak non-patch terakhir. ' +
      'Setiap perubahan dicatat di sini, patch naik otomatis.',
    by: 'system',
  },
  {
    date: '2026-05-09',
    type: 'patch',
    label: 'Version Integrity Button di header',
    description: 'Buat VersionIntegrityButton.tsx — tombol di header yang ' +
      'buka modal berisi: ringkasan versi, daftar modul operasional, ' +
      'daftar add-on (status rilis/planned), dan changelog lengkap. ' +
      'User bisa lihat semua perubahan secara transparan.',
    by: 'system',
  },
  {
    date: '2026-05-09',
    type: 'patch',
    label: 'Version M auto-count dari operational module registry',
    description: 'Segmen M (Module) sekarang otomatis menghitung jumlah modul operasional ' +
      'dari OPERATIONAL_MODULES.length di module-registry.ts. ' +
      'Hasil: M = 6 (Fleet, Workshop, Job Order, Project, LMS, Syirkah).',
    by: 'system',
  },
  {
    date: '2026-05-09',
    type: 'patch',
    label: 'Generic onboarding setup page for all operational modules',
    description: 'Buat halaman setup generik di /marketplace/setup/[moduleKey] ' +
      'dengan wizard: aktivasi → CoA install → settings → selesai. ' +
      'Sidebar pending module redirect ke halaman setup.',
    by: 'system',
  },
  {
    date: '2026-05-09',
    type: 'patch',
    label: 'Fix module activation client-side refresh',
    description: 'ActivateModuleButton dan DeactivateModuleButton sekarang ' +
      'panggil router.refresh() setelah sukses, biar UI langsung update.',
    by: 'system',
  },
  {
    date: '2026-05-09',
    type: 'patch',
    label: 'Add version badge to AppHeader',
    description: 'NIZAM v1.x.x badge di pojok kanan atas header (antara notifikasi dan avatar).',
    by: 'system',
  },
  // ── v1.0.0.0 ────────────────────────────────────────────────────────────
  {
    date: '2026-04-30',
    type: 'core',
    label: 'Initial release NIZAM Full v1.0.0.0',
    description: 'Core generation pertama. Fondasi platform: auth, multi-tenant, ' +
      'roles/permissions, business settings, dashboard shell.',
    by: 'system',
  },
]

/** Ambil patch count: jumlah entry 'patch' sejak tipe non-patch terakhir */
export function getPatchCount(): number {
  let count = 0
  for (const entry of VERSION_LOG) {
    if (entry.type === 'patch') {
      count++
    } else {
      // Reset: hitungan patch mulai dari entry non-patch ini
      break
    }
  }
  return count
}
