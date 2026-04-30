import { NextRequest, NextResponse } from 'next/server'
import { createPublicEcommerceOrderRequest } from '@/modules/ecommerce/lib/ecommerce.server'

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, maxLength)
}

function cleanItems(value: unknown) {
  if (!Array.isArray(value)) return []

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      return {
        productId: cleanText((item as { productId?: unknown }).productId, 80),
        quantity: Number((item as { quantity?: unknown }).quantity || 0),
      }
    })
    .filter((item): item is { productId: string; quantity: number } => Boolean(item?.productId))
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>

    if (cleanText(body.website, 120)) {
      return NextResponse.json({ success: true, successMessage: 'Permintaan berhasil diterima.' })
    }

    const orgSlug = cleanText(body.orgSlug, 120)
    const fullName = cleanText(body.fullName, 120)
    const phone = cleanText(body.phone, 80)

    if (!orgSlug || !fullName || !phone) {
      return NextResponse.json({ error: 'Nama, nomor WhatsApp, dan toko tujuan wajib diisi.' }, { status: 400 })
    }

    const result = await createPublicEcommerceOrderRequest({
      orgSlug,
      fullName,
      phone,
      email: cleanText(body.email, 180),
      address: cleanText(body.address, 500),
      notes: cleanText(body.notes, 1000),
      promoCode: cleanText(body.promoCode, 40),
      items: cleanItems(body.items),
    })

    return NextResponse.json({
      success: true,
      saleId: result.saleId,
      saleNumber: result.saleNumber,
      grandTotal: result.grandTotal,
      successMessage: `Permintaan order masuk sebagai draft quotation ${result.saleNumber || 'baru'}. Tim sales bisa langsung follow-up dari ERP.`,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal membuat draft quotation.'
    const normalized = message.toLowerCase()

    if (normalized.includes('tidak ditemukan')) {
      return NextResponse.json({ error: message }, { status: 404 })
    }

    if (
      normalized.includes('wajib') ||
      normalized.includes('kosong') ||
      normalized.includes('tidak aktif') ||
      normalized.includes('tidak valid')
    ) {
      return NextResponse.json({ error: message }, { status: 400 })
    }

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
