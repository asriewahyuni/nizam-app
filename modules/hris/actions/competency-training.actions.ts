'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getCurrentAccessibleBranch, isAccessibleBranch } from '@/modules/organization/lib/branch-access.server'
import { getLearningAccessContext } from '@/modules/edu/lib/learning-access.server'

type TrainingStatus = 'DRAFT' | 'PLANNED' | 'ONGOING' | 'COMPLETED' | 'ARCHIVED'
type TrainingType = 'INTERNAL' | 'EXTERNAL' | 'CERTIFICATION' | 'COACHING'
type DeliveryMode = 'CLASSROOM' | 'ONLINE' | 'HYBRID' | 'ON_THE_JOB'
type ScopeType = 'ORG' | 'BRANCH'
type ParticipantStatus = 'ASSIGNED' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
type SessionStatus = 'SCHEDULED' | 'DONE' | 'CANCELLED'
type EvaluationType = 'PRETEST' | 'POSTTEST' | 'OBSERVATION' | 'ASSESSMENT' | 'CERTIFICATION'
type EvaluationResultStatus = 'OBSERVED' | 'PASS' | 'REMEDIAL' | 'FAIL'

type TrainingContext = {
  id: string
  org_id: string
  branch_id: string | null
  scope_type: ScopeType
  title: string
}

type EmployeeContext = {
  id: string
  org_id: string
  branch_id: string | null
  employment_status: string | null
}

function normalizeText(value: FormDataEntryValue | null, maxLength = 200) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLength)
}

function normalizePlainText(value: unknown, maxLength = 200) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLength)
}

function normalizeLongText(value: FormDataEntryValue | null, maxLength = 4000) {
  return String(value || '').trim().slice(0, maxLength)
}

function normalizeStatus(value: FormDataEntryValue | null): TrainingStatus {
  const normalized = String(value || '').trim().toUpperCase()
  if (normalized === 'PLANNED' || normalized === 'ONGOING' || normalized === 'COMPLETED' || normalized === 'ARCHIVED') {
    return normalized
  }
  return 'DRAFT'
}

function normalizeTrainingType(value: FormDataEntryValue | null): TrainingType {
  const normalized = String(value || '').trim().toUpperCase()
  if (normalized === 'EXTERNAL' || normalized === 'CERTIFICATION' || normalized === 'COACHING') {
    return normalized
  }
  return 'INTERNAL'
}

function normalizeDeliveryMode(value: FormDataEntryValue | null): DeliveryMode {
  const normalized = String(value || '').trim().toUpperCase()
  if (normalized === 'ONLINE' || normalized === 'HYBRID' || normalized === 'ON_THE_JOB') {
    return normalized
  }
  return 'CLASSROOM'
}

function normalizeScopeType(value: FormDataEntryValue | null): ScopeType {
  return String(value || '').trim().toUpperCase() === 'BRANCH' ? 'BRANCH' : 'ORG'
}

function normalizeParticipantStatus(value: FormDataEntryValue | null): ParticipantStatus {
  const normalized = String(value || '').trim().toUpperCase()
  if (normalized === 'CONFIRMED' || normalized === 'IN_PROGRESS' || normalized === 'COMPLETED' || normalized === 'CANCELLED') {
    return normalized
  }
  return 'ASSIGNED'
}

function normalizeSessionStatus(value: FormDataEntryValue | null): SessionStatus {
  const normalized = String(value || '').trim().toUpperCase()
  if (normalized === 'DONE' || normalized === 'CANCELLED') {
    return normalized
  }
  return 'SCHEDULED'
}

function normalizeEvaluationType(value: FormDataEntryValue | null): EvaluationType {
  const normalized = String(value || '').trim().toUpperCase()
  if (normalized === 'PRETEST' || normalized === 'POSTTEST' || normalized === 'OBSERVATION' || normalized === 'CERTIFICATION') {
    return normalized
  }
  return 'ASSESSMENT'
}

