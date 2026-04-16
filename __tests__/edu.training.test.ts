import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createSupabaseMock, success } from './helpers/supabase-mock'

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  getSession: vi.fn(),
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: mocks.createAdminClient,
}))

vi.mock('@/modules/auth/actions/auth.actions', () => ({
  getSession: mocks.getSession,
}))

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
}))

import {
  TRAINING_MAX_SCORE,
  TRAINING_PHASE_LABELS,
  TRAINING_QUESTIONS,
} from '@/lib/edu/training-simulation'
import {
  createTrainingTeam,
  updateTrainingQuestionScore,
  updateTrainingTeamElapsedMinutes,
} from '@/modules/edu/actions/training.actions'
import {
  DEFAULT_TRAINING_EVENT_SLUG,
  getTrainingBoardData,
} from '@/modules/edu/lib/training.server'

describe('EDU Training Simulation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('keeps the curriculum aligned with the 15-question ERP simulation', () => {
    expect(TRAINING_MAX_SCORE).toBe(45)
    expect(TRAINING_QUESTIONS).toHaveLength(15)
    expect(Object.keys(TRAINING_PHASE_LABELS)).toEqual(['SETUP', 'OPERATIONS', 'CONTROL'])
    expect(TRAINING_QUESTIONS.map((question) => question.id)).toEqual(
      Array.from({ length: 15 }, (_, index) => index + 1)
    )
    expect(TRAINING_QUESTIONS.filter((question) => question.phase === 'SETUP')).toHaveLength(4)
    expect(TRAINING_QUESTIONS.filter((question) => question.phase === 'OPERATIONS')).toHaveLength(6)
    expect(TRAINING_QUESTIONS.filter((question) => question.phase === 'CONTROL')).toHaveLength(5)
    expect(TRAINING_QUESTIONS.every((question) => question.verification.length === 3)).toBe(true)
    expect(TRAINING_QUESTIONS[3]?.title).toBe('Transfer Modal dari Holding ke Anak')
    expect(TRAINING_QUESTIONS[14]?.title).toBe('Review Laporan Konsolidasi')
  })

  it('sorts leaderboard using score, verified tasks, corrections, then elapsed time', async () => {
    const adminSupabase = createSupabaseMock({
      tables: {
        training_events: [
          {
            maybeSingleResult: success({
              id: 'event-1',
              slug: DEFAULT_TRAINING_EVENT_SLUG,
              title: 'Simulasi Bisnis ERP Nizam',
              description: 'Event training',
              question_count: 15,
            }),
          },
        ],
        training_teams: [
          {
            result: success([
              { id: 'team-b', event_id: 'event-1', name: 'Tim Beta', elapsed_minutes: 120, status: 'ACTIVE' },
              { id: 'team-c', event_id: 'event-1', name: 'Tim Charlie', elapsed_minutes: 80, status: 'ACTIVE' },
              { id: 'team-a', event_id: 'event-1', name: 'Tim Alpha', elapsed_minutes: 90, status: 'ACTIVE' },
            ]),
          },
        ],
        training_team_scores: [
          {
            result: success([
              { team_id: 'team-a', question_id: 1, transaction_ok: true, context_ok: true, evidence_ok: true, note: null },
              { team_id: 'team-a', question_id: 2, transaction_ok: true, context_ok: true, evidence_ok: true, note: null },
              { team_id: 'team-b', question_id: 1, transaction_ok: true, context_ok: true, evidence_ok: true, note: null },
              { team_id: 'team-b', question_id: 2, transaction_ok: true, context_ok: true, evidence_ok: true, note: null },
              { team_id: 'team-c', question_id: 1, transaction_ok: true, context_ok: true, evidence_ok: true, note: null },
              { team_id: 'team-c', question_id: 2, transaction_ok: true, context_ok: true, evidence_ok: false, note: 'Butuh revisi bukti' },
              { team_id: 'team-c', question_id: 3, transaction_ok: true, context_ok: false, evidence_ok: false, note: 'Context salah' },
            ]),
          },
        ],
      },
    })

    mocks.createAdminClient.mockResolvedValue(adminSupabase.client)

    const board = await getTrainingBoardData(DEFAULT_TRAINING_EVENT_SLUG)

    expect(board.maxScore).toBe(45)
    expect(board.questionCount).toBe(15)
    expect(board.teams.map((team) => team.name)).toEqual(['Tim Alpha', 'Tim Beta', 'Tim Charlie'])
    expect(board.teams[0]).toEqual(expect.objectContaining({ totalScore: 6, verifiedTasks: 2, correctionCount: 0 }))
    expect(board.teams[2]).toEqual(expect.objectContaining({ totalScore: 6, verifiedTasks: 1, correctionCount: 2 }))
  })

  it('creates a team and seeds score rows for all training questions', async () => {
    const adminSupabase = createSupabaseMock({
      tables: {
        training_events: [
          {
            maybeSingleResult: success({
              id: 'event-1',
              slug: DEFAULT_TRAINING_EVENT_SLUG,
              title: 'Simulasi Bisnis ERP Nizam',
              description: null,
              question_count: 15,
            }),
          },
        ],
        training_teams: [
          {
            maybeSingleResult: success(null),
          },
          {
            singleResult: success({ id: 'team-1' }),
          },
        ],
        training_team_scores: [
          {
            result: success([]),
          },
        ],
      },
    })

    mocks.getSession.mockResolvedValue({ id: 'trainer-1', email: 'trainer@nizam.test' })
    mocks.createAdminClient.mockResolvedValue(adminSupabase.client)

    const result = await createTrainingTeam({
      teamName: '  Tim   Alpha  ',
      eventSlug: DEFAULT_TRAINING_EVENT_SLUG,
    })

    expect(result).toEqual({ ok: true, teamId: 'team-1' })

    const teamInsertCall = adminSupabase.calls.find(
      (call) => call.table === 'training_teams' && call.operations.some((operation) => operation.method === 'insert')
    )
    const teamInsertPayload = teamInsertCall?.operations.find((operation) => operation.method === 'insert')
      ?.args[0] as Record<string, unknown>

    expect(teamInsertPayload).toEqual(
      expect.objectContaining({
        event_id: 'event-1',
        name: 'Tim Alpha',
        elapsed_minutes: 0,
        status: 'ACTIVE',
        created_by: 'trainer-1',
      })
    )

    const scoreSeedCall = adminSupabase.calls.find(
      (call) => call.table === 'training_team_scores' && call.operations.some((operation) => operation.method === 'upsert')
    )
    const scoreSeedRows = scoreSeedCall?.operations.find((operation) => operation.method === 'upsert')
      ?.args[0] as Array<Record<string, unknown>>

    expect(scoreSeedRows).toHaveLength(15)
    expect(scoreSeedRows.map((row) => row.question_id)).toEqual(
      Array.from({ length: 15 }, (_, index) => index + 1)
    )
    expect(scoreSeedRows.every((row) => row.updated_by === 'trainer-1')).toBe(true)
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/edu')
  })

  it('updates only the selected criterion for a training question', async () => {
    const adminSupabase = createSupabaseMock({
      tables: {
        training_teams: [
          {
            maybeSingleResult: success({ id: 'team-1', event_id: 'event-1', name: 'Tim Alpha' }),
          },
        ],
        training_team_scores: [
          {
            maybeSingleResult: success({
              transaction_ok: true,
              context_ok: false,
              evidence_ok: false,
              note: 'Initial review',
            }),
          },
          {
            result: success([]),
          },
        ],
      },
    })

    mocks.getSession.mockResolvedValue({ id: 'trainer-1', email: 'trainer@nizam.test' })
    mocks.createAdminClient.mockResolvedValue(adminSupabase.client)

    const result = await updateTrainingQuestionScore({
      teamId: 'team-1',
      questionId: 11,
      criterion: 'evidence',
      value: true,
    })

    expect(result).toEqual({ ok: true, teamId: 'team-1' })

    const scoreUpdateCall = adminSupabase.calls.find(
      (call) => call.table === 'training_team_scores' && call.operations.some((operation) => operation.method === 'upsert')
    )
    const scoreUpdatePayload = scoreUpdateCall?.operations.find((operation) => operation.method === 'upsert')
      ?.args[0] as Record<string, unknown>

    expect(scoreUpdatePayload).toEqual(
      expect.objectContaining({
        team_id: 'team-1',
        question_id: 11,
        transaction_ok: true,
        context_ok: false,
        evidence_ok: true,
        note: 'Initial review',
        updated_by: 'trainer-1',
      })
    )
  })

  it('clamps elapsed minutes when trainer updates team duration', async () => {
    const adminSupabase = createSupabaseMock({
      tables: {
        training_teams: [
          {
            maybeSingleResult: success({ id: 'team-1', event_id: 'event-1', name: 'Tim Alpha' }),
          },
          {
            result: success([]),
          },
        ],
      },
    })

    mocks.getSession.mockResolvedValue({ id: 'trainer-1', email: 'trainer@nizam.test' })
    mocks.createAdminClient.mockResolvedValue(adminSupabase.client)

    const result = await updateTrainingTeamElapsedMinutes({
      teamId: 'team-1',
      elapsedMinutes: 90000,
    })

    expect(result).toEqual({ ok: true, teamId: 'team-1' })

    const durationUpdateCall = adminSupabase.calls.find(
      (call) => call.table === 'training_teams' && call.operations.some((operation) => operation.method === 'update')
    )
    const durationPayload = durationUpdateCall?.operations.find((operation) => operation.method === 'update')
      ?.args[0] as Record<string, unknown>

    expect(durationPayload).toEqual({ elapsed_minutes: 1440 })
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/edu')
  })
})
