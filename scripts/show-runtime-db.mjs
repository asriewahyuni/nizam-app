#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

/**
 * Tampilkan database runtime aktif yang benar-benar akan dipakai aplikasi.
 *
 * Urutan source mengikuti runtime app:
 * 1. DATABASE_URL
 * 2. RAILWAY_DATABASE_URL
 * 3. DATABASE_PUBLIC_URL
 */

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {}

  const env = {}
  const content = fs.readFileSync(filePath, 'utf8')

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    const normalized = line.startsWith('export ') ? line.slice('export '.length).trim() : line
    const separatorIndex = normalized.indexOf('=')
    if (separatorIndex <= 0) continue

    const key = normalized.slice(0, separatorIndex).trim()
    const value = normalized.slice(separatorIndex + 1).trim()
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue

    env[key] = value.replace(/^['"]|['"]$/g, '')
  }

  return env
}

function loadEnvMap() {
  const rootDir = process.cwd()
  return {
    ...parseEnvFile(path.join(rootDir, '.env')),
    ...parseEnvFile(path.join(rootDir, '.env.local')),
    ...process.env,
  }
}

function getActiveConnection(envMap) {
  const candidates = [
    ['DATABASE_URL', String(envMap.DATABASE_URL || '').trim()],
    ['RAILWAY_DATABASE_URL', String(envMap.RAILWAY_DATABASE_URL || '').trim()],
    ['DATABASE_PUBLIC_URL', String(envMap.DATABASE_PUBLIC_URL || '').trim()],
  ]

  for (const [sourceKey, value] of candidates) {
    if (value) return { sourceKey, value }
  }

  return { sourceKey: 'missing', value: '' }
}

function detectMode(host) {
  const normalized = String(host || '').trim().toLowerCase()
  if (!normalized) return 'missing'
  if (normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1') {
    return 'local-postgres'
  }
  if (normalized.endsWith('.rlwy.net') || normalized.endsWith('.railway.internal')) {
    return 'railway-postgres'
  }
  return 'remote-postgres'
}

function maskDbUrl(dbUrl) {
  try {
    const parsed = new URL(dbUrl)
    if (parsed.password) parsed.password = '***'
    return parsed.toString()
  } catch {
    return dbUrl
  }
}

function main() {
  const envMap = loadEnvMap()
  const active = getActiveConnection(envMap)

  if (!active.value) {
    console.error('Tidak ada DATABASE_URL/RAILWAY_DATABASE_URL/DATABASE_PUBLIC_URL yang aktif.')
    process.exit(1)
  }

  let host = ''
  let port = ''
  let database = ''
  let mode = 'remote-postgres'

  try {
    const parsed = new URL(active.value)
    host = parsed.hostname
    port = parsed.port
    database = String(parsed.pathname || '').replace(/^\/+/, '')
    mode = detectMode(host)
  } catch {
    mode = 'remote-postgres'
  }

  console.log('Runtime database aktif:')
  console.log(`- Mode: ${mode}`)
  console.log(`- Sumber env: ${active.sourceKey}`)
  console.log(`- URL aktif: ${maskDbUrl(active.value)}`)
  if (host) console.log(`- Host: ${host}`)
  if (port) console.log(`- Port: ${port}`)
  if (database) console.log(`- Database: ${database}`)
  console.log(`- AUTH_PROVIDER: ${String(envMap.AUTH_PROVIDER || envMap.NEXT_PUBLIC_AUTH_PROVIDER || 'supabase')}`)
  console.log(
    `- NEXT_PUBLIC_SUPABASE_TARGET: ${String(envMap.NEXT_PUBLIC_SUPABASE_TARGET || 'remote')} (indikator legacy, bukan sumber kebenaran DB runtime)`
  )
}

main()
