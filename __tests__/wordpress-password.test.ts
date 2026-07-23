import { describe, expect, it } from 'vitest'
import { verifyWordPressPassword } from '@/lib/auth/wordpress-password'

describe('verifikasi sandi WordPress', () => {
  const password = 'Nizam-Test-2026!'

  it('menerima hash phpass WordPress lama', async () => {
    const hash = '$P$BARp1xJOnvVqhMq4sK9j6FnoQlAwTF0'
    await expect(verifyWordPressPassword(password, hash)).resolves.toBe(true)
    await expect(verifyWordPressPassword('salah', hash)).resolves.toBe(false)
  })

  it('menerima hash bcrypt WordPress 6.8', async () => {
    const hash = '$wp$2y$10$4xpx.pm5TJaEGMai75/43eNXSdUXQdeoS2wPD6JqC0oxRTWlmUN3O'
    await expect(verifyWordPressPassword(password, hash)).resolves.toBe(true)
    await expect(verifyWordPressPassword('salah', hash)).resolves.toBe(false)
  })

  it('menolak format hash yang tidak dikenal', async () => {
    await expect(verifyWordPressPassword(password, 'MIGRATED_NO_PASSWORD')).resolves.toBe(false)
    await expect(verifyWordPressPassword(password, '')).resolves.toBe(false)
  })
})
