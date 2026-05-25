import { NextResponse } from 'next/server'
import { buildSignOutRedirectUrl, signOutServerSession } from '@/lib/auth/signout.server'

export async function GET(request: Request) {
  await signOutServerSession()
  const { searchParams } = new URL(request.url)
  return NextResponse.redirect(buildSignOutRedirectUrl(request.url, searchParams.get('reason')))
}
