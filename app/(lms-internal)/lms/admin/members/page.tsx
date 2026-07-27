import React from 'react'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getLmsAdminMembers } from '@/modules/edu/actions/lms-members.actions'
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
    sortBy?: string
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
  const sortBy = params.sortBy || 'level_desc'

  const { members, settings, totalCount } = await getLmsAdminMembers(
    search,
    levelFilter,
    courseFilter,
    sortBy
  )

  return (
    <MembersAdminClient
      initialMembers={members}
      initialSettings={settings}
      totalCount={totalCount}
    />
  )
}
