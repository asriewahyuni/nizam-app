/**
 * Module Registry — Nizam App
 * Sumber kebenaran tunggal untuk semua modul yang tersedia di marketplace.
 *
 * ARSITEKTUR 5 PILAR (wajib, selalu aktif):
 *   1. Finance    → Accounting, Kas & Bank, Purchasing, Inventory, Warehouse, Reports, Audit
 *   2. Operasional → Container, isinya Business Type (swapable)
 *   3. Marketing   → Sales, CRM
 *   4. HRIS       → Karyawan & Payroll
 *   5. Syirkah    → Kemitraan & Bagi Hasil
 *
 * BUSINESS TYPE (isi Operasional, swapable, hanya 1 aktif):
 *   Fleet & Rental, Manufacturing, Workshop, Job Order, Project, LMS
 *
 * ADD-ON (multi-aktif, tidak ngaruh business type):
 *   POS, Sales Page, Ecommerce, Quick Bill, Service
 */

export type OnboardingStep = {
  id: string
  title: string
  description: string
}

export type ModuleCategory = 'finance' | 'operasional' | 'marketing' | 'hris' | 'syirkah' | 'business_type' | 'addon' | 'special'

export type ModuleDefinition = {
  key: string
  name: string
  tagline: string
  description: string
  icon: string
  color: string
  href: string
  isCore: boolean
  category: ModuleCategory
  isAddon?: boolean        // true = add-on (multi-aktif, tidak swap)
  coaInjectionFn?: string
  defaultSettings?: Record<string, any>
  onboardingSteps: OnboardingStep[]
  tags?: string[]
  requires?: string[]
}

// ── FINANCE PILLAR ─────────────────────────────────────────────────────────
export const FINANCE_MODULES: ModuleDefinition[] = [
  {
    key: 'Accounting',
    name: 'Akuntansi & Jurnal',
    tagline: 'Buku besar, jurnal, dan laporan keuangan PSAK',
    description: 'Pencatatan jurnal otomatis dari setiap transaksi, buku besar, laporan laba rugi, neraca, dan arus kas.',
    icon: '📒',
    color: 'bg-blue-500',
    href: '/accounting/journal',
    isCore: true,
    category: 'finance',
    onboardingSteps: [],
    requires: [],
  },
  {
    key: 'Finance',
    name: 'Kas & Keuangan',
    tagline: 'Kelola kas, bank, piutang, dan utang',
    description: 'Manajemen kas dan bank, rekonsiliasi, aging AR/AP, aset tetap, dan reimbursement.',
    icon: '💰',
    color: 'bg-emerald-500',
    href: '/cash',
    isCore: true,
    category: 'finance',
    onboardingSteps: [],
    requires: ['Accounting'],
  },
  {
    key: 'Purchasing',
    name: 'Pembelian',
    tagline: 'Purchase order, penerimaan, dan hutang dagang',
    description: 'Alur pembelian lengkap dari PO, penerimaan barang, hingga hutang dagang dan pembayaran supplier.',
    icon: '🛒',
    color: 'bg-orange-500',
    href: '/purchasing',
    isCore: true,
    category: 'finance',
    onboardingSteps: [],
    requires: ['Inventory', 'Finance'],
  },
  {
    key: 'Inventory',
    name: 'Inventori & Stok',
    tagline: 'Stok, valuasi, dan mutasi persediaan',
    description: 'Pencatatan stok masuk/keluar, penilaian persediaan (FIFO/Average), adjustment, dan laporan mutasi.',
    icon: '📦',
    color: 'bg-amber-500',
    href: '/inventory',
    isCore: true,
    category: 'finance',
    onboardingSteps: [],
    requires: [],
  },
  {
    key: 'Warehouse',
    name: 'Gudang (WMS)',
    tagline: 'Manajemen multi-gudang dan lokasi stok',
    description: 'Warehouse Management System: multi-lokasi stok, transfer antar gudang, dan scanning barcode.',
    icon: '🏬',
    color: 'bg-yellow-700',
    href: '/inventory/warehouses',
    isCore: true,
    category: 'finance',
    onboardingSteps: [],
    requires: ['Inventory'],
  },
  {
    key: 'Reports',
    name: 'Laporan & Insight',
    tagline: 'Laporan keuangan dan analitik bisnis',
    description: 'Laporan Laba Rugi, Neraca, Arus Kas, Trial Balance, analitik penjualan, dan dashboard eksekutif.',
    icon: '📊',
    color: 'bg-rose-600',
    href: '/reports',
    isCore: true,
    category: 'finance',
    onboardingSteps: [],
    requires: ['Accounting', 'Finance'],
  },
  {
    key: 'Audit',
    name: 'Audit & Stock Opname',
    tagline: 'Audit trail, stock opname, dan rekonsiliasi',
    description: 'Audit trail perubahan data, stock opname periodik, dan rekonsiliasi stok fisik vs sistem.',
    icon: '🔍',
    color: 'bg-purple-700',
    href: '/audit',
    isCore: true,
    category: 'finance',
    onboardingSteps: [],
    requires: ['Inventory'],
  },
]

