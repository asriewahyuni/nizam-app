import { describe, expect, it, vi } from 'vitest'
import { randomUUID } from 'node:crypto'
import { Pool, type PoolClient } from 'pg'

vi.mock('server-only', () => ({}))

import {
  provisionOrderEntitlements,
  reconcileEffectiveEnrollments,
  snapshotOrderEntitlements,
} from '@/modules/ecommerce/payments/entitlement.service'
import { finalizeFreeCommerceOrder } from '@/modules/ecommerce/payments/commerce-payment.service'

function mockClient(
  candidates: Array<Record<string, unknown>>,
) {
  const calls: Array<{ sql: string; values: unknown[] }> = []
  const query = vi.fn(async (sql: string, values: unknown[] = []) => {
    calls.push({ sql, values })
    if (sql.includes("'DIRECT'::text AS source_kind")) {
      return { rows: candidates }
    }
    return { rows: [] }
  })
  return {
    client: { query } as unknown as PoolClient,
    calls,
  }
}

describe('snapshot hak akses multi-course', () => {
  it('menggabungkan course langsung dan paket tanpa membuat course ganda', async () => {
    const { client, calls } = mockClient([
      {
        order_item_id: '10000000-0000-4000-8000-000000000001',
        store_product_id: '20000000-0000-4000-8000-000000000001',
        course_id: '30000000-0000-4000-8000-000000000001',
        duration_value: 30,
        duration_unit: 'DAY',
        source_kind: 'DIRECT',
        package_id: null,
        package_version: null,
      },
      {
        order_item_id: '10000000-0000-4000-8000-000000000001',
        store_product_id: '20000000-0000-4000-8000-000000000001',
        course_id: '30000000-0000-4000-8000-000000000001',
        duration_value: 1,
        duration_unit: 'YEAR',
        source_kind: 'PACKAGE',
        package_id: '40000000-0000-4000-8000-000000000001',
        package_version: 4,
      },
      {
        order_item_id: '10000000-0000-4000-8000-000000000001',
        store_product_id: '20000000-0000-4000-8000-000000000001',
        course_id: '30000000-0000-4000-8000-000000000002',
        duration_value: null,
        duration_unit: null,
        source_kind: 'PACKAGE',
        package_id: '40000000-0000-4000-8000-000000000001',
        package_version: 4,
      },
    ])

    const count = await snapshotOrderEntitlements(client, {
      orgId: '50000000-0000-4000-8000-000000000001',
      orderId: '60000000-0000-4000-8000-000000000001',
    })

    expect(count).toBe(2)
    const inserts = calls.filter((call) => call.sql.includes(
      'INSERT INTO public.commerce_order_entitlements',
    ))
    expect(inserts).toHaveLength(2)
    expect(inserts[0].values[5]).toBe('MIXED')
    expect(inserts[0].values[8]).toBe(1)
    expect(inserts[0].values[9]).toBe('YEAR')
    expect(inserts[0].values[6]).toEqual([
      '40000000-0000-4000-8000-000000000001',
    ])
  })

  it('mempertahankan akses permanen saat sumber lain memiliki batas waktu', async () => {
    const { client, calls } = mockClient([
      {
        order_item_id: '10000000-0000-4000-8000-000000000001',
        store_product_id: '20000000-0000-4000-8000-000000000001',
        course_id: '30000000-0000-4000-8000-000000000001',
        duration_value: 12,
        duration_unit: 'MONTH',
        source_kind: 'DIRECT',
        package_id: null,
        package_version: null,
      },
      {
        order_item_id: '10000000-0000-4000-8000-000000000001',
        store_product_id: '20000000-0000-4000-8000-000000000001',
        course_id: '30000000-0000-4000-8000-000000000001',
        duration_value: null,
        duration_unit: null,
        source_kind: 'PACKAGE',
        package_id: '40000000-0000-4000-8000-000000000001',
        package_version: 2,
      },
    ])

    await snapshotOrderEntitlements(client, {
      orgId: '50000000-0000-4000-8000-000000000001',
      orderId: '60000000-0000-4000-8000-000000000001',
    })

    const insert = calls.find((call) => call.sql.includes(
      'INSERT INTO public.commerce_order_entitlements',
    ))
    expect(insert?.values[8]).toBeNull()
    expect(insert?.values[9]).toBeNull()
  })
})

