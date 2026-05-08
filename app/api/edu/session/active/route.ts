import { NextResponse } from 'next/server'
import {
  clearEduSessionCookie,
  getCurrentTrainingSessionState,
  validateCurrentTrainingSession,
} from '@/modules/edu/lib/session.server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const state = await getCurrentTrainingSessionState()
  return NextResponse.json(state)
}

export async function POST() {
  const state = await validateCurrentTrainingSession()
  return NextResponse.json(state)
}

export async function DELETE() {
  await clearEduSessionCookie()
  return NextResponse.json({ ok: true })
}
