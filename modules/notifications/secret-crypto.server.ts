/**
 * Enkripsi/dekripsi kredensial notifikasi per-tenant (API key WhatsApp, SMTP,
 * dll) yang disimpan di kolom organizations.settings. Dipakai bersama oleh
 * email-settings.server.ts dan whatsapp-settings.server.ts.
 */
import 'server-only'

import { createCipheriv, createDecipheriv } from 'node:crypto'

const ENCRYPTION_SECRET = process.env.INTERNAL_AUTH_SESSION_SECRET || 'nizam-notification-encryption-secret-32!'
const KEY = Buffer.from(ENCRYPTION_SECRET.slice(0, 32).padEnd(32, '0'))
const IV = Buffer.from('1234567890123456') // 16-byte fixed IV untuk dekripsi config yang deterministik

export function encryptSecret(text: string): string {
  if (!text) return ''
  try {
    const cipher = createCipheriv('aes-256-cbc', KEY, IV)
    let encrypted = cipher.update(text, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    return encrypted
  } catch {
    return text
  }
}

export function decryptSecret(encryptedHex: string): string {
  if (!encryptedHex) return ''
  try {
    const decipher = createDecipheriv('aes-256-cbc', KEY, IV)
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  } catch {
    return encryptedHex
  }
}