function normalizeEvaluationResult(value: FormDataEntryValue | null): EvaluationResultStatus {
  const normalized = String(value || '').trim().toUpperCase()
  if (normalized === 'PASS' || normalized === 'REMEDIAL' || normalized === 'FAIL') {
    return normalized
  }
  return 'OBSERVED'
}

function normalizeDate(value: FormDataEntryValue | null) {
  const normalized = String(value || '').trim()
  if (!normalized) return null
  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) return null
  return normalized
}

function normalizeDurationHours(value: FormDataEntryValue | null) {
  const parsed = Number(String(value || '').trim())
  if (!Number.isFinite(parsed) || parsed < 0) return 0
  return Math.round(parsed * 100) / 100
}

function normalizeScore(value: FormDataEntryValue | null) {
  const raw = String(value || '').trim()
  if (!raw) return null
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) return null
  return Math.round(parsed * 100) / 100
}

function normalizeTime(value: FormDataEntryValue | null) {
  const normalized = String(value || '').trim()
  return normalized || null
}

function buildLearningRedirect(params: Record<string, string>, hash = 'buat-pelatihan') {
  const search = new URLSearchParams(params)
  const query = search.toString()
  return `/learning${query ? `?${query}` : ''}#${hash}`
}

function buildTrainingDetailRedirect(trainingId: string, params: Record<string, string>, hash = 'overview') {
  const search = new URLSearchParams(params)
  const query = search.toString()
  return `/learning/trainings/${trainingId}${query ? `?${query}` : ''}#${hash}`
}

async function requireTrainingManager() {
  const orgData = await getActiveOrg()
  if (!orgData) {
    redirect('/onboarding')
  }

  const learningAccess = await getLearningAccessContext({
    userRole: orgData.role,
    permissions: orgData.permissions,
    email: orgData.user?.email,
  })

  if (!learningAccess.canManage) {
    redirect(buildLearningRedirect({
      error: 'Anda memerlukan akses learning:write untuk membuat atau mengubah pelatihan.',
    }))
  }

  return { orgData, learningAccess }
}

async function getTrainingContext(orgId: string, trainingId: string): Promise<TrainingContext | null> {
  const admin = await createAdminClient()
  const { data } = await admin
    .from('hris_competency_trainings')
    .select('id, org_id, branch_id, scope_type, title')
    .eq('org_id', orgId)
    .eq('id', trainingId)
    .maybeSingle()

  if (!data?.id) return null

  return {
    id: String(data.id),
    org_id: String(data.org_id),
    branch_id: data.branch_id ? String(data.branch_id) : null,
    scope_type: String(data.scope_type || '').trim().toUpperCase() === 'BRANCH' ? 'BRANCH' : 'ORG',
    title: String(data.title || 'Pelatihan'),
  }
}

async function getEmployeeContext(orgId: string, employeeId: string): Promise<EmployeeContext | null> {
  const admin = await createAdminClient()
  const { data } = await admin
    .from('employees')
    .select('id, org_id, branch_id, employment_status')
    .eq('org_id', orgId)
    .eq('id', employeeId)
    .maybeSingle()

  if (!data?.id) return null

  return {
    id: String(data.id),
    org_id: String(data.org_id),
    branch_id: data.branch_id ? String(data.branch_id) : null,
    employment_status: data.employment_status ? String(data.employment_status) : null,
  }
}

async function ensureTrainingBranchAccess(orgId: string, branchId: string | null) {
  const trimmedBranchId = normalizePlainText(branchId)
  if (!trimmedBranchId) return { branchId: null as string | null }

  const hasAccess = await isAccessibleBranch(orgId, trimmedBranchId)
  if (!hasAccess) {
    return { error: 'Anda tidak memiliki akses ke unit yang dipilih.' }
  }

  return { branchId: trimmedBranchId }
}

