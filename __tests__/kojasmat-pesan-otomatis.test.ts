import { describe, expect, it } from 'vitest'

import { interpolate } from '@/modules/notifications/interpolate.shared'
import { PESAN_OTOMATIS_CATALOG } from '@/modules/kojasmat/lib/pesan-otomatis.shared'

describe('interpolate', () => {
  it('mengganti {{var}} dengan nilai yang sesuai', () => {
    expect(interpolate('Halo {{nama}}, skor Anda {{skor}}.', { nama: 'Budi', skor: 90 }))
      .toBe('Halo Budi, skor Anda 90.')
  })

  it('mengganti variabel yang tidak ada di values dengan string kosong', () => {
    expect(interpolate('Halo {{nama}}, {{tidak_ada}}.', { nama: 'Budi' }))
      .toBe('Halo Budi, .')
  })

  it('mengganti nilai null dengan string kosong', () => {
    expect(interpolate('Kode: {{kode}}', { kode: null })).toBe('Kode: ')
  })

  it('membiarkan teks tanpa placeholder apa adanya', () => {
    expect(interpolate('Tidak ada placeholder di sini.', {})).toBe('Tidak ada placeholder di sini.')
  })
})

describe('PESAN_OTOMATIS_CATALOG', () => {
  it('setiap {{var}} di defaultBody terdaftar di variabel entry yang sama', () => {
    for (const entry of PESAN_OTOMATIS_CATALOG) {
      const usedVars = [...entry.defaultBody.matchAll(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g)].map(m => m[1])
      for (const v of usedVars) {
        expect(entry.variabel, `key "${entry.key}" pakai {{${v}}} tapi tidak ada di daftar variabel`).toContain(v)
      }
    }
  })

  it('setiap entry punya key unik', () => {
    const keys = PESAN_OTOMATIS_CATALOG.map(e => e.key)
    expect(new Set(keys).size).toBe(keys.length)
  })
})
