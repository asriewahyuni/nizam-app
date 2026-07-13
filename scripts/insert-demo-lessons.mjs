import pg from 'pg'
import crypto from 'crypto'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const { Pool } = pg

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.RAILWAY_DATABASE_URL
})

async function run() {
  try {
    console.log('Connecting to database...')
    const courseSlug = 'meta-ads-balik-modal-1783071392461'
    
    // 1. Get course ID and Org ID
    const res = await pool.query(`SELECT id, org_id FROM learning_courses WHERE slug = $1`, [courseSlug])
    
    if (res.rowCount === 0) {
      console.log('Course not found!')
      return
    }

    const { id: courseId, org_id: orgId } = res.rows[0]
    console.log(`Found course ${courseId} for org ${orgId}`)

    const demoLessons = [
      {
        title: 'Modul 1: Pengantar Meta Ads',
        slug: 'modul-1-pengantar-meta-ads',
        type: 'TEXT',
        sort: 1,
        content: '# Pengantar Meta Ads\n\nMeta Ads adalah platform periklanan dari perusahaan Meta yang memungkinkan Anda menampilkan iklan di Facebook, Instagram, Messenger, dan Audience Network.\n\nKeuntungan menggunakan Meta Ads:\n- **Jangkauan Luas**: Miliaran pengguna aktif bulanan.\n- **Penargetan Spesifik**: Demografi, minat, dan perilaku.\n- **Beragam Format Iklan**: Gambar, video, carousel, dll.\n\nMari kita mulai perjalanan Anda untuk menguasai Meta Ads!'
      },
      {
        title: 'Modul 2: Persiapan Business Manager',
        slug: 'modul-2-persiapan-business-manager',
        type: 'VIDEO',
        sort: 2,
        content: '# Persiapan Business Manager\n\nSebelum beriklan, Anda wajib memiliki Business Manager.\n\nVideo berikut akan menjelaskan langkah demi langkah cara membuat dan melakukan verifikasi Business Manager Anda.\n\n*(Anggap ini adalah video embed dari YouTube)*\n\n```\nhttps://www.youtube.com/watch?v=dQw4w9WgXcQ\n```\n\nPastikan Anda sudah mengaitkan Halaman Facebook dan Akun Instagram Anda.'
      },
      {
        title: 'Modul 3: Struktur Kampanye yang Efektif',
        slug: 'modul-3-struktur-kampanye-yang-efektif',
        type: 'TEXT',
        sort: 3,
        content: '# Struktur Kampanye Meta Ads\n\nStruktur iklan Meta terdiri dari 3 level:\n1. **Campaign (Kampanye)**: Menentukan tujuan iklan (Objektif).\n2. **Ad Set (Set Iklan)**: Menentukan audiens, penempatan, dan anggaran.\n3. **Ad (Iklan)**: Menentukan kreatif iklan (gambar/video dan teks).\n\n![Struktur Iklan](https://example.com/struktur-iklan.png)\n\nPelajari struktur ini dengan baik karena ini adalah fondasi dari setiap iklan yang Anda jalankan.'
      }
    ]

    for (const lesson of demoLessons) {
      const lessonId = crypto.randomUUID()
      await pool.query(
        `INSERT INTO learning_lessons 
         (id, org_id, course_id, title, slug, lesson_type, content_md, sort_order, is_required)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)`,
        [lessonId, orgId, courseId, lesson.title, lesson.slug, lesson.type, lesson.content, lesson.sort]
      )
      console.log(`Inserted lesson: ${lesson.title}`)
    }

    console.log('Demo data inserted successfully!')
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await pool.end()
  }
}

run()
