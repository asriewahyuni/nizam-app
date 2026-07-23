/** Menjalankan satu batch worker notification outbox. */
import { dispatchNotificationOutbox } from '../../modules/notifications/outbox.server'
import { closePostgresPool } from '../../lib/db/postgres'

const rawLimit = process.argv.find((argument) => argument.startsWith('--limit='))?.split('=')[1]
const limit = Math.max(1, Math.min(100, Number(rawLimit || 25)))

dispatchNotificationOutbox(limit)
  .then((result) => console.log(JSON.stringify(result, null, 2)))
  .catch((error: unknown) => {
    console.error(`[notifications:dispatch] ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  })
  .finally(() => closePostgresPool())
