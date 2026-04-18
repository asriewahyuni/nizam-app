import {
  TRAINING_PHASE_LABELS,
  TRAINING_QUESTIONS,
  type TrainingBoardData,
  type TrainingPhase,
} from '@/lib/edu/training-simulation'

/**
 * Ringkasan ringan untuk dashboard kompetensi agar halaman baru tetap
 * terisolasi dari flow simulasi/training yang sudah ada.
 */
export function buildCompetencyOverview(board: TrainingBoardData | null) {
  const teams = Array.isArray(board?.teams) ? board.teams : []
  const questionCount = Number(board?.questionCount || TRAINING_QUESTIONS.length || 0)
  const maxScore = Number(board?.maxScore || 0)

  const totalTeams = teams.length
  const activeTeams = teams.filter((team) => Number(team.completionPercent || 0) > 0).length
  const averageCompletion = totalTeams > 0
    ? Math.round(teams.reduce((sum, team) => sum + Number(team.completionPercent || 0), 0) / totalTeams)
    : 0
  const averageScore = totalTeams > 0
    ? Math.round((teams.reduce((sum, team) => sum + Number(team.totalScore || 0), 0) / totalTeams) * 10) / 10
    : 0

  const phaseSummaries = (Object.keys(TRAINING_PHASE_LABELS) as TrainingPhase[]).map((phase) => {
    const phaseQuestions = TRAINING_QUESTIONS.filter((question) => question.phase === phase)
    const phaseQuestionIds = new Set(phaseQuestions.map((question) => question.id))
    const completedChecks = teams.reduce((sum, team) => {
      return sum + phaseQuestions.reduce((phaseSum, question) => {
        const score = team.questionScores?.[question.id]
        return phaseSum + Number(score?.points || 0)
      }, 0)
    }, 0)
    const maxChecks = totalTeams * phaseQuestions.length * 3

    return {
      key: phase,
      label: TRAINING_PHASE_LABELS[phase].label,
      description: TRAINING_PHASE_LABELS[phase].description,
      questionCount: phaseQuestionIds.size,
      completionPercent: maxChecks > 0 ? Math.round((completedChecks / maxChecks) * 100) : 0,
    }
  })

  return {
    totalTeams,
    activeTeams,
    averageCompletion,
    averageScore,
    questionCount,
    maxScore,
    topTeams: teams.slice(0, 5),
    phaseSummaries,
  }
}
