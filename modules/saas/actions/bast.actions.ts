'use server'

import { queryPostgres } from '@/lib/db/postgres'
import { getSession } from '@/modules/auth/actions/auth.actions'
import { revalidatePath } from 'next/cache'

export type BastDocument = {
  id: string
  org_id: string
  uat_session_id: string | null
  document_number: string
  issued_date: string
  system_name: string
  modules_delivered: string[]
  operator_name: string | null
  operator_title: string | null
  client_name: string | null
  client_title: string | null
  notes: string | null
  status: 'DRAFT' | 'ISSUED'
  created_at: string
  org_name?: string
  uat_session_number?: string | null
}

export async function getBastDocuments(): Promise<BastDocument[]> {
  const result = await queryPostgres<BastDocument>(`
    SELECT b.*, o.name AS org_name, s.session_number AS uat_session_number
    FROM bast_documents b
    JOIN organizations o ON o.id = b.org_id
    LEFT JOIN uat_sessions s ON s.id = b.uat_session_id
    ORDER BY b.created_at DESC
  `)
  return result.rows
}

export async function getBastDocument(id: string): Promise<BastDocument | null> {
  const result = await queryPostgres<BastDocument>(`
    SELECT b.*, o.name AS org_name, s.session_number AS uat_session_number
    FROM bast_documents b
    JOIN organizations o ON o.id = b.org_id
    LEFT JOIN uat_sessions s ON s.id = b.uat_session_id
    WHERE b.id = $1
  `, [id])
  return result.rows[0] ?? null
}

export async function createBastDocument(input: {
  org_id: string
  uat_session_id?: string
  issued_date: string
  modules_delivered: string[]
  operator_name?: string
  operator_title?: string
  client_name?: string
  client_title?: string
  notes?: string
}): Promise<{ id: string }> {
  const session = await getSession()
  if (!session) throw new Error('Unauthorized')

  const docNumber = `BAST-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`

  const result = await queryPostgres<{ id: string }>(`
    INSERT INTO bast_documents (
      org_id, uat_session_id, document_number, issued_date,
      modules_delivered, operator_name, operator_title,
      client_name, client_title, notes, status
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'DRAFT')
    RETURNING id
  `, [
    input.org_id,
    input.uat_session_id ?? null,
    docNumber,
    input.issued_date,
    input.modules_delivered,
    input.operator_name ?? null,
    input.operator_title ?? null,
    input.client_name ?? null,
    input.client_title ?? null,
    input.notes ?? null,
  ])

  revalidatePath('/saas/bast')
  return { id: result.rows[0].id }
}

export async function issueBastDocument(id: string): Promise<void> {
  await queryPostgres(`UPDATE bast_documents SET status = 'ISSUED', updated_at = NOW() WHERE id = $1`, [id])
  revalidatePath('/saas/bast')
  revalidatePath(`/saas/bast/${id}`)
}