/**
 * Membuat program pelatihan internal baru untuk entitas aktif atau unit aktif.
 */
export async function createCompetencyTraining(formData: FormData) {
  const { orgData } = await requireTrainingManager()

  const title = normalizeText(formData.get('title'), 160)
  if (title.length < 3) {
    redirect(buildLearningRedirect({ error: 'Judul pelatihan minimal 3 karakter.' }))
  }

  const skillCategory = normalizeText(formData.get('skillCategory'), 120) || 'General Business Skill'
  const targetRole = normalizeText(formData.get('targetRole'), 120) || null
  const trainingType = normalizeTrainingType(formData.get('trainingType'))
  const deliveryMode = normalizeDeliveryMode(formData.get('deliveryMode'))
  const scopeType = normalizeScopeType(formData.get('scopeType'))
  const status = normalizeStatus(formData.get('status'))
  const facilitatorName = normalizeText(formData.get('facilitatorName'), 120) || null
  const startDate = normalizeDate(formData.get('startDate'))
  const endDate = normalizeDate(formData.get('endDate'))
  const durationHours = normalizeDurationHours(formData.get('durationHours'))
  const objective = normalizeLongText(formData.get('objective')) || null
  const notes = normalizeLongText(formData.get('notes')) || null

  if (startDate && endDate && endDate < startDate) {
    redirect(buildLearningRedirect({ error: 'Tanggal selesai tidak boleh lebih awal dari tanggal mulai.' }))
  }

  let branchId: string | null = null
  if (scopeType === 'BRANCH') {
    const selectedBranchId = normalizeText(formData.get('branchId'), 120)
    const fallbackBranch = await getCurrentAccessibleBranch(orgData.org.id)
    branchId = selectedBranchId || fallbackBranch?.id || null

    if (!branchId) {
      redirect(buildLearningRedirect({ error: 'Pilih unit target untuk pelatihan tingkat unit.' }))
    }

    const branchAccess = await ensureTrainingBranchAccess(orgData.org.id, branchId)
    if ('error' in branchAccess) {
      redirect(buildLearningRedirect({ error: branchAccess.error }))
    }
    branchId = branchAccess.branchId
  }

  const admin = await createAdminClient()
  const { error } = await admin
    .from('hris_competency_trainings')
    .insert({
      org_id: orgData.org.id,
      branch_id: branchId,
      title,
      skill_category: skillCategory,
      target_role: targetRole,
      training_type: trainingType,
      delivery_mode: deliveryMode,
      scope_type: scopeType,
      status,
      facilitator_name: facilitatorName,
      start_date: startDate,
      end_date: endDate,
      duration_hours: durationHours,
      objective,
      notes,
      created_by: orgData.user?.id || null,
      updated_by: orgData.user?.id || null,
    })

  if (error) {
    redirect(buildLearningRedirect({ error: error.message || 'Gagal membuat pelatihan baru.' }))
  }

  revalidatePath('/learning')
  redirect(buildLearningRedirect({ created: '1' }))
}

export async function updateCompetencyTrainingStatus(formData: FormData) {
  const { orgData } = await requireTrainingManager()
  const trainingId = normalizeText(formData.get('trainingId'), 120)
  const status = normalizeStatus(formData.get('status'))

  if (!trainingId) {
    redirect(buildLearningRedirect({ error: 'Pelatihan tidak valid.' }, 'daftar-pelatihan'))
  }

  const admin = await createAdminClient()
  const { error } = await admin
    .from('hris_competency_trainings')
    .update({
      status,
      updated_by: orgData.user?.id || null,
    })
    .eq('id', trainingId)
    .eq('org_id', orgData.org.id)

  if (error) {
    redirect(buildLearningRedirect({ error: error.message || 'Gagal memperbarui status pelatihan.' }, 'daftar-pelatihan'))
  }

  revalidatePath('/learning')
  redirect(buildLearningRedirect({ updated: '1' }, 'daftar-pelatihan'))
}

