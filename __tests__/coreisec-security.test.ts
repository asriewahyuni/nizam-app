import { describe, expect, it } from 'vitest'
import {
  sanitizeLearningHtml,
  sanitizeQuizOptionHtml,
} from '@/modules/lms/lib/content-sanitizer'
import {
  hmacSha256Hex,
  safeEqualHex,
  timingSafeTextEqual,
  verifyHmacSha256,
} from '@/modules/ecommerce/payments/signature'
import { DuitkuPaymentProvider } from '@/modules/ecommerce/payments/duitku.provider'
import { MootaPaymentProvider } from '@/modules/ecommerce/payments/moota.provider'
import { ManualPaymentProvider } from '@/modules/ecommerce/payments/manual.provider'

describe('keamanan konten pembelajaran', () => {
  it('membuang script, event handler, javascript URL, dan iframe liar', () => {
    const dirty = [
      '<h2 onclick="steal()">Materi aman</h2>',
      '<script>alert(1)</script>',
      '<a href="javascript:alert(1)" target="_blank">jahat</a>',
      '<iframe src="https://evil.example/embed"></iframe>',
      '<iframe src="https://www.youtube-nocookie.com/embed/abc" allowfullscreen></iframe>',
    ].join('')
    const clean = sanitizeLearningHtml(dirty)

    expect(clean).toContain('<h2>Materi aman</h2>')
    expect(clean).not.toContain('<script')
    expect(clean).not.toContain('onclick')
    expect(clean).not.toContain('javascript:')
    expect(clean).not.toContain('evil.example')
    expect(clean).toContain('youtube-nocookie.com/embed/abc')
    expect(clean).toContain('referrerpolicy="strict-origin-when-cross-origin"')
  })

  it('menambahkan perlindungan pada tautan eksternal', () => {
    const clean = sanitizeLearningHtml(
      '<a href="https://coreisec.id" target="_blank">Coreisec</a>',
    )
    expect(clean).toContain('rel="noopener noreferrer"')
  })

  it('menyembunyikan penanda jawaban benar dari opsi LearnPress lama', () => {
    expect(sanitizeQuizOptionHtml('[TRUE] - Jawaban rahasia')).toBe('Jawaban rahasia')
    expect(sanitizeQuizOptionHtml('<p>[BENAR]: Opsi aman</p>')).toBe('<p>Opsi aman</p>')
    expect(sanitizeQuizOptionHtml('Pilihan biasa')).toBe('Pilihan biasa')
  })
})

describe('signature pembayaran', () => {
  it('membandingkan signature tanpa perbedaan waktu yang mudah ditebak', () => {
    const signature = hmacSha256Hex('secret-kuat', 'payload')
    expect(signature).toHaveLength(64)
    expect(verifyHmacSha256('secret-kuat', 'payload', signature)).toBe(true)
    expect(verifyHmacSha256('secret-kuat', 'payload-berubah', signature)).toBe(false)
    expect(safeEqualHex(signature.toUpperCase(), signature)).toBe(true)
    expect(safeEqualHex('pendek', signature)).toBe(false)
    expect(timingSafeTextEqual('sama', 'sama')).toBe(true)
    expect(timingSafeTextEqual('sama', 'beda')).toBe(false)
  })

  it('menerima callback Duitku resmi dan menolak signature palsu', async () => {
    const apiKey = 'duitku-secret'
    const provider = new DuitkuPaymentProvider({
      merchantCode: 'D12345',
      apiKey,
      sandbox: true,
    })
    const fields = new URLSearchParams({
      merchantCode: 'D12345',
      amount: '150000',
      merchantOrderId: 'ORD-2026-001',
      resultCode: '00',
      reference: 'DUITKU-REF-1',
      publisherOrderId: 'DUITKU-EVENT-1',
    })
    fields.set(
      'signature',
      hmacSha256Hex(apiKey, 'D12345150000ORD-2026-001'),
    )

    const valid = await provider.validateWebhook({
      rawBody: fields.toString(),
      headers: new Headers(),
      fields,
    })
    expect(valid).toMatchObject({
      valid: true,
      state: 'PAID',
      orderNumber: 'ORD-2026-001',
      amount: 150000,
    })

    fields.set('signature', '00'.repeat(32))
    const invalid = await provider.validateWebhook({
      rawBody: fields.toString(),
      headers: new Headers(),
      fields,
    })
    expect(invalid.valid).toBe(false)
    expect(invalid.state).toBe('PENDING')
  })

  it('hanya menerima mutasi Moota kredit dengan HMAC yang benar', async () => {
    const webhookSecret = 'moota-secret'
    const provider = new MootaPaymentProvider({
      bankName: 'Bank Uji',
      accountNumber: '1234567890',
      accountHolder: 'CORe Islamic Economics',
      webhookSecret,
    })
    const rawBody = JSON.stringify([
      { id: 'mutation-1', type: 'DB', amount: 50000 },
      { id: 'mutation-2', type: 'CR', amount: 175123 },
    ])
    const valid = await provider.validateWebhook({
      rawBody,
      headers: new Headers({
        'x-moota-signature': hmacSha256Hex(webhookSecret, rawBody),
      }),
    })
    expect(valid).toMatchObject({
      valid: true,
      providerEventId: 'mutation-2',
      state: 'PAID',
      amount: 175123,
    })

    const invalid = await provider.validateWebhook({
      rawBody,
      headers: new Headers({ 'x-moota-signature': 'signature-palsu' }),
    })
    expect(invalid.valid).toBe(false)
    expect(invalid.state).toBe('PENDING')
  })

  it('provider manual tidak dapat melunasi order melalui webhook', async () => {
    const provider = new ManualPaymentProvider({
      bankName: 'Bank Uji',
      accountNumber: '1234567890',
      accountHolder: 'CORe Islamic Economics',
    })
    const result = await provider.validateWebhook()
    expect(result.valid).toBe(false)
    expect(result.state).toBe('PENDING')
  })
})
