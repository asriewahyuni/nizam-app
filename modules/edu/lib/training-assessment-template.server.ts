import { createAdminClient } from '@/lib/supabase/server'
import type { TrainingAssessmentTemplate, TrainingAssessmentTask } from './training-assessment-mvp'

// ── Re-export types for convenience ──
export type { TrainingAssessmentTemplate, TrainingAssessmentTask }

type TemplateRow = {
  id: string
  org_id: string
  course_slug: string
  document_title: string
  version: string
  effective_date: string
  purpose: string
  methods: string[]
  competent_when: string[]
  not_yet_competent_when: string[]
  theory_questions: string[]
  answer_guide: string[]
  practical_tasks: TrainingAssessmentTask[]
  performance_checklist: string[]
  evidence_checklist: string[]
  follow_up_guidance: string[]
  created_at: string
  updated_at: string
}

function rowToTemplate(row: TemplateRow): TrainingAssessmentTemplate {
  return {
    courseSlug: row.course_slug,
    documentTitle: row.document_title,
    version: row.version,
    effectiveDate: row.effective_date,
    purpose: row.purpose,
    methods: row.methods || [],
    competentWhen: row.competent_when || [],
    notYetCompetentWhen: row.not_yet_competent_when || [],
    theoryQuestions: row.theory_questions || [],
    answerGuide: row.answer_guide || [],
    practicalTasks: row.practical_tasks || [],
    performanceChecklist: row.performance_checklist || [],
    evidenceChecklist: row.evidence_checklist || [],
    followUpGuidance: row.follow_up_guidance || [],
  }
}

/**
 * Fetch an assessment template from DB for a given org + course slug.
 * Returns null if not found (caller falls back to hardcoded MVP).
 */
export async function getAssessmentTemplateFromDb(
  orgId: string,
  courseSlug: string,
): Promise<TrainingAssessmentTemplate | null> {
  const supabase = await createAdminClient()

  const { data, error } = await supabase
    .from('training_assessment_templates')
    .select('*')
    .eq('org_id', orgId)
    .eq('course_slug', courseSlug)
    .single()

  if (error || !data) return null

  return rowToTemplate(data as TemplateRow)
}

/**
 * Fetch ALL assessment templates for an org.
 */
export async function listAssessmentTemplatesForOrg(
  orgId: string,
): Promise<TrainingAssessmentTemplate[]> {
  const supabase = await createAdminClient()

  const { data, error } = await supabase
    .from('training_assessment_templates')
    .select('course_slug, document_title, version, updated_at')
    .eq('org_id', orgId)
    .order('course_slug')

  if (error || !data) return []

  return data.map((row: any) => ({
    courseSlug: row.course_slug,
    documentTitle: row.document_title,
    version: row.version,
    effectiveDate: '',
    purpose: '',
    methods: [],
    competentWhen: [],
    notYetCompetentWhen: [],
    theoryQuestions: [],
    answerGuide: [],
    practicalTasks: [],
    performanceChecklist: [],
    evidenceChecklist: [],
    followUpGuidance: [],
  }))
}

/**
 * Upsert (create or update) an assessment template.
 */
export async function upsertAssessmentTemplate(
  orgId: string,
  userId: string,
  template: TrainingAssessmentTemplate,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createAdminClient()

  const payload = {
    org_id: orgId,
    course_slug: template.courseSlug,
    document_title: template.documentTitle,
    version: template.version,
    effective_date: template.effectiveDate,
    purpose: template.purpose,
    methods: template.methods,
    competent_when: template.competentWhen,
    not_yet_competent_when: template.notYetCompetentWhen,
    theory_questions: template.theoryQuestions,
    answer_guide: template.answerGuide,
    practical_tasks: template.practicalTasks as any,
    performance_checklist: template.performanceChecklist,
    evidence_checklist: template.evidenceChecklist,
    follow_up_guidance: template.followUpGuidance,
    updated_by: userId,
  }

  // Check if exists
  const { data: existing } = await supabase
    .from('training_assessment_templates')
    .select('id')
    .eq('org_id', orgId)
    .eq('course_slug', template.courseSlug)
    .single()

  if (existing) {
    const { error } = await supabase
      .from('training_assessment_templates')
      .update(payload)
      .eq('org_id', orgId)
      .eq('course_slug', template.courseSlug)

    if (error) return { success: false, error: error.message }
  } else {
    const { error } = await supabase
      .from('training_assessment_templates')
      .insert({ ...payload, created_by: userId })

    if (error) return { success: false, error: error.message }
  }

  return { success: true }
}

/**
 * Delete an assessment template.
 */
export async function deleteAssessmentTemplate(
  orgId: string,
  courseSlug: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createAdminClient()

  const { error } = await supabase
    .from('training_assessment_templates')
    .delete()
    .eq('org_id', orgId)
    .eq('course_slug', courseSlug)

  if (error) return { success: false, error: error.message }
  return { success: true }
}
