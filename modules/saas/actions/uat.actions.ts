'use server'

import { queryPostgres } from '@/lib/db/postgres'
import { getSession } from '@/modules/auth/actions/auth.actions'
import { revalidatePath } from 'next/cache'

// ─── Types ──────────────────────────────────────────────────────────────────

export type UatTemplate = {
  id: string
  name: string
  description: string | null
  applicable_modules: string[]
  is_active: boolean
  created_by: string | null
  created_at: string
  item_count?: number
}

export type UatTemplateItem = {
  id: string
  template_id: string
  module_name: string
  category: string | null
  test_scenario: string
  expected_result: string
  order_index: number
}

export type UatSession = {
  id: string
  org_id: string
  template_id: string
  session_number: string
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED'
  start_date: string | null
  completed_date: string | null
  operator_notes: string | null
  assigned_by: string | null
  created_at: string
  org_name?: string
  template_name?: string
  total_items?: number
  passed_items?: number
  failed_items?: number
}

export type UatSessionResult = {
  id: string
  session_id: string
  template_item_id: string
  status: 'PENDING' | 'PASS' | 'FAIL' | 'SKIP'
  notes: string | null
  tested_by: string | null
  tested_at: string | null
  module_name?: string
  category?: string | null
  test_scenario?: string
  expected_result?: string
  order_index?: number
}

export type UatSessionDetail = UatSession & {
  results: UatSessionResult[]
}

// ─── Templates ───────────────────────────────────────────────────────────────

export async function getUatTemplates(): Promise<UatTemplate[]> {
  const result = await queryPostgres<UatTemplate>(`
    SELECT t.*, COUNT(i.id)::int AS item_count
    FROM uat_templates t
    LEFT JOIN uat_template_items i ON i.template_id = t.id
    GROUP BY t.id
    ORDER BY t.created_at DESC
  `)
  return result.rows
}

export async function getUatTemplate(id: string): Promise<{ template: UatTemplate; items: UatTemplateItem[] } | null> {
  const [tRes, iRes] = await Promise.all([
    queryPostgres<UatTemplate>(`SELECT * FROM uat_templates WHERE id = $1`, [id]),
    queryPostgres<UatTemplateItem>(`SELECT * FROM uat_template_items WHERE template_id = $1 ORDER BY order_index, module_name`, [id]),
  ])
  if (!tRes.rows.length) return null
  return { template: tRes.rows[0], items: iRes.rows }
}