// ── MARKETING PILLAR ───────────────────────────────────────────────────────
export const MARKETING_MODULES: ModuleDefinition[] = [
  {
    key: 'Sales',
    name: 'Penjualan',
    tagline: 'Quotation, sales order, dan invoice penjualan',
    description: 'Alur penjualan dari quotation, sales order, delivery, hingga invoice dan penerimaan pembayaran.',
    icon: '📈',
    color: 'bg-green-600',
    href: '/sales',
    isCore: true,
    category: 'marketing',
    onboardingSteps: [],
    requires: ['Inventory', 'Finance'],
  },
  {
    key: 'CRM',
    name: 'Pelanggan (CRM)',
    tagline: 'Database pelanggan, leads, dan follow-up',
    description: 'Manajemen kontak pelanggan, pipeline penjualan, aktivitas follow-up, dan histori interaksi.',
    icon: '👥',
    color: 'bg-violet-600',
    href: '/contacts',
    isCore: true,
    category: 'marketing',
    onboardingSteps: [],
    requires: [],
  },
]

// ── HRIS PILLAR ────────────────────────────────────────────────────────────
export const HRIS_MODULES: ModuleDefinition[] = [
  {
    key: 'HRIS',
    name: 'HRIS & Payroll',
    tagline: 'Karyawan, absensi, dan penggajian otomatis',
    description: 'Manajemen data karyawan, absensi, lembur, penggajian, slip gaji, dan peningkatan kompetensi internal.',
    icon: '🧑‍💼',
    color: 'bg-indigo-600',
    href: '/hris',
    isCore: true,
    category: 'hris',
    onboardingSteps: [],
    requires: [],
  },
]

