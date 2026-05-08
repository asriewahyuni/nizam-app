import fs from 'node:fs'
import path from 'node:path'
import { Client } from 'pg'

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {}

  const output = {}
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    if (!line || line.trim().startsWith('#')) continue
    const separatorIndex = line.indexOf('=')
    if (separatorIndex === -1) continue

    const key = line.slice(0, separatorIndex).trim()
    let value = line.slice(separatorIndex + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    output[key] = value
  }

  return output
}

function loadEnv() {
  const cwd = process.cwd()
  return {
    ...readEnvFile(path.join(cwd, '.env')),
    ...readEnvFile(path.join(cwd, '.env.local')),
    ...process.env,
  }
}

const CATERING_THEME = {
  tokens: {
    accent: '#C62828',
    accentStrong: '#8E1C1C',
    accentSoft: '#FFE7E2',
    surface: '#FFFDFB',
    surfaceAlt: '#FFF4EF',
    border: '#F1D5CC',
    text: '#0F172A',
    muted: '#7A5A50',
    fontLabel: 'Corporate Catering',
    cardRadius: 'rounded',
    buttonRadius: 'pill',
    density: 'comfortable',
    shadow: 'medium',
  },
  layout: {
    home: [
      {
        id: 'product-grid-1',
        type: 'product-grid',
        eyebrow: 'Menu Catering',
        title: 'Pilih menu yang ingin Anda pesan',
        body: '',
        productCount: 8,
      },
    ],
    collection: [
      {
        id: 'collection-1',
        type: 'rich-text',
        eyebrow: 'Menu Catering',
        title: 'Temukan paket yang paling cocok untuk rapat, jamuan tamu, atau acara keluarga Anda.',
        body: 'Silakan mulai dari jenis acara dan kisaran porsi yang Anda butuhkan. Dari sana, pilih paket yang paling pas dengan suasana dan anggaran Anda.',
      },
      {
        id: 'featured-1',
        type: 'featured-product',
        eyebrow: 'Paling Dicari',
        title: 'Paket yang paling aman untuk meeting, presentasi, dan jamuan tamu.',
      },
      {
        id: 'product-grid-2',
        type: 'product-grid',
        title: 'Semua Paket Tersedia',
        productCount: 16,
      },
    ],
    product: [
      {
        id: 'image-banner-1',
        type: 'image-banner',
        eyebrow: 'Catatan untuk Acara',
        title: 'Lihat apakah paket ini paling cocok untuk jenis acara dan jumlah tamu yang Anda siapkan.',
        body: 'Perhatikan isi paket, jumlah porsi, dan nuansa sajiannya supaya pilihan Anda terasa pas untuk momen yang akan digelar.',
        imageUrl: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1400&q=80',
      },
      {
        id: 'testimonial-1',
        type: 'testimonial',
        eyebrow: 'Kenapa Cepat Dipilih',
        title: 'Paket catering lebih mudah diputuskan kalau manfaatnya langsung jelas',
        items: [
          {
            label: 'Meeting tim',
            title: 'Porsi rapi dan mudah dibagikan',
            body: 'Cocok untuk acara kantor yang butuh pembagian cepat tanpa repot plating.',
          },
          {
            label: 'Acara keluarga',
            title: 'Menu terasa lebih lengkap',
            body: 'Pelanggan bisa langsung tahu apakah paket ini cocok untuk santai, formal, atau syukuran.',
          },
        ],
      },
    ],
    checkout: {
      bannerTitle: 'Konfirmasi acara Anda dalam satu order',
      bannerBody: 'Isi data pemesan, alamat kirim, dan catatan acara Anda. Setelah order dibuat, Anda bisa langsung cek status dan upload bukti bayar dari halaman order.',
      supportLabel: 'Tim catering siap bantu kebutuhan porsi, jam kirim, dan catatan acara.',
    },
  },
}

