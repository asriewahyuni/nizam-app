import { NextRequest, NextResponse } from 'next/server'
import { uploadOrderPaymentProof } from '@/modules/ecommerce/lib/ecommerce.server'

export const runtime = 'nodejs'

type PaymentProofRouteContext = {
  params: Promise<{ orderNumber: string }>
}

export async function POST(request: NextRequest, context: PaymentProofRouteContext) {
  try {
    const { orderNumber } = await context.params
    const formData = await request.formData()
    const file = formData.get('file')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'File bukti pembayaran wajib diunggah.' }, { status: 400 })
    }

    const data = await uploadOrderPaymentProof({
      orgSlug: String(formData.get('org_slug') || ''),
      storeSlug: String(formData.get('store_slug') || ''),
      orderNumber,
      accessToken: String(formData.get('access_token') || ''),
      file,
      payerName: String(formData.get('payer_name') || ''),
      payerBankName: String(formData.get('payer_bank_name') || ''),
      paidAmount: Number(formData.get('paid_amount') || 0),
      paidAt: String(formData.get('paid_at') || ''),
      clientUploadKey: String(formData.get('client_upload_key') || ''),
      clientIp:
        String(request.headers.get('x-forwarded-for') || '').trim()
        || String(request.headers.get('x-real-ip') || '').trim(),
    })

    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload bukti pembayaran gagal.' },
      { status: 400 }
    )
  }
}