export async function deleteCompetencyTraining(formData: FormData) {
  const { orgData } = await requireTrainingManager()
  const trainingId = normalizeText(formData.get('trainingId'), 120)

  if (!trainingId) {
    redirect(buildLearningRedirect({ error: 'Pelatihan tidak valid.' }, 'daftar-pelatihan'))
  }

  const admin = await createAdminClient()
  const { error } = await admin
    .from('hris_competency_trainings')
    .delete()
    .eq('id', trainingId)
    .eq('org_id', orgData.org.id)

  if (error) {
    redirect(buildLearningRedirect({ error: error.message || 'Gagal menghapus pelatihan.' }, 'daftar-pelatihan'))
  }

  revalidatePath('/learning')
  redirect(buildLearningRedirect({ deleted: '1' }, 'daftar-pelatihan'))
}

export async function assignCompetencyTrainingParticipant(formData: FormData) {
  const { orgData } = await requireTrainingManager()
  const trainingId = normalizeText(formData.get('trainingId'), 120)
  const employeeId = normalizeText(formData.get('employeeId'), 120)
  const participantStatus = normalizeParticipantStatus(formData.get('participantStatus'))
  const note = normalizeLongText(formData.get('note')) || null

  if (!trainingId || !employeeId) {
    redirect(buildLearningRedirect({ error: 'Pelatihan atau karyawan tidak valid.' }))
  }

  const training = await getTrainingContext(orgData.org.id, trainingId)
  if (!training) {
    redirect(buildLearningRedirect({ error: 'Pelatihan tidak ditemukan.' }))
  }

  const employee = await getEmployeeContext(orgData.org.id, employeeId)
  if (!employee) {
    redirect(buildTrainingDetailRedirect(trainingId, { error: 'Karyawan tidak ditemukan.' }, 'peserta'))
  }

  const employmentStatus = normalizePlainText(employee.employment_status).toUpperCase()
  if (employmentStatus === 'RESIGNED' || employmentStatus === 'TERMINATED') {
    redirect(buildTrainingDetailRedirect(trainingId, { error: 'Karyawan nonaktif tidak dapat ditambahkan ke pelatihan.' }, 'peserta'))
  }

  if (training.scope_type === 'BRANCH' && normalizePlainText(employee.branch_id) !== normalizePlainText(training.branch_id)) {
    redirect(buildTrainingDetailRedirect(trainingId, { error: 'Karyawan harus berasal dari unit yang sama dengan pelatihan branch-scope.' }, 'peserta'))
  }

  const admin = await createAdminClient()
  const { error } = await admin
    .from('hris_competency_training_participants')
    .upsert({
      training_id: training.id,
      org_id: orgData.org.id,
      employee_id: employee.id,
      status: participantStatus,
      note,
      assigned_by: orgData.user?.id || null,
      completed_at: participantStatus === 'COMPLETED' ? new Date().toISOString() : null,
    }, {
      onConflict: 'training_id,employee_id',
    })

  if (error) {
    redirect(buildTrainingDetailRedirect(trainingId, { error: error.message || 'Gagal menambahkan peserta pelatihan.' }, 'peserta'))
  }

  revalidatePath('/learning')
  revalidatePath(`/learning/trainings/${trainingId}`)
  redirect(buildTrainingDetailRedirect(trainingId, { participantSaved: '1' }, 'peserta'))
}

