/**
 * CLI read-only untuk gerbang go-live Coreisec.
 */
import { closePostgresPool } from '../../lib/db/postgres'
import { getCoreisecReadiness } from '../../modules/migration/coreisec-readiness.server'

function argValue(name: string) {
  const inline = process.argv.find((arg) => arg.startsWith(`--${name}=`))
  if (inline) return inline.slice(name.length + 3).trim()
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? String(process.argv[index + 1] || '').trim() : ''
}

async function main() {
  const orgId = argValue('org-id')
  if (!orgId) throw new Error('Gunakan --org-id <uuid>.')
  try {
    const result = await getCoreisecReadiness(orgId)
    console.log(JSON.stringify(result, null, 2))
    if (!result.ready) process.exitCode = 2
  } finally {
    await closePostgresPool()
  }
}

main().catch((error: unknown) => {
  console.error(`[coreisec:readiness] ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
