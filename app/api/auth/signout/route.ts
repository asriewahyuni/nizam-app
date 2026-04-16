import { NextResponse } from 'next/server'
import { signOutServerSession } from '@/lib/auth/signout.server'

export async function POST() {
  await signOutServerSession()
  return NextResponse.json({ success: true })
}
