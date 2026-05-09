/**
 * Add-on Registry — NIZAM Full
 *
 * Sumber kebenaran untuk semua add-on yang tersedia.
 * Jumlah add-on = ADDON_REGISTRY.length → otomatis di versi.
 *
 * Standar versioning: STANDAR_RESMI_VERSIONING_NIZAM_FULL.md
 */

export interface AddonDefinition {
  /** Kode unik add-on */
  key: string
  /** Nama tampilan */
  name: string
  /** Deskripsi singkat */
  description: string
  /** Ikon emoji */
  icon: string
  /** Apakah sudah dirilis (false = planned) */
  released: boolean
  /** Tanggal rilis (jika sudah) */
  releasedAt?: string
  /** Modul inti/operasional yang terkait */
  relatesTo?: string[]
}

/**
 * Daftar add-on NIZAM Full.
 * Referensi: STANDAR_RESMI_VERSIONING_NIZAM_FULL.md §5.3
 *
 * Aturan:
 * - `released: true` → terhitung dalam versi (A)
 * - `released: false` → planned, belum terhitung
 */
export const ADDON_REGISTRY: AddonDefinition[] = [
  {
    key: 'pos',
    name: 'POS',
    description: 'Point of Sale untuk retail dan F&B',
    icon: '💳',
    released: true,
    releasedAt: '2026-05-09',
    relatesTo: ['Sales'],
  },
  {
    key: 'advanced-wms',
    name: 'Advanced WMS',
    description: 'Manajemen gudang lanjutan: multi-lokasi, bin tracking, picking optimization',
    icon: '📦',
    released: false,
    relatesTo: ['Warehouse'],
  },
  {
    key: 'sales-page',
    name: 'Sales Page',
    description: 'Landing page penjualan dan checkout link untuk bisnis online',
    icon: '🛍️',
    released: true,
    releasedAt: '2026-05-09',
    relatesTo: ['Sales'],
  },
  {
    key: 'open-api',
    name: 'Open API & Webhooks',
    description: 'Integrasi eksternal lewat REST API dan webhook events',
    icon: '🔌',
    released: false,
  },
  {
    key: 'multi-entity',
    name: 'Multi-Entity',
    description: 'Kelola multiple business entity dalam satu akun',
    icon: '🏢',
    released: false,
  },
  {
    key: 'quick-bill',
    name: 'Quick Bill',
    description: 'Faktur instan untuk tagihan cepat tanpa workflow penuh',
    icon: '⚡',
    released: true,
    releasedAt: '2026-05-09',
    relatesTo: ['Sales'],
  },
  {
    key: 'fleet-maintenance',
    name: 'Fleet Maintenance Pack',
    description: 'Manajemen perawatan armada: jadwal servis, riwayat perbaikan, biaya per kendaraan',
    icon: '🚛',
    released: false,
    relatesTo: ['Fleet & Rental'],
  },
  {
    key: 'package-tracking',
    name: 'Package Tracking',
    description: 'Tracking pengiriman untuk customer: status, lokasi, estimasi',
    icon: '📬',
    released: false,
  },
  {
    key: 'sales-ar-cockpit',
    name: 'Sales AR Cockpit',
    description: 'Dashboard piutang penjualan dengan aging, kolektibilitas, dan forecast',
    icon: '📊',
    released: false,
    relatesTo: ['Sales'],
  },
  {
    key: 'sales-ar-seat',
    name: 'Sales AR Seat Pack',
    description: 'Tambahan seat license untuk Sales AR Cockpit',
    icon: '🪑',
    released: false,
    relatesTo: ['Sales AR Cockpit'],
  },
]

/** Jumlah add-on yang sudah dirilis */
export const RELEASED_ADDON_COUNT = ADDON_REGISTRY.filter(a => a.released).length
