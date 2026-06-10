'use server'

import { queryPostgres } from '@/lib/db/postgres'
import { getSession } from '@/modules/auth/actions/auth.actions'
import { revalidatePath } from 'next/cache'

export type SpkDocument = {
  id: string
  org_id: string
  sale_invoice_id: string | null
  document_number: string
  issued_date: string
  start_date: string | null
  end_date: string | null
  system_name: string
  modules_scope: string[]
  consultant_name: string | null
  consultant_title: string | null
  client_pic_name: string | null
  client_pic_title: string | null
  notes: string | null
  status: 'DRAFT' | 'ISSUED' | 'IN_PROGRESS' | 'COMPLETED'
  created_at: string
  org_name?: string
}

export async function getSpkDocuments(): Promise<SpkDocument[]> {
  const result = await queryPostgres<SpkDocument>(`
    SELECT s.*, o.name AS org_name
    FROM spk_documents s
    JOIN organizations o ON o.id = s.org_id
    ORDER BY s.created_at DESC
  `)
  return result.rows
}

export async function getSpkDocument(id: string): Promise<SpkDocument | null> {
  const result = await queryPostgres<SpkDocument>(`
    SELECT s.*, o.name AS org_name
    FROM spk_documents s
    JOIN organizations o ON o.id = s.org_id
    WHERE s.id = $1
  `, [id])
  return result.rows[0] ?? null
}

export async function createSpkDocument(input: {
  org_id: string
  sale_invoice_id?: string
  issued_date: string
  start_date?: string
  end_date?: string
  modules_scope: string[]
  consultant_name?: string
  consultant_title?: string
  client_pic_name?: string
  client_pic_title?: string
  notes?: string
}): Promise<{ id: string }> {
  const session = await getSession()
  if (!session) throw new Error('Unauthorized')

  const docNumber = `SPK-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`

  const result = await queryPostgres<{ id: string }>(`
    INSERT INTO spk_documents (
      org_id, sale_invoice_id, document_number, issued_date, start_date, end_date,
      modules_scope, consultant_name, consultant_title,
      client_pic_name, client_pic_title, notes, status
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'DRAFT')
    RETURNING id
  `, [
    input.org_id,
    input.sale_invoice_id ?? null,
    docNumber,
    input.issued_date,
    input.start_date ?? null,
    input.end_date ?? null,
    input.modules_scope,
    input.consultant_name ?? null,
    input.consultant_title ?? null,
    input.client_pic_name ?? null,
    input.client_pic_title ?? null,
    input.notes ?? null,
  ])

  revalidatePath('/saas/spk')
  return { id: result.rows[0].id }
}

export async function issueSpkDocument(id: string): Promise<void> {
  await queryPostgres(`UPDATE spk_documents SET status = 'ISSUED', updated_at = NOW() WHERE id = $1`, [id])
  revalidatePath('/saas/spk')
  revalidatePath(`/saas/spk/${id}`)
}

export async function updateSpkStatus(id: string, status: 'IN_PROGRESS' | 'COMPLETED'): Promise<void> {
  await queryPostgres(`UPDATE spk_documents SET status = $2, updated_at = NOW() WHERE id = $1`, [id, status])
  revalidatePath('/saas/spk')
  revalidatePath(`/saas/spk/${id}`)
}