const CATERING_PRODUCTS = [
  {
    productId: '94fb4063-a5d9-4241-bfd2-4c700cb39575',
    publicSlug: 'nasi-box-meeting-hemat',
    publicName: 'Nasi Box Meeting Hemat',
    shortDescription: 'Paket paling aman untuk rapat harian, briefing, dan training singkat.',
    publicDescription: 'Isi praktis dengan nasi, lauk utama, sayur, sambal, dan pelengkap dasar. Cocok untuk acara kantor yang butuh distribusi cepat dan harga tetap ramah.',
    priceOverride: 30000,
    comparePrice: 34000,
    badgeText: 'Favorit Meeting',
    sortOrder: 10,
    isFeatured: false,
    imageUrl: 'https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=1200&q=80',
  },
  {
    productId: 'c8bf8963-10c2-4bea-8ab9-d66da5a8de0b',
    publicSlug: 'nasi-box-signature',
    publicName: 'Nasi Box Signature',
    shortDescription: 'Pilihan menu yang lebih lengkap untuk meeting penting dan tamu khusus.',
    publicDescription: 'Cocok untuk presentasi, rapat dengan klien, atau acara internal yang butuh kesan lebih rapi. Porsi tetap praktis, tetapi komposisi menunya terasa lebih premium.',
    priceOverride: 35000,
    comparePrice: 39000,
    badgeText: 'Best Seller',
    sortOrder: 20,
    isFeatured: false,
    imageUrl: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80',
  },
  {
    productId: '3c6e3766-f439-47a1-b567-7430984843a8',
    publicSlug: 'paket-eksekutif',
    publicName: 'Paket Eksekutif',
    shortDescription: 'Untuk direksi, tamu penting, dan acara yang ingin naik kelas tanpa terlihat berlebihan.',
    publicDescription: 'Menu lebih lengkap dengan keseimbangan lauk, sayur, dan pelengkap yang cocok untuk acara formal. Ideal untuk jamuan tamu perusahaan atau rapat eksekutif.',
    priceOverride: 60000,
    comparePrice: 68000,
    badgeText: 'Premium Office',
    sortOrder: 30,
    isFeatured: true,
    imageUrl: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=1200&q=80',
  },
  {
    productId: '14bdfbad-81dd-4fa6-8a15-3ff5020f8251',
    publicSlug: 'nasi-box-vip',
    publicName: 'Nasi Box VIP',
    shortDescription: 'Solusi rapi untuk jamuan penting, kunjungan klien, atau acara pimpinan.',
    publicDescription: 'Didesain untuk kebutuhan acara yang menuntut presentasi lebih baik. Cocok saat Anda ingin setiap box terasa lebih lengkap dan lebih meyakinkan.',
    priceOverride: 80000,
    comparePrice: 90000,
    badgeText: 'High Touch',
    sortOrder: 40,
    isFeatured: false,
    imageUrl: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&w=1200&q=80',
  },
  {
    productId: '824ff1f2-240b-4f74-b07c-53491970a07c',
    publicSlug: 'nasi-box-vvip',
    publicName: 'Nasi Box VVIP',
    shortDescription: 'Pilihan tertinggi untuk tamu kehormatan dan acara seremonial yang lebih resmi.',
    publicDescription: 'Dipakai saat Anda butuh paket individual dengan kesan paling premium di antara opsi box. Cocok untuk tamu kehormatan, pimpinan, dan jamuan resmi.',
    priceOverride: 100000,
    comparePrice: 110000,
    badgeText: 'Very Premium',
    sortOrder: 50,
    isFeatured: false,
    imageUrl: 'https://images.unsplash.com/photo-1511690743698-d9d85f2fbf38?auto=format&fit=crop&w=1200&q=80',
  },
  {
    productId: 'e2d4b517-cc3a-4e2e-97de-c1bce408cded',
    publicSlug: 'paket-botram-keluarga',
    publicName: 'Paket Botram Keluarga',
    shortDescription: 'Untuk makan bersama yang hangat, santai, dan tidak terasa terlalu formal.',
    publicDescription: 'Format sajian bersama yang cocok untuk syukuran kecil, makan keluarga, arisan, dan gathering komunitas. Mudah dibagi dan lebih akrab saat dinikmati bersama.',
    priceOverride: 425000,
    comparePrice: 465000,
    badgeText: 'Acara Keluarga',
    sortOrder: 60,
    isFeatured: false,
    imageUrl: 'https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&w=1200&q=80',
  },
  {
    productId: 'a3ecd450-6e7a-4153-9b73-b25b56619390',
    publicSlug: 'tumpeng-syukuran-inti',
    publicName: 'Tumpeng Syukuran Inti',
    shortDescription: 'Pilihan untuk syukuran ringkas, ulang tahun kantor, dan momen kebersamaan yang hangat.',
    publicDescription: 'Cocok untuk acara keluarga inti, perayaan kecil, dan seremoni sederhana. Tampil kuat secara visual dan tetap mudah masuk ke alur acara.',
    priceOverride: 395000,
    comparePrice: 435000,
    badgeText: 'Syukuran',
    sortOrder: 70,
    isFeatured: false,
    imageUrl: 'https://images.unsplash.com/photo-1514326640560-7d063ef2aed5?auto=format&fit=crop&w=1200&q=80',
  },
  {
    productId: '30b15025-41ab-4638-b33c-aaa52f7f895c',
    publicSlug: 'tumpeng-acara-besar',
    publicName: 'Tumpeng Acara Besar',
    shortDescription: 'Untuk momen yang butuh sajian pusat perhatian dan presentasi lebih kuat.',
    publicDescription: 'Pilihan yang lebih pas untuk syukuran kantor, pembukaan acara, dan perayaan yang melibatkan lebih banyak tamu. Cocok dijadikan anchor visual sekaligus sajian utama.',
    priceOverride: 525000,
    comparePrice: 575000,
    badgeText: 'Centerpiece',
    sortOrder: 80,
    isFeatured: false,
    imageUrl: 'https://images.unsplash.com/photo-1519864600265-abb23847ef2c?auto=format&fit=crop&w=1200&q=80',
  },
]

