'use server'

import { revalidatePath } from 'next/cache'
import { connectPostgresClient } from '@/lib/db/postgres'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { normalizeCommerceCouponCode } from '@/modules/ecommerce/lib/coupon.service'

function parseUuidList(value: FormDataEntryValue | null): string[] {
  if (typeof value !== 'string' || !value.trim()) return []
  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) return []
    return [...new Set(
      parsed
        .map((item) => String(item || '').trim())
        .filter((item) => /^[0-9a-f-]{36}$/i.test(item)),
    )]
  } catch {
    return []
  }
}

function parseOptionalDate(value: FormDataEntryValue | null): string | null {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) return null
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) throw new Error('Tanggal kode diskon tidak valid.')
  return date.toISOString()
}

function revalidateLmsSalesPaths() {
  revalidatePath('/lms/admin/penjualan')
  revalidatePath('/ecommerce')
}

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
    const imageUrl = formData.get('image_url')?.toString().trim() || null
    
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
           badge_text, is_featured, is_published, product_type, quantity_enabled
         )
         VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
           'DIGITAL', false
         )
         ON CONFLICT (store_id, product_id)
         DO UPDATE SET
           public_name = EXCLUDED.public_name,
           price_override = EXCLUDED.price_override,
           compare_price = EXCLUDED.compare_price,
           short_description = EXCLUDED.short_description,
           public_description = EXCLUDED.public_description,
           badge_text = EXCLUDED.badge_text,
           is_featured = EXCLUDED.is_featured,
           is_published = EXCLUDED.is_published,
           product_type = 'DIGITAL',
           quantity_enabled = false
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

      // Handle product image (ecommerce_product_media)
      if (imageUrl) {
        const existingMediaRes = await client.query(
          `SELECT id FROM ecommerce_product_media
           WHERE org_id = $1 AND store_id = $2 AND product_id = $3 AND variant_id IS NULL
           LIMIT 1`,
          [orgId, storeId, finalProductId]
        )
        if (existingMediaRes.rows.length > 0) {
          await client.query(
            `UPDATE ecommerce_product_media SET url = $1, is_primary = true WHERE id = $2`,
            [imageUrl, existingMediaRes.rows[0].id]
          )
        } else {
          await client.query(
            `INSERT INTO ecommerce_product_media (org_id, store_id, product_id, url, is_primary)
             VALUES ($1, $2, $3, $4, true)`,
            [orgId, storeId, finalProductId, imageUrl]
          )
        }
      } else {
        // If image URL cleared, remove existing media
        await client.query(
          `DELETE FROM ecommerce_product_media
           WHERE org_id = $1 AND store_id = $2 AND product_id = $3 AND variant_id IS NULL`,
          [orgId, storeId, finalProductId]
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

/**
 * Membuat atau mengubah kode diskon LMS. Pembatasan produk menggunakan ID
 * store_product agar kupon dapat dipakai oleh checkout publik dan portal member.
 */
export async function saveLmsCouponAction(formData: FormData) {
  const orgData = await getActiveOrg()
  if (!orgData?.org?.id) return { success: false, error: 'Sesi tidak valid.' }
  if (!['owner', 'admin', 'manager'].includes(orgData.role)) {
    return { success: false, error: 'Hanya admin yang dapat mengelola kode diskon.' }
  }

  const orgId = orgData.org.id
  const couponId = String(formData.get('coupon_id') || '').trim()
  const code = normalizeCommerceCouponCode(formData.get('code'))
  const discountType = String(formData.get('discount_type') || '').toUpperCase()
  const discountValue = Number(formData.get('discount_value') || 0)
  const minimumAmount = Math.max(0, Number(formData.get('minimum_amount') || 0))
  const usageLimitRaw = Number(formData.get('usage_limit') || 0)
  const usageLimit = Number.isInteger(usageLimitRaw) && usageLimitRaw > 0
    ? usageLimitRaw
    : null
  const perUserLimit = Math.max(1, Math.trunc(Number(formData.get('per_user_limit') || 1)))
  const allowedStoreProductIds = parseUuidList(formData.get('store_product_ids'))
  const isActive = formData.get('is_active') !== 'false'

  try {
    if (code.length < 3) {
      throw new Error('Kode diskon minimal 3 karakter dan hanya boleh berisi huruf, angka, - atau _.')
    }
    if (!['FIXED', 'PERCENT'].includes(discountType)) {
      throw new Error('Jenis diskon tidak valid.')
    }
    if (!Number.isFinite(discountValue) || discountValue <= 0) {
      throw new Error('Nilai diskon harus lebih dari nol.')
    }
    if (discountType === 'PERCENT' && discountValue > 100) {
      throw new Error('Diskon persen tidak boleh lebih dari 100%.')
    }
    if (!Number.isFinite(minimumAmount)) {
      throw new Error('Minimum belanja tidak valid.')
    }

    const startsAt = parseOptionalDate(formData.get('starts_at'))
    const expiresAt = parseOptionalDate(formData.get('expires_at'))
    if (startsAt && expiresAt && new Date(startsAt) >= new Date(expiresAt)) {
      throw new Error('Tanggal berakhir harus setelah tanggal mulai.')
    }

    const client = await connectPostgresClient()
    try {
      await client.query('BEGIN')
      if (allowedStoreProductIds.length > 0) {
        const productCheck = await client.query<{ id: string }>(
          `SELECT id::text
           FROM public.store_products
           WHERE org_id = $1::uuid
             AND id = ANY($2::uuid[])`,
          [orgId, allowedStoreProductIds],
        )
        if (productCheck.rows.length !== allowedStoreProductIds.length) {
          throw new Error('Ada produk kupon yang tidak ditemukan pada organisasi ini.')
        }
      }

      if (couponId) {
        const updated = await client.query<{ id: string }>(
          `UPDATE public.commerce_coupons
           SET
             code = $3,
             discount_type = $4,
             discount_value = $5,
             minimum_amount = $6,
             starts_at = $7::timestamptz,
             expires_at = $8::timestamptz,
             usage_limit = $9,
             per_user_limit = $10,
             allowed_store_product_ids = $11::uuid[],
             is_active = $12,
             updated_at = NOW()
           WHERE id = $1::uuid
             AND org_id = $2::uuid
           RETURNING id::text`,
          [
            couponId,
            orgId,
            code,
            discountType,
            discountValue,
            minimumAmount,
            startsAt,
            expiresAt,
            usageLimit,
            perUserLimit,
            allowedStoreProductIds,
            isActive,
          ],
        )
        if (!updated.rows[0]) throw new Error('Kode diskon tidak ditemukan.')
      } else {
        await client.query(
          `INSERT INTO public.commerce_coupons (
             org_id, code, discount_type, discount_value, minimum_amount,
             starts_at, expires_at, usage_limit, per_user_limit,
             allowed_store_product_ids, is_active
           ) VALUES (
             $1::uuid, $2, $3, $4, $5,
             $6::timestamptz, $7::timestamptz, $8, $9,
             $10::uuid[], $11
           )`,
          [
            orgId,
            code,
            discountType,
            discountValue,
            minimumAmount,
            startsAt,
            expiresAt,
            usageLimit,
            perUserLimit,
            allowedStoreProductIds,
            isActive,
          ],
        )
      }
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }

    revalidateLmsSalesPaths()
    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal menyimpan kode diskon.'
    return {
      success: false,
      error: message.toLowerCase().includes('duplicate')
        ? 'Kode diskon tersebut sudah digunakan.'
        : message,
    }
  }
}

/** Mengaktifkan atau menonaktifkan kode diskon tanpa menghapus riwayat pemakaian. */
export async function setLmsCouponStatusAction(formData: FormData) {
  const orgData = await getActiveOrg()
  if (!orgData?.org?.id) return { success: false, error: 'Sesi tidak valid.' }
  if (!['owner', 'admin', 'manager'].includes(orgData.role)) {
    return { success: false, error: 'Hanya admin yang dapat mengelola kode diskon.' }
  }

  const couponId = String(formData.get('coupon_id') || '').trim()
  const isActive = formData.get('is_active') === 'true'
  if (!couponId) return { success: false, error: 'Kode diskon tidak valid.' }

  const client = await connectPostgresClient()
  try {
    const result = await client.query<{ id: string }>(
      `UPDATE public.commerce_coupons
       SET is_active = $3, updated_at = NOW()
       WHERE id = $1::uuid
         AND org_id = $2::uuid
       RETURNING id::text`,
      [couponId, orgData.org.id, isActive],
    )
    if (!result.rows[0]) return { success: false, error: 'Kode diskon tidak ditemukan.' }
    revalidateLmsSalesPaths()
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Gagal mengubah status kode diskon.',
    }
  } finally {
    client.release()
  }
}
