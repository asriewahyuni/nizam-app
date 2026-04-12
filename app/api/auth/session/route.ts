/**
 * app/api/auth/session/route.ts
 * Returns current internal auth session for browser clients.
 */

import { NextResponse } from 'next/server'
import { getInternalAuthSession } from '@/lib/auth/internal-auth.server'

export async function GET() {
  try {
    const session = await getInternalAuthSession()
    if (!session?.user) {
      return NextResponse.json({ session: null, user: null })
    }
    return NextResponse.json({
      session: {
        access_token: `internal:${session.sessionId}`,
        user: session.user,
      },
      user: session.user,
    })
  } catch (e: any) {
    return NextResponse.json({ session: null, user: null, error: e.message })
  }
}
