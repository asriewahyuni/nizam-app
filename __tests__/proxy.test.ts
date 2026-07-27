import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mocks = vi.hoisted(() => ({
  updateSession: vi.fn(),
  queryPostgres: vi.fn(),
}))

vi.mock('@/lib/supabase/middleware', () => ({
  updateSession: mocks.updateSession,
}))

vi.mock('@/lib/db/postgres', () => ({
  queryPostgres: mocks.queryPostgres,
}))

import { proxy } from '@/proxy'

function mockTenantRow(row: {
  orgSlug: string
  storeSlug?: string | null
  rootBehavior: 'STOREFRONT' | 'LOGIN'
}) {
  mocks.queryPostgres.mockResolvedValueOnce({
    rows: [{
      org_slug: row.orgSlug,
      store_slug: row.storeSlug ?? null,
      root_behavior: row.rootBehavior,
    }],
  })
}

function mockNoTenant() {
  mocks.queryPostgres.mockResolvedValueOnce({ rows: [] })
}

describe('Next proxy', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
  })
  it('returns a server-action redirect for legacy domain action requests', async () => {
    const request = new NextRequest('http://nizam.xales.id/demo', {
      method: 'POST',
      headers: {
        host: 'nizam.xales.id',
        'next-action': 'demo-action',
      },
    })

    const response = await proxy(request)

    expect(response.status).toBe(303)
    expect(response.headers.get('x-action-redirect')).toBe('https://kliknizam.app;replace')
    expect(mocks.updateSession).not.toHaveBeenCalled()
  })

  it('delegates normal requests to updateSession', async () => {
    mockNoTenant()
    mocks.updateSession.mockResolvedValue(
      new NextResponse(null, {
        status: 200,
      })
    )

    const request = new NextRequest('http://localhost:3000/demo', {
      headers: {
        host: 'localhost:3000',
      },
    })

    const response = await proxy(request)

    expect(response.status).toBe(200)
    expect(mocks.updateSession).toHaveBeenCalledTimes(1)
  })

  it('mengalihkan URL member lama ke URL custom domain yang bersih', async () => {
    mockTenantRow({
      orgSlug: 'core-islamic-economics',
      storeSlug: 'store-fyrigc',
      rootBehavior: 'STOREFRONT',
    })

    const request = new NextRequest('https://member.coreisec.id/kelas', {
      headers: { host: 'member.coreisec.id' },
    })
    const response = await proxy(request)

    expect(response.status).toBe(308)
    expect(response.headers.get('location')).toBe(
      'https://member.coreisec.id/my-courses',
    )
    expect(mocks.updateSession).not.toHaveBeenCalled()
  })

  it('menulis ulang halaman produk custom domain ke storefront yang sama', async () => {
    mockTenantRow({
      orgSlug: 'core-islamic-economics',
      storeSlug: 'store-fyrigc',
      rootBehavior: 'STOREFRONT',
    })
    const response = await proxy(new NextRequest(
      'https://kelas.coreisec.id/product/ams-paket-1-tahun?ref=affiliate-1',
      { headers: { host: 'kelas.coreisec.id' } },
    ))

    expect(response.headers.get('x-middleware-rewrite')).toContain(
      '/toko/core-islamic-economics/store-fyrigc/produk/ams-paket-1-tahun',
    )
    expect(response.headers.get('x-middleware-rewrite')).toContain('ref=affiliate-1')
  })

  it('mode Login mengarahkan tamu ke login tenant', async () => {
    mockTenantRow({
      orgSlug: 'core-islamic-economics',
      storeSlug: 'store-fyrigc',
      rootBehavior: 'LOGIN',
    })
    const response = await proxy(new NextRequest(
      'https://member.coreisec.id/',
      { headers: { host: 'member.coreisec.id' } },
    ))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'https://member.coreisec.id/login?redirectTo=%2Fdashboard',
    )
  })

  it('menolak area ERP melalui custom domain', async () => {
    mockTenantRow({
      orgSlug: 'core-islamic-economics',
      storeSlug: 'store-fyrigc',
      rootBehavior: 'STOREFRONT',
    })
    const response = await proxy(new NextRequest(
      'https://kelas.coreisec.id/lms/admin',
      { headers: { host: 'kelas.coreisec.id' } },
    ))

    expect(response.status).toBe(404)
  })

  it('menulis ulang verifikasi sertifikat ke organisasi pemilik domain', async () => {
    mockTenantRow({
      orgSlug: 'core-islamic-economics',
      storeSlug: 'store-fyrigc',
      rootBehavior: 'STOREFRONT',
    })
    const response = await proxy(new NextRequest(
      'https://kelas.coreisec.id/certificate/verify/token-valid',
      { headers: { host: 'kelas.coreisec.id' } },
    ))

    expect(response.headers.get('x-middleware-rewrite')).toContain(
      '/member/core-islamic-economics/sertifikat/verifikasi/token-valid',
    )
  })

  it('mengalihkan URL toko lama ke URL store berbahasa Inggris', async () => {
    mockNoTenant()
    const response = await proxy(new NextRequest(
      'http://localhost:3000/toko/core-islamic-economics/store-fyrigc/produk/ams-paket?ref=abc',
      { headers: { host: 'localhost:3000' } },
    ))

    expect(response.status).toBe(308)
    expect(response.headers.get('location')).toBe(
      'http://localhost:3000/store/core-islamic-economics/store-fyrigc/product/ams-paket?ref=abc',
    )
  })

  it('menulis ulang URL store Inggris ke route internal storefront', async () => {
    mockNoTenant()
    const response = await proxy(new NextRequest(
      'http://localhost:3000/store/core-islamic-economics/store-fyrigc/product/ams-paket',
      { headers: { host: 'localhost:3000' } },
    ))

    expect(response.headers.get('x-middleware-rewrite')).toContain(
      '/toko/core-islamic-economics/store-fyrigc/produk/ams-paket',
    )
  })
})
