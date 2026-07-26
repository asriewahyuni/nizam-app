'use server'

import { revalidatePath } from 'next/cache'
import { connectPostgresClient } from '@/lib/db/postgres'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'

export async function saveLmsSimpleProductAction(formData: FormData) {
  try {
    const orgData = await getActiveOrg()
    if (!orgData) return { success: false, error: 'Sesi tidak valid.' }
    const orgId = orgData.org.id

    const productId = formData.get('product_id')?.toString() || ''
    const storeId = formData.get('store_id')?.toString() || ''
    const name = formData.get('name')?.toString().trim()
    const price = Number(formData.get('price') || 0)
    const comparePrice = Number(formData.get('compare_price') || 0)
    const shortDescription = formData.get('short_description')?.toString().trim() || null
    const publicDescription = formData.get('public_description')?.toString().trim() || null
    const badgeText = formData.get('badge_text')?.toString().trim() || null
    const isFeatured = formData.get('is_featured') === 'true'
    const isPublished = formData.get('is_published') === 'true'
    
    // Subscription setting
    const isSubscription = formData.get('is_subscription') === 'true'
    const billingInterval = (formData.get('billing_interval')?.toString() || 'YEAR').toUpperCase()
    const billingIntervalCount = Number(formData.get('billing_interval_count') || 1)
    const trialDays = Number(formData.get('trial_days') || 0)
    const signupFee = Number(formData.get('signup_fee') || 0)

    // Parse course_ids safely
    const courseIdsRaw = formData.get('course_ids')?.toString() || '[]'
    let courseIds: string[] = []
    try {
      const parsed = JSON.parse(courseIdsRaw)
      if (Array.isArray(parsed)) {
        courseIds = parsed.map((id) => String(id)).filter(Boolean)
      }
    } catch {
      courseIds = []
    }

    if (!name) return { success: false, error: 'Nama produk wajib diisi.' }
    if (!storeId) return { success: false, error: 'Store tidak valid.' }

    const client = await connectPostgresClient()

    let finalProductId = productId

    await client.query('BEGIN')

    try {
      if (!finalProductId) {
        // Create new Product
        const sku = 'LMS-' + Math.random().toString(36).substring(2, 8).toUpperCase()
        const prodRes = await client.query(
          "INSERT INTO products (org_id, name, sku, type, selling_price, is_active) VALUES ($1, $2, $3, 'NON_INVENTORY', $4, true) RETURNING id",
          [orgId, name, sku, price]
        )
        finalProductId = prodRes.rows[0].id
      } else {
        // Update existing Product
        await client.query(
          "UPDATE products SET name = $1, selling_price = $2 WHERE id = $3 AND org_id = $4",
          [name, price, finalProductId, orgId]
        )
      }

      // Upsert to store_products
      const publicSlug = 'p-' + Math.random().toString(36).substring(2, 8)
      
      const spRes = await client.query(
        `INSERT INTO store_products (
           org_id, store_id, product_id, public_name, public_slug,
           price_override, compare_price, short_description, public_description,
           badge_text, is_featured, is_published
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (store_id, product_id)
         DO UPDATE SET
           public_name = EXCLUDED.public_name,
           price_override = EXCLUDED.price_override,
           compare_price = EXCLUDED.compare_price,
           short_description = EXCLUDED.short_description,
           public_description = EXCLUDED.public_description,
           badge_text = EXCLUDED.badge_text,
           is_featured = EXCLUDED.is_featured,
           is_published = EXCLUDED.is_published
         RETURNING id`,
        [
          orgId,
          storeId,
          finalProductId,
          name,
          publicSlug,
          price,
          comparePrice > 0 ? comparePrice : null,
          shortDescription,
          publicDescription,
          badgeText,
          isFeatured,
          isPublished,
        ]
      )
      
      const storeProductId = spRes.rows[0].id

      // Handle Subscription Plan
      if (isSubscription) {
        const existingPlanRes = await client.query(
          'SELECT id FROM commerce_subscription_plans WHERE store_product_id = $1 LIMIT 1',
          [storeProductId]
        )
        if (existingPlanRes.rows.length > 0) {
          await client.query(
            `UPDATE commerce_subscription_plans
             SET name = $1,
                 billing_interval = $2,
                 billing_interval_count = $3,
                 price = $4,
                 trial_days = $5,
                 signup_fee = $6,
                 is_active = true
             WHERE id = $7`,
            [
              name,
              billingInterval,
              billingIntervalCount,
              price,
              trialDays,
              signupFee,
              existingPlanRes.rows[0].id,
            ]
          )
        } else {
          await client.query(
            `INSERT INTO commerce_subscription_plans (
               org_id, store_product_id, name, billing_interval, billing_interval_count,
               price, trial_days, signup_fee, grace_period_days, is_active
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, true)`,
            [
              orgId,
              storeProductId,
              name,
              billingInterval,
              billingIntervalCount,
              price,
              trialDays,
              signupFee,
            ]
          )
        }
      } else {
        await client.query(
          'UPDATE commerce_subscription_plans SET is_active = false WHERE store_product_id = $1 AND org_id = $2',
          [storeProductId, orgId]
        )
      }

      // Delete existing entitlements
      await client.query(
        "DELETE FROM commerce_product_courses WHERE store_product_id = $1 AND org_id = $2",
        [storeProductId, orgId]
      )

      // Insert new entitlements
      const uniqueCourseIds = Array.from(new Set(courseIds))
      if (uniqueCourseIds.length > 0) {
        const values = uniqueCourseIds.map((cid, i) => `($1, $2, $${i + 3})`).join(',')
        const params = [orgId, storeProductId, ...uniqueCourseIds]
        await client.query(
          `INSERT INTO commerce_product_courses (org_id, store_product_id, course_id) VALUES ${values} ON CONFLICT (org_id, store_product_id, course_id) DO NOTHING`,
          params
        )
      }

      await client.query('COMMIT')
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    }

    revalidatePath('/lms/admin/penjualan')
    revalidatePath('/ecommerce')
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'Gagal menyimpan produk.' }
  }
}

export async function deleteLmsSimpleProductAction(formData: FormData) {
  try {
    const orgData = await getActiveOrg()
    if (!orgData) return { success: false, error: 'Sesi tidak valid.' }
    const orgId = orgData.org.id
    const storeProductId = formData.get('store_product_id')?.toString()
    
    if (!storeProductId) return { success: false, error: 'ID Produk Store tidak valid.' }

    const client = await connectPostgresClient()
    
    try {
      await client.query('BEGIN')
      await client.query(
        "DELETE FROM commerce_product_courses WHERE store_product_id = $1 AND org_id = $2",
        [storeProductId, orgId]
      )
      await client.query(
        "DELETE FROM commerce_subscription_plans WHERE store_product_id = $1 AND org_id = $2",
        [storeProductId, orgId]
      )
      await client.query(
        "DELETE FROM store_products WHERE id = $1 AND org_id = $2",
        [storeProductId, orgId]
      )
      await client.query('COMMIT')
    } catch {
      await client.query('ROLLBACK')
      // If FK constraint prevents deletion, unpublish instead
      await client.query(
        "UPDATE store_products SET is_published = false WHERE id = $1 AND org_id = $2",
        [storeProductId, orgId]
      )
    }

    revalidatePath('/lms/admin/penjualan')
    revalidatePath('/ecommerce')
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'Gagal menghapus produk.' }
  }
}
