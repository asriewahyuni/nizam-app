/**
 * Module Registry — Nizam App
 * Sumber kebenaran tunggal untuk semua modul yang tersedia di marketplace.
 *
 * KONSEP UTAMA:
 * - Modul INTI (isCore: true) → sudah termasuk dalam paket, tidak perlu diaktifkan.
 *   Semua bisnis butuh ini: pembukuan, pembelian, penjualan, SDM, dsb.
 *
 * - Modul OPERASIONAL (isCore: false) → user memilih sesuai model bisnisnya.
 *   Memilih modul ini berarti user mendefinisikan sifat operasional bisnisnya:
 *   apakah bisnis jasa armada, bisnis konstruksi, lembaga pelatihan, dsb.
 */

export type OnboardingStep = {
  id: string
  title: string
  description: string
}

export type ModuleDefinition = {
  key: string                       // harus match module_key di AppSidebar
  name: string
  tagline: string
  description: string
  icon: string                      // emoji icon
  color: string                     // tailwind bg-* class
  href: string                      // route utama modul
  isCore: boolean                   // true = inti (sudah termasuk); false = operasional (dipilih)
  coaInjectionFn?: string           // nama SQL function inject CoA
  defaultSettings?: Record<string, any>
  onboardingSteps: OnboardingStep[]
  tags?: string[]
  requires?: string[]               // Modul-modul prasyarat (module keys)
}

// ─────────────────────────────────────────────────────────────────────────────
// MINIMUM CORE — modul wajib di setiap paket, bahkan yang paling kecil.
// Tanpa modul-modul ini, sistem tidak bisa beroperasi secara minimal.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Daftar key modul inti yang WAJIB ada di setiap paket.
 * Operator tidak boleh membuat paket tanpa modul-modul ini.
 * Standar minimal agar sistem bisa berjalan secara fungsional:
 *   - Accounting  → pencatatan jurnal & laporan keuangan
 *   - Finance     → kelola kas, piutang, utang
 *   - Inventory   → stok & persediaan
 *   - CRM         → database pelanggan
 *   - Reports     → laporan keuangan dasar
 */
export const MINIMUM_CORE_MODULES: string[] = [
  'Accounting',
  'Finance',
  'Inventory',
  'CRM',
  'Reports',
]

