// Konstanta & tipe pemetaan akun Klinik Pratama yang dipakai baik server
// maupun client (lihat klinik-account-mapping.server.ts untuk query DB-nya).

export const KLINIK_ACCOUNT_ROLES = [
  'kas',
  'pendapatan_konsultasi',
  'pendapatan_tindakan',
  'pendapatan_obat',
  'hpp_obat',
  'persediaan_obat',
  'piutang_bpjs',
  'kerugian_obat_kadaluarsa',
] as const

export type KlinikAccountRole = typeof KLINIK_ACCOUNT_ROLES[number]

export const KLINIK_ACCOUNT_ROLE_LABEL: Record<KlinikAccountRole, string> = {
  kas: 'Kas',
  pendapatan_konsultasi: 'Pendapatan Konsultasi',
  pendapatan_tindakan: 'Pendapatan Tindakan Medis',
  pendapatan_obat: 'Pendapatan Penjualan Obat',
  hpp_obat: 'HPP Obat',
  persediaan_obat: 'Persediaan Obat',
  piutang_bpjs: 'Piutang Klaim BPJS',
  kerugian_obat_kadaluarsa: 'Kerugian Obat Kadaluarsa',
}

export type KlinikAccountMapping = Record<KlinikAccountRole, string | null>

export type KlinikAccountOption = {
  id: string
  code: string
  name: string
  type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE'
}
