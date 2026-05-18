'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getLearningAccessContext } from '@/modules/edu/lib/learning-access.server'
import {
  upsertAssessmentTemplate,
  deleteAssessmentTemplate,
  type TrainingAssessmentTemplate,
} from '@/modules/edu/lib/training-assessment-template.server'

// ── Guard: only users who can manage LMS ──
async function requireLmsManage() {
  const orgData = await getActiveOrg()
  if (!orgData) throw redirect('/onboarding')

  const access = await getLearningAccessContext({
    userRole: orgData.role,
    permissions: orgData.permissions,
    email: orgData.user?.email,
  })

  if (!access.canManage) throw redirect('/lms')

  return {
    orgId: orgData.org.id,
    userId: orgData.user?.id || '',
    userEmail: orgData.user?.email || '',
  }
}

// ── Save (create/update) ──
export async function saveAssessmentTemplate(
  courseSlug: string,
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  'use server'
  const ctx = await requireLmsManage()

  const template: TrainingAssessmentTemplate = {
    courseSlug,
    documentTitle: String(formData.get('documentTitle') || ''),
    version: String(formData.get('version') || '1.0'),
    effectiveDate: String(formData.get('effectiveDate') || ''),
    purpose: String(formData.get('purpose') || ''),
    methods: parseArrayField(formData, 'methods'),
    competentWhen: parseArrayField(formData, 'competentWhen'),
    notYetCompetentWhen: parseArrayField(formData, 'notYetCompetentWhen'),
    theoryQuestions: parseArrayField(formData, 'theoryQuestions'),
    answerGuide: parseArrayField(formData, 'answerGuide'),
    practicalTasks: parsePracticalTasks(formData),
    performanceChecklist: parseArrayField(formData, 'performanceChecklist'),
    evidenceChecklist: parseArrayField(formData, 'evidenceChecklist'),
    followUpGuidance: parseArrayField(formData, 'followUpGuidance'),
  }

  const result = await upsertAssessmentTemplate(ctx.orgId, ctx.userId, template)

  if (result.success) {
    revalidatePath('/lms/admin/assessment-templates', 'layout')
    revalidatePath(`/lms/course/${courseSlug}/assessment`, 'layout')
  }

  return result
}

// ── Delete ──
export async function removeAssessmentTemplate(
  courseSlug: string,
): Promise<{ success: boolean; error?: string }> {
  'use server'
  const ctx = await requireLmsManage()

  const result = await deleteAssessmentTemplate(ctx.orgId, courseSlug)

  if (result.success) {
    revalidatePath('/lms/admin/assessment-templates', 'layout')
  }

  return result
}

// ── Helpers: parse array fields from FormData ──
function parseArrayField(formData: FormData, prefix: string): string[] {
  const result: string[] = []
  let i = 0
  while (true) {
    const val = formData.get(`${prefix}_${i}`)
    if (val === null) break
    const text = String(val).trim()
    if (text) result.push(text)
    i++
  }
  return result
}

function parsePracticalTasks(
  formData: FormData,
): { title: string; instruction: string; expectedEvidence: string }[] {
  const result: { title: string; instruction: string; expectedEvidence: string }[] = []
  let i = 0
  while (true) {
    const title = formData.get(`practicalTasks_${i}_title`)
    if (title === null) break
    const instruction = String(formData.get(`practicalTasks_${i}_instruction`) || '')
    const expectedEvidence = String(formData.get(`practicalTasks_${i}_expectedEvidence`) || '')
    const t = String(title).trim()
    if (t) {
      result.push({ title: t, instruction: instruction.trim(), expectedEvidence: expectedEvidence.trim() })
    }
    i++
  }
  return result
}
