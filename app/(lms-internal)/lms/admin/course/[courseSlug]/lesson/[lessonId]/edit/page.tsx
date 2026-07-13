import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import EditLessonForm from './EditLessonForm'
import { createClient } from '@/lib/supabase/server'

export const metadata = {
  title: 'Edit Materi — Nizam LMS Admin',
}

export default async function EditLessonPage(props: { params: Promise<{ courseSlug: string; lessonId: string }> }) {
  const params = await props.params
  const orgData = await getActiveOrg()
  if (!orgData) return redirect('/onboarding')

  const supabase = await createClient()
  
  // Verify course exists and belongs to org
  const { data: course } = await supabase
    .from('learning_courses')
    .select('id, title')
    .eq('slug', params.courseSlug)
    .eq('org_id', orgData.org.id)
    .single()

  if (!course) return redirect('/lms/admin')

  // Get lesson
  const { data: lesson } = await supabase
    .from('learning_lessons')
    .select('*')
    .eq('id', params.lessonId)
    .eq('course_id', course.id)
    .single()

  if (!lesson) return redirect(`/lms/admin/course/${params.courseSlug}?tab=curriculum`)

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <Link href={`/lms/admin/course/${params.courseSlug}?tab=curriculum`} className="text-xs font-semibold text-slate-500 hover:text-indigo-600 mb-2 inline-block">
          &larr; Kembali ke Kurikulum
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Edit Materi</h1>
        <p className="mt-1 text-slate-500">
          Program: <span className="font-semibold text-slate-700">{course.title}</span>
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <EditLessonForm lesson={lesson} courseSlug={params.courseSlug} />
      </div>
    </div>
  )
}
