'use server'

import { revalidatePath } from 'next/cache'
import { connectPostgresClient } from '@/lib/db/postgres'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { normalizeCommerceCouponCode } from '@/modules/ecommerce/lib/coupon.service'
import { normalizePublicSlug } from '@/modules/ecommerce/lib/lms-domain'

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
  revalidatePath('/lms/admin/penjualan/paket-akses')
  revalidatePath('/lms/admin/penjualan/consulting-360')
  revalidatePath('/lms/admin/penjualan/diskon')
  revalidatePath('/lms/admin/penjualan/ringkasan')
  revalidatePath('/ecommerce')
}

export async function saveLmsSimpleProductAction(formData: FormData) {
  try {
    const orgData = await getActiveOrg()
    if (!orgData) return { success: false, error: 'Sesi tidak valid.' }
    if (!['owner', 'admin', 'manager'].includes(String(orgData.role || '').toLowerCase())) {
      return { success: false, error: 'Hanya owner, admin, atau manager yang dapat mengelola produk.' }
    }
    const orgId = orgData.org.id

    const productId = formData.get('product_id')?.toString() || ''
    const storeId = formData.get('store_id')?.toString() || ''
    const name = formData.get('name')?.toString().trim()
    const publicSlug = normalizePublicSlug(formData.get('public_slug'), name || 'produk')
    const seoTitle = formData.get('seo_title')?.toString().trim().slice(0, 200) || null
    const seoDescription = formData.get('seo_description')?.toString().trim().slice(0, 260) || null
    const price = Number(formData.get('price') || 0)
    const comparePrice = Number(formData.get('compare_price') || 0)
    const shortDescription = formData.get('short_description')?.toString().trim() || null
    const publicDescription = formData.get('public_description')?.toString().trim() || null
    const badgeText = formData.get('badge_text')?.toString().trim() || null
    const isFeatured = formData.get('is_featured') === 'true'
    const isPublished = formData.get('is_published') === 'true'
    const imageUrl = formData.get('image_url')?.toString().trim() || null
    const productPageConfig = {
      pageLayout: {
        layout: formData.get('page_layout') === 'TWO_COLUMNS'
          ? 'TWO_COLUMNS'
          : 'SINGLE_COLUMN',
        checkoutButtonLabel: formData.get('checkout_button_label')?.toString().trim().slice(0, 80)
          || 'Beli Sekarang',
        benefitTitle: formData.get('benefit_title')?.toString().trim().slice(0, 100)
          || 'Anda mendapatkan',
        customerSectionTitle: formData.get('customer_section_title')?.toString().trim().slice(0, 100)
          || 'Informasi Pribadi',
        paymentSectionTitle: formData.get('payment_section_title')?.toString().trim().slice(0, 100)
          || 'Metode Pembayaran & Konfirmasi',
        paymentMethodLabel: formData.get('payment_method_label')?.toString().trim().slice(0, 120)
          || 'Transfer Bank / Virtual Account / E-Wallet',
        showDescription: formData.get('show_description') === 'true',
        showBuyerNote: formData.get('show_buyer_note') === 'true',
        showTrustSignals: formData.get('show_trust_signals') === 'true',
      },
    }
    
    const notificationOverrides = (() => {
      const raw = formData.get('notification_overrides')?.toString() || ''
      if (!raw) return {}
      try {
        const parsed = JSON.parse(raw)
        return parsed && typeof parsed === 'object' ? parsed : {}
      } catch {
        return {}
      }
    })()

    // Subscription setting
    const isSubscription = formData.get('is_subscription') === 'true'
    const billingInterval = (formData.get('billing_interval')?.toString() || 'YEAR').toUpperCase()
    const billingIntervalCount = Number(formData.get('billing_interval_count') || 1)
    const trialDays = Number(formData.get('trial_days') || 0)
    const signupFee = Number(formData.get('signup_fee') || 0)

    const courseIds = parseUuidList(formData.get('course_ids'))
    const packageIds = parseUuidList(formData.get('package_ids'))

    if (!name) return { success: false, error: 'Nama produk wajib diisi.' }
    if (!publicSlug) {
      return { success: false, error: 'Slug produk tidak valid atau memakai kata yang dicadangkan.' }
    }
    if (!storeId) return { success: false, error: 'Store tidak valid.' }

    const client = await connectPostgresClient()

    let finalProductId = productId

    await client.query('BEGIN')

    try {
      const storeCheck = await client.query<{ id: string }>(
        `SELECT id::text
         FROM public.stores
         WHERE id = $1::uuid
           AND org_id = $2::uuid
           AND is_active = TRUE
         LIMIT 1
         FOR UPDATE`,
        [storeId, orgId],
      )
      if (!storeCheck.rows[0]) {
        throw new Error('Store tidak ditemukan atau sudah tidak aktif.')
      }

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
        const updatedProduct = await client.query(
          "UPDATE products SET name = $1, selling_price = $2 WHERE id = $3 AND org_id = $4",
          [name, price, finalProductId, orgId]
        )
        if (updatedProduct.rowCount !== 1) {
          throw new Error('Produk tidak ditemukan dalam organisasi ini.')
        }
      }

      const existingStoreProduct = await client.query<{
        id: string
        public_slug: string
      }>(
        `SELECT id::text, public_slug
           FROM public.store_products
          WHERE store_id = $1::uuid
            AND product_id = $2::uuid
            AND org_id = $3::uuid
          LIMIT 1
          FOR UPDATE`,
        [storeId, finalProductId, orgId],
      )
      
      const spRes = await client.query(
        `INSERT INTO store_products (
           org_id, store_id, product_id, public_name, public_slug,
           price_override, compare_price, short_description, public_description,
           seo_title, seo_description, badge_text, is_featured, is_published,
           analytics_config, product_type, quantity_enabled, notification_overrides
         )
         VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
           $15::jsonb, 'DIGITAL', false, $16::jsonb
         )
         ON CONFLICT (store_id, product_id)
         DO UPDATE SET
           public_name = EXCLUDED.public_name,
           public_slug = EXCLUDED.public_slug,
           price_override = EXCLUDED.price_override,
           compare_price = EXCLUDED.compare_price,
           short_description = EXCLUDED.short_description,
           public_description = EXCLUDED.public_description,
           seo_title = EXCLUDED.seo_title,
           seo_description = EXCLUDED.seo_description,
           badge_text = EXCLUDED.badge_text,
           is_featured = EXCLUDED.is_featured,
           is_published = EXCLUDED.is_published,
           analytics_config = COALESCE(store_products.analytics_config, '{}'::jsonb)
             || EXCLUDED.analytics_config,
           product_type = 'DIGITAL',
           quantity_enabled = false,
           notification_overrides = EXCLUDED.notification_overrides
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
          seoTitle,
          seoDescription,
          badgeText,
          isFeatured,
          isPublished,
          JSON.stringify(productPageConfig),
          JSON.stringify(notificationOverrides),
        ]
      )
      
      const storeProductId = spRes.rows[0].id
      const previousPublicSlug = existingStoreProduct.rows[0]?.public_slug || ''
      if (previousPublicSlug && previousPublicSlug !== publicSlug) {
        await client.query(
          `INSERT INTO public.store_product_slug_aliases (
             org_id, store_id, store_product_id, old_slug
           ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4)
           ON CONFLICT (store_id, old_slug) DO UPDATE SET
             store_product_id = EXCLUDED.store_product_id`,
          [orgId, storeId, storeProductId, previousPublicSlug],
        )
        await client.query(
          `DELETE FROM public.store_product_slug_aliases
            WHERE org_id = $1::uuid
              AND store_id = $2::uuid
              AND store_product_id = $3::uuid
              AND lower(old_slug) = lower($4)`,
          [orgId, storeId, storeProductId, publicSlug],
        )
      }

      if (courseIds.length > 0) {
        const courseCheck = await client.query<{ id: string }>(
          `SELECT id::text
           FROM public.learning_courses
           WHERE org_id = $1::uuid
             AND id = ANY($2::uuid[])
             AND deleted_at IS NULL`,
          [orgId, courseIds],
        )
        if (courseCheck.rows.length !== courseIds.length) {
          throw new Error('Ada course yang tidak ditemukan dalam organisasi ini.')
        }
      }
      if (packageIds.length > 0) {
        const packageCheck = await client.query<{ id: string }>(
          `SELECT id::text
           FROM public.commerce_access_packages
           WHERE org_id = $1::uuid
             AND id = ANY($2::uuid[])`,
          [orgId, packageIds],
        )
        if (packageCheck.rows.length !== packageIds.length) {
          throw new Error('Ada Paket Akses yang tidak ditemukan dalam organisasi ini.')
        }
      }

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
      await client.query(
        `DELETE FROM commerce_product_access_packages
         WHERE store_product_id = $1 AND org_id = $2`,
        [storeProductId, orgId],
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

      for (const packageId of packageIds) {
        await client.query(
          `INSERT INTO public.commerce_product_access_packages (
             org_id, store_product_id, package_id
           ) VALUES ($1::uuid, $2::uuid, $3::uuid)
           ON CONFLICT (org_id, store_product_id, package_id) DO NOTHING`,
          [orgId, storeProductId, packageId],
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
    } finally {
      client.release()
    }

    revalidateLmsSalesPaths()
    return { success: true, productId: finalProductId }
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error
        ? (
            error.message.toLowerCase().includes('duplicate')
              ? 'Slug produk sudah dipakai oleh produk lain pada toko ini.'
              : error.message
          )
        : 'Gagal menyimpan produk.',
    }
  }
}

export async function deleteLmsSimpleProductAction(formData: FormData) {
  try {
    const orgData = await getActiveOrg()
    if (!orgData) return { success: false, error: 'Sesi tidak valid.' }
    if (!['owner', 'admin', 'manager'].includes(String(orgData.role || '').toLowerCase())) {
      return { success: false, error: 'Hanya owner, admin, atau manager yang dapat menghapus produk.' }
    }
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
        "DELETE FROM commerce_product_access_packages WHERE store_product_id = $1 AND org_id = $2",
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

    revalidateLmsSalesPaths()
    return { success: true }
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Gagal menghapus produk.',
    }
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