export async function updateCompetencyTrainingParticipantStatus(formData: FormData) {
  const { orgData } = await requireTrainingManager()
  const trainingId = normalizeText(formData.get('trainingId'), 120)
  const participantId = normalizeText(formData.get('participantId'), 120)
  const status = normalizeParticipantStatus(formData.get('status'))

  if (!trainingId || !participantId) {
    redirect(buildLearningRedirect({ error: 'Peserta pelatihan tidak valid.' }))
  }

  const completedAt = status === 'COMPLETED' ? new Date().toISOString() : null
  const admin = await createAdminClient()
  const { error } = await admin
    .from('hris_competency_training_participants')
    .update({
      status,
      completed_at: completedAt,
    })
    .eq('id', participantId)
    .eq('training_id', trainingId)
    .eq('org_id', orgData.org.id)

  if (error) {
    redirect(buildTrainingDetailRedirect(trainingId, { error: error.message || 'Gagal memperbarui status peserta.' }, 'peserta'))
  }

  revalidatePath('/learning')
  revalidatePath(`/learning/trainings/${trainingId}`)
  redirect(buildTrainingDetailRedirect(trainingId, { participantUpdated: '1' }, 'peserta'))
}

export async function createCompetencyTrainingSession(formData: FormData) {
  const { orgData } = await requireTrainingManager()
  const trainingId = normalizeText(formData.get('trainingId'), 120)
  const title = normalizeText(formData.get('title'), 160)
  const sessionDate = normalizeDate(formData.get('sessionDate'))
  const startTime = normalizeTime(formData.get('startTime'))
  const endTime = normalizeTime(formData.get('endTime'))
  const location = normalizeText(formData.get('location'), 160) || null
  const facilitatorName = normalizeText(formData.get('facilitatorName'), 120) || null
  const status = normalizeSessionStatus(formData.get('status'))
  const note = normalizeLongText(formData.get('note')) || null

  if (!trainingId || title.length < 3) {
    redirect(buildLearningRedirect({ error: 'Judul sesi minimal 3 karakter.' }))
  }

  const training = await getTrainingContext(orgData.org.id, trainingId)
  if (!training) {
    redirect(buildLearningRedirect({ error: 'Pelatihan tidak ditemukan.' }))
  }

  let branchId: string | null = training.branch_id
  if (training.scope_type === 'ORG') {
    const selectedBranchId = normalizeText(formData.get('branchId'), 120) || null
    if (selectedBranchId) {
      const branchAccess = await ensureTrainingBranchAccess(orgData.org.id, selectedBranchId)
      if ('error' in branchAccess) {
        redirect(buildTrainingDetailRedirect(trainingId, { error: branchAccess.error }, 'sesi'))
      }
      branchId = branchAccess.branchId
    } else {
      branchId = null
    }
  }

  const admin = await createAdminClient()
  const { error } = await admin
    .from('hris_competency_training_sessions')
    .insert({
      training_id: training.id,
      org_id: orgData.org.id,
      branch_id: branchId,
      title,
      session_date: sessionDate,
      start_time: startTime,
      end_time: endTime,
      location,
      facilitator_name: facilitatorName,
      status,
      note,
      created_by: orgData.user?.id || null,
      updated_by: orgData.user?.id || null,
    })

  if (error) {
    redirect(buildTrainingDetailRedirect(trainingId, { error: error.message || 'Gagal membuat sesi pelatihan.' }, 'sesi'))
  }

  revalidatePath('/learning')
  revalidatePath(`/learning/trainings/${trainingId}`)
  redirect(buildTrainingDetailRedirect(trainingId, { sessionSaved: '1' }, 'sesi'))
}

export async function updateCompetencyTrainingSessionStatus(formData: FormData) {
  const { orgData } = await requireTrainingManager()
  const trainingId = normalizeText(formData.get('trainingId'), 120)
  const sessionId = normalizeText(formData.get('sessionId'), 120)
  const status = normalizeSessionStatus(formData.get('status'))

  if (!trainingId || !sessionId) {
    redirect(buildLearningRedirect({ error: 'Sesi pelatihan tidak valid.' }))
  }

  const admin = await createAdminClient()
  const { error } = await admin
    .from('hris_competency_training_sessions')
    .update({
      status,
      updated_by: orgData.user?.id || null,
    })
    .eq('id', sessionId)
    .eq('training_id', trainingId)
    .eq('org_id', orgData.org.id)

  if (error) {
    redirect(buildTrainingDetailRedirect(trainingId, { error: error.message || 'Gagal memperbarui status sesi.' }, 'sesi'))
  }

  revalidatePath('/learning')
  revalidatePath(`/learning/trainings/${trainingId}`)
  redirect(buildTrainingDetailRedirect(trainingId, { sessionUpdated: '1' }, 'sesi'))
}

