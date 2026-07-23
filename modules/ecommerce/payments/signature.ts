/**
 * Helper signature webhook yang memakai pembandingan waktu konstan.
 */
import { createHmac, timingSafeEqual } from 'node:crypto'

export function hmacSha256Hex(secret: string, value: string) {
  return createHmac('sha256', secret).update(value).digest('hex')
}

export function safeEqualHex(actual: string, expected: string) {
  const left = Buffer.from(actual.trim().toLowerCase(), 'utf8')
  const right = Buffer.from(expected.trim().toLowerCase(), 'utf8')
  return left.length === right.length && timingSafeEqual(left, right)
}

export function timingSafeTextEqual(actual: string, expected: string) {
  const left = Buffer.from(actual, 'utf8')
  const right = Buffer.from(expected, 'utf8')
  return left.length === right.length && timingSafeEqual(left, right)
}

export function verifyHmacSha256(secret: string, value: string, signature: string) {
  if (!secret || !signature) return false
  return safeEqualHex(signature, hmacSha256Hex(secret, value))
}