// ─────────────────────────────────────────────────────────────────────────────
// MODUL INTI — selalu aktif, tidak perlu onboarding tambahan
// ─────────────────────────────────────────────────────────────────────────────
export const CORE_MODULES: ModuleDefinition[] = [
  {
    key: 'Accounting',
    name: 'Akuntansi & Jurnal',
    tagline: 'Buku besar, jurnal, dan laporan keuangan PSAK',
    description: 'Pencatatan jurnal otomatis dari setiap transaksi, buku besar, laporan laba rugi, neraca, dan arus kas.',
    icon: '📒',
    color: 'bg-blue-500',
    href: '/accounting/journal',
    isCore: true,
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
    onboardingSteps: [],
    requires: ['Inventory', 'Finance'],
  },
  {
    key: 'Inventory',
    name: 'Inventori',
    tagline: 'Stok, valuasi, dan mutasi persediaan',
    description: 'Pencatatan stok masuk/keluar, penilaian persediaan (FIFO/Average), adjustment, dan laporan mutasi.',
    icon: '📦',
    color: 'bg-amber-500',
    href: '/inventory',
    isCore: true,
    onboardingSteps: [],
    requires: [],
  },
  {
    key: 'Manufacturing',
    name: 'Manufaktur (BoM)',
    tagline: 'Bill of Materials, produksi, dan konversi bahan',
    description: 'Manajemen Bill of Materials, work orders, konversi bahan baku menjadi produk jadi, dan biaya produksi.',
    icon: '🏭',
    color: 'bg-slate-600',
    href: '/factory',
    isCore: true,
    onboardingSteps: [],
    requires: ['Inventory'],
  },
  {
    key: 'Sales',
    name: 'Penjualan',
    tagline: 'Quotation, sales order, dan invoice penjualan',
    description: 'Alur penjualan dari quotation, sales order, delivery, hingga invoice dan penerimaan pembayaran.',
    icon: '📈',
    color: 'bg-green-600',
    href: '/sales',
    isCore: true,
    onboardingSteps: [],
    requires: ['Inventory', 'Finance'],
  },
  {
    key: 'POS',
    name: 'POS (Kasir)',
    tagline: 'Point of Sale untuk transaksi ritel cepat',
    description: 'Kasir digital untuk transaksi retail: produk, diskon, metode bayar, shift, dan laporan penjualan harian.',
    icon: '🏪',
    color: 'bg-pink-600',
    href: '/pos',
    isCore: true,
    onboardingSteps: [],
    requires: ['Sales', 'Inventory'],
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
    onboardingSteps: [],
    requires: [],
  },
  {
    key: 'Sales Page',
    name: 'Sales Page',
    tagline: 'Landing page produk dan pemesanan online',
    description: 'Buat halaman produk publik untuk menerima pesanan online langsung terintegrasi ke sistem penjualan.',
    icon: '🌐',
    color: 'bg-teal-600',
    href: '/sales/pages',
    isCore: true,
    onboardingSteps: [],
    requires: ['Sales'],
  },
  {
    key: 'HRIS',
    name: 'HRIS & Payroll',
    tagline: 'Karyawan, absensi, dan penggajian otomatis',
    description: 'Manajemen data karyawan, absensi, lembur, penggajian, slip gaji, dan peningkatan kompetensi internal.',
    icon: '🧑‍💼',
    color: 'bg-indigo-600',
    href: '/hris',
    isCore: true,
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
    onboardingSteps: [],
    requires: ['Accounting'],
  },
  {
    key: 'Audit',
    name: 'Audit Integritas',
    tagline: 'Deteksi anomali dan log aktivitas keuangan',
    description: 'Pemantauan integritas data keuangan, deteksi anomali jurnal, dan log aktivitas pengguna untuk keperluan audit.',
    icon: '🛡️',
    color: 'bg-red-700',
    href: '/accounting/audit',
    isCore: true,
    onboardingSteps: [],
    requires: ['Accounting'],
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// MODUL OPERASIONAL — dipilih user untuk mendefinisikan model bisnisnya.
// Mengaktifkan modul ini = mengubah/memperluas operasional bisnis.
// ─────────────────────────────────────────────────────────────────────────────
export const OPERATIONAL_MODULES: ModuleDefinition[] = [
  {
    key: 'Fleet & Rental',
    name: 'Fleet & Rental',
    tagline: 'Bisnis armada kendaraan dan sewa aset',
    description: 'Untuk bisnis yang mengoperasikan armada kendaraan atau menyewakan aset. Mencakup jadwal operasional, perawatan, penugasan driver, dan penagihan sewa.',
    icon: '🚛',
    color: 'bg-cyan-600',
    href: '/fleet',
    isCore: false,
    coaInjectionFn: 'inject_fleet_coa',
    onboardingSteps: [
      { id: 'coa', title: 'Install CoA Fleet', description: 'Pasang akun Aset Kendaraan, Penyusutan, Pendapatan Sewa, dan Beban Operasional Armada.' },
      { id: 'settings', title: 'Pengaturan Armada', description: 'Tentukan kategori kendaraan dan satuan operasional.' },
    ],
    tags: ['logistik', 'transportasi', 'sewa', 'rental'],
    requires: ['Finance', 'Sales'],
  },
  {
    key: 'Workshop',
    name: 'Bengkel Motor',
    tagline: 'Operasional bengkel motor: SPK, kendaraan, dan mekanik',
    description: 'Untuk bisnis bengkel motor: Surat Perintah Kerja (SPK), manajemen kendaraan pelanggan, daftar jasa dan spare part, alur status dari antri hingga diserahkan, serta jurnal pendapatan otomatis ke buku besar.',
    icon: '🔩',
    color: 'bg-blue-700',
    href: '/workshop',
    isCore: false,
    coaInjectionFn: 'inject_workshop_coa',
    onboardingSteps: [
      { id: 'coa', title: 'Install CoA Bengkel', description: 'Pasang akun Pendapatan Jasa Servis, Pendapatan Spare Part, dan Piutang Usaha Bengkel.' },
      { id: 'settings', title: 'Pengaturan Bengkel', description: 'Tentukan mekanik default dan preferensi nomor SPK.' },
    ],
    tags: ['bengkel', 'motor', 'servis', 'spk', 'otomotif'],
    requires: ['Finance', 'Inventory'],
  },
  {
    key: 'Job Order (Jasa)',
    name: 'Job Order (Jasa)',
    tagline: 'Bisnis jasa berbasis pekerjaan dan order',
    description: 'Untuk bisnis jasa yang mengerjakan order per pekerjaan: servis, instalasi, konsultasi, atau pekerjaan teknis. Mencakup penugasan teknisi, biaya bahan, dan penagihan per job.',
    icon: '🔧',
    color: 'bg-purple-600',
    href: '/services',
    isCore: false,
    onboardingSteps: [
      { id: 'coa', title: 'Install CoA Jasa', description: 'Pasang akun Pendapatan Jasa, WIP, Beban Langsung, dan Beban Tenaga Kerja.' },
      { id: 'settings', title: 'Pengaturan Layanan', description: 'Definisikan jenis layanan, satuan waktu, dan template job order.' },
    ],
    tags: ['jasa', 'servis', 'teknisi', 'order'],
    requires: ['Finance'],
  },
  {
    key: 'Project & Construction',
    name: 'Project & Construction',
    tagline: 'Bisnis konstruksi dan proyek berbasis kontrak',
    description: 'Untuk kontraktor dan developer: manajemen RAB, termin pembayaran, progress pekerjaan, retensi, laporan biaya per proyek, dan akuntansi kontrak jangka panjang (PSAK 34).',
    icon: '🏗️',
    color: 'bg-stone-600',
    href: '/construction',
    isCore: false,
    onboardingSteps: [
      { id: 'coa', title: 'Install CoA Konstruksi', description: 'Pasang akun Kontrak, Tagihan Kemajuan, WIP, Retensi, dan Beban Proyek.' },
      { id: 'settings', title: 'Pengaturan Proyek', description: 'Tentukan metode pengakuan pendapatan dan template RAB.' },
    ],
    tags: ['konstruksi', 'kontraktor', 'proyek', 'RAB'],
    requires: ['Inventory', 'Sales', 'Accounting'],
  },
  {
    key: 'LMS',
    name: 'LMS (Pelatihan Komersial)',
    tagline: 'Bisnis lembaga pelatihan dan pendidikan berbayar',
    description: 'Untuk lembaga pelatihan, balai diklat, atau perusahaan yang menjual layanan training. Mencakup manajemen program kursus, angkatan, jadwal sesi, presensi QR, registrasi peserta eksternal, dan sertifikasi.',
    icon: '🎓',
    color: 'bg-blue-600',
    href: '/lms',
    isCore: false,
    coaInjectionFn: 'inject_lms_coa',
    defaultSettings: {
      allowPublicRegistration: true,
      defaultCurrency: 'IDR',
      certificateTemplate: 'default',
    },
    onboardingSteps: [
      { id: 'coa', title: 'Install CoA LMS', description: 'Pasang akun Pendapatan Pelatihan, Piutang Pelatihan, Beban Honor Instruktur, dan Beban Operasional LMS.' },
      { id: 'settings', title: 'Pengaturan LMS', description: 'Tentukan template sertifikat dan akses pendaftaran.' },
    ],
    tags: ['lms', 'pelatihan', 'kursus', 'edukasi'],
    requires: ['Sales'],
  },
  {
    key: 'Syirkah',
    name: 'Syirkah (Kemitraan Syariah)',
    tagline: 'Bisnis berbasis kemitraan modal dan bagi hasil syariah',
    description: 'Untuk usaha dengan struktur permodalan syariah: syirkah inan, mudharabah, atau musyarakah. Mencakup pencatatan modal mitra, distribusi laba sesuai nisbah, dan pelaporan akuntansi syariah.',
    icon: '🤝',
    color: 'bg-emerald-700',
    href: '/syirkah',
    isCore: false,
    coaInjectionFn: 'inject_shariah_coa',
    onboardingSteps: [
      { id: 'coa', title: 'Install CoA Syirkah', description: 'Pasang akun Modal Syirkah, Bagi Hasil Belum Dibagi, Beban Bagi Hasil, dan Kewajiban Syirkah.' },
      { id: 'settings', title: 'Pengaturan Syirkah', description: 'Tentukan metode nisbah dan frekuensi bagi hasil (bulanan/tahunan).' },
    ],
    tags: ['syirkah', 'kemitraan', 'investasi', 'mudharabah'],
    requires: ['Accounting'],
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Combined registry (untuk lookup by key)
// ─────────────────────────────────────────────────────────────────────────────
export const MODULE_REGISTRY: ModuleDefinition[] = [...CORE_MODULES, ...OPERATIONAL_MODULES]

export function getModuleByKey(key: string): ModuleDefinition | undefined {
  return MODULE_REGISTRY.find(m => m.key === key)
}

export function getCoreModules(): ModuleDefinition[] {
  return CORE_MODULES
}

export function getOperationalModules(): ModuleDefinition[] {
  return OPERATIONAL_MODULES
}