export async function createUatTemplate(input: {
  name: string
  description?: string
  applicable_modules: string[]
  items: Array<{ module_name: string; category?: string; test_scenario: string; expected_result: string; order_index?: number }>
}): Promise<{ id: string }> {
  const session = await getSession()
  if (!session) throw new Error('Unauthorized')

  const result = await queryPostgres<{ id: string }>(`
    INSERT INTO uat_templates (name, description, applicable_modules, created_by)
    VALUES ($1, $2, $3, $4) RETURNING id
  `, [input.name, input.description ?? null, input.applicable_modules, session.email])

  const templateId = result.rows[0].id
  for (let i = 0; i < input.items.length; i++) {
    const item = input.items[i]
    await queryPostgres(`
      INSERT INTO uat_template_items (template_id, module_name, category, test_scenario, expected_result, order_index)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [templateId, item.module_name, item.category ?? null, item.test_scenario, item.expected_result, item.order_index ?? i])
  }

  revalidatePath('/saas/uat')
  return { id: templateId }
}

export async function saveUatTemplateItems(templateId: string, items: Array<{
  module_name: string
  category?: string
  test_scenario: string
  expected_result: string
  order_index?: number
}>): Promise<void> {
  await queryPostgres(`DELETE FROM uat_template_items WHERE template_id = $1`, [templateId])
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    await queryPostgres(`
      INSERT INTO uat_template_items (template_id, module_name, category, test_scenario, expected_result, order_index)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [templateId, item.module_name, item.category ?? null, item.test_scenario, item.expected_result, item.order_index ?? i])
  }
  revalidatePath('/saas/uat')
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

export async function getUatSessions(): Promise<UatSession[]> {
  const result = await queryPostgres<UatSession>(`
    SELECT
      s.*,
      o.name AS org_name,
      t.name AS template_name,
      COUNT(r.id)::int AS total_items,
      COUNT(CASE WHEN r.status = 'PASS' THEN 1 END)::int AS passed_items,
      COUNT(CASE WHEN r.status = 'FAIL' THEN 1 END)::int AS failed_items
    FROM uat_sessions s
    JOIN organizations o ON o.id = s.org_id
    JOIN uat_templates t ON t.id = s.template_id
    LEFT JOIN uat_session_results r ON r.session_id = s.id
    GROUP BY s.id, o.name, t.name
    ORDER BY s.created_at DESC
  `)
  return result.rows
}

export async function getUatSession(id: string): Promise<UatSessionDetail | null> {
  const sRes = await queryPostgres<UatSession>(`
    SELECT s.*, o.name AS org_name, t.name AS template_name
    FROM uat_sessions s
    JOIN organizations o ON o.id = s.org_id
    JOIN uat_templates t ON t.id = s.template_id
    WHERE s.id = $1
  `, [id])
  if (!sRes.rows.length) return null

  const rRes = await queryPostgres<UatSessionResult>(`
    SELECT r.*, i.module_name, i.category, i.test_scenario, i.expected_result, i.order_index
    FROM uat_session_results r
    JOIN uat_template_items i ON i.id = r.template_item_id
    WHERE r.session_id = $1
    ORDER BY i.order_index, i.module_name
  `, [id])

  return { ...sRes.rows[0], results: rRes.rows }
}

export async function createUatSession(input: { org_id: string; template_id: string }): Promise<{ id: string }> {
  const session = await getSession()
  if (!session) throw new Error('Unauthorized')

  const sessionNumber = `UAT-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`

  const sRes = await queryPostgres<{ id: string }>(`
    INSERT INTO uat_sessions (org_id, template_id, session_number, status, assigned_by)
    VALUES ($1, $2, $3, 'PENDING', $4) RETURNING id
  `, [input.org_id, input.template_id, sessionNumber, session.email])

  const sessionId = sRes.rows[0].id
  const itemsRes = await queryPostgres<{ id: string }>(`SELECT id FROM uat_template_items WHERE template_id = $1`, [input.template_id])
  for (const item of itemsRes.rows) {
    await queryPostgres(`
      INSERT INTO uat_session_results (session_id, template_item_id, status) VALUES ($1, $2, 'PENDING')
    `, [sessionId, item.id])
  }

  revalidatePath('/saas/uat')
  return { id: sessionId }
}

export async function updateUatSessionResult(resultId: string, input: {
  status: 'PENDING' | 'PASS' | 'FAIL' | 'SKIP'
  notes?: string
}): Promise<void> {
  const session = await getSession()
  if (!session) throw new Error('Unauthorized')
  await queryPostgres(`
    UPDATE uat_session_results
    SET status = $1, notes = $2, tested_by = $3, tested_at = NOW(), updated_at = NOW()
    WHERE id = $4
  `, [input.status, input.notes ?? null, session.email, resultId])
}

export async function updateUatSessionStatus(sessionId: string, input: {
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED'
  operator_notes?: string
}): Promise<void> {
  const completedDate = input.status === 'COMPLETED' ? 'CURRENT_DATE' : 'NULL'
  const startDate = input.status === 'IN_PROGRESS' ? 'COALESCE(start_date, CURRENT_DATE)' : 'start_date'

  await queryPostgres(`
    UPDATE uat_sessions
    SET status = $1, operator_notes = $2, updated_at = NOW(),
        start_date = ${startDate},
        completed_date = ${completedDate}
    WHERE id = $3
  `, [input.status, input.operator_notes ?? null, sessionId])
  revalidatePath('/saas/uat')
  revalidatePath(`/saas/uat/${sessionId}`)
}
