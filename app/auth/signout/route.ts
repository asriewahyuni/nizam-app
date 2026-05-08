import { NextResponse } from 'next/server'
import { SIGNOUT_REDIRECT_URL, signOutServerSession } from '@/lib/auth/signout.server'

export async function GET() {
  await signOutServerSession()
  return NextResponse.redirect(new URL(SIGNOUT_REDIRECT_URL))
}
