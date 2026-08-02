/**
 * Halaman manajemen peserta per-kursus.
 * Menampilkan list peserta, statistik progress, dan action admin.
 */
import React from 'react'
import { notFound } from 'next/navigation'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getLmsCourseBySlug } from '@/modules/edu/actions/lms-commercial.actions'
import { getCourseParticipants } from '@/modules/edu/actions/lms-members.actions'
import { CourseParticipantsClient } from './CourseParticipantsClient'

export async function generateMetadata({ params }: { params: Promise<{ courseSlug: string }> }) {
  const { courseSlug } = await params
  return {
    title: `Peserta Kursus — ${courseSlug} | Nizam LMS Admin`,
    description: 'Kelola peserta kursus: list, progress, ban, bulk add, dan export.',
  }
}

interface Props {
  params: Promise<{ courseSlug: string }>
  searchParams: Promise<{
    search?: string
    status?: string
    batchId?: string
    sortBy?: string
    page?: string
  }>
}

export default async function CourseParticipantsPage({ params, searchParams }: Props) {
  const orgData = await getActiveOrg()
  if (!orgData || !['owner', 'admin'].includes(orgData.role)) return null

  const { courseSlug } = await params
  const sp = await searchParams

  const course = await getLmsCourseBySlug(orgData.org.id, courseSlug)
  if (!course) return notFound()

  const page = Math.max(1, Number(sp.page) || 1)
  const status = (sp.status as 'ALL' | 'ACTIVE' | 'COMPLETED' | 'BANNED') || 'ALL'

  const data = await getCourseParticipants(courseSlug, {
    search: sp.search || '',
    status,
    batchId: sp.batchId || 'ALL',
    sortBy: sp.sortBy || 'started_desc',
    page,
    pageSize: 30,
  })

  return (
    <CourseParticipantsClient
      courseSlug={courseSlug}
      courseTitle={String(course.title)}
      initialData={data}
      initialFilters={{
        search: sp.search || '',
        status,
        batchId: sp.batchId || 'ALL',
        sortBy: sp.sortBy || 'started_desc',
        page,
      }}
    />
  )
}
