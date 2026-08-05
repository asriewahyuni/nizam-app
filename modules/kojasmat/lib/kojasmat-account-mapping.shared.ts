// Konstanta & tipe pemetaan akun Kojasmat yang dipakai baik server maupun client
// (lihat kojasmat-account-mapping.server.ts untuk query DB-nya).

export const KOJASMAT_ACCOUNT_ROLES = [
  'kas',
  'simpanan_pokok',
  'simpanan_wajib',
  'simpanan_sukarela',
  'dst_murabahah',
  'dst_mudharabah',
  'piutang_pembiayaan',
  'ujrah_murabahah',
  'ujrah_mudharabah',
  'pendapatan_admin',
  'pendapatan_proyek',
  'beban_proyek',
  'bagi_hasil',
] as const

export type KojasmatAccountRole = typeof KOJASMAT_ACCOUNT_ROLES[number]

export const KOJASMAT_ACCOUNT_ROLE_LABEL: Record<KojasmatAccountRole, string> = {
  kas: 'Kas',
  simpanan_pokok: 'Simpanan Pokok',
  simpanan_wajib: 'Simpanan Wajib',
  simpanan_sukarela: 'Simpanan Sukarela',
  dst_murabahah: 'Dana Syirkah Temporer — Murabahah',
  dst_mudharabah: 'Dana Syirkah Temporer — Mudharabah/Inan',
  piutang_pembiayaan: 'Piutang Pembiayaan (disalurkan ke mudharib)',
  ujrah_murabahah: 'Pendapatan Ujrah Wakalah — Murabahah',
  ujrah_mudharabah: 'Pendapatan Ujrah Wakalah — Mudharabah',
  pendapatan_admin: 'Pendapatan Biaya Admin Pendaftaran',
  pendapatan_proyek: 'Pendapatan Usaha Proyek',
  beban_proyek: 'Beban Usaha Proyek',
  bagi_hasil: 'Distribusi Bagi Hasil ke Pemodal',
}

export type KojasmatAccountMapping = Record<KojasmatAccountRole, string | null>

export type KojasmatAccountOption = {
  id: string
  code: string
  name: string
  type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE'
}
