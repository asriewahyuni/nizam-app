import { type NextRequest, NextResponse } from 'next/server'
import { signOutServerSession } from '@/lib/auth/signout.server'

export async function GET(request: NextRequest) {
  await signOutServerSession()
  const origin = new URL(request.url).origin
  return NextResponse.redirect(`${origin}/anggota/login`)
}
