import { type NextRequest, NextResponse } from 'next/server'
import { signOutServerSession } from '@/lib/auth/signout.server'

export async function GET(request: NextRequest) {
  await signOutServerSession()
  // Baca Host header, bukan request.url — di belakang reverse proxy Railway,
  // request.url mencerminkan alamat bind internal (0.0.0.0:8080), bukan domain publik.
  const host = request.headers.get('host') || 'localhost:3000'
  const protocol = request.headers.get('x-forwarded-proto') || 'https'
  return NextResponse.redirect(`${protocol}://${host}/anggota/login`)
}
