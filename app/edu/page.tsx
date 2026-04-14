import type { Metadata } from 'next'
import { unstable_noStore as noStore } from 'next/cache'
import EduSimulationClient from './EduSimulationClient'
import { getSession } from '@/modules/auth/actions/auth.actions'
import { DEFAULT_TRAINING_EVENT_SLUG, getTrainingBoardData } from '@/modules/edu/lib/training.server'

export const metadata: Metadata = {
  title: 'Simulasi EDU ERP',
  description: 'Halaman simulasi pelatihan ERP dengan 15 soal, rubrik skor, dan preview leaderboard.',
}

export default async function EduPage(props: { searchParams: Promise<{ event?: string }> }) {
  noStore()
  const searchParams = await props.searchParams
  const eventSlug = String(searchParams?.event || '').trim() || DEFAULT_TRAINING_EVENT_SLUG

  const [board, session] = await Promise.all([
    getTrainingBoardData(eventSlug),
    getSession(),
  ])

  return (
    <EduSimulationClient
      initialBoard={board}
      canManage={Boolean(session?.id)}
      trainerLabel={session?.email || null}
    />
  )
}
