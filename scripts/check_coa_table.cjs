const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Read .env.local manually
const envPath = path.join(__dirname, '..', '.env.local')
const envContent = fs.readFileSync(envPath, 'utf8')
const env = {}
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/)
  if (match) env[match[1].trim()] = match[2].trim()
})

const url = env.NEXT_PUBLIC_SUPABASE_URL
const key = env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) { console.log('Missing env vars. url:', !!url, 'key:', !!key); process.exit(1) }

const sb = createClient(url, key)

async function main() {
  // 1. Check table via PostgREST
  const { error, count } = await sb
    .from('coa_account_requests')
    .select('id', { count: 'exact', head: true })

  if (error) {
    console.log('PostgREST ERROR:', error.message, '|', error.code)
  } else {
    console.log('PostgREST OK — row count:', count)
  }
}

main().catch(console.error)
