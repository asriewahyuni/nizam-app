/**
 * Version Log — NIZAM Full
 *
 * Mencatat setiap perubahan sistem dengan version tracking.
 * Patch count = jumlah entry 'patch' dalam versi saat ini.
 *
 * Aturan:
 * - Setiap bump (core/module/addon) menaikkan versi → reset patch
 * - Patch entries di bawah bump entry = milik versi itu
 * - Wajib diupdate setiap kali ada perubahan
 *
 * Cara pakai:
 *   1. Bump versi → tambah entry type 'core'/'module'/'addon' di PALING ATAS
 *   2. Patch → tambah entry type 'patch' setelah bump entry
 *   3. Urutkan dari TERBARU ke TERLAMA
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

/**
 * ═════════════════════════════════════════════════════════════════════════════
 * VERSION LOG — ENTRIES PALING ATAS = PALING BARU
 *
 * STRUKTUR:
 *   [BUMP entry — core|module|addon]  ← menandai versi baru
 *   [patch entries...]                  ← patch dalam versi ini
 *   ─────────────────────
 *   [BUMP entry sebelumnya]
 *   [patch entries...]
 *   ...
 * ═════════════════════════════════════════════════════════════════════════════
 */

export const VERSION_LOG: VersionLogEntry[] = [
  // ╔════════════════════════════════════════════════════════════════════╗
  // ║  CURRENT VERSION — N1.6.3.x                                       ║
  // ║  Core=1, Module=6, Addon=3                                       ║
  // ╚════════════════════════════════════════════════════════════════════╝
  // ── BUMP: addon ─────────────────────────────────────────────────────
  {
    date: '2026-05-09',
    type: 'addon',
    label: 'Rilis 3 add-on: POS, Sales Page, Quick Bill',
    description: 'POS, Sales Page, dan Quick Bill di-set released: true. ' +
      'Add-on count naik dari 0 ke 3. Versi: v1.6.0.x → v1.6.3.x.',
    by: 'system',
  },
  // ── Patches dalam v1.6.3.x ──────────────────────────────────────────
  {
    date: '2026-05-10',
    type: 'patch',
    label: 'Roleplay: Payroll empty JE + branch budget bug',
    description: 'process_payroll_payment RPC creates JE header but 0 journal lines. ' +
      'Adjusting journal entries needed manually. Also fixed employee salary ' +
      'concatenation bug (CurrencyInput missing name prop).',
    by: 'system',
  },
  {
    date: '2026-05-10',
    type: 'patch',
    label: 'Roleplay: Fixed Budi Santoso salary in production via direct DB',
    description: 'Employee Budi Santoso had salary Rp 1.112.223.331 instead of ' +
      'Rp 10.000.000. Deleted and recreated via direct PostgreSQL on Railway. ' +
      'NIK cross-branch uniqueness issue found (counter resets per branch).',
    by: 'system',
  },
  {
    date: '2026-05-10',
    type: 'patch',
    label: 'Roleplay: Dropped uq_payroll_period_per_org constraint',
    description: 'Unique constraint (org_id, period_start, period_end) prevented ' +
      'creating payroll runs for different branches in same period. ' +
      'Should include branch_id. Constraint dropped via ALTER TABLE.',
    by: 'system',
  },
  {
    date: '2026-05-09',
    type: 'patch',
    label: 'Fix core module visibility + aktivasi',
    description: 'MINIMUM_CORE_MODULES bypass di sidebar (Accounting, Finance, ' +
      'Inventory, CRM, Reports selalu muncul). CoreModuleCard di marketplace ' +
      'nampilin status Aktif/Aktifkan. ActivateCoreModuleButton client component.',
    by: 'system',
  },
  {
    date: '2026-05-09',
    type: 'patch',
    label: 'Fix aktivasi modul langsung redirect ke halaman setup',
    description: 'ActivateModuleButton sekarang pake router.push() ke ' +
      '/marketplace/setup/{moduleKey} setelah aktivasi, bukan router.refresh(). ' +
      'User langsung masuk wizard setup tanpa perlu klik "Selesaikan Setup" manual.',
    by: 'system',
  },
  {
    date: '2026-05-09',
    type: 'patch',
    label: 'Fix pop-up modal: X button ga kelihatan',
    description: 'X button diubah jadi sticky top-4 float-right dengan ' +
      'background putih solid + border + shadow. Backdrop bg-black/60 tanpa blur.',
    by: 'system',
  },

  // ╔════════════════════════════════════════════════════════════════════╗
  // ║  v1.6.0.x — Core=1, Module=6, Addon=0                            ║
  // ╚════════════════════════════════════════════════════════════════════╝
  // ── BUMP: module ────────────────────────────────────────────────────
  {
    date: '2026-05-09',
    type: 'module',
    label: 'Version M auto-count dari operational module registry',
    description: 'Segmen M (Module) sekarang otomatis menghitung jumlah modul operasional ' +
      'dari OPERATIONAL_MODULES.length di module-registry.ts. ' +
      'Hasil: M = 6 (Fleet, Workshop, Job Order, Project, LMS, Syirkah).',
    by: 'system',
  },
  // ── Patches dalam v1.6.0.x ──────────────────────────────────────────
  {
    date: '2026-05-09',
    type: 'patch',
    label: 'Add-on registry + auto-count versioning',
    description: 'Buat lib/addon-registry.ts sebagai sumber kebenaran add-on. ' +
      'Add-on count otomatis dari RELEASED_ADDON_COUNT (filter a.released).',
    by: 'system',
  },
  {
    date: '2026-05-09',
    type: 'patch',
    label: 'Version changelog + patch auto-count infrastructure',
    description: 'Buat lib/version-log.ts dengan VERSION_LOG entries. ' +
      'Patch count otomatis dari log entries.',
    by: 'system',
  },
  {
    date: '2026-05-09',
    type: 'patch',
    label: 'Version Integrity Button di header',
    description: 'Buat VersionIntegrityButton.tsx — tombol header yang ' +
      'buka modal berisi ringkasan versi + changelog transparan.',
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

  // ╔════════════════════════════════════════════════════════════════════╗
  // ║  v1.0.0.0 — Initial Release                                      ║
  // ╚════════════════════════════════════════════════════════════════════╝
  // ── BUMP: core ──────────────────────────────────────────────────────
  {
    date: '2026-04-30',
    type: 'core',
    label: 'Initial release NIZAM Full v1.0.0.0',
    description: 'Core generation pertama. Fondasi platform: auth, multi-tenant, ' +
      'roles/permissions, business settings, dashboard shell.',
    by: 'system',
  },
]

/**
 * Patch count = jumlah entry 'patch' di antara bump teratas (current version)
 * dan bump di bawahnya (previous version).
 *
 * Cara baca log (newest-first):
 *   1. Skip entry pertama jika dia bump (current version marker)
 *   2. Hitung patch entries sampai ketemu bump berikutnya (previous version)
 *   3. Berhenti di situ
 */
export function getPatchCount(): number {
  let count = 0
  let currentVersionBumpSeen = false

  for (const entry of VERSION_LOG) {
    if (!currentVersionBumpSeen) {
      // Skip the first bump entry (current version marker)
      if (entry.type === 'core' || entry.type === 'module' || entry.type === 'addon') {
        currentVersionBumpSeen = true
      }
      continue
    }

    // Now we're past the current version marker
    if (entry.type === 'patch') {
      count++
    } else if (entry.type === 'core' || entry.type === 'module' || entry.type === 'addon') {
      // Hit previous version bump — stop
      break
    }
  }

  return count
}
