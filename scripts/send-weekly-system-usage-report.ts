/**
 * Jalankan laporan pekanan penggunaan sistem dari command line.
 * Contoh:
 * - npm run report:weekly-system-usage
 * - npm run report:weekly-system-usage -- --dry-run
 */

import { loadEnvConfig } from '@next/env'
import { sendWeeklySystemUsageReport } from '../lib/activity/weekly-usage-report.server'
loadEnvConfig(process.cwd())

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const result = await sendWeeklySystemUsageReport({ dryRun })
  const failedRecipients = result.results.filter((item) => !item.success)

  console.log(`Periode laporan: ${result.report.periodLabel}`)
  console.log(`Penerima: ${result.recipients.join(', ')}`)
  console.log(`Mode: ${dryRun ? 'dry-run' : 'kirim email'}`)
  console.log(`Ringkasan: ${JSON.stringify(result.report.summary)}`)

  if (dryRun) {
    console.log('Dry-run selesai. Email tidak dikirim.')
    return
  }

  if (failedRecipients.length > 0) {
    console.error(`Gagal kirim ke: ${failedRecipients.map((item) => item.recipient).join(', ')}`)
    failedRecipients.forEach((item) => {
      console.error(`- ${item.recipient}: ${item.error || 'Unknown error'}`)
    })
    process.exitCode = 1
    return
  }

  console.log('Laporan pekanan berhasil dikirim ke semua penerima.')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Gagal menjalankan laporan pekanan.')
  process.exitCode = 1
})
