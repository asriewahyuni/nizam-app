import { NextRequest, NextResponse } from 'next/server'
import { createPublicSalesPageLead } from '@/modules/sales/lib/sales-page.server'

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, maxLength)
}

function cleanRecord(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}

  return Object.entries(value as Record<string, unknown>).reduce<Record<string, string>>((acc, [key, raw]) => {
    if (typeof raw === 'string' && raw.trim()) {
      acc[key] = raw.trim().slice(0, 200)
    }
    return acc
  }, {})
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>

    if (cleanText(body.website, 120)) {
      return NextResponse.json({ success: true, successMessage: 'Lead diterima.' })
    }

    const orgSlug = cleanText(body.orgSlug, 120)
    const pageSlug = cleanText(body.pageSlug, 120)
    const fullName = cleanText(body.fullName, 120)
    const email = cleanText(body.email, 180)
    const phone = cleanText(body.phone, 80)

    if (!orgSlug || !pageSlug || !fullName || !phone) {
      return NextResponse.json({ error: 'Nama, nomor WhatsApp, dan target halaman wajib diisi.' }, { status: 400 })
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Format email tidak valid.' }, { status: 400 })
    }

    const result = await createPublicSalesPageLead({
      orgSlug,
      pageSlug,
      fullName,
      email,
      phone,
      company: cleanText(body.company, 120),
      message: cleanText(body.message, 1000),
      sourceUrl: cleanText(body.sourceUrl, 500),
      utmParams: cleanRecord(body.utmParams),
      meta: {
        ...cleanRecord(body.meta),
        referrer: cleanText(body.referrer, 500),
        userAgent: cleanText(request.headers.get('user-agent'), 400),
      },
    })

    return NextResponse.json({
      success: true,
      leadId: result.lead.id,
      successMessage: result.page.formSettings.successMessage,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal menyimpan data lead.'
    const normalized = message.toLowerCase()
    if (normalized.includes('tidak ditemukan') || normalized.includes('belum dipublikasikan')) {
      return NextResponse.json({ error: message }, { status: 404 })
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
