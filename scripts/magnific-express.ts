#!/usr/bin/env node
/**
 * scripts/magnific-express.ts
 *
 * CLI buat generate ekspresi via Magnific API.
 * Panggil: npx tsx scripts/magnific-express.ts <emotion> [custom prompt]
 *
 * Contoh:
 *   npx tsx scripts/magnific-express.ts happy
 *   npx tsx scripts/magnific-express.ts angry "red background, intense"
 *   npx tsx scripts/magnific-express.ts custom "A dragon roaring"
 */

import { generateExpression, getRemainingToday, getExpressionPrompt } from '../lib/magnific/service'

async function main() {
  const args = process.argv.slice(2)
  const emotion = args[0] || 'happy'
  const customText = args.slice(1).join(' ')

  const sisa = getRemainingToday()
  console.log(`🎨 Generate ekspresi: "${emotion}"`)
  console.log(`📊 Sisa kuota hari ini: ${sisa}/20`)

  if (sisa <= 0) {
    console.log('❌ Daily limit udah habis! Besok lagi ya.')
    process.exit(1)
  }

  const prompt = getExpressionPrompt(emotion, customText)
  console.log(`📝 Prompt: ${prompt}`)

  const result = await generateExpression({ prompt })

  if (!result.success) {
    console.log(`❌ Error: ${result.error}`)
    process.exit(1)
  }

  console.log(`✅ Task Created! ID: ${result.data?.task_id}`)
  console.log(`📊 Sisa kuota: ${result.remaining_today}/20`)

  // Polling sampe selesai
  const { checkTaskStatus } = await import('../lib/magnific/service')
  let attempts = 0
  const maxAttempts = 10

  while (attempts < maxAttempts) {
    await new Promise(r => setTimeout(r, 5000))
    const status = await checkTaskStatus(result.data!.task_id)
    attempts++

    if (status.success && status.data) {
      if (status.data.status === 'COMPLETED') {
        console.log(`\n✅ SELESAI! Image URL:`)
        status.data.generated.forEach((url, i) => {
          console.log(`   ${i + 1}. ${url}`)
        })
        return
      }
      if (status.data.status === 'FAILED') {
        console.log('❌ Generate gagal.')
        process.exit(1)
      }
      console.log(`⏳ Masih processing... (${status.data.status})`)
    }
  }

  console.log('⏰ Timeout — task masih processing. Cek manual via task ID.')
}

main().catch(console.error)
