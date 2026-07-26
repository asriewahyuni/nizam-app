import { randomUUID } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const rehearsal = process.env.DATABASE_URL?.includes('nizam_consulting360_rehearsal')

describe.runIf(rehearsal)('Consulting 360 rehearsal', () => {
  it('mengaktifkan empat sesi satu kali walau finalisasi diulang', async () => {
    const { connectPostgresClient } = await import('@/lib/db/postgres')
    const { activateConsultingOrder } = await import(
      '@/modules/consulting/lib/consulting.server'
    )
    const client = await connectPostgresClient()
    try {
      await client.query('BEGIN')
      const base = await client.query<{
        org_id: string
        store_id: string
        branch_id: string
        warehouse_id: string
        user_id: string
        user_email: string
      }>(
        `SELECT
           organization.id::text AS org_id,
           store.id::text AS store_id,
           store.branch_id::text,
           store.warehouse_id::text,
           internal_user.id::text AS user_id,
           internal_user.login_email AS user_email
         FROM public.organizations organization
         JOIN public.stores store ON store.org_id = organization.id
         CROSS JOIN LATERAL (
           SELECT id, login_email
           FROM public.internal_auth_users
           ORDER BY created_at
           LIMIT 1
         ) internal_user
         WHERE organization.slug = 'core-islamic-economics'
         LIMIT 1`,
      )
      const fixture = base.rows[0]
      expect(fixture).toBeTruthy()
      const suffix = randomUUID().replaceAll('-', '').slice(0, 12)
      const employee = await client.query<{ id: string }>(
        `INSERT INTO public.employees (
           org_id, user_id, nik, first_name, job_title, join_date
         ) VALUES ($1::uuid, $2::uuid, $3, 'Konsultan', 'Konsultan', CURRENT_DATE)
         RETURNING id::text`,
        [fixture.org_id, fixture.user_id, `C360-${suffix}`],
      )
      const instructor = await client.query<{ id: string }>(
        `INSERT INTO public.learning_instructor_profiles (
           org_id, user_id, display_name, employee_id
         ) VALUES ($1::uuid, $2::uuid, 'Konsultan Rehearsal', $3::uuid)
         ON CONFLICT (org_id, user_id) DO UPDATE
         SET employee_id = EXCLUDED.employee_id, is_active = TRUE
         RETURNING id::text`,
        [fixture.org_id, fixture.user_id, employee.rows[0].id],
      )
      const product = await client.query<{ id: string }>(
        `INSERT INTO public.products (
           org_id, sku, name, type, unit, selling_price
         ) VALUES ($1::uuid, $2, 'Consulting 360 Rehearsal', 'SERVICE', 'Paket', 1000000)
         RETURNING id::text`,
        [fixture.org_id, `C360-${suffix}`],
      )
      const storeProduct = await client.query<{ id: string }>(
        `INSERT INTO public.store_products (
           org_id, store_id, product_id, public_slug, public_name,
           price_override, is_published, product_type, quantity_enabled,
           offering_type
         ) VALUES (
           $1::uuid, $2::uuid, $3::uuid, $4, 'Consulting 360 Rehearsal',
           1000000, TRUE, 'DIGITAL', FALSE, 'CONSULTING_1_ON_1'
         ) RETURNING id::text`,
        [fixture.org_id, fixture.store_id, product.rows[0].id, `consulting-360-${suffix}`],
      )
      const offering = await client.query<{ id: string }>(
        `INSERT INTO public.consulting_offerings (
           org_id, store_product_id, session_count, duration_minutes,
           delivery_mode, default_meeting_url
         ) VALUES ($1::uuid, $2::uuid, 4, 60, 'ONLINE', 'https://meet.google.com/')
         RETURNING id::text`,
        [fixture.org_id, storeProduct.rows[0].id],
      )
      await client.query(
        `INSERT INTO public.consulting_offering_consultants (
           org_id, offering_id, consultant_id
         ) VALUES ($1::uuid, $2::uuid, $3::uuid)`,
        [fixture.org_id, offering.rows[0].id, instructor.rows[0].id],
      )
      const order = await client.query<{ id: string }>(
        `INSERT INTO public.ecommerce_orders (
           org_id, store_id, branch_id, warehouse_id, customer_name,
           customer_email, customer_phone, order_number, status,
           subtotal_amount, grand_total, user_id
         ) VALUES (
           $1::uuid, $2::uuid, $3::uuid, $4::uuid, 'Member Rehearsal',
           $5, '081234567890', $6, 'READY_TO_FULFILL',
           1000000, 1000000, $7::uuid
         ) RETURNING id::text`,
        [
          fixture.org_id,
          fixture.store_id,
          fixture.branch_id,
          fixture.warehouse_id,
          fixture.user_email,
          `C360-ORDER-${suffix}`,
          fixture.user_id,
        ],
      )
      const orderItem = await client.query<{ id: string }>(
        `INSERT INTO public.ecommerce_order_items (
           org_id, order_id, store_id, product_id, inventory_product_id,
           product_name, quantity, unit_price, line_subtotal, line_total
         ) VALUES (
           $1::uuid, $2::uuid, $3::uuid, $4::uuid, $4::uuid,
           'Consulting 360 Rehearsal', 1, 1000000, 1000000, 1000000
         ) RETURNING id::text`,
        [fixture.org_id, order.rows[0].id, fixture.store_id, product.rows[0].id],
      )
      for (let index = 0; index < 4; index += 1) {
        const startsAt = new Date(Date.now() + (index + 2) * 86_400_000)
        startsAt.setUTCHours(2, 0, 0, 0)
        const endsAt = new Date(startsAt.getTime() + 3_600_000)
        await client.query(
          `INSERT INTO public.consulting_slot_holds (
             org_id, offering_id, consultant_id, hold_group_id, token_hash,
             starts_at, ends_at, status, held_until, order_id, order_item_id
           ) VALUES (
             $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5,
             $6::timestamptz, $7::timestamptz, 'PENDING_PAYMENT',
             $7::timestamptz, $8::uuid, $9::uuid
           )`,
          [
            fixture.org_id,
            offering.rows[0].id,
            instructor.rows[0].id,
            randomUUID(),
            `hash-${suffix}-${index}`,
            startsAt.toISOString(),
            endsAt.toISOString(),
            order.rows[0].id,
            orderItem.rows[0].id,
          ],
        )
      }

      await activateConsultingOrder(client, {
        orgId: fixture.org_id,
        orderId: order.rows[0].id,
      })
      await activateConsultingOrder(client, {
        orgId: fixture.org_id,
        orderId: order.rows[0].id,
      })

      const counts = await client.query<{
        engagement_count: number
        session_count: number
        confirmation_count: number
      }>(
        `SELECT
           (SELECT COUNT(*)::int FROM public.consulting_engagements
            WHERE org_id = $1::uuid AND order_id = $2::uuid) AS engagement_count,
           (SELECT COUNT(*)::int
            FROM public.consulting_sessions session
            JOIN public.consulting_engagements engagement
              ON engagement.org_id = session.org_id
             AND engagement.id = session.engagement_id
            WHERE engagement.org_id = $1::uuid
              AND engagement.order_id = $2::uuid) AS session_count,
           (SELECT COUNT(*)::int FROM public.notification_outbox
            WHERE org_id = $1::uuid
              AND idempotency_key LIKE $3) AS confirmation_count`,
        [fixture.org_id, order.rows[0].id, `consulting-confirmed:${order.rows[0].id}:%`],
      )
      expect(counts.rows[0]).toMatchObject({
        engagement_count: 1,
        session_count: 4,
      })
      expect(counts.rows[0].confirmation_count).toBeLessThanOrEqual(2)
    } finally {
      await client.query('ROLLBACK')
      client.release()
    }
  })
})
