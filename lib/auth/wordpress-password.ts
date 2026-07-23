/**
 * Verifikasi hash sandi WordPress untuk login pertama saat migrasi.
 * Mendukung phpass lama dan bcrypt WordPress 6.8 tanpa pernah menyimpan sandi asli.
 */
import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { compare as compareBcrypt } from 'bcryptjs'

const PHPASS_ITOA64 = './0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'

function md5(parts: readonly (Buffer | string)[]) {
  const hash = createHash('md5')
  for (const part of parts) hash.update(part)
  return hash.digest()
}

function encodePhpass64(input: Buffer, outputLength: number) {
  let output = ''
  let index = 0

  while (index < input.length) {
    let value = input[index]
    index += 1
    output += PHPASS_ITOA64[value & 0x3f]
    if (output.length >= outputLength) break

    if (index < input.length) value |= input[index] << 8
    output += PHPASS_ITOA64[(value >> 6) & 0x3f]
    if (output.length >= outputLength) break

    index += 1
    if (index < input.length) value |= input[index] << 16
    output += PHPASS_ITOA64[(value >> 12) & 0x3f]
    if (output.length >= outputLength) break

    index += 1
    output += PHPASS_ITOA64[(value >> 18) & 0x3f]
  }

  return output
}

function verifyPortablePhpass(password: string, storedHash: string) {
  if (storedHash.length !== 34 || !['$P$', '$H$'].includes(storedHash.slice(0, 3))) {
    return false
  }

  const countLog2 = PHPASS_ITOA64.indexOf(storedHash[3])
  if (countLog2 < 7 || countLog2 > 30) return false

  const salt = storedHash.slice(4, 12)
  if (salt.length !== 8) return false

  let digest = md5([salt, password])
  let iterationCount = 1 << countLog2
  while (iterationCount > 0) {
    digest = md5([digest, password])
    iterationCount -= 1
  }

  const calculated = storedHash.slice(0, 12) + encodePhpass64(digest, 22)
  const expectedBuffer = Buffer.from(storedHash)
  const calculatedBuffer = Buffer.from(calculated)
  return expectedBuffer.length === calculatedBuffer.length
    && timingSafeEqual(expectedBuffer, calculatedBuffer)
}

function normalizeBcryptPrefix(hash: string) {
  return hash.startsWith('$2y$') ? `$2b$${hash.slice(4)}` : hash
}

/**
 * WordPress 6.8 menambahkan prefix `$wp` dan melakukan pre-hash SHA-384
 * sebelum bcrypt. Hash `$2y$` langsung tetap didukung untuk plugin lama.
 */
export async function verifyWordPressPassword(password: string, storedHash: string) {
  if (!password || !storedHash) return false

  if (storedHash.startsWith('$P$') || storedHash.startsWith('$H$')) {
    return verifyPortablePhpass(password, storedHash)
  }

  if (storedHash.startsWith('$wp$2')) {
    const passwordToVerify = createHmac('sha384', 'wp-sha384')
      .update(password)
      .digest('base64')
    return compareBcrypt(passwordToVerify, normalizeBcryptPrefix(storedHash.slice(3)))
  }

  if (/^\$2[aby]\$\d{2}\$/.test(storedHash)) {
    return compareBcrypt(password, normalizeBcryptPrefix(storedHash))
  }

  return false
}
