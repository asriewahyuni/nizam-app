import { readFileSync } from 'fs'
import { join } from 'path'
import { queryPostgres } from '../lib/db/postgres'
import { randomUUID } from 'crypto'
import { slugify } from '../lib/utils'

const DUMP_DIR = '/Users/idyogi/.gemini/antigravity-ide/brain/d98e1750-9db0-4057-827f-74e7354a6ce0/scratch/lms_dump'
const ORG_ID = '475a4db7-b5c9-45f7-8282-31f72abb45ad'

async function migrate() {
  console.log('Loading JSON dumps...')
  const users: any[] = JSON.parse(readFileSync(join(DUMP_DIR, 'users.json'), 'utf-8'))
  const posts: any[] = JSON.parse(readFileSync(join(DUMP_DIR, 'posts.json'), 'utf-8'))
  const sections: any[] = JSON.parse(readFileSync(join(DUMP_DIR, 'sections.json'), 'utf-8'))
  const sectionItems: any[] = JSON.parse(readFileSync(join(DUMP_DIR, 'section_items.json'), 'utf-8'))
  const userItems: any[] = JSON.parse(readFileSync(join(DUMP_DIR, 'user_items.json'), 'utf-8'))

  const userMap = new Map<string, string>() // wp_user.ID -> nizam.user_id
  const courseMap = new Map<string, string>() // wp_post.ID -> course_id
  const lessonMap = new Map<string, string>() // wp_post.ID -> lesson_id

  console.log(`Loading courses from DB to populate courseMap and lessonMap...`)
  const cRes = await queryPostgres<{ id: string, title: string }>(`SELECT id, title FROM learning_courses WHERE org_id = $1`, [ORG_ID])
  for (const c of wpCourses) {
    const slug = slugify(c.post_name || c.post_title)
    const existing = await queryPostgres<{ id: string }>(`SELECT id FROM learning_courses WHERE org_id = $1 AND slug = $2`, [ORG_ID, slug])
    if (existing.rows.length > 0) courseMap.set(c.ID.toString(), existing.rows[0].id)
  }

  for (const l of wpLessons) {
    const slug = slugify(l.post_name || l.post_title)
    const existing = await queryPostgres<{ id: string }>(`SELECT id FROM learning_lessons WHERE org_id = $1 AND slug = $2`, [ORG_ID, slug])
    if (existing.rows.length > 0) lessonMap.set(l.ID.toString(), existing.rows[0].id)
  }

  console.log(`Populating userMap from DB...`)
  for (const u of users) {
    const email = u.user_email.toLowerCase() || `${u.user_login}@coreisec.local`
    const authRes = await queryPostgres<{ id: string }>(`SELECT id FROM auth.users WHERE email = $1`, [email])
    if (authRes.rows.length > 0) {
      userMap.set(u.ID.toString(), authRes.rows[0].id)
    }
  }

  console.log(`Processing enrollments and progress...`)
  let enrCount = 0
  for (const ui of userItems) {
    const userId = userMap.get(ui.user_id.toString())
    if (!userId) continue;

    if (ui.item_type === 'lp_course') {
      const courseId = courseMap.get(ui.item_id.toString())
      if (courseId) {
        try {
          await queryPostgres(
            `INSERT INTO learning_enrollments (org_id, user_id, course_id, status, started_at)
             VALUES ($1, $2, $3, $4, $5) ON CONFLICT (org_id, user_id, course_id) DO NOTHING`,
            [ORG_ID, userId, courseId, ui.status === 'enrolled' ? 'IN_PROGRESS' : 'COMPLETED', new Date(ui.start_time)]
          )
          enrCount++
        } catch(e) {
          console.error("Error inserting enrollment:", e)
        }
      } else {
         console.log("No courseId for item_id", ui.item_id)
      }
    } else if (ui.item_type === 'lp_lesson') {
      const lessonId = lessonMap.get(ui.item_id.toString())
      if (lessonId) {
        const enrolRes = await queryPostgres<{ id: string }>(
          `SELECT le.id FROM learning_enrollments le 
           JOIN learning_lessons ll ON ll.course_id = le.course_id
           WHERE le.user_id = $1 AND ll.id = $2`,
          [userId, lessonId]
        )
        if (enrolRes.rows.length > 0) {
          const enrollmentId = enrolRes.rows[0].id
          await queryPostgres(
            `INSERT INTO learning_lesson_progress (org_id, enrollment_id, lesson_id, status, viewed_at)
             VALUES ($1, $2, $3, $4, $5) ON CONFLICT (org_id, enrollment_id, lesson_id) DO NOTHING`,
             [ORG_ID, enrollmentId, lessonId, ui.status === 'completed' ? 'COMPLETED' : 'VIEWED', new Date(ui.start_time)]
          )
        }
      }
    }
  }

  console.log('Migration complete.')
  process.exit(0)
}

migrate().catch(console.error)
