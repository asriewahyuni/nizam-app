import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { summarizeCompetencyTrainings, type CompetencyTrainingRecord } from '@/modules/hris/lib/competency-training.server'

const baseRecord: CompetencyTrainingRecord = {
  id: '1',
  orgId: 'org-1',
  branchId: null,
  branchName: null,
  branchCode: null,
  title: 'Pelatihan',
  skillCategory: 'Leadership',
  targetRole: null,
  trainingType: 'INTERNAL',
  deliveryMode: 'CLASSROOM',
  scopeType: 'ORG',
  status: 'DRAFT',
  facilitatorName: null,
  startDate: null,
  endDate: null,
  durationHours: 0,
  objective: null,
  notes: null,
  createdAt: '2026-05-07T00:00:00.000Z',
  updatedAt: '2026-05-07T00:00:00.000Z',
  participantCount: 0,
  sessionCount: 0,
  evaluationCount: 0,
}

describe('summarizeCompetencyTrainings', () => {
  it('counts records by scope and status', () => {
    const summary = summarizeCompetencyTrainings([
      baseRecord,
      { ...baseRecord, id: '2', status: 'PLANNED' },
      { ...baseRecord, id: '3', status: 'ONGOING', scopeType: 'BRANCH', branchId: 'branch-1' },
      { ...baseRecord, id: '4', status: 'COMPLETED', scopeType: 'BRANCH', branchId: 'branch-2' },
      { ...baseRecord, id: '5', status: 'ARCHIVED' },
    ])

    expect(summary).toEqual({
      total: 5,
      draft: 1,
      planned: 1,
      ongoing: 1,
      completed: 1,
      archived: 1,
      branchScoped: 2,
      orgScoped: 3,
    })
  })
})
