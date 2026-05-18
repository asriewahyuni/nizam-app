import Link from 'next/link'
import { unstable_noStore as noStore } from 'next/cache'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, Save, Plus, Trash2 } from 'lucide-react'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getLearningAccessContext } from '@/modules/edu/lib/learning-access.server'
import { getTrainingCourseBySlug } from '@/modules/edu/lib/training-center-mvp'
import { getAssessmentTemplateFromDb } from '@/modules/edu/lib/training-assessment-template.server'
import { getTrainingAssessmentByCourseSlug } from '@/modules/edu/lib/training-assessment-mvp'
import type { TrainingAssessmentTemplate, TrainingAssessmentTask } from '@/modules/edu/lib/training-assessment-mvp'
import { AssessmentTemplateEditor } from './AssessmentTemplateEditor'

export default async function EditAssessmentTemplatePage(props: {
  params: Promise<{ courseSlug: string }>
  searchParams: Promise<{ saved?: string; error?: string }>
}) {
  noStore()

  const orgData = await getActiveOrg()
  if (!orgData) return redirect('/onboarding')

  const access = await getLearningAccessContext({
    userRole: orgData.role,
    permissions: orgData.permissions,
    email: orgData.user?.email,
  })
  if (!access.canManage) return redirect('/lms')

  const params = await props.params
  const course = getTrainingCourseBySlug(params.courseSlug)
  if (!course) notFound()

  // Try DB first, fallback to hardcoded MVP
  let template: TrainingAssessmentTemplate | null = await getAssessmentTemplateFromDb(
    orgData.org.id,
    params.courseSlug,
  )

  if (!template) {
    template = getTrainingAssessmentByCourseSlug(params.courseSlug) || null
  }

  // If still no template, provide empty skeleton
  if (!template) {
    template = {
      courseSlug: params.courseSlug,
      documentTitle: `Lembar Asesmen · ${course.title}`,
      version: '1.0',
      effectiveDate: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }),
      purpose: '',
      methods: [''],
      competentWhen: [''],
      notYetCompetentWhen: [''],
      theoryQuestions: [''],
      answerGuide: [''],
      practicalTasks: [{ title: '', instruction: '', expectedEvidence: '' }],
      performanceChecklist: [''],
      evidenceChecklist: [''],
      followUpGuidance: [''],
    }
  }

  const searchParams = await props.searchParams

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <Link
            href="/lms/admin/assessment-templates"
            className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 mb-2"
          >
            <ArrowLeft size={16} /> Kembali ke daftar template
          </Link>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
            Edit Template Asesmen
          </h1>
          <p className="text-sm text-slate-500">
            Course: <span className="font-semibold text-slate-700">{course.title}</span>
            {' · '}
            <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">{params.courseSlug}</code>
          </p>
        </div>
      </div>

      {/* ── Saved/Error Alert ── */}
      {searchParams.saved === '1' && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-medium text-emerald-800">
          ✅ Template berhasil disimpan. Template ini sekarang akan digunakan saat assessor membuka halaman asesmen.
        </div>
      )}
      {searchParams.error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-sm font-medium text-red-800">
          ❌ Gagal menyimpan: {searchParams.error}
        </div>
      )}

      {/* ── Editor ── */}
      <AssessmentTemplateEditor
        courseSlug={params.courseSlug}
        template={template}
      />
    </div>
  )
}
