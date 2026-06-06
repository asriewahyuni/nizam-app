'use server'

/**
 * kojasmat.actions.ts
 * Server actions untuk modul Kojasmat (Koperasi Jasa & Tabungan Anggota)
 */

import { queryPostgres } from '@/lib/db/postgres'
import { ERPBridge } from '@/lib/erp-bridge/finances'
import { revalidatePath } from 'next/cache'
import type { KojasmatStatus, KojasmatProyek, KojasmatTabungan, KojasmatAnggota } from '../lib/kojasmat-types'

// ─── Proyek ──────────────────────────────────────────────────────────────────

export async function getAllProyek(orgId: string) {
  const { rows } = await queryPostgres(
    `SELECT * FROM public.kojasmat_proyek WHERE org_id = $1 ORDER BY created_at DESC`,
    [orgId]
  )
  return rows as KojasmatProyek[]
}

export async function createProyek(input: {
  org_id: string
  branch_id?: string | null
  contact_id?: string | null
  employee_id?: string | null
  nama_proyek: string
  amount?: number
  notes?: string
}) {
  const { rows } = await queryPostgres(
    `INSERT INTO public.kojasmat_proyek (org_id, branch_id, contact_id, employee_id, nama_proyek, amount, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [input.org_id, input.branch_id ?? null, input.contact_id ?? null,
     input.employee_id ?? null, input.nama_proyek, input.amount ?? null, input.notes ?? null]
  )
  const data = rows[0] as KojasmatProyek

  if (input.amount && input.amount > 0) {
    const debit = await ERPBridge.getDefaultAccount(input.org_id, '1-10001')
    const credit = await ERPBridge.getDefaultAccount(input.org_id, '4-40001')
    if (debit && credit) {
      await ERPBridge.recordRevenue({
        orgId: input.org_id, branchId: input.branch_id ?? undefined,
        amount: input.amount,
        date: new Date().toISOString().split('T')[0],
        description: `Kojasmat Proyek: ${input.nama_proyek}`,
        referenceType: 'KOJASMAT_PROYEK', referenceId: data.id,
        debitAccountId: debit, creditAccountId: credit, autoPost: true,
      }).catch(console.error)
    }
  }

  revalidatePath('/(dashboard)/kojasmat')
  return { data, error: null }
}

export async function updateProyekStatus(id: string, orgId: string, status: KojasmatStatus) {
  const { rows } = await queryPostgres(
    `UPDATE public.kojasmat_proyek SET status = $1, updated_at = NOW()
     WHERE id = $2 AND org_id = $3 RETURNING *`,
    [status, id, orgId]
  )
  if (!rows[0]) return { data: null, error: 'Proyek tidak ditemukan' }

  if (status === 'DIBAYAR' && rows[0].amount) {
    const debit = await ERPBridge.getDefaultAccount(orgId, '1-10001')
    const credit = await ERPBridge.getDefaultAccount(orgId, '4-40001')
    if (debit && credit) {
      await ERPBridge.recordRevenue({
        orgId, amount: Number(rows[0].amount),
        date: new Date().toISOString().split('T')[0],
        description: `Kojasmat Lunas: ${rows[0].nama_proyek}`,
        referenceType: 'KOJASMAT_PAYMENT', referenceId: id,
        debitAccountId: debit, creditAccountId: credit, autoPost: true,
      }).catch(console.error)
    }
  }

  revalidatePath('/(dashboard)/kojasmat')
  return { data: rows[0] as KojasmatProyek, error: null }
}

export async function deleteProyek(id: string, orgId: string) {
  await queryPostgres(
    `DELETE FROM public.kojasmat_proyek WHERE id = $1 AND org_id = $2`,
    [id, orgId]
  )
  revalidatePath('/(dashboard)/kojasmat')
  return { error: null }
}

// ─── Tabungan ─────────────────────────────────────────────────────────────────

export async function getAllTabungan(orgId: string) {
  const { rows } = await queryPostgres(
    `SELECT * FROM public.kojasmat_tabungan WHERE org_id = $1 ORDER BY created_at DESC`,
    [orgId]
  )
  return rows as KojasmatTabungan[]
}

export async function createTabungan(input: {
  org_id: string
  branch_id?: string | null
  contact_id?: string | null
  nama_anggota: string
  saldo?: number
  notes?: string
}) {
  const { rows } = await queryPostgres(
    `INSERT INTO public.kojasmat_tabungan (org_id, branch_id, contact_id, nama_anggota, saldo, notes)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [input.org_id, input.branch_id ?? null, input.contact_id ?? null,
     input.nama_anggota, input.saldo ?? 0, input.notes ?? null]
  )
  revalidatePath('/(dashboard)/kojasmat')
  return { data: rows[0] as KojasmatTabungan, error: null }
}

// ─── Anggota ─────────────────────────────────────────────────────────────────

export async function getAllAnggota(orgId: string) {
  const { rows } = await queryPostgres(
    `SELECT * FROM public.kojasmat_anggota WHERE org_id = $1 ORDER BY created_at DESC`,
    [orgId]
  )
  return rows as KojasmatAnggota[]
}

export async function createAnggota(input: {
  org_id: string
  branch_id?: string | null
  contact_id?: string | null
  nama_anggota: string
  no_anggota?: string
  notes?: string
}) {
  const { rows } = await queryPostgres(
    `INSERT INTO public.kojasmat_anggota (org_id, branch_id, contact_id, nama_anggota, no_anggota, notes)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [input.org_id, input.branch_id ?? null, input.contact_id ?? null,
     input.nama_anggota, input.no_anggota ?? null, input.notes ?? null]
  )
  revalidatePath('/(dashboard)/kojasmat')
  return { data: rows[0] as KojasmatAnggota, error: null }
}

export async function verifyAnggota(id: string, orgId: string) {
  const { rows } = await queryPostgres(
    `UPDATE public.kojasmat_anggota SET is_verified = true, status = 'SELESAI', updated_at = NOW()
     WHERE id = $1 AND org_id = $2 RETURNING *`,
    [id, orgId]
  )
  revalidatePath('/(dashboard)/kojasmat')
  return { data: rows[0] as KojasmatAnggota, error: null }
}
