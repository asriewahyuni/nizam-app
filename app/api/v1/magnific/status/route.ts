/**
 * app/api/v1/magnific/status/route.ts
 *
 * Cek status task generate ekspresi.
 * GET /api/v1/magnific/status?taskId=xxx
 */

export const dynamic = 'force-dynamic'
export const revalidate = 0

import { type NextRequest, NextResponse } from 'next/server'
import { checkTaskStatus } from '@/lib/magnific/service'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const taskId = searchParams.get('taskId')

  if (!taskId) {
    return NextResponse.json(
      { success: false, error: 'Parameter "taskId" wajib diisi.' },
      { status: 400 }
    )
  }

  const result = await checkTaskStatus(taskId)
  if (!result.success) {
    return NextResponse.json(result, { status: 500 })
  }

  return NextResponse.json(result)
}
