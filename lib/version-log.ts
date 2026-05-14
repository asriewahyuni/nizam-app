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
  // ║  CURRENT VERSION — N2.6.3.x                                       ║
  // ║  Core=2 (Syirkah pillar), BusinessType=6, Addon=3                 ║
  // ║  Phase 1–3 feature complete milestone                             ║
  // ╚════════════════════════════════════════════════════════════════════╝
  // ── BUMP: module — Phase 1–3 milestone ────────────────────────────
  {
    date: '2026-05-13',
    type: 'module',
    label: 'Phase 3 milestone — Mobile responsive + PWA + Auto FX',
    description: 'Complete Phase 2.4 (Auto FX Gain/Loss) and Phase 3 (Mobile/PWA). ' +
      'Service worker (network-first caching, offline fallback) + PWA registration. ' +
      'Safe area CSS utilities (pb-safe/pt-safe/pl-safe/pr-safe/min-h-safe). ' +
      'Mobile touch target utilities (.touch-target/.touch-table-row). ' +
      'Auto FX Gain/Loss recording on sales + purchase payments. ' +
      'Multi-currency purchases integration (CurrencyPicker, DRAFT/PUBLISH sync). ' +
      'Phase 1 UI Design System:  CSS tokens, utility classes, Form components, loading skeletons. ' +
      'PPN Tax Engine: Bayar Pajak, Download SPT, PKP Settings. ' +
      'Financial Ratios (11 rasio). Multi-currency engine. ' +
      '6 accounting core bug fixes. Child org module independence. ' +
      'LMS CRUD full. Roles page dynamic module filtering.',
    by: 'Z',
  },
  // ── PATCH: Phase 3 Mobile + PWA ──────────────────────────────────
  {
    date: '2026-05-13',
    type: 'patch',
    label: 'PWA Service Worker + Safe Area CSS + Touch Targets',
    description: 'Service worker (public/sw.js): network-first caching, offline fallback, ' +
      'auto-install pada browser modern. Root layout: SW registration inline script. ' +
      'Safe area CSS: pb-safe/pt-safe/pl-safe/pr-safe/minh-safe via env(safe-area-inset-*). ' +
      'Mobile touch targets: .touch-target (44px min) dan .touch-table-row (48px min) ' +
      'aktif via @media (hover: none) and (pointer: coarse). ' +
      'Manifest, viewport, MobileBottomNav, MobilePullToRefresh sudah ada sebelumnya.',
    by: 'Z',
  },
  // ── PATCH: Auto FX Gain/Loss Phase 2.4 ────────────────────────────
  {
    date: '2026-05-13',
    type: 'patch',
    label: 'Auto FX Gain/Loss — Phase 2.4 complete',
    description: 'recordFxGainLoss(): compares exchange rate at transaction vs payment ' +
      'settlement rate, auto-creates gain/loss journal entry. ' +
      'Akun CoA: Laba Selisih Kurs (4-8010), Rugi Selisih Kurs (6-8010). ' +
      'Integrasi: createPurchasePayment + processSalesPayment otomatis record FX. ' +
      'UI: /accounting/forex dengan summary cards + riwayat + hapus. ' +
      'Sidebar: Selisih Kurs (FX) di grup Finance.',
    by: 'Z',
  },
  // ── PATCH: Multi-currency purchases ───────────────────────────────
  {
    date: '2026-05-12',
    type: 'patch',
    label: 'Multi-currency purchases integration — Phase 2.3',
    description: 'CurrencyPicker di purchase form header. CurrencyBadge di list untuk ' +
      'transaksi non-IDR. DRAFT: currency fields di insertPurchaseRecord. ' +
      'PUBLISH: sync via updatePurchaseRecord setelah process_purchase_atomic. ' +
      'Pattern sama dengan sales integration.',
    by: 'Z',
  },
  {
    date: '2026-05-11',
    type: 'patch',
    label: 'UI Design System — CSS tokens + utility classes',
    description: 'Design tokens di globals.css: status colors (success/warning/danger/info), ' +
      'component-level CSS variables (buttons, inputs, tables, cards, modals, badges), ' +
      'utility class .btn (sm/md/lg + 5 variants), .input + .input-error, .table-wrap, .card, ' +
      '.badge (5 variants), .section-header/title/subtitle.',
    by: 'Z',
  },
  // ── PATCH: NizamUI Extended ─────────────────────────────────────────
  {
    date: '2026-05-11',
    type: 'patch',
    label: 'NizamUI: Loading Skeleton, Form Components, ErrorBoundary, PageShell',
    description: 'Komponen baru: Skeleton/TableSkeleton/CardSkeleton/FormSkeleton (loading state), ' +
      'FormField/FormInput/FormSelect/FormTextarea (form konsisten + error state), ' +
      'PageShell (universal page wrapper: title, subtitle, actions, loading skeleton), ' +
      'ErrorBoundary (class component, fallback UI, refresh button).',
    by: 'Z',
  },
  // ── PATCH: Multi-Currency Engine ──────────────────────────────────
  {
    date: '2026-05-11',
    type: 'patch',
    label: 'Feat: Multi Mata Uang — kurs, settings, forex tracking',
    description: 'Sistem multi-currency lengkap: org_currencies (base IDR), ' +
      'org_allowed_currencies (USD/SGD/MYR etc), exchange_rates (riwayat harian). ' +
      'Kolom currency_code + exchange_rate di sales & purchases. ' +
      'Halaman /accounting/currencies: setting base currency, kelola mata uang asing, ' +
      'input kurs manual, tren kurs, riwayat per mata uang.',
    by: 'Z',
  },
  // ── PATCH: Financial Ratios Dashboard ──────────────────────────────
  {
    date: '2026-05-11',
    type: 'patch',
    label: 'Feat: Financial Ratios Dashboard — 11 rasio akuntansi',
    description: 'Halaman /accounting/ratios dengan 11 rasio standar: Likuiditas (Current Ratio, Quick, Cash), ' +
      'Solvabilitas (DER, DAR, Equity Ratio), Profitabilitas (GPM, NPM, ROA, ROE), Efisiensi (OER). ' +
      'Fitur: health score, category tabs, bar chart, gauge bars, auto-interpretation.',
    by: 'Z',
  },
  // ── PATCH: PPN Tax Engine ──────────────────────────────────────────
  {
    date: '2026-05-11',
    type: 'patch',
    label: 'Feat: PPN Tax Engine — Bayar Pajak, Download SPT, PKP Settings',
    description: 'PPN engine full live: (1) PKP settings modal — toggle PKP, NPWP, tarif 11%/12%. ' +
      '(2) Bayar Pajak — pilih rekening bank, auto-generate journal entry ' +
      '(debit PPN Keluaran 2201, credit Kas). (3) Download SPT Masa PPN 1111 ' +
      'format CSV siap DJP Online. (4) Faktur Pajak generation (via tax_invoices table). ' +
      '(5) Migration 1303: org_tax_settings, tax_invoice_numbers, tax_invoices tables + ' +
      'get_spt_ppn_1111() + create_tax_payment_journal() functions. ' +
      'Gantikan semua "Segera Hadir" stubs dengan real functionality.',
    by: 'Z',
  },
  // ── PATCH: accounting core audit fixes ─────────────────────────────
  {
    date: '2026-05-11',
    type: 'patch',
    label: 'Fix: cash_flow_category 1.546 akun NULL',
    description: 'Inject default cash_flow_category (OPERATING/INVESTING/FINANCING) ' +
      'ke 1.546 akun berdasarkan code prefix. Fix cash flow report yang sebelumnya ' +
      'cuma nampilin 54 akun dari 1.600.',
    by: 'Z',
  },
  {
    date: '2026-05-11',
    type: 'patch',
    label: 'Fix: P&L & Neraca pake hardcoded code prefix',
    description: 'Hapus fallback startsWith(\'1\'/2/3/4/5/6/7/8/9) dari filtering ' +
      'revenue/expense/assets/liabilities. Sekarang 100% pake account type. ' +
      'Mencegah misklasifikasi akun kustom.',
    by: 'Z',
  },
  {
    date: '2026-05-11',
    type: 'patch',
    label: 'Fix: cash account detection via bank_accounts FK',
    description: 'Hapus code.startsWith(\'11\') fallback dari getCashAccountCodes. ' +
      'Sekarang cuma pake JOIN bank_accounts.account_id → accounts.code. ' +
      'Akun non-kas yang kodenya mulai 11 gak bakal ke-detek sebagai kas.',
    by: 'Z',
  },
  {
    date: '2026-05-11',
    type: 'patch',
    label: 'Fix: fiscal period closing generates closing JE',
    description: 'generate_period_closing_journal() otomatis bikin closing JE: ' +
      'debit semua Revenue, credit semua Expense, transfer net ke Laba Ditahan (3002). ' +
      'Trigger cegah unclose period kalo udah ada closing journal. ' +
      'CLOSING reference_type ditambahkan ke enum.',
    by: 'Z',
  },
  {
    date: '2026-05-11',
    type: 'patch',
    label: 'Fix: getBalanceSheet gak manggil getProfitLoss 2×',
    description: 'Optimasi query: retained earnings & current profit dihitung langsung ' +
      'dari getPostedEntryIds + getAccountBalancesFromEntries, tanpa bikin ' +
      'koneksi Supabase baru. Load laporan keuangan lebih cepat.',
    by: 'Z',
  },
  {
    date: '2026-05-11',
    type: 'patch',
    label: 'Feat: opening balance system',
    description: 'Table opening_balances + fungsi apply_opening_balances() untuk ' +
      'generate JE opening balance. Validasi balance (debit = credit) sebelum posting. ' +
      'OPENING_BALANCE reference_type ditambahkan ke enum.',
    by: 'Z',
  },
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
    date: '2026-05-10',
    type: 'patch',
    label: 'Fix payroll JE empty lines: RPC fallback for NULL account_id',
    description: 'process_payroll_payment sekarang punya FALLBACK: kalo loop ' +
      'payslip_lines gak menghasilkan baris (karena account_id NULL), ' +
      'otomatis cari akun beban (6001) dan bikin 1 baris jurnal. ' +
      'generate_payslips_for_run juga improved: fallback akun sampe ' +
      'last-resort (any account in org) biar account_id gak pernah NULL.',
    by: 'system',
  },
  {
    date: '2026-05-10',
    type: 'patch',
    label: 'Fix NIK auto-counter: pake all org employees instead of per-branch',
    description: 'getNextNik() sebelumnya cuma liat employees state yang ' +
      'terfilter per branch. Pas ganti branch, counter reset. Sekarang ' +
      'pake prop allEmployees yang isinya SEMUA karyawan se-org (tanpa ' +
      'filter branch), jadi NIK auto-counter akurat secara global.',
    by: 'system',
  },
  {
    date: '2026-05-10',
    type: 'patch',
    label: 'Restruktur arsitektur: 4 pilar + business type + add-on',
    description: 'Modul diorganisir ulang sesuai arahan: ' +
      '4 Pilar (Finance, Operasional container, Marketing, HRIS) selalu aktif. ' +
      'Business Type (Fleet, Manufacturing, Workshop, Job Order, Project, ' +
      'LMS, Syirkah) swapable, hanya 1 aktif. Add-on (POS, Sales Page) ' +
      'multi-aktif. activateModule: swap logic by category. ' +
      'module-registry: category field + BUSINESS_TYPE_MODULES + ADDON_MODULES. ' +
      'Mark: Manufacturing pindah dari core ke business type. ' +
      'POS dan Sales Page pindah dari core ke add-on.',
    by: 'system',
  },
  {
    date: '2026-05-10',
    type: 'patch',
    label: 'Fix LMS tidak muncul di sidebar + entitlement catalog',
    description: 'LMS ditambahkan ke SAAS_ENTITLEMENT_CATALOG dan ' +
      'SAAS_CAPABILITY_COVERAGE. MINIMUM_CORE_KEYS hardcoded diganti ' +
      'dengan PILLAR_MODULES dinamis dari registry. Semua pillar module ' +
      'auto-visible di sidebar. Sidebar module_keys diverifikasi: ' +
      'semua 24 module_keys sudah ada di entitlement catalog.',
    by: 'system',
  },
  {
    date: '2026-05-10',
    type: 'core',
    label: 'Syirkah jadi pillar ke-5 → Core naik N1→N2',
    description: 'Syirkah diangkat jadi pillar (SYIRKAH_MODULES, isCore:true). ' +
      'Category: syirkah. PILLAR_MODULES: Finance + Marketing + HRIS + Syirkah. ' +
      'Version: N2.6.3.x (Core=2, BusinessType=6, Addon=3). ' +
      'ModuleCategory ditambah tipe syirkah. ' +
      'Sidebar: grup Syirkah otomatis muncul via PILLAR_MODULES bypass (always-on).',
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
