/**
 * Backup PostgreSQL ke Telegram.
 * Pakai pg_dump → gzip → kirim via Telegram Bot API (sendDocument).
 * Dipanggil dari scheduler atau endpoint manual /api/admin/backup.
 */

import { execFile } from 'child_process'
import { unlinkSync, existsSync, mkdirSync, statSync, readdirSync, readFileSync } from 'fs'
import { createGzip } from 'zlib'
import { promisify } from 'util'
import path from 'path'
import { pipeline } from 'stream/promises'
import { createReadStream, createWriteStream } from 'fs'
// Note: fetch & FormData tersedia native di Node 18+ / Next.js 14+

const execFileAsync = promisify(execFile)

export type BackupResult = {
  ok: boolean
  filename?: string
  sizeBytes?: number
  sizeMB?: string
  telegramMessageId?: number
  error?: string
  dryRun?: boolean
}

function getBackupConfig() {
  const dbUrl = String(process.env.RAILWAY_DATABASE_URL || process.env.DATABASE_URL || '').trim()
  const botToken = String(process.env.TELEGRAM_BOT_TOKEN || '').trim()
  const chatId = String(process.env.TELEGRAM_USER_ID || '').trim()
  const backupDir = path.join(process.cwd(), '.backups')
  return { dbUrl, botToken, chatId, backupDir }
}

function parseDatabaseUrl(dbUrl: string) {
  try {
    const url = new URL(dbUrl)
    return {
      host: url.hostname,
      port: url.port || '5432',
      user: url.username,
      password: url.password,
      database: url.pathname.replace(/^\//, ''),
    }
  } catch {
    throw new Error('RAILWAY_DATABASE_URL tidak valid.')
  }
}

function buildTimestamp(now: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  // Konversi ke WIB untuk nama file
  const wib = new Date(now.getTime() + 7 * 60 * 60 * 1000)
  const y = wib.getUTCFullYear()
  const mo = pad(wib.getUTCMonth() + 1)
  const d = pad(wib.getUTCDate())
  const h = pad(wib.getUTCHours())
  const mi = pad(wib.getUTCMinutes())
  const s = pad(wib.getUTCSeconds())
  return `${y}${mo}${d}_${h}${mi}${s}`
}

async function runPgDump(dbParams: ReturnType<typeof parseDatabaseUrl>, outFile: string): Promise<void> {
  const env = { ...process.env, PGPASSWORD: dbParams.password }
  await execFileAsync(
    'pg_dump',
    [
      '-h', dbParams.host,
      '-p', dbParams.port,
      '-U', dbParams.user,
      '-d', dbParams.database,
      '--no-password',
      '--format=plain',
      '--encoding=UTF8',
      '--file', outFile,
    ],
    { env, timeout: 120_000 }
  )
}

async function gzipFile(inputPath: string, outputPath: string): Promise<void> {
  const source = createReadStream(inputPath)
  const gzip = createGzip({ level: 6 })
  const dest = createWriteStream(outputPath)
  await pipeline(source, gzip, dest)
}

async function sendToTelegram(
  botToken: string,
  chatId: string,
  filePath: string,
  caption: string
): Promise<number> {
  const fileBuffer = readFileSync(filePath)
  const filename = path.basename(filePath)

  const form = new FormData()
  form.append('chat_id', chatId)
  form.append('caption', caption)
  form.append('parse_mode', 'Markdown')
  form.append('document', new Blob([fileBuffer], { type: 'application/gzip' }), filename)

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, {
    method: 'POST',
    body: form,
  })

  const json = await response.json() as { ok: boolean; result?: { message_id: number }; description?: string }

  if (json.ok && json.result?.message_id) {
    return json.result.message_id
  }

  throw new Error(`Telegram error: ${json.description || JSON.stringify(json)}`)
}

function cleanupOldBackups(backupDir: string, keepDays: number) {
  try {
    const cutoff = Date.now() - keepDays * 24 * 60 * 60 * 1000
    const files = readdirSync(backupDir) as string[]
    for (const file of files) {
      if (!file.endsWith('.sql.gz') && !file.endsWith('.sql')) continue
      const filePath = path.join(backupDir, file)
      const stat = statSync(filePath)
      if (stat.mtimeMs < cutoff) {
        unlinkSync(filePath)
      }
    }
  } catch {
    // Best-effort cleanup, jangan sampai gagalin backup utama
  }
}

/**
 * Jalankan backup database.
 * @param dryRun - kalau true, skip pg_dump & Telegram, cuma validasi config
 */
export async function runDatabaseBackup(dryRun = false): Promise<BackupResult> {
  const config = getBackupConfig()

  if (!config.dbUrl) {
    return { ok: false, error: 'RAILWAY_DATABASE_URL tidak dikonfigurasi.' }
  }
  if (!config.botToken) {
    return { ok: false, error: 'TELEGRAM_BOT_TOKEN tidak dikonfigurasi.' }
  }
  if (!config.chatId) {
    return { ok: false, error: 'TELEGRAM_USER_ID tidak dikonfigurasi.' }
  }

  if (dryRun) {
    return {
      ok: true,
      dryRun: true,
      filename: `nizam_db_backup_${buildTimestamp(new Date())}.sql.gz`,
    }
  }

  // Pastikan folder .backups ada
  if (!existsSync(config.backupDir)) {
    mkdirSync(config.backupDir, { recursive: true })
  }

  const now = new Date()
  const timestamp = buildTimestamp(now)
  const sqlFile = path.join(config.backupDir, `nizam_db_backup_${timestamp}.sql`)
  const gzFile = `${sqlFile}.gz`

  try {
    const dbParams = parseDatabaseUrl(config.dbUrl)

    // Step 1: pg_dump ke file SQL
    await runPgDump(dbParams, sqlFile)

    // Step 2: compress ke gzip
    await gzipFile(sqlFile, gzFile)

    // Hapus file SQL mentah setelah gzip sukses
    if (existsSync(sqlFile)) unlinkSync(sqlFile)

    // Step 3: hitung ukuran
    const sizeBytes = statSync(gzFile).size
    const sizeMB = (sizeBytes / 1024 / 1024).toFixed(2)
    const filename = path.basename(gzFile)

    // Step 4: kirim ke Telegram
    const wibStr = new Date(now.getTime() + 7 * 60 * 60 * 1000)
      .toISOString()
      .replace('T', ' ')
      .slice(0, 19)

    const caption =
      `🗄️ *Nizam DB Backup*\n` +
      `📅 Tanggal: ${wibStr} WIB\n` +
      `📦 File: \`${filename}\`\n` +
      `💾 Ukuran: ${sizeMB} MB\n` +
      `✅ Status: Sukses`

    const telegramMessageId = await sendToTelegram(config.botToken, config.chatId, gzFile, caption)

    // Cleanup: hapus file lokal setelah berhasil terkirim
    if (existsSync(gzFile)) unlinkSync(gzFile)

    // Cleanup: hapus backup lokal lama (> 7 hari) — safety net
    cleanupOldBackups(config.backupDir, 7)

    return { ok: true, filename, sizeBytes, sizeMB, telegramMessageId }
  } catch (error) {
    // Cleanup file gagal agar disk gak penuh
    if (existsSync(sqlFile)) unlinkSync(sqlFile)
    if (existsSync(gzFile)) unlinkSync(gzFile)

    const message = error instanceof Error ? error.message : String(error)
    return { ok: false, error: message }
  }
}