async function main() {
  const env = loadEnv()
  const connectionString = env.DATABASE_URL || env.RAILWAY_DATABASE_URL || env.DATABASE_PUBLIC_URL

  if (!connectionString) {
    throw new Error('DATABASE_URL belum tersedia.')
  }

  const client = new Client({ connectionString })
  await client.connect()

  try {
    await client.query('BEGIN')

    const storeResult = await client.query(
      `
        select s.id, s.org_id
        from stores s
        join organizations o on o.id = s.org_id
        where o.slug = $1 and s.slug = $2
        limit 1
      `,
      ['testtt', 'st1']
    )

    const store = storeResult.rows[0]
    if (!store) {
      throw new Error('Store testtt/st1 tidak ditemukan di database lokal.')
    }

    await client.query(
      `
        update stores
        set
          name = $2,
          brand_name = $3,
          line_name = $4,
          headline = $5,
          subheadline = $6,
          support_email = $7,
          support_phone = $8,
          whatsapp_phone = $9,
          is_active = true,
          is_published = true,
          updated_at = now()
        where id = $1
      `,
      [
        store.id,
        'Rantang Raya Catering',
        'Rantang Raya',
        'Corporate & Family Catering',
        'Pilih paket catering yang rapi untuk rapat, syukuran, dan acara keluarga.',
        'Menu box, paket premium, tumpeng, dan sajian bersama untuk kebutuhan kantor maupun keluarga.',
        'halo@rantangraya.test',
        '0812-7000-8800',
        '0812-7000-8800',
      ]
    )

    await client.query(
      `
        insert into store_settings (
          org_id,
          store_id,
          seo_title,
          seo_description,
          hero_notice,
          checkout_notice,
          transfer_instructions,
          allow_guest_checkout,
          allow_manual_payment
        )
        values ($1, $2, $3, $4, $5, $6, $7, true, true)
        on conflict (store_id) do update set
          seo_title = excluded.seo_title,
          seo_description = excluded.seo_description,
          hero_notice = excluded.hero_notice,
          checkout_notice = excluded.checkout_notice,
          transfer_instructions = excluded.transfer_instructions,
          allow_guest_checkout = true,
          allow_manual_payment = true,
          updated_at = now()
      `,
      [
        store.org_id,
        store.id,
        'Rantang Raya Catering | Nasi Box, Tumpeng, dan Paket Acara',
        'Contoh storefront catering untuk rapat kantor, syukuran, acara keluarga, nasi box, tumpeng, dan paket premium.',
        'Pesan untuk meeting, syukuran, dan acara keluarga',
        'Untuk order besar, sebaiknya masuk paling lambat H-1 sebelum jam 15.00 agar slot dapur dan pengiriman lebih aman.',
        'Transfer 50% untuk mengunci jadwal produksi. Sisa pembayaran dapat dilunasi sebelum pengiriman atau sesuai konfirmasi tim catering.',
      ]
    )

    await client.query(
      `
        insert into store_theme_templates (
          template_key,
          name,
          description,
          category,
          tokens,
          layout
        )
        values ($1, $2, $3, $4, $5::jsonb, $6::jsonb)
        on conflict (template_key) do update set
          name = excluded.name,
          description = excluded.description,
          category = excluded.category,
          tokens = excluded.tokens,
          layout = excluded.layout
      `,
      [
        'corporate-catering',
        'Corporate Catering',
        'Dirancang untuk catering kantor, nasi box, tray rapat, dan acara keluarga.',
        'Catering',
        JSON.stringify(CATERING_THEME.tokens),
        JSON.stringify(CATERING_THEME.layout),
      ]
    )

    await client.query(
      `
        update store_theme_versions
        set
          version_name = case when status = 'PUBLISHED' then 'Corporate Catering Live' else 'Corporate Catering Draft' end,
          tokens = $2::jsonb,
          layout = $3::jsonb,
          updated_at = now()
        where store_id = $1
      `,
      [store.id, JSON.stringify(CATERING_THEME.tokens), JSON.stringify(CATERING_THEME.layout)]
    )

    await client.query(
      `
        update store_products
        set
          is_published = false,
          is_featured = false,
          updated_at = now()
        where store_id = $1
      `,
      [store.id]
    )

    for (const [index, item] of CATERING_PRODUCTS.entries()) {
      await client.query(
        `
          insert into store_products (
            org_id,
            store_id,
            product_id,
            public_slug,
            public_name,
            short_description,
            public_description,
            price_override,
            compare_price,
            badge_text,
            seo_title,
            seo_description,
            sort_order,
            is_featured,
            is_published,
            stock_visibility
          )
          values (
            $1, $2, $3, $4, $5, $6, $7,
            $8, $9, $10, $11, $12, $13, $14, true, 'PUBLIC'
          )
          on conflict (store_id, product_id) do update set
            public_slug = excluded.public_slug,
            public_name = excluded.public_name,
            short_description = excluded.short_description,
            public_description = excluded.public_description,
            price_override = excluded.price_override,
            compare_price = excluded.compare_price,
            badge_text = excluded.badge_text,
            seo_title = excluded.seo_title,
            seo_description = excluded.seo_description,
            sort_order = excluded.sort_order,
            is_featured = excluded.is_featured,
            is_published = true,
            stock_visibility = 'PUBLIC',
            updated_at = now()
        `,
        [
          store.org_id,
          store.id,
          item.productId,
          item.publicSlug,
          item.publicName,
          item.shortDescription,
          item.publicDescription,
          item.priceOverride,
          item.comparePrice,
          item.badgeText,
          item.publicName,
          item.publicDescription,
          item.sortOrder,
          item.isFeatured,
        ]
      )

      await client.query(
        `
          delete from ecommerce_product_media
          where store_id = $1 and product_id = $2 and variant_id is null
        `,
        [store.id, item.productId]
      )

      await client.query(
        `
          insert into ecommerce_product_media (
            org_id,
            store_id,
            product_id,
            variant_id,
            media_type,
            url,
            alt_text,
            sort_order,
            is_primary
          )
          values ($1, $2, $3, null, 'IMAGE', $4, $5, $6, true)
        `,
        [
          store.org_id,
          store.id,
          item.productId,
          item.imageUrl,
          item.publicName,
          index + 1,
        ]
      )
    }

    await client.query('COMMIT')
    console.log('Seed contoh store catering selesai untuk testtt/st1.')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
