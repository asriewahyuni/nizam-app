/**
 * app/api/v1/contacts/upsert/route.ts
 *
 * Open API endpoint untuk create/update kontak dengan perilaku upsert.
 * POST /api/v1/contacts/upsert → buat atau perbarui kontak customer/supplier (scope: contacts:write)
 */

export const dynamic = 'force-dynamic'
export const revalidate = 0

import { type NextRequest } from 'next/server'
import {
  validateApiKey,
  requireScope,
  apiError,
  apiSuccess,
  extractApiKeyFromRequest,
  logApiCall,
  extractIpFromRequest,
} from '@/lib/api/validate-key'
import { queryPostgres } from '@/lib/db/postgres'

type ContactType = 'CUSTOMER' | 'SUPPLIER'

type ContactUpsertBody = {
  id: string | null
  name: string
  type: ContactType
  email: string | null
  phone: string | null
  phone_wa: string | null
  instagram: string | null
  address: string | null
  is_active: boolean
}

type MatchedContactRow = {
  id: string
  name: string
  type: string | null
  email: string | null
  phone: string | null
  phone_wa: string | null
  instagram: string | null
  address: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  matched_by: string | null
}

type ContactRow = {
  id: string
  name: string
  type: string | null
  email: string | null
  phone: string | null
  phone_wa: string | null
  instagram: string | null
  address: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

function withNoStore(response: Response) {
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
  return response
}

function normalizeOptionalText(value: unknown) {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

function normalizeContactName(value: unknown) {
  if (typeof value !== 'string') return ''
  return value.trim().replace(/\s+/g, ' ')
}

function normalizeContactType(value: unknown): ContactType | null {
  if (typeof value !== 'string') return null

  const normalized = value.trim().toUpperCase()
  if (normalized === 'CUSTOMER' || normalized === 'SUPPLIER') return normalized
  return null
}

function normalizeEmailLookup(value: string | null) {
  return value ? value.trim().toLowerCase() : null
}

function normalizeNameLookup(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase()
}

function normalizePhoneLookup(value: string | null) {
  if (!value) return null
  const digits = value.replace(/\D+/g, '')
  return digits.length > 0 ? digits : null
}

async function parseRequestBody(request: NextRequest): Promise<{ data: ContactUpsertBody } | { error: Response }> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return { error: withNoStore(apiError('Request body harus berformat JSON valid.', 400, { errorCode: 'request_body_invalid' })) }
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: withNoStore(apiError('Request body harus object JSON.', 400, { errorCode: 'request_body_invalid' })) }
  }

  const payload = body as Record<string, unknown>
  const name = normalizeContactName(payload.name)
  const type = normalizeContactType(payload.type)

  if (!name) {
    return { error: withNoStore(apiError('Field "name" wajib diisi.', 400, { errorCode: 'contact_name_required' })) }
  }

  if (!type) {
    return { error: withNoStore(apiError('Field "type" harus berisi CUSTOMER atau SUPPLIER.', 400, { errorCode: 'contact_type_invalid' })) }
  }

  return {
    data: {
      id: normalizeOptionalText(payload.id),
      name,
      type,
      email: normalizeOptionalText(payload.email),
      phone: normalizeOptionalText(payload.phone),
      phone_wa: normalizeOptionalText(payload.phone_wa),
      instagram: normalizeOptionalText(payload.instagram),
      address: normalizeOptionalText(payload.address),
      is_active: typeof payload.is_active === 'boolean' ? payload.is_active : true,
    },
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const rawKey = extractApiKeyFromRequest(request)
  if (!rawKey) return withNoStore(apiError('API key diperlukan. Sertakan header x-api-key.', 401))

  const validation = await validateApiKey(rawKey)
  if (!validation.success) {
    return withNoStore(apiError(validation.error, validation.statusCode, { errorCode: validation.errorCode }))
  }

  if (!requireScope(validation.key, 'contacts:write')) {
    return withNoStore(apiError('Scope tidak mencukupi. Diperlukan: contacts:write', 403))
  }

  const parsedBody = await parseRequestBody(request)
  if ('error' in parsedBody) return parsedBody.error

  const { orgId } = validation.key
  const payload = parsedBody.data

  const emailLookup = normalizeEmailLookup(payload.email)
  const phoneWaLookup = normalizePhoneLookup(payload.phone_wa)
  const phoneLookup = normalizePhoneLookup(payload.phone)
  const nameLookup = normalizeNameLookup(payload.name)

  const response = await (async () => {
    let matchedContact: MatchedContactRow | null = null

    try {
      const existingResult = await queryPostgres<MatchedContactRow>(
        `
          WITH candidates AS (
            SELECT
              c.id::text AS id,
              c.name,
              c.type::text AS type,
              c.email,
              c.phone,
              c.phone_wa,
              c.instagram,
              c.address,
              c.is_active,
              c.created_at,
              c.updated_at,
              CASE
                WHEN $2::uuid IS NOT NULL AND c.id = $2::uuid THEN 'id'
                WHEN $3::text IS NOT NULL AND c.type = $7::text AND lower(trim(COALESCE(c.email, ''))) = $3::text THEN 'email'
                WHEN $4::text IS NOT NULL AND c.type = $7::text AND regexp_replace(COALESCE(c.phone_wa, ''), '[^0-9]+', '', 'g') = $4::text THEN 'phone_wa'
                WHEN $5::text IS NOT NULL AND c.type = $7::text AND regexp_replace(COALESCE(c.phone, ''), '[^0-9]+', '', 'g') = $5::text THEN 'phone'
                WHEN $6::text IS NOT NULL AND c.type = $7::text AND lower(regexp_replace(trim(COALESCE(c.name, '')), '\\s+', ' ', 'g')) = $6::text THEN 'name'
                ELSE NULL
              END AS matched_by,
              CASE
                WHEN $2::uuid IS NOT NULL AND c.id = $2::uuid THEN 1
                WHEN $3::text IS NOT NULL AND c.type = $7::text AND lower(trim(COALESCE(c.email, ''))) = $3::text THEN 2
                WHEN $4::text IS NOT NULL AND c.type = $7::text AND regexp_replace(COALESCE(c.phone_wa, ''), '[^0-9]+', '', 'g') = $4::text THEN 3
                WHEN $5::text IS NOT NULL AND c.type = $7::text AND regexp_replace(COALESCE(c.phone, ''), '[^0-9]+', '', 'g') = $5::text THEN 4
                WHEN $6::text IS NOT NULL AND c.type = $7::text AND lower(regexp_replace(trim(COALESCE(c.name, '')), '\\s+', ' ', 'g')) = $6::text THEN 5
                ELSE 99
              END AS match_priority
            FROM public.contacts c
            WHERE c.org_id = $1::uuid
              AND (
                ($2::uuid IS NOT NULL AND c.id = $2::uuid)
                OR ($3::text IS NOT NULL AND c.type = $7::text AND lower(trim(COALESCE(c.email, ''))) = $3::text)
                OR ($4::text IS NOT NULL AND c.type = $7::text AND regexp_replace(COALESCE(c.phone_wa, ''), '[^0-9]+', '', 'g') = $4::text)
                OR ($5::text IS NOT NULL AND c.type = $7::text AND regexp_replace(COALESCE(c.phone, ''), '[^0-9]+', '', 'g') = $5::text)
                OR ($6::text IS NOT NULL AND c.type = $7::text AND lower(regexp_replace(trim(COALESCE(c.name, '')), '\\s+', ' ', 'g')) = $6::text)
              )
          )
          SELECT
            id,
            name,
            type,
            email,
            phone,
            phone_wa,
            instagram,
            address,
            is_active,
            created_at,
            updated_at,
            matched_by
          FROM candidates
          WHERE matched_by IS NOT NULL
          ORDER BY match_priority ASC, is_active DESC, updated_at DESC, created_at DESC
          LIMIT 1
        `,
        [orgId, payload.id, emailLookup, phoneWaLookup, phoneLookup, nameLookup, payload.type]
      )

      matchedContact = existingResult.rows[0] ?? null
    } catch {
      return withNoStore(apiError('Gagal membuat atau memperbarui kontak.', 500, { errorCode: 'contacts_upsert_failed' }))
    }

    const contactWriteFields = [
      payload.name,
      payload.type,
      payload.email ? payload.email.trim().toLowerCase() : null,
      payload.phone,
      payload.phone_wa,
      payload.instagram,
      payload.address,
      payload.is_active,
    ]

    try {
      if (matchedContact?.id) {
        const updateResult = await queryPostgres<ContactRow>(
          `
            UPDATE public.contacts
            SET
              name = $1::text,
              type = $2::text,
              email = $3::text,
              phone = $4::text,
              phone_wa = $5::text,
              instagram = $6::text,
              address = $7::text,
              is_active = $8::boolean,
              updated_at = now()
            WHERE id = $9::uuid
              AND org_id = $10::uuid
          RETURNING
              id::text,
              name,
              type::text,
              email,
              phone,
              phone_wa,
              instagram,
              address,
              is_active,
              created_at,
              updated_at
          `,
          [...contactWriteFields, matchedContact.id, orgId]
        )

        const updatedContact = updateResult.rows[0]
        if (!updatedContact) {
          return withNoStore(apiError('Gagal membuat atau memperbarui kontak.', 500, { errorCode: 'contacts_upsert_failed' }))
        }

        return withNoStore(apiSuccess(updatedContact, {
          org_id: orgId,
          action: 'updated',
          matched_by: matchedContact.matched_by ?? 'unknown',
        }))
      }

      const insertResult = await queryPostgres<ContactRow>(
        `
          INSERT INTO public.contacts (
            org_id,
            name,
            type,
            email,
            phone,
            phone_wa,
            instagram,
            address,
            is_active
          )
          VALUES (
            $1::uuid,
            $2::text,
            $3::text,
            $4::text,
            $5::text,
            $6::text,
            $7::text,
            $8::text,
            $9::boolean
          )
          RETURNING
            id::text,
            name,
            type::text,
            email,
            phone,
            phone_wa,
            instagram,
            address,
            is_active,
            created_at,
            updated_at
        `,
        [
          orgId,
          ...contactWriteFields,
        ]
      )

      const insertedContact = insertResult.rows[0]
      if (!insertedContact) {
        return withNoStore(apiError('Gagal membuat atau memperbarui kontak.', 500, { errorCode: 'contacts_upsert_failed' }))
      }

      return withNoStore(apiSuccess(insertedContact, {
        org_id: orgId,
        action: 'created',
        matched_by: 'insert',
      }))
    } catch {
      return withNoStore(apiError('Gagal membuat atau memperbarui kontak.', 500, { errorCode: 'contacts_upsert_failed' }))
    }
  })()

  void logApiCall({
    orgId: validation.key.orgId,
    apiKeyId: validation.key.keyId,
    method: 'POST',
    endpoint: '/api/v1/contacts/upsert',
    statusCode: response.status,
    durationMs: Date.now() - startTime,
    ipAddress: extractIpFromRequest(request),
    userAgent: request.headers.get('user-agent'),
  })

  return response
}
