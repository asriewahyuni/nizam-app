/**
 * app/api/v1/magnific/generate/route.ts
 *
 * API endpoint untuk generate ekspresi via Magnific API.
 * POST /api/v1/magnific/generate
 *
 * Body:
 *   { prompt: string, aspect_ratio?: string, negative_prompt?: string, style?: string }
 *
 * Response:
 *   { success: boolean, data?: MagnificTask, error?: string, remaining_today?: number }
 */

export const dynamic = 'force-dynamic'
export const revalidate = 0

import { type NextRequest, NextResponse } from 'next/server'
import { generateExpression } from '@/lib/magnific/service'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body.prompt || typeof body.prompt !== 'string' || body.prompt.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Parameter "prompt" wajib diisi dan harus berupa teks.' },
        { status: 400 }
      )
    }

    const result = await generateExpression({
      prompt: body.prompt.trim(),
      aspect_ratio: body.aspect_ratio || undefined,
      negative_prompt: body.negative_prompt || undefined,
      style: body.style || undefined,
    })

    if (!result.success) {
      const status = result.error?.includes('limit') ? 429 : 500
      return NextResponse.json(result, { status })
    }

    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { success: false, error: `Invalid request: ${message}` },
      { status: 400 }
    )
  }
}
