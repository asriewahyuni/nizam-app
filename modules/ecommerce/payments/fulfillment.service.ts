/**
 * Fulfillment fisik atomik: konsumsi reservasi, kurangi stok, posting jurnal
 * HPP/persediaan, lalu selesaikan sales dan order.
 */
import 'server-only'

import { connectPostgresClient } from '@/lib/db/postgres'

export async function fulfillPaidCommerceOrder(input: {
  orgId: string
  orderId: string
  actorUserId: string
  idempotencyKey: string
}) {
  const client = await connectPostgresClient()
  try {
    await client.query('BEGIN')
    await client.query(
      `INSERT INTO public.commerce_transaction_operations (
         org_id, operation_type, aggregate_type, aggregate_id,
         idempotency_key, status, started_at
       ) VALUES (
         $1::uuid, 'FULFILL_ORDER', 'ORDER', $2::uuid, $3, 'PENDING', NOW()
       )
       ON CONFLICT (org_id, idempotency_key) DO NOTHING`,
      [input.orgId, input.orderId, input.idempotencyKey],
    )
    const operationResult = await client.query<{
      id: string
      status: string
      result: Record<string, unknown>
    }>(
      `SELECT id::text, status, result
       FROM public.commerce_transaction_operations
       WHERE org_id = $1::uuid AND idempotency_key = $2
       FOR UPDATE`,
      [input.orgId, input.idempotencyKey],
    )
    const operation = operationResult.rows[0]
    if (!operation) throw new Error('Operasi fulfillment tidak dapat dikunci.')
    if (operation.status === 'SUCCEEDED') {
      await client.query('COMMIT')
      return { ...operation.result, alreadyProcessed: true }
    }

    const orderResult = await client.query<{
      id: string
      order_number: string
      branch_id: string
      warehouse_id: string
      erp_sale_id: string
      status: string
    }>(
      `SELECT
         id::text, order_number, branch_id::text, warehouse_id::text,
         erp_sale_id::text, status::text
       FROM public.ecommerce_orders
       WHERE id = $1::uuid AND org_id = $2::uuid
       FOR UPDATE`,
      [input.orderId, input.orgId],
    )
    const order = orderResult.rows[0]
    if (!order) throw new Error('Order tidak ditemukan.')
    if (order.status === 'COMPLETED') {
      await client.query(
        `UPDATE public.commerce_transaction_operations
         SET status = 'SUCCEEDED', result = $2::jsonb,
             completed_at = NOW(), updated_at = NOW()
         WHERE id = $1::uuid`,
        [operation.id, JSON.stringify({ orderId: order.id, alreadyCompleted: true })],
      )
      await client.query('COMMIT')
      return { orderId: order.id, alreadyCompleted: true }
    }
    if (!['READY_TO_FULFILL', 'FULFILLING', 'SHIPPED'].includes(order.status)) {
      throw new Error('Order belum siap dipenuhi.')
    }
    if (!order.erp_sale_id) throw new Error('Sales ERP order belum tersedia.')

    const reservations = await client.query<{
      id: string
      product_id: string
      quantity: number
      average_cost: number
      asset_account_id: string | null
      expense_account_id: string | null
    }>(
      `SELECT
         reservation.id::text,
         reservation.product_id::text,
         reservation.quantity::float8,
         COALESCE(product.average_cost, product.purchase_price, 0)::float8 AS average_cost,
         COALESCE(
           product.asset_account_id,
           public.resolve_inventory_asset_account($1::uuid, product.id, '1301')
         )::text AS asset_account_id,
         COALESCE(
           product.expense_account_id,
           (
             SELECT account.id
             FROM public.accounts account
             WHERE account.org_id = $1::uuid
               AND account.code = '5001'
               AND account.is_active = TRUE
             LIMIT 1
           )
         )::text AS expense_account_id
       FROM public.ecommerce_inventory_reservations reservation
       JOIN public.products product
         ON product.id = reservation.product_id
        AND product.org_id = reservation.org_id
       WHERE reservation.org_id = $1::uuid
         AND reservation.order_id = $2::uuid
         AND reservation.status = 'ACTIVE'
       ORDER BY reservation.id
       FOR UPDATE OF reservation`,
      [input.orgId, input.orderId],
    )
    if (reservations.rows.length === 0) {
      throw new Error('Reservasi stok aktif untuk order ini tidak ditemukan.')
    }
    for (const reservation of reservations.rows) {
      if (!reservation.asset_account_id || !reservation.expense_account_id) {
        throw new Error('Akun persediaan/HPP produk belum lengkap.')
      }
      if (reservation.average_cost <= 0) {
        throw new Error('Biaya rata-rata produk belum diisi; jurnal HPP tidak dapat dibuat.')
      }
      await client.query(
        `SELECT pg_advisory_xact_lock(hashtextextended($1 || ':' || $2 || ':' || $3, 0))`,
        [input.orgId, order.warehouse_id, reservation.product_id],
      )
      const stockResult = await client.query<{ quantity: number }>(
        `SELECT COALESCE(SUM(quantity), 0)::float8 AS quantity
         FROM public.inventory_stocks
         WHERE org_id = $1::uuid
           AND warehouse_id = $2::uuid
           AND product_id = $3::uuid`,
        [input.orgId, order.warehouse_id, reservation.product_id],
      )
      if (Number(stockResult.rows[0]?.quantity || 0) < reservation.quantity) {
        throw new Error('Stok berubah dan tidak lagi cukup untuk fulfillment.')
      }
    }

    const numberResult = await client.query<{ entry_number: string }>(
      `SELECT public.generate_entry_number($1::uuid) AS entry_number`,
      [input.orgId],
    )
    const journalResult = await client.query<{ id: string }>(
      `INSERT INTO public.journal_entries (
         org_id, branch_id, entry_number, entry_date, description,
         reference_type, reference_id, status, is_auto
       ) VALUES (
         $1::uuid, $2::uuid, $3, CURRENT_DATE, $4,
         'COMMERCE_FULFILLMENT', $5::uuid, 'DRAFT', TRUE
       )
       RETURNING id::text`,
      [
        input.orgId,
        order.branch_id,
        numberResult.rows[0].entry_number,
        `HPP fulfillment ${order.order_number}`,
        order.id,
      ],
    )
    const journalId = journalResult.rows[0].id

    const journalGroups = new Map<string, {
      accountId: string
      debit: number
      credit: number
    }>()
    for (const reservation of reservations.rows) {
      const value = reservation.quantity * reservation.average_cost
      const debitKey = `D:${reservation.expense_account_id}`
      const creditKey = `C:${reservation.asset_account_id}`
      const debit = journalGroups.get(debitKey) || {
        accountId: reservation.expense_account_id!,
        debit: 0,
        credit: 0,
      }
      debit.debit += value
      journalGroups.set(debitKey, debit)
      const credit = journalGroups.get(creditKey) || {
        accountId: reservation.asset_account_id!,
        debit: 0,
        credit: 0,
      }
      credit.credit += value
      journalGroups.set(creditKey, credit)

      await client.query(
        `INSERT INTO public.stock_movements (
           org_id, product_id, warehouse_id, branch_id, movement_date,
           quantity, unit_price, reference_type, reference_id, notes
         ) VALUES (
           $1::uuid, $2::uuid, $3::uuid, $4::uuid, NOW(),
           -$5, $6, 'COMMERCE_FULFILLMENT', $7::uuid, $8
         )`,
        [
          input.orgId,
          reservation.product_id,
          order.warehouse_id,
          order.branch_id,
          reservation.quantity,
          reservation.average_cost,
          order.id,
          `Fulfillment ${order.order_number}`,
        ],
      )
      await client.query(
        `SELECT public.adjust_inventory_stock(
           $1::uuid, $2::uuid, $3::uuid, -$4, NULL, NULL
         )`,
        [input.orgId, reservation.product_id, order.warehouse_id, reservation.quantity],
      )
      await client.query(
        `UPDATE public.ecommerce_inventory_reservations
         SET status = 'CONSUMED', consumed_at = NOW(), updated_at = NOW()
         WHERE id = $1::uuid`,
        [reservation.id],
      )
    }

    for (const line of journalGroups.values()) {
      if (line.debit === 0 && line.credit === 0) continue
      await client.query(
        `INSERT INTO public.journal_lines (entry_id, account_id, debit, credit, memo)
         VALUES ($1::uuid, $2::uuid, $3, $4, $5)`,
        [
          journalId,
          line.accountId,
          line.debit,
          line.credit,
          `HPP ${order.order_number}`,
        ],
      )
    }
    await client.query(
      `UPDATE public.journal_entries SET status = 'POSTED', updated_at = NOW()
       WHERE id = $1::uuid`,
      [journalId],
    )
    await client.query(
      `UPDATE public.sales
       SET status = 'FINISHED', warehouse_id = $3::uuid, updated_at = NOW()
       WHERE id = $1::uuid AND org_id = $2::uuid`,
      [order.erp_sale_id, input.orgId, order.warehouse_id],
    )
    await client.query(
      `UPDATE public.ecommerce_orders
       SET status = 'COMPLETED', fulfilled_at = NOW(), updated_at = NOW()
       WHERE id = $1::uuid AND org_id = $2::uuid`,
      [order.id, input.orgId],
    )
    await client.query(
      `INSERT INTO public.ecommerce_order_events (
         org_id, order_id, actor_user_id, actor_label, event_type, message, payload
       ) VALUES (
         $1::uuid, $2::uuid, $3::uuid, 'INTERNAL', 'ORDER_FULFILLED',
         'Barang dipenuhi; stok dan jurnal HPP telah diposting.',
         $4::jsonb
       )`,
      [
        input.orgId,
        order.id,
        input.actorUserId,
        JSON.stringify({ journalId, reservationCount: reservations.rows.length }),
      ],
    )
    const result = {
      orderId: order.id,
      journalId,
      reservationCount: reservations.rows.length,
    }
    await client.query(
      `UPDATE public.commerce_transaction_operations
       SET status = 'SUCCEEDED', result = $2::jsonb,
           completed_at = NOW(), updated_at = NOW()
       WHERE id = $1::uuid`,
      [operation.id, JSON.stringify(result)],
    )
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
