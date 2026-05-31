import { NextResponse } from 'next/server'
import { signOutServerSession } from '@/lib/auth/signout.server'

export async function POST() {
  try {
  await signOutServerSession()
  return NextResponse.json({ success: true })
}

  } catch (err) {
    console.warn('[signout] Error:', err)
    return NextResponse.json({ success: false, error: 'Signout failed' }, { status: 500 })
  }