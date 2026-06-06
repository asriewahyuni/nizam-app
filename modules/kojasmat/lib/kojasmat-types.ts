/**
 * kojasmat-types.ts
 * Tipe data untuk modul Kojasmat (Koperasi Jasa & Tabungan Anggota)
 */

export const STATUS_KOJASMAT = {
  MENUNGGU: 'MENUNGGU',
  PROSES: 'PROSES',
  SELESAI: 'SELESAI',
  DIBAYAR: 'DIBAYAR',
} as const

export type KojasmatStatus = keyof typeof STATUS_KOJASMAT

export interface KojasmatProyek {
  id: string
  org_id: string
  branch_id: string | null
  contact_id: string | null
  employee_id: string | null
  nama_proyek: string
  status: KojasmatStatus
  amount: number | null
  notes: string | null
  created_at: string
  updated_at: string | null
}

export interface KojasmatTabungan {
  id: string
  org_id: string
  branch_id: string | null
  contact_id: string | null
  employee_id: string | null
  nama_anggota: string
  saldo: number
  status: KojasmatStatus
  notes: string | null
  created_at: string
  updated_at: string | null
}

export interface KojasmatAnggota {
  id: string
  org_id: string
  branch_id: string | null
  contact_id: string | null
  nama_anggota: string
  no_anggota: string | null
  is_verified: boolean
  status: KojasmatStatus
  notes: string | null
  created_at: string
  updated_at: string | null
}
