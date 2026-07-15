import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'
function slugify(text: string) {
  return text.toString().toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '')
}

const DUMP_DIR = '/Users/idyogi/.gemini/antigravity-ide/brain/d98e1750-9db0-4057-827f-74e7354a6ce0/scratch/lms_dump'
const ORG_ID = '475a4db7-b5c9-45f7-8282-31f72abb45ad'

const users: any[] = JSON.parse(readFileSync(join(DUMP_DIR, 'users.json'), 'utf-8'))
const posts: any[] = JSON.parse(readFileSync(join(DUMP_DIR, 'posts.json'), 'utf-8'))
const sections: any[] = JSON.parse(readFileSync(join(DUMP_DIR, 'sections.json'), 'utf-8'))
const sectionItems: any[] = JSON.parse(readFileSync(join(DUMP_DIR, 'section_items.json'), 'utf-8'))
const userItems: any[] = JSON.parse(readFileSync(join(DUMP_DIR, 'user_items.json'), 'utf-8'))

const userEmailMap = new Map<string, string>() 
const courseSlugMap = new Map<string, string>() 
const lessonSlugMap = new Map<string, string>() 

let sql = ''

const escapeSql = (val: string | null | undefined) => {
  if (!val) return 'NULL'
  return "'" + val.toString().replace(/'/g, "''") + "'"
}

console.log(`Processing ${users.length} users...`)
for (const u of users) {
  const email = u.user_email.toLowerCase() || `${u.user_login}@coreisec.local`
  const authUserId = randomUUID()
  const internalUserId = randomUUID()
  
  userEmailMap.set(u.ID.toString(), email)

  sql += `
    INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at) 
    VALUES ('${authUserId}', ${escapeSql(email)}, '', now(), now()) 
    ON CONFLICT (email) DO NOTHING;
    
    INSERT INTO internal_auth_users (id, legacy_user_id, login_email, password_hash, display_name, user_type, is_active)
    VALUES ('${internalUserId}', (SELECT id FROM auth.users WHERE email = ${escapeSql(email)}), ${escapeSql(email)}, 'MIGRATED_NO_PASSWORD', ${escapeSql(u.display_name)}, 'member', true)
    ON CONFLICT (login_email) DO UPDATE SET legacy_user_id = EXCLUDED.legacy_user_id;

    INSERT INTO org_members (org_id, user_id, role, is_active) 
    VALUES ('${ORG_ID}', (SELECT id FROM auth.users WHERE email = ${escapeSql(email)}), 'viewer', true)
    ON CONFLICT (org_id, user_id) DO NOTHING;
  `
}

console.log(`Processing courses and lessons...`)
const wpCourses = posts.filter(p => p.post_type === 'lp_course')
const wpLessons = posts.filter(p => p.post_type === 'lp_lesson')

for (const c of wpCourses) {
  const courseId = randomUUID()
  const slug = slugify(c.post_name || c.post_title)
  courseSlugMap.set(c.ID.toString(), slug)

  sql += `
    INSERT INTO learning_courses (id, org_id, slug, title, description, is_active)
    VALUES ('${courseId}', '${ORG_ID}', ${escapeSql(slug)}, ${escapeSql(c.post_title)}, ${escapeSql(c.post_content)}, true)
    ON CONFLICT (org_id, slug) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description;
  `
}

for (const l of wpLessons) {
  const si = sectionItems.find(s => s.item_id == l.ID)
  let targetCourseSlug = courseSlugMap.values().next().value 
  let sortOrder = 0
  if (si) {
    const section = sections.find(s => s.section_id == si.section_id)
    if (section && courseSlugMap.has(section.section_course_id.toString())) {
      targetCourseSlug = courseSlugMap.get(section.section_course_id.toString())
    }
    sortOrder = parseInt(si.item_order) || 0
  }
  
  if (targetCourseSlug) {
    const lessonId = randomUUID()
    const slug = slugify(l.post_name || l.post_title)
    lessonSlugMap.set(l.ID.toString(), slug)

    sql += `
      INSERT INTO learning_lessons (id, org_id, course_id, slug, title, content_md, sort_order)
      VALUES ('${lessonId}', '${ORG_ID}', (SELECT id FROM learning_courses WHERE org_id = '${ORG_ID}' AND slug = ${escapeSql(targetCourseSlug)}), ${escapeSql(slug)}, ${escapeSql(l.post_title)}, ${escapeSql(l.post_content)}, ${sortOrder})
      ON CONFLICT (org_id, course_id, slug) DO UPDATE SET title = EXCLUDED.title, content_md = EXCLUDED.content_md, sort_order = EXCLUDED.sort_order;
    `
  }
}

console.log(`Processing enrollments and progress...`)
for (const ui of userItems) {
  const email = userEmailMap.get(ui.user_id.toString())
  if (!email) continue;

  if (ui.item_type === 'lp_course') {
    const courseSlug = courseSlugMap.get(ui.item_id.toString())
    if (courseSlug) {
      sql += `
        INSERT INTO learning_enrollments (org_id, user_id, course_id, status, started_at)
        SELECT '${ORG_ID}', 
               u.id, 
               c.id, 
               '${ui.status === 'enrolled' ? 'IN_PROGRESS' : 'COMPLETED'}', 
               ${escapeSql(ui.start_time)}
        FROM auth.users u, learning_courses c
        WHERE u.email = ${escapeSql(email)} AND c.org_id = '${ORG_ID}' AND c.slug = ${escapeSql(courseSlug)}
        ON CONFLICT (org_id, user_id, course_id) DO NOTHING;
      `
    }
  } else if (ui.item_type === 'lp_lesson') {
    const lessonSlug = lessonSlugMap.get(ui.item_id.toString())
    if (lessonSlug) {
      sql += `
        INSERT INTO learning_lesson_progress (org_id, enrollment_id, lesson_id, status, viewed_at)
        SELECT '${ORG_ID}', le.id, ll.id, '${ui.status === 'completed' ? 'COMPLETED' : 'VIEWED'}', ${escapeSql(ui.start_time)}
        FROM learning_enrollments le
        JOIN learning_lessons ll ON ll.course_id = le.course_id
        JOIN auth.users u ON u.id = le.user_id
        WHERE u.email = ${escapeSql(email)} 
          AND ll.org_id = '${ORG_ID}' AND ll.slug = ${escapeSql(lessonSlug)}
        ON CONFLICT (org_id, enrollment_id, lesson_id) DO NOTHING;
      `
    }
  }
}

writeFileSync('generated.sql', sql)
console.log('generated.sql created.')