// ── BUSINESS TYPE (swapable, isi Operasional) ──────────────────────────────
export const BUSINESS_TYPE_MODULES: ModuleDefinition[] = [
  {
    key: 'Fleet & Rental',
    name: 'Fleet & Rental',
    tagline: 'Bisnis armada kendaraan dan sewa aset',
    description: 'Untuk bisnis yang mengoperasikan armada kendaraan atau menyewakan aset. Mencakup jadwal operasional, perawatan, penugasan driver, dan penagihan sewa.',
    icon: '🚛',
    color: 'bg-cyan-600',
    href: '/fleet',
    isCore: false,
    category: 'business_type',
    coaInjectionFn: 'inject_fleet_coa',
    onboardingSteps: [
      { id: 'coa', title: 'Install CoA Fleet', description: 'Pasang akun Aset Kendaraan, Penyusutan, Pendapatan Sewa, dan Beban Operasional Armada.' },
      { id: 'settings', title: 'Pengaturan Armada', description: 'Tentukan kategori kendaraan dan satuan operasional.' },
    ],
    tags: ['logistik', 'transportasi', 'sewa', 'rental'],
    requires: ['Sales'],
  },
  {
    key: 'Manufacturing',
    name: 'Manufaktur (BoM)',
    tagline: 'Bill of Materials, produksi, dan konversi bahan',
    description: 'Manajemen Bill of Materials, work orders, konversi bahan baku menjadi produk jadi, dan biaya produksi.',
    icon: '🏭',
    color: 'bg-slate-600',
    href: '/factory',
    isCore: false,
    category: 'business_type',
    onboardingSteps: [
      { id: 'settings', title: 'Pengaturan Produksi', description: 'Tentukan satuan produksi, kategori BoM, dan default gudang produksi.' },
    ],
    requires: ['Inventory'],
  },
  {
    key: 'Workshop',
    name: 'Workshop & Service',
    tagline: 'Bisnis bengkel dan jasa perbaikan',
    description: 'Untuk bisnis bengkel/service: work order, spare part, teknisi, dan penagihan jasa perbaikan.',
    icon: '🔧',
    color: 'bg-stone-600',
    href: '/workshop',
    isCore: false,
    category: 'business_type',
    onboardingSteps: [
      { id: 'settings', title: 'Pengaturan Bengkel', description: 'Tentukan layanan jasa bengkel, kategori spare part, dan tarif teknisi.' },
    ],
    requires: ['Inventory', 'Sales'],
  },
  {
    key: 'Job Order',
    name: 'Job Order (Jasa)',
    tagline: 'Bisnis jasa berbasis proyek/pekerjaan',
    description: 'Untuk bisnis jasa: job order, penugasan tim, time tracking, dan billing berbasis pekerjaan.',
    icon: '📋',
    color: 'bg-teal-600',
    href: '/services',
    isCore: false,
    category: 'business_type',
    onboardingSteps: [
      { id: 'settings', title: 'Pengaturan Jasa', description: 'Tentukan kategori jasa, metode billing, dan template job order.' },
    ],
    requires: ['Finance', 'Sales'],
  },
  {
    key: 'Project & Construction',
    name: 'Proyek & Konstruksi',
    tagline: 'Bisnis kontraktor dan manajemen proyek',
    description: 'Untuk bisnis konstruksi/kontraktor: RAB, progress billing, subkon, dan laporan progres proyek.',
    icon: '🏗️',
    color: 'bg-orange-700',
    href: '/construction',
    isCore: false,
    category: 'business_type',
    onboardingSteps: [
      { id: 'settings', title: 'Pengaturan Proyek', description: 'Tentukan kategori proyek, metode RAB, dan format progress billing.' },
    ],
    requires: ['Finance', 'Purchasing'],
  },
  {
    key: 'LMS',
    name: 'Lembaga Pelatihan',
    tagline: 'Bisnis pendidikan dan pelatihan',
    description: 'Untuk lembaga pelatihan/kursus: batch, peserta, instruktur, jadwal, sertifikat, dan pembayaran tuition.',
    icon: '🎓',
    color: 'bg-sky-600',
    href: '/lms',
    isCore: false,
    category: 'business_type',
    onboardingSteps: [
      { id: 'coa', title: 'Install CoA LMS', description: 'Pasang akun Pendapatan Pelatihan, Piutang Pelatihan, dan Beban Instruktur.' },
      { id: 'settings', title: 'Pengaturan Lembaga', description: 'Tentukan kategori program, durasi, dan metode pembayaran.' },
    ],
    requires: ['Finance'],
  },
]

// ── SYIRKAH PILLAR ─────────────────────────────────────────────────────────
export const SYIRKAH_MODULES: ModuleDefinition[] = [
  {
    key: 'Syirkah',
    name: 'Syirkah (Bagi Hasil)',
    tagline: 'Kemitraan & bagi hasil/patungan',
    description: 'Pencatatan porsi modal, nisbah bagi hasil, distribusi keuntungan periodik, dan laporan kinerja kemitraan.',
    icon: '🤝',
    color: 'bg-emerald-700',
    href: '/syirkah',
    isCore: true,
    category: 'syirkah',
    coaInjectionFn: 'inject_shariah_coa',
    onboardingSteps: [
      { id: 'coa', title: 'Install CoA Syirkah', description: 'Pasang akun Modal Syirkah, Kewajiban Syariah, Piutang Salam, dan Beban Ijarah.' },
      { id: 'settings', title: 'Pengaturan Kemitraan', description: 'Tentukan jenis akad, nisbah bagi hasil default, dan periode distribusi.' },
    ],
    requires: ['Finance', 'Accounting'],
  },
]

// ── SPECIAL — cadangan (kosong) ───────────────────────────────────────────
export const SPECIAL_MODULES: ModuleDefinition[] = []

