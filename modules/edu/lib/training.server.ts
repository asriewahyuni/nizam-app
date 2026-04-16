import { createAdminClient } from '@/lib/supabase/server'
import {
  TRAINING_MAX_SCORE,
  TRAINING_QUESTIONS,
  type TrainingBoardData,
  type TrainingBoardTeam,
  type TrainingQuestionScore,
} from '@/lib/edu/training-simulation'

export const DEFAULT_TRAINING_EVENT_SLUG = 'simulasi-erp-nizam'

type TrainingEventRow = {
  id: string
  slug: string
  title: string
  description: string | null
  question_count: number | null
  settings?: Record<string, unknown> | null
}

type TrainingTeamRow = {
  id: string
  event_id: string
  name: string
  elapsed_minutes: number | null
  status: string | null
}

type TrainingScoreRow = {
  team_id: string
  question_id: number
  transaction_ok: boolean | null
  context_ok: boolean | null
  evidence_ok: boolean | null
  note: string | null
}

function normalizeEventSlug(value?: string | null) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return normalized || DEFAULT_TRAINING_EVENT_SLUG
}

function buildDefaultQuestionScores() {
  return TRAINING_QUESTIONS.reduce<Record<number, TrainingQuestionScore>>((acc, question) => {
    acc[question.id] = {
      questionId: question.id,
      transaction: false,
      context: false,
      evidence: false,
      note: null,
      points: 0,
    }
    return acc
  }, {})
}

function buildBoardTeam(team: TrainingTeamRow, scores: TrainingScoreRow[]): TrainingBoardTeam {
  const questionScores = buildDefaultQuestionScores()

  scores.forEach((row) => {
    const questionId = Number(row.question_id || 0)
    if (!questionScores[questionId]) return

    const transaction = Boolean(row.transaction_ok)
    const context = Boolean(row.context_ok)
    const evidence = Boolean(row.evidence_ok)
    const points = Number(transaction) + Number(context) + Number(evidence)

    questionScores[questionId] = {
      questionId,
      transaction,
      context,
      evidence,
      note: row.note || null,
      points,
    }
  })

  const scoreList = Object.values(questionScores)
  const totalScore = scoreList.reduce((sum, item) => sum + item.points, 0)
  const verifiedTasks = scoreList.filter((item) => item.points === 3).length
  const correctionCount = scoreList.filter((item) => item.points > 0 && item.points < 3).length
  const startedTasks = scoreList.filter((item) => item.points > 0).length
  const elapsedMinutes = Math.max(0, Number(team.elapsed_minutes || 0))
  const completionPercent = scoreList.length > 0
    ? Math.round((startedTasks / scoreList.length) * 100)
    : 0

  return {
    id: team.id,
    name: team.name,
    totalScore,
    verifiedTasks,
    correctionCount,
    timeMinutes: elapsedMinutes,
    elapsedMinutes,
    completionPercent,
    questionScores,
  }
}

function sortBoardTeams(teams: TrainingBoardTeam[]) {
  return [...teams].sort((left, right) => {
    if (right.totalScore !== left.totalScore) return right.totalScore - left.totalScore
    if (right.verifiedTasks !== left.verifiedTasks) return right.verifiedTasks - left.verifiedTasks
    if (left.correctionCount !== right.correctionCount) return left.correctionCount - right.correctionCount
    if (left.timeMinutes !== right.timeMinutes) return left.timeMinutes - right.timeMinutes
    return left.name.localeCompare(right.name)
  })
}

export async function ensureTrainingEvent(eventSlug?: string | null): Promise<TrainingEventRow> {
  const db = (await createAdminClient()) as any
  const slug = normalizeEventSlug(eventSlug)

  const { data: existingEvent, error: existingError } = await db
    .from('training_events')
    .select('id, slug, title, description, question_count, settings')
    .eq('slug', slug)
    .maybeSingle()

  if (existingError) {
    throw new Error(existingError.message || 'Gagal membaca event training.')
  }

  if (existingEvent?.id) {
    return existingEvent as TrainingEventRow
  }

  const defaultTitle = slug === DEFAULT_TRAINING_EVENT_SLUG
    ? 'Simulasi Bisnis ERP Nizam'
    : `Training Event ${slug}`

  const { data: insertedEvent, error: insertError } = await db
    .from('training_events')
    .insert({
      slug,
      title: defaultTitle,
      description: 'Board pelatihan ERP untuk simulasi bisnis real dan penilaian trainer.',
      is_active: true,
      question_count: TRAINING_QUESTIONS.length,
      settings: {
        source: 'edu-page',
      },
    })
    .select('id, slug, title, description, question_count, settings')
    .single()

  if (!insertError && insertedEvent?.id) {
    return insertedEvent as TrainingEventRow
  }

  const { data: fallbackEvent, error: fallbackError } = await db
    .from('training_events')
    .select('id, slug, title, description, question_count, settings')
    .eq('slug', slug)
    .maybeSingle()

  if (fallbackError || !fallbackEvent?.id) {
    throw new Error(insertError?.message || fallbackError?.message || 'Gagal membuat event training.')
  }

  return fallbackEvent as TrainingEventRow
}

export async function getTrainingBoardData(eventSlug?: string | null): Promise<TrainingBoardData> {
  const db = (await createAdminClient()) as any
  const event = await ensureTrainingEvent(eventSlug)

  const { data: teamRows, error: teamError } = await db
    .from('training_teams')
    .select('id, event_id, name, elapsed_minutes, status')
    .eq('event_id', event.id)
    .neq('status', 'ARCHIVED')
    .order('created_at', { ascending: true })

  if (teamError) {
    throw new Error(teamError.message || 'Gagal membaca daftar tim training.')
  }

  const teams = (Array.isArray(teamRows) ? teamRows : []) as TrainingTeamRow[]
  const teamIds = teams.map((team) => team.id).filter(Boolean)

  let scoreRows: TrainingScoreRow[] = []
  if (teamIds.length > 0) {
    const { data: rawScores, error: scoreError } = await db
      .from('training_team_scores')
      .select('team_id, question_id, transaction_ok, context_ok, evidence_ok, note')
      .in('team_id', teamIds)

    if (scoreError) {
      throw new Error(scoreError.message || 'Gagal membaca skor training.')
    }

    scoreRows = (Array.isArray(rawScores) ? rawScores : []) as TrainingScoreRow[]
  }

  const scoresByTeamId = new Map<string, TrainingScoreRow[]>()
  scoreRows.forEach((row) => {
    const items = scoresByTeamId.get(row.team_id) || []
    items.push(row)
    scoresByTeamId.set(row.team_id, items)
  })

  const boardTeams = sortBoardTeams(
    teams.map((team) => buildBoardTeam(team, scoresByTeamId.get(team.id) || []))
  )

  return {
    event: {
      id: event.id,
      slug: event.slug,
      title: event.title,
      description: event.description || null,
    },
    maxScore: TRAINING_MAX_SCORE,
    questionCount: Number(event.question_count || TRAINING_QUESTIONS.length),
    teams: boardTeams,
  }
}
