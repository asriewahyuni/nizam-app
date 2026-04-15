/**
 * app/api/openapi/route.ts
 *
 * Machine-readable OpenAPI 3.1 specification endpoint.
 */

import { buildOpenApiSpec } from '@/lib/api/openapi'

export async function GET(request: Request) {
  const { origin } = new URL(request.url)
  const fallbackBaseUrl = process.env.NEXT_PUBLIC_APP_URL || origin
  const spec = buildOpenApiSpec(fallbackBaseUrl)

  return Response.json(spec, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.oai.openapi+json; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  })
}
