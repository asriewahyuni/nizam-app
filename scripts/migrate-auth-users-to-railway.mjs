/**
 * migrate-auth-users-to-railway.mjs
 * Migrates Supabase auth.users → Railway auth.users
 * Ensures all public table FK references (org_members.user_id, etc.) remain valid.
 */

import https from 'https'
import pg from 'pg'
const { Pool } = pg

const SUPABASE_URL = 'https://jbocbeewybphnuhrpddx.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impib2NiZWV3eWJwaG51aHJwZGR4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzkzNDQxOSwiZXhwIjoyMDg5NTEwNDE5fQ.KTS_F1FyDzZwhupgZnM9Cuatp-MHvqjVGPIDeRYKNfE'
const RAILWAY_URL = 'postgresql://postgres:WizrKrHnupxehsBQmpqnlxOgMANBAbVB@maglev.proxy.rlwy.net:25780/railway'

const APPLY = process.argv.includes('--apply')
const railway = new Pool({ connectionString: RAILWAY_URL, ssl: { rejectUnauthorized: false } })

function fetchSupabaseUsers(page = 1) {
  return new Promise((resolve, reject) => {
    const url = `${SUPABASE_URL}/auth/v1/admin/users?per_page=200&page=${page}`
    const req = https.get(url, {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
    }, (res) => {
      let data = ''
      res.on('data', (c) => (data += c))
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data)
          resolve(parsed)
        } catch {
          reject(new Error(`Parse error: ${data.slice(0, 100)}`))
        }
      })
    })
    req.on('error', reject)
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout')) })
  })
}

async function getAllSupabaseUsers() {
  const users = []
  let page = 1
  while (true) {
    const result = await fetchSupabaseUsers(page)
    const batch = result.users || []
    users.push(...batch)
    if (batch.length < 200) break
    page++
  }
  return users
}

async function main() {
  console.log('\n🚀 Migrate auth.users: Supabase → Railway')
  console.log(`   Mode: ${APPLY ? '🔴 APPLY' : '🟡 DRY RUN'}`)
  console.log('='.repeat(60))

  // 1. Get all Supabase auth users
  console.log('\n📥 Fetching Supabase auth.users...')
  const supUsers = await getAllSupabaseUsers()
  console.log(`   Found: ${supUsers.length} users`)

  // 2. Get all Railway auth.users
  const railwayUsers = await railway.query('SELECT id::text, email FROM auth.users')
  const railwayUserIds = new Set(railwayUsers.rows.map(r => r.id))
  console.log(`   Railway has: ${railwayUsers.rows.length} auth.users`)

  // 3. Find missing
  const missing = supUsers.filter(u => !railwayUserIds.has(u.id))
  console.log(`   Missing in Railway: ${missing.length}`)

  if (missing.length === 0) {
    console.log('\n✅ All auth.users already in Railway!')
  } else {
    console.log('\nMissing users:')
    for (const u of missing) {
      console.log(`  - ${u.id} | ${u.email} | created: ${u.created_at}`)
    }

    if (APPLY) {
      console.log('\n🔄 Inserting missing auth.users into Railway...')
      let inserted = 0
      let errors = 0

      for (const u of missing) {
        try {
          // Insert minimal auth.users record
          // Railway auth.users schema follows Supabase: id, email, encrypted_password, etc.
          await railway.query(`
            INSERT INTO auth.users (
              id,
              instance_id,
              aud,
              role,
              email,
              encrypted_password,
              email_confirmed_at,
              raw_app_meta_data,
              raw_user_meta_data,
              created_at,
              updated_at,
              is_sso_user,
              is_anonymous
            ) VALUES (
              $1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10, $11, $12, $13
            ) ON CONFLICT (id) DO UPDATE SET
              email = EXCLUDED.email,
              updated_at = now()
          `, [
            u.id,
            u.instance_id || '00000000-0000-0000-0000-000000000000',
            u.aud || 'authenticated',
            u.role || 'authenticated',
            u.email || null,
            u.encrypted_password || '',
            u.email_confirmed_at || null,
            JSON.stringify(u.app_metadata || {}),
            JSON.stringify(u.user_metadata || {}),
            u.created_at || new Date().toISOString(),
            u.updated_at || new Date().toISOString(),
            u.is_sso_user || false,
            u.is_anonymous || false,
          ])
          console.log(`  ✅ Inserted: ${u.email || u.id}`)
          inserted++
        } catch (e) {
          console.error(`  ❌ Failed ${u.id}: ${e.message.slice(0, 80)}`)
          errors++
        }
      }

      console.log(`\n   Inserted: ${inserted} | Errors: ${errors}`)
    }
  }

  // 4. Show Railway auth.users summary
  const finalCount = await railway.query('SELECT COUNT(*)::int as n FROM auth.users')
  const supCount = supUsers.length
  console.log(`\n📊 Final auth.users — Railway: ${finalCount.rows[0].n} | Supabase: ${supCount}`)

  // 5. Check org_members user_id FK integrity
  console.log('\n🔍 Checking org_members.user_id FK integrity...')
  const fkCheck = await railway.query(`
    SELECT om.user_id::text, om.org_id::text
    FROM public.org_members om
    LEFT JOIN auth.users u ON u.id = om.user_id
    WHERE u.id IS NULL
    LIMIT 10
  `)
  if (fkCheck.rows.length === 0) {
    console.log('   ✅ All org_members.user_id references valid')
  } else {
    console.log(`   ⚠  ${fkCheck.rows.length} org_members with invalid user_id:`, fkCheck.rows)
  }
}

main()
  .then(() => railway.end())
  .catch((e) => {
    console.error('FATAL:', e.message)
    railway.end()
  })
