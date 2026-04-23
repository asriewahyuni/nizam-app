/**
 * Runner scheduler ala Laravel.
 * Dipanggil cron secara berkala, lalu ia memutuskan task mana yang memang due.
 */

import { loadEnvConfig } from '@next/env'
import { closePostgresPool } from '../lib/db/postgres'
import { runScheduledTasks } from '../lib/scheduler/scheduler.server'

loadEnvConfig(process.cwd())

function readFlag(name: string) {
  return process.argv.includes(name)
}

function readOption(prefix: string) {
  const argument = process.argv.find((value) => value.startsWith(`${prefix}=`))
  return argument ? argument.slice(prefix.length + 1).trim() : ''
}

async function main() {
  const results = await runScheduledTasks({
    dryRun: readFlag('--dry-run'),
    force: readFlag('--force'),
    taskName: readOption('--task') || null,
  })

  if (results.length === 0) {
    console.log('Tidak ada task scheduler yang terdaftar.')
    return
  }

  let hasFailure = false

  for (const result of results) {
    const status = result.skipped
      ? 'SKIP'
      : result.success
        ? 'OK'
        : 'FAIL'

    console.log(`[${status}] ${result.task}`)
    console.log(`  Window : ${result.currentWindowLabel}`)
    console.log(`  Next   : ${result.nextRunLabel}`)
    console.log(`  Key    : ${result.scheduleKey}`)

    if (result.summary) {
      console.log(`  Info   : ${result.summary}`)
    }

    if (result.reason) {
      console.log(`  Note   : ${result.reason}`)
    }

    if (result.success === false) {
      hasFailure = true
    }
  }

  if (hasFailure) {
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Scheduler gagal dijalankan.')
  process.exitCode = 1
}).finally(async () => {
  await closePostgresPool()
})
