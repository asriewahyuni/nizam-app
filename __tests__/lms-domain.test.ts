import { describe, expect, it } from 'vitest'
import {
  buildTenantPath,
  normalizeLmsHostname,
  normalizePublicSlug,
} from '@/modules/ecommerce/lib/lms-domain'
import { normalizeStorefrontProductPageConfig } from '@/modules/ecommerce/lib/ecommerce'

describe('helper custom domain LMS', () => {
  it('menormalkan hostname tanpa menerima URL lokal atau IP', () => {
    expect(normalizeLmsHostname('https://Kelas.Coreisec.ID/path')).toBe('kelas.coreisec.id')
    expect(normalizeLmsHostname('localhost:3000')).toBe('')
    expect(normalizeLmsHostname('127.0.0.1')).toBe('')
  })

  it('membentuk slug publik aman dan menolak slug sistem', () => {
    expect(normalizePublicSlug('AMS Paket 1 Tahun', 'produk')).toBe('ams-paket-1-tahun')
    expect(normalizePublicSlug('product', 'produk')).toBe('')
  })

  it('menghasilkan URL bersih pada custom domain dan URL lama pada domain Nizam', () => {
    expect(buildTenantPath(
      { customDomain: true, orgSlug: 'core', storeSlug: 'store' },
      { kind: 'product', slug: 'ams' },
    )).toBe('/product/ams')
    expect(buildTenantPath(
      { customDomain: false, orgSlug: 'core', storeSlug: 'store' },
      { kind: 'product', slug: 'ams' },
    )).toBe('/toko/core/store/produk/ams')
  })

  it('menormalkan override halaman produk tanpa mengubah data tema toko', () => {
    expect(normalizeStorefrontProductPageConfig({
      pageLayout: {
        layout: 'TWO_COLUMNS',
        checkoutButtonLabel: 'Daftar Sekarang',
        showBuyerNote: false,
      },
    })).toMatchObject({
      layout: 'TWO_COLUMNS',
      checkoutButtonLabel: 'Daftar Sekarang',
      showBuyerNote: false,
      showDescription: true,
    })
  })
})