describe('pemilihan grant enrollment', () => {
  it('mendahulukan grant permanen lalu tanggal kedaluwarsa terpanjang', async () => {
    const query = vi.fn(async (_sql: string, _values?: unknown[]) => ({ rows: [] }))
    await reconcileEffectiveEnrollments(
      { query } as unknown as PoolClient,
      {
        orgId: '50000000-0000-4000-8000-000000000001',
        userId: '70000000-0000-4000-8000-000000000001',
        courseIds: [
          '30000000-0000-4000-8000-000000000001',
          '30000000-0000-4000-8000-000000000001',
        ],
      },
    )

    expect(query).toHaveBeenCalledTimes(1)
    const call = query.mock.calls[0]
    expect(call).toBeDefined()
    if (!call) throw new Error('Query rekonsiliasi tidak dipanggil.')
    const sql = String(call[0])
    expect(sql).toContain('(access_grant.expires_at IS NULL) DESC')
    expect(sql).toContain('access_grant.expires_at DESC')
    expect(call[1]?.[2]).toEqual([
      '30000000-0000-4000-8000-000000000001',
    ])
  })
})

const rehearsalDatabaseUrl = process.env.COREISEC_REHEARSAL_DATABASE_URL

describe.runIf(Boolean(rehearsalDatabaseUrl))('rehearsal database multi-course', () => {
  it('membuat snapshot, grant, enrollment, dan membership secara idempoten', async () => {
    const pool = new Pool({ connectionString: rehearsalDatabaseUrl })
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const source = await client.query<{
        org_id: string
        store_product_id: string
        store_id: string
        branch_id: string
        warehouse_id: string
        product_id: string
        product_name: string
        product_slug: string
        direct_course_id: string
        second_course_id: string
        user_id: string
        bank_account_id: string
        cash_account_id: string
        revenue_account_id: string
        discount_account_id: string
      }>(
        `SELECT
           store_product.org_id::text,
           store_product.id::text AS store_product_id,
           store_product.store_id::text,
           store.branch_id::text,
           store.warehouse_id::text,
           store_product.product_id::text,
           store_product.public_name AS product_name,
           store_product.public_slug AS product_slug,
           product_course.course_id::text AS direct_course_id,
           (
             SELECT course.id::text
             FROM public.learning_courses course
             WHERE course.org_id = store_product.org_id
               AND course.id <> product_course.course_id
               AND course.deleted_at IS NULL
             ORDER BY course.created_at
             LIMIT 1
           ) AS second_course_id,
           (
             SELECT member.user_id::text
             FROM public.org_members member
             WHERE member.org_id = store_product.org_id
               AND member.is_active = TRUE
             ORDER BY member.joined_at
             LIMIT 1
           ) AS user_id,
           (
             SELECT bank.id::text
             FROM public.bank_accounts bank
             WHERE bank.org_id = store_product.org_id
               AND bank.branch_id = store.branch_id
               AND bank.is_active = TRUE
             ORDER BY bank.created_at
             LIMIT 1
           ) AS bank_account_id,
           (
             SELECT bank.account_id::text
             FROM public.bank_accounts bank
             WHERE bank.org_id = store_product.org_id
               AND bank.branch_id = store.branch_id
               AND bank.is_active = TRUE
             ORDER BY bank.created_at
             LIMIT 1
           ) AS cash_account_id,
           (
             SELECT account.id::text
             FROM public.accounts account
             WHERE account.org_id = store_product.org_id
               AND account.code = '4001'
             LIMIT 1
           ) AS revenue_account_id,
           (
             SELECT account.id::text
             FROM public.accounts account
             WHERE account.org_id = store_product.org_id
               AND account.code = '4002'
             LIMIT 1
           ) AS discount_account_id
         FROM public.store_products store_product
         JOIN public.stores store
           ON store.id = store_product.store_id
          AND store.org_id = store_product.org_id
         JOIN public.commerce_product_courses product_course
           ON product_course.org_id = store_product.org_id
          AND product_course.store_product_id = store_product.id
         JOIN public.organizations organization
           ON organization.id = store_product.org_id
         WHERE organization.slug = 'core-islamic-economics'
           AND store_product.product_type = 'DIGITAL'
         LIMIT 1`,
      )
      const row = source.rows[0]
      expect(row?.second_course_id).toBeTruthy()
      expect(row?.user_id).toBeTruthy()
      expect(row?.bank_account_id).toBeTruthy()
      expect(row?.revenue_account_id).toBeTruthy()
      expect(row?.discount_account_id).toBeTruthy()

      await client.query(
        `INSERT INTO public.commerce_branch_account_settings (
           org_id, branch_id, bank_account_id, cash_account_id,
           revenue_account_id, discount_account_id
         ) VALUES (
           $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6::uuid
         )
         ON CONFLICT (org_id, branch_id) DO UPDATE
         SET
           bank_account_id = EXCLUDED.bank_account_id,
           cash_account_id = EXCLUDED.cash_account_id,
           revenue_account_id = EXCLUDED.revenue_account_id,
           discount_account_id = EXCLUDED.discount_account_id,
           updated_at = NOW()`,
        [
          row.org_id,
          row.branch_id,
          row.bank_account_id,
          row.cash_account_id,
          row.revenue_account_id,
          row.discount_account_id,
        ],
      )

      const accessPackage = await client.query<{ id: string }>(
        `INSERT INTO public.commerce_access_packages (
           org_id, name, slug, version, is_active
         ) VALUES ($1::uuid, 'Rehearsal Multi Course', $2, 1, TRUE)
         RETURNING id::text`,
        [row.org_id, `rehearsal-${randomUUID()}`],
      )
      const packageId = accessPackage.rows[0].id
      await client.query(
        `INSERT INTO public.commerce_access_package_courses (
           org_id, package_id, course_id
         ) VALUES
           ($1::uuid, $2::uuid, $3::uuid),
           ($1::uuid, $2::uuid, $4::uuid)`,
        [row.org_id, packageId, row.direct_course_id, row.second_course_id],
      )
      await client.query(
        `INSERT INTO public.commerce_product_access_packages (
           org_id, store_product_id, package_id
         ) VALUES ($1::uuid, $2::uuid, $3::uuid)`,
        [row.org_id, row.store_product_id, packageId],
      )
      const order = await client.query<{ id: string; order_number: string }>(
        `INSERT INTO public.ecommerce_orders (
           org_id, store_id, branch_id, warehouse_id, user_id,
           customer_name, customer_email, customer_phone, order_number,
           status, payment_status, subtotal_amount, discount_amount, grand_total,
           idempotency_key, checkout_idempotency_key
         ) VALUES (
           $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid,
           'Rehearsal Member', 'rehearsal@example.test', '62800000000', '',
           'COMPLETED', 'VALIDATED', 100, 100, 0, $6, $6
         )
         RETURNING id::text, order_number`,
        [
          row.org_id,
          row.store_id,
          row.branch_id,
          row.warehouse_id,
          row.user_id,
          `rehearsal:${randomUUID()}`,
        ],
      )
      await client.query(
        `INSERT INTO public.ecommerce_order_items (
           org_id, order_id, store_id, product_id, inventory_product_id,
           product_name, slug, quantity, unit_price, compare_price,
           line_subtotal, line_total
         ) VALUES (
           $1::uuid, $2::uuid, $3::uuid, $4::uuid, $4::uuid,
           $5, $6, 1, 100, 100, 100, 0
         )`,
        [
          row.org_id,
          order.rows[0].id,
          row.store_id,
          row.product_id,
          row.product_name,
          row.product_slug,
        ],
      )

      await snapshotOrderEntitlements(client, {
        orgId: row.org_id,
        orderId: order.rows[0].id,
      })
      await snapshotOrderEntitlements(client, {
        orgId: row.org_id,
        orderId: order.rows[0].id,
      })
      await provisionOrderEntitlements(client, {
        orgId: row.org_id,
        orderId: order.rows[0].id,
      })
      await provisionOrderEntitlements(client, {
        orgId: row.org_id,
        orderId: order.rows[0].id,
      })

      const counts = await client.query<{
        entitlement_count: number
        grant_count: number
        membership_count: number
        mixed_count: number
      }>(
        `SELECT
           (
             SELECT COUNT(*)::int
             FROM public.commerce_order_entitlements
             WHERE org_id = $1::uuid AND order_id = $2::uuid
           ) AS entitlement_count,
           (
             SELECT COUNT(*)::int
             FROM public.learning_access_grants
             WHERE org_id = $1::uuid
               AND source_type = 'ORDER'
               AND source_id = $2::uuid
           ) AS grant_count,
           (
             SELECT COUNT(*)::int
             FROM public.commerce_memberships
             WHERE org_id = $1::uuid
               AND source_type = 'ORDER'
               AND source_id = $2::uuid
           ) AS membership_count,
           (
             SELECT COUNT(*)::int
             FROM public.commerce_order_entitlements
             WHERE org_id = $1::uuid
               AND order_id = $2::uuid
               AND source_kind = 'MIXED'
           ) AS mixed_count`,
        [row.org_id, order.rows[0].id],
      )
      expect(counts.rows[0]).toMatchObject({
        entitlement_count: 2,
        grant_count: 2,
        membership_count: 1,
        mixed_count: 1,
      })

      const finalized = await finalizeFreeCommerceOrder(client, {
        orgId: row.org_id,
        orderId: order.rows[0].id,
      })
      const retried = await finalizeFreeCommerceOrder(client, {
        orgId: row.org_id,
        orderId: order.rows[0].id,
      })
      expect(retried.saleId).toBe(finalized.saleId)
      expect(retried.paymentId).toBe(finalized.paymentId)
      expect(retried.journalEntryId).toBe(finalized.journalEntryId)

      const accounting = await client.query<{
        sale_count: number
        payment_count: number
        journal_count: number
        debit: number
        credit: number
      }>(
        `SELECT
           (
             SELECT COUNT(*)::int
             FROM public.sales
             WHERE org_id = $1::uuid
               AND reference_type = 'ECOMMERCE_ORDER'
               AND reference_id = $2::uuid
           ) AS sale_count,
           (
             SELECT COUNT(*)::int
             FROM public.sales_payments
             WHERE org_id = $1::uuid
               AND ecommerce_order_id = $2::uuid
           ) AS payment_count,
           (
             SELECT COUNT(*)::int
             FROM public.journal_entries
             WHERE org_id = $1::uuid
               AND reference_type = 'COMMERCE_PAYMENT'
               AND reference_id = $2::uuid
           ) AS journal_count,
           COALESCE((
             SELECT SUM(line.debit)::float8
             FROM public.journal_lines line
             JOIN public.journal_entries journal ON journal.id = line.entry_id
             WHERE journal.org_id = $1::uuid
               AND journal.reference_type = 'COMMERCE_PAYMENT'
               AND journal.reference_id = $2::uuid
           ), 0) AS debit,
           COALESCE((
             SELECT SUM(line.credit)::float8
             FROM public.journal_lines line
             JOIN public.journal_entries journal ON journal.id = line.entry_id
             WHERE journal.org_id = $1::uuid
               AND journal.reference_type = 'COMMERCE_PAYMENT'
               AND journal.reference_id = $2::uuid
           ), 0) AS credit`,
        [row.org_id, order.rows[0].id],
      )
      expect(accounting.rows[0]).toMatchObject({
        sale_count: 1,
        payment_count: 1,
        journal_count: 1,
        debit: 100,
        credit: 100,
      })
      await client.query('ROLLBACK')
    } finally {
      client.release()
      await pool.end()
    }
  })
})