// ── ADD-ON (multi-aktif, tidak ngaruh operasional) ────────────────────────
export const ADDON_MODULES: ModuleDefinition[] = [
  {
    key: 'POS',
    name: 'POS (Kasir)',
    tagline: 'Point of Sale untuk transaksi ritel cepat',
    description: 'Kasir digital untuk transaksi retail: produk, diskon, metode bayar, shift, dan laporan penjualan harian.',
    icon: '🏪',
    color: 'bg-pink-600',
    href: '/pos',
    isCore: false,
    isAddon: true,
    category: 'addon',
    onboardingSteps: [
      { id: 'settings', title: 'Pengaturan Sales Page', description: 'Pilih template halaman, domain, dan metode pembayaran.' },
    ],
    requires: ['Sales', 'Inventory'],
  },
  {
    key: 'Sales Page',
    name: 'Landing Penjualan',
    tagline: 'Halaman penjualan online dengan payment link',
    description: 'Buat halaman penjualan online untuk produk/jasa dengan link pembayaran. Cocok untuk campaign dan social selling.',
    icon: '🛍️',
    color: 'bg-rose-500',
    href: '/sales/pages',
    isCore: false,
    isAddon: true,
    category: 'addon',
    onboardingSteps: [
      { id: 'settings', title: 'Pengaturan Sales Page', description: 'Pilih template halaman, domain, dan metode pembayaran.' },
    ],
    requires: ['Sales'],
  },
  {
    key: 'Mobile Canvassing',
    name: 'Canvassing & Mobile POS',
    tagline: 'Aplikasi kasir mobile untuk sales lapangan',
    description: 'Manajemen sales lapangan, gudang kendaraan berjalan, dan Mobile POS dengan dukungan retur/tukar tambah.',
    icon: '🚚',
    color: 'bg-blue-600',
    href: '/sales/co-sales',
    isCore: false,
    isAddon: true,
    category: 'addon',
    onboardingSteps: [
      { id: 'roles', title: 'Atur Peran Sales', description: 'Berikan hak akses POS pada akun sales lapangan Anda.' },
    ],
    requires: ['Sales', 'Inventory'],
  },
]

// ── PILLAR MODULES (selalu aktif) ──────────────────────────────────────────
export const PILLAR_MODULES: ModuleDefinition[] = [
  ...FINANCE_MODULES,
  ...MARKETING_MODULES,
  ...HRIS_MODULES,
  ...SYIRKAH_MODULES,
]

// ── BACKWARD COMPAT ALIASES ────────────────────────────────────────────────

/** @deprecated Gunakan PILLAR_MODULES atau FINANCE_MODULES / MARKETING_MODULES / HRIS_MODULES */
export const CORE_MODULES: ModuleDefinition[] = PILLAR_MODULES

/** @deprecated Gunakan BUSINESS_TYPE_MODULES */
export const OPERATIONAL_MODULES: ModuleDefinition[] = BUSINESS_TYPE_MODULES

/**
 * Daftar key modul inti yang WAJIB ada di setiap paket.
 * Standar minimal agar sistem bisa berjalan secara fungsional.
 */
export const MINIMUM_CORE_MODULES: string[] = [
  'Accounting',
  'Finance',
  'Inventory',
  'CRM',
  'Reports',
  'HRIS',
]

// ── AGGREGATE ──────────────────────────────────────────────────────────────
export const MODULE_REGISTRY: ModuleDefinition[] = [
  ...PILLAR_MODULES,
  ...BUSINESS_TYPE_MODULES,
  ...ADDON_MODULES,
  ...SPECIAL_MODULES,
]

// ── HELPERS ─────────────────────────────────────────────────────────────────

export function getModuleByKey(key: string): ModuleDefinition | undefined {
  return MODULE_REGISTRY.find(m => m.key === key)
}

/** @deprecated Gunakan PILLAR_MODULES */
export function getCoreModules(): ModuleDefinition[] {
  return PILLAR_MODULES
}

/** @deprecated Gunakan BUSINESS_TYPE_MODULES */
export function getOperationalModules(): ModuleDefinition[] {
  return BUSINESS_TYPE_MODULES
}

export function getAddonModules(): ModuleDefinition[] {
  return ADDON_MODULES
}

export function getPillarModules(): ModuleDefinition[] {
  return PILLAR_MODULES
}

export function getBusinessTypeModules(): ModuleDefinition[] {
  return BUSINESS_TYPE_MODULES
}

export function getActiveBusinessType(enabledModules: string[]): ModuleDefinition | undefined {
  return BUSINESS_TYPE_MODULES.find(m =>
    enabledModules.some(e => e.toLowerCase().replace(/\s+/g, '') === m.key.toLowerCase().replace(/\s+/g, ''))
  )
}
