import React from 'react'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getLmsAdminMembers, getLmsCourseOptions } from '@/modules/edu/actions/lms-members.actions'
import { MembersAdminClient } from './MembersAdminClient'

export const metadata = {
  title: 'Member Directory & Gamification — Nizam LMS Admin',
  description:
    'Comprehensive member directory with advanced search, filters, gamification levels, badge tracking, and user history timelines.',
}

interface MembersAdminPageProps {
  searchParams: Promise<{
    search?: string
    levelFilter?: string
    courseFilter?: string
    courseId?: string
    sortBy?: string
    page?: string
  }>
}

export default async function MembersAdminPage({ searchParams }: MembersAdminPageProps) {
  const orgData = await getActiveOrg()
  if (!orgData || !['owner', 'admin'].includes(orgData.role)) {
    return null
  }

  const params = await searchParams
  const search = params.search || ''
  const levelFilter = params.levelFilter || 'ALL'
  const courseFilter = params.courseFilter || 'ALL'
  const courseId = params.courseId || ''
  const sortBy = params.sortBy || 'level_desc'
  const page = Math.max(1, Number(params.page) || 1)
  const pageSize = 25

  const [{ members, settings, totalCount, totalPages }, courseOptions] = await Promise.all([
    getLmsAdminMembers(search, levelFilter, courseFilter, sortBy, page, pageSize, courseId),
    getLmsCourseOptions(),
  ])

  return (
    <MembersAdminClient
      orgSlug={orgData.org.slug}
      initialMembers={members}
      initialSettings={settings}
      courseOptions={courseOptions}
      totalCount={totalCount}
      page={page}
      pageSize={pageSize}
      totalPages={totalPages}
    />
  )
}
