/**
 * Pengujian jadwal publik dan pengaman database Consulting 360.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const queryPostgresMock = vi.fn()
const STORE_PRODUCT_ID = '10000000-0000-4000-8000-000000000001'
const CONSULTANT_ID = '20000000-0000-4000-8000-000000000002'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/db/postgres', () => ({
  queryPostgres: queryPostgresMock,
  connectPostgresClient: vi.fn(),
}))

function nextWeekday(weekday: number) {
  const date = new Date()
  date.setUTCHours(0, 0, 0, 0)
  date.setUTCDate(date.getUTCDate() + 2)
  while (date.getUTCDay() !== weekday) date.setUTCDate(date.getUTCDate() + 1)
  return date.toISOString().slice(0, 10)
}

describe('Consulting 360', () => {
  beforeEach(() => {
    queryPostgresMock.mockReset()
  })

  it('membentuk slot mingguan dan menyembunyikan slot yang sudah ditahan', async () => {
    const monday = nextWeekday(1)
    const busyStart = new Date(`${monday}T02:00:00.000Z`)
    queryPostgresMock.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM public.organizations organization')) {
        return {
          rows: [{
            org_id: 'org',
            store_id: 'store',
            store_product_id: 'store-product',
            offering_id: 'offering',
            consultant_id: 'consultant',
            session_count: 4,
            duration_minutes: 60,
            timezone: 'Asia/Jakarta',
            booking_horizon_days: 90,
            minimum_notice_hours: 0,
          }],
        }
      }
      if (sql.includes('FROM public.consulting_availability_rules')) {
        return {
          rows: [{
            weekday: 1,
            start_local: '09:00:00',
            end_local: '11:00:00',
            valid_from: null,
            valid_until: null,
          }],
        }
      }
      if (sql.includes('FROM public.consulting_availability_exceptions')) {
        return { rows: [] }
      }
      if (sql.includes('FROM public.consulting_slot_holds')) {
        return {
          rows: [{
            starts_at: busyStart.toISOString(),
            ends_at: new Date(busyStart.getTime() + 60 * 60 * 1000).toISOString(),
          }],
        }
      }
      throw new Error(`Query pengujian tidak dikenali: ${sql}`)
    })

    const { getPublicConsultingAvailability } = await import(
      '@/modules/consulting/lib/consulting.server'
    )
    const result = await getPublicConsultingAvailability({
      orgSlug: 'core-islamic-economics',
      storeSlug: 'store',
      storeProductId: STORE_PRODUCT_ID,
      consultantId: CONSULTANT_ID,
      fromDate: monday,
      toDate: monday,
    })

    expect(result.sessionCount).toBe(4)
    expect(result.slots).toHaveLength(1)
    expect(result.slots[0].startsAt).toBe(`${monday}T03:00:00.000Z`)
  })

  it('tidak membiarkan parameter tanggal melewati horizon pemesanan', async () => {
    queryPostgresMock.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM public.organizations organization')) {
        return {
          rows: [{
            org_id: 'org',
            store_id: 'store',
            store_product_id: 'store-product',
            offering_id: 'offering',
            consultant_id: 'consultant',
            session_count: 1,
            duration_minutes: 60,
            timezone: 'Asia/Jakarta',
            booking_horizon_days: 30,
            minimum_notice_hours: 0,
          }],
        }
      }
      if (sql.includes('FROM public.consulting_availability_rules')) {
        return {
          rows: Array.from({ length: 7 }, (_, weekday) => ({
            weekday,
            start_local: '09:00:00',
            end_local: '10:00:00',
            valid_from: null,
            valid_until: null,
          })),
        }
      }
      if (sql.includes('FROM public.consulting_availability_exceptions')) {
        return {
          rows: [{
            exception_type: 'AVAILABLE',
            starts_at: '2099-01-02T02:00:00.000Z',
            ends_at: '2099-01-02T03:00:00.000Z',
          }],
        }
      }
      return { rows: [] }
    })

    const { getPublicConsultingAvailability } = await import(
      '@/modules/consulting/lib/consulting.server'
    )
    const result = await getPublicConsultingAvailability({
      orgSlug: 'core-islamic-economics',
      storeSlug: 'store',
      storeProductId: STORE_PRODUCT_ID,
      consultantId: CONSULTANT_ID,
      fromDate: '2099-01-01',
      toDate: '2099-01-07',
    })

    expect(result.slots).toEqual([])
  })

  it('migration menyimpan pengaman bentrok dan idempotensi', () => {
    const migration = readFileSync(
      resolve(process.cwd(), 'supabase/migrations/1390_consulting_360.sql'),
      'utf8',
    )

    expect(migration).toContain("offering_type IN ('STANDARD', 'CONSULTING_1_ON_1')")
    expect(migration).toContain('ADD CONSTRAINT consulting_slot_holds_no_overlap')
    expect(migration).toContain("tstzrange(starts_at, ends_at, '[)') WITH &&")
    expect(migration).toContain('UNIQUE (org_id, order_item_id)')
    expect(migration).toContain('consulting_session_history_idempotency_unique')
    expect(migration).toContain('UNIQUE (org_id, template_id, user_id, source_type, source_id)')
  })
})
