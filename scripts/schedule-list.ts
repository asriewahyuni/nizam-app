/**
 * Menampilkan daftar scheduler yang aktif, mirip `artisan schedule:list`.
 */

import { loadEnvConfig } from '@next/env'
import { closePostgresPool } from '../lib/db/postgres'
import { listScheduledTasks } from '../lib/scheduler/scheduler.server'

loadEnvConfig(process.cwd())

async function main() {
  const tasks = listScheduledTasks()

  if (tasks.length === 0) {
    console.log('Belum ada task scheduler yang terdaftar.')
    return
  }

  for (const task of tasks) {
    console.log(task.task)
    console.log(`  Deskripsi : ${task.description}`)
    console.log(`  Timezone  : ${task.timezone}`)
    console.log(`  Window    : ${task.currentWindowLabel}`)
    console.log(`  Next Run  : ${task.nextRunLabel}`)
    console.log(`  Due Now   : ${task.due ? 'ya' : 'tidak'}`)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Gagal membaca daftar scheduler.')
  process.exitCode = 1
}).finally(async () => {
  await closePostgresPool()
})
