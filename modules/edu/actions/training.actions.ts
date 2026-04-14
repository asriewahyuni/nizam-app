'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { TRAINING_QUESTIONS, type TrainingCriterionKey } from '@/lib/edu/training-simulation'
import { getSession } from '@/modules/auth/actions/auth.actions'
import { DEFAULT_TRAINING_EVENT_SLUG, ensureTrainingEvent } from '@/modules/edu/lib/training.server'

type TrainingMutationResult = {
  ok?: true
  error?: string
  teamId?: string
}

type TrainingScoreRow = {
  transaction_ok?: boolean | null
  context_ok?: boolean | null
  evidence_ok?: boolean | null
  note?: string | null
}

const SCORE_COLUMN_MAP: Record<TrainingCriterionKey, 'transaction_ok' | 'context_ok' | 'evidence_ok'> = {
  transaction: 'transaction_ok',
  context: 'context_ok',
  evidence: 'evidence_ok',
}

function normalizeTeamName(value: string) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
}

function clampElapsedMinutes(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(24 * 60, Math.round(value)))
}

async function requireTrainerUser() {
  const user = await getSession()
  if (!user?.id) {
    return { error: 'Login sebagai trainer terlebih dahulu untuk mengelola scoring board.' }
  }
  return { user }
}

async function ensureTeamExists(teamId: string) {
  const db = (await createAdminClient()) as any
  const normalizedTeamId = String(teamId || '').trim()
  if (!normalizedTeamId) {
    return { error: 'Tim training tidak valid.' as const }
  }

  const { data: teamRow, error } = await db
    .from('training_teams')
    .select('id, event_id, name')
    .eq('id', normalizedTeamId)
    .maybeSingle()

  if (error) {
    return { error: error.message || 'Gagal membaca data tim training.' as const }
  }

  if (!teamRow?.id) {
    return { error: 'Tim training tidak ditemukan.' as const }
  }

  return { team: teamRow as { id: string; event_id: string; name: string } }
}

export async function createTrainingTeam(input: {
  teamName: string
  eventSlug?: string
}): Promise<TrainingMutationResult> {
  const auth = await requireTrainerUser()
  if ('error' in auth) return { error: auth.error }

  const db = (await createAdminClient()) as any
  const teamName = normalizeTeamName(input.teamName)
  const event = await ensureTrainingEvent(input.eventSlug || DEFAULT_TRAINING_EVENT_SLUG)

  if (teamName.length < 2) {
    return { error: 'Nama tim minimal 2 karakter.' }
  }

  if (teamName.length > 60) {
    return { error: 'Nama tim maksimal 60 karakter.' }
  }

  const { data: existingTeam, error: existingError } = await db
    .from('training_teams')
    .select('id')
    .eq('event_id', event.id)
    .ilike('name', teamName)
    .maybeSingle()

  if (existingError) {
    return { error: existingError.message || 'Gagal memeriksa nama tim.' }
  }

  if (existingTeam?.id) {
    return { error: 'Nama tim sudah terdaftar pada event ini.' }
  }

  const { data: createdTeam, error: insertError } = await db
    .from('training_teams')
    .insert({
      event_id: event.id,
      name: teamName,
      elapsed_minutes: 0,
      status: 'ACTIVE',
      created_by: auth.user.id,
    })
    .select('id')
    .single()

  if (insertError || !createdTeam?.id) {
    return { error: insertError?.message || 'Gagal membuat tim training.' }
  }

  const defaultScoreRows = TRAINING_QUESTIONS.map((question) => ({
    team_id: createdTeam.id,
    question_id: question.id,
    transaction_ok: false,
    context_ok: false,
    evidence_ok: false,
    updated_by: auth.user.id,
  }))

  const { error: scoreInsertError } = await db
    .from('training_team_scores')
    .upsert(defaultScoreRows, { onConflict: 'team_id,question_id' })

  if (scoreInsertError) {
    return { error: scoreInsertError.message || 'Tim berhasil dibuat, tetapi skor awal gagal disiapkan.' }
  }

  revalidatePath('/edu')
  return { ok: true, teamId: String(createdTeam.id) }
}

export async function updateTrainingTeamElapsedMinutes(input: {
  teamId: string
  elapsedMinutes: number
}): Promise<TrainingMutationResult> {
  const auth = await requireTrainerUser()
  if ('error' in auth) return { error: auth.error }

  const teamResult = await ensureTeamExists(input.teamId)
  if ('error' in teamResult) return { error: teamResult.error }

  const db = (await createAdminClient()) as any
  const elapsedMinutes = clampElapsedMinutes(input.elapsedMinutes)

  const { error } = await db
    .from('training_teams')
    .update({
      elapsed_minutes: elapsedMinutes,
    })
    .eq('id', teamResult.team.id)

  if (error) {
    return { error: error.message || 'Gagal memperbarui durasi tim.' }
  }

  revalidatePath('/edu')
  return { ok: true, teamId: teamResult.team.id }
}

export async function updateTrainingQuestionScore(input: {
  teamId: string
  questionId: number
  criterion: TrainingCriterionKey
  value: boolean
}): Promise<TrainingMutationResult> {
  const auth = await requireTrainerUser()
  if ('error' in auth) return { error: auth.error }

  const teamResult = await ensureTeamExists(input.teamId)
  if ('error' in teamResult) return { error: teamResult.error }

  const questionId = Math.round(Number(input.questionId || 0))
  if (!TRAINING_QUESTIONS.some((question) => question.id === questionId)) {
    return { error: 'Nomor soal tidak valid.' }
  }

  const scoreColumn = SCORE_COLUMN_MAP[input.criterion]
  if (!scoreColumn) {
    return { error: 'Kriteria skor tidak valid.' }
  }

  const db = (await createAdminClient()) as any
  const { data: existingRow, error: existingError } = await db
    .from('training_team_scores')
    .select('transaction_ok, context_ok, evidence_ok, note')
    .eq('team_id', teamResult.team.id)
    .eq('question_id', questionId)
    .maybeSingle()

  if (existingError) {
    return { error: existingError.message || 'Gagal membaca skor lama.' }
  }

  const currentRow = (existingRow || {}) as TrainingScoreRow

  const nextRow = {
    team_id: teamResult.team.id,
    question_id: questionId,
    transaction_ok: Boolean(currentRow.transaction_ok),
    context_ok: Boolean(currentRow.context_ok),
    evidence_ok: Boolean(currentRow.evidence_ok),
    note: currentRow.note || null,
    updated_by: auth.user.id,
    [scoreColumn]: Boolean(input.value),
  }

  const { error: upsertError } = await db
    .from('training_team_scores')
    .upsert(nextRow, { onConflict: 'team_id,question_id' })

  if (upsertError) {
    return { error: upsertError.message || 'Gagal memperbarui skor soal.' }
  }

  revalidatePath('/edu')
  return { ok: true, teamId: teamResult.team.id }
}