export async function recordCompetencyTrainingEvaluation(formData: FormData) {
  const { orgData } = await requireTrainingManager()
  const trainingId = normalizeText(formData.get('trainingId'), 120)
  const participantId = normalizeText(formData.get('participantId'), 120)
  const sessionId = normalizeText(formData.get('sessionId'), 120) || null
  const evaluationType = normalizeEvaluationType(formData.get('evaluationType'))
  const resultStatus = normalizeEvaluationResult(formData.get('resultStatus'))
  const score = normalizeScore(formData.get('score'))
  const note = normalizeLongText(formData.get('note')) || null
  const evaluatedAt = normalizeDate(formData.get('evaluatedAt')) || new Date().toISOString()

  if (!trainingId || !participantId) {
    redirect(buildLearningRedirect({ error: 'Data evaluasi tidak valid.' }))
  }

  const admin = await createAdminClient()
  const { data: participant } = await admin
    .from('hris_competency_training_participants')
    .select('id, training_id, org_id, status')
    .eq('id', participantId)
    .eq('training_id', trainingId)
    .eq('org_id', orgData.org.id)
    .maybeSingle()

  if (!participant?.id) {
    redirect(buildTrainingDetailRedirect(trainingId, { error: 'Peserta pelatihan tidak ditemukan.' }, 'evaluasi'))
  }

  if (sessionId) {
    const { data: session } = await admin
      .from('hris_competency_training_sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('training_id', trainingId)
      .eq('org_id', orgData.org.id)
      .maybeSingle()

    if (!session?.id) {
      redirect(buildTrainingDetailRedirect(trainingId, { error: 'Sesi evaluasi tidak ditemukan pada pelatihan ini.' }, 'evaluasi'))
    }
  }

  const evaluatorName = normalizePlainText(
    orgData.user?.user_metadata?.full_name
    || orgData.user?.user_metadata?.name
    || orgData.user?.email
    || 'Penilai NIZAM',
    120,
  ) || 'Penilai NIZAM'

  const { error } = await admin
    .from('hris_competency_training_evaluations')
    .insert({
      training_id: trainingId,
      org_id: orgData.org.id,
      participant_id: participantId,
      session_id: sessionId,
      evaluator_name: evaluatorName,
      evaluation_type: evaluationType,
      result_status: resultStatus,
      score,
      note,
      evaluated_at: evaluatedAt,
      created_by: orgData.user?.id || null,
      updated_by: orgData.user?.id || null,
    })

  if (error) {
    redirect(buildTrainingDetailRedirect(trainingId, { error: error.message || 'Gagal menyimpan evaluasi peserta.' }, 'evaluasi'))
  }

  if (resultStatus === 'PASS') {
    await admin
      .from('hris_competency_training_participants')
      .update({
        status: 'COMPLETED',
        completed_at: new Date().toISOString(),
      })
      .eq('id', participantId)
      .eq('training_id', trainingId)
      .eq('org_id', orgData.org.id)
  } else if (resultStatus === 'REMEDIAL') {
    await admin
      .from('hris_competency_training_participants')
      .update({
        status: 'IN_PROGRESS',
        completed_at: null,
      })
      .eq('id', participantId)
      .eq('training_id', trainingId)
      .eq('org_id', orgData.org.id)
  }

  revalidatePath('/learning')
  revalidatePath(`/learning/trainings/${trainingId}`)
  redirect(buildTrainingDetailRedirect(trainingId, { evaluationSaved: '1' }, 'evaluasi'))
}
