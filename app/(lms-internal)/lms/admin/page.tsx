import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getLmsCourses, getLmsBatches } from '@/modules/edu/actions/lms-commercial.actions'
import { queryPostgres } from '@/lib/db/postgres'
import { CatalogAdminClient } from './CatalogAdminClient'

export const metadata = {
  title: 'Course Catalog — Nizam LMS Admin',
  description: 'Manage all training programs. Edit, publish, and track courses from one place.',
}

export default async function CatalogAdminPage() {
  const orgData = await getActiveOrg()
  if (!orgData) return null

  const [courses, allBatches] = await Promise.all([
    getLmsCourses(orgData.org.id),
    getLmsBatches(orgData.org.id),
  ])

  // Lesson counts per course
  const { rows: lessonCounts } = await queryPostgres(`
    SELECT course_id, COUNT(*) as count
    FROM learning_lessons
    WHERE org_id = $1
    GROUP BY course_id
  `, [orgData.org.id])

  const lessonMap = new Map<string, number>(
    lessonCounts.map((r: Record<string, unknown>) => [r.course_id as string, Number(r.count)])
  )

  // Enrollment counts per course
  const { rows: enrollmentCounts } = await queryPostgres(`
    SELECT course_id, COUNT(*) as count
    FROM learning_enrollments
    WHERE org_id = $1
    GROUP BY course_id
  `, [orgData.org.id])

  const enrollmentMap = new Map<string, number>(
    enrollmentCounts.map((r: Record<string, unknown>) => [r.course_id as string, Number(r.count)])
  )

  const courseRows = (courses as Record<string, unknown>[]).map((c) => {
    const cid = c.id as string
    const courseBatches = (allBatches as Record<string, unknown>[]).filter(
      (b) => b.course_id === cid
    )
    const lessonCount = lessonMap.get(cid) || 0
    const enrolled = enrollmentMap.get(cid) || 0
    const relatedProducts = courseBatches.map((b) => b.name as string).join(', ') || '—'

    return {
      id: cid,
      slug: c.slug as string,
      title: c.title as string,
      isActive: Boolean(c.is_active),
      chapterCount: lessonCount > 0 ? 1 : 0,
      lessonCount,
      relatedProducts,
      enrolled,
      shortId: cid.split('-')[0].toUpperCase(),
    }
  })

  const activeCount = courseRows.filter((c) => c.isActive).length

  return (
    <CatalogAdminClient
      courses={courseRows}
      totalCount={courseRows.length}
      activeCount={activeCount}
    />
  )
}
