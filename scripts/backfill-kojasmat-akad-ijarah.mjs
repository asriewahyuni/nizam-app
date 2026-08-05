#!/usr/bin/env node

// Backfill kojasmat_akad_ijarah untuk anggota AKTIF yang sudah ada sebelum fitur
// ijarah platform diluncurkan. Tagihan pertama TIDAK langsung dipotong hari itu —
// tagihan_berikutnya diset ke rollout_date + periode_hari (masa tenggang), supaya
// tidak ada anggota lama yang langsung dibekukan di hari peluncuran.

import process from 'node:process'
import { Client } from 'pg'
import nextEnv from '@next/env'

const { loadEnvConfig } = nextEnv
loadEnvConfig(process.cwd())

const HELP_TEXT = `
Backfill kojasmat_akad_ijarah for existing AKTIF anggota.

Usage:
  node scripts/backfill-kojasmat-akad-ijarah.mjs --rollout-date YYYY-MM-DD [--apply] [--db-url <postgres-url>]

--rollout-date is required (no default) so this is never run accidentally with
"today" when re-run days later for a straggler org.
`

function parseArgs(argv) {
  const args = { apply: false, dbUrl: '', rolloutDate: '' }
  for (let index = 2; index < argv.length; index += 1) {
    const current = String(argv[index] || '').trim()
    if (!current) continue
    if (current === '--help' || current === '-h') { args.help = true; continue }
    if (current === '--apply') { args.apply = true; continue }
    if (current === '--db-url') { args.dbUrl = String(argv[index + 1] || '').trim(); index += 1; continue }
    if (current === '--rollout-date') { args.rolloutDate = String(argv[index + 1] || '').trim(); index += 1; continue }
    throw new Error(`Unknown argument: ${current}`)
  }
  return args
}

function resolveDbUrl(cliDbUrl) {
  const fromCli = String(cliDbUrl || '').trim()
  if (fromCli) return fromCli
  return (
    String(process.env.RAILWAY_DATABASE_URL || '').trim() ||
    String(process.env.DATABASE_PUBLIC_URL || '').trim() ||
    String(process.env.DATABASE_URL || '').trim()
  )
}

const DEFAULT_IJARAH_FEE = 25000
const DEFAULT_IJARAH_PERIODE_HARI = 30

async function main() {
  const args = parseArgs(process.argv)
  if (args.help) { console.log(HELP_TEXT.trim()); return }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(args.rolloutDate)) {
    console.error('Error: --rollout-date YYYY-MM-DD wajib diisi eksplisit.')
    console.log(HELP_TEXT.trim())
    process.exitCode = 1
    return
  }

  const dbUrl = resolveDbUrl(args.dbUrl)
  if (!dbUrl) {
    console.error('Error: DB URL tidak ditemukan (set DATABASE_URL / RAILWAY_DATABASE_URL atau pakai --db-url).')
    process.exitCode = 1
    return
  }

  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
  await client.connect()

  try {
    const { rows: orgs } = await client.query(
      `SELECT org_id::text, settings FROM org_module_instances WHERE module_key='Kojasmat'`
    )

    console.log(`=== Backfill Akad Ijarah (${args.apply ? 'APPLY' : 'DRY RUN'}) ===`)
    console.log(`Rollout date: ${args.rolloutDate}`)
    console.log(`Org Kojasmat ditemukan: ${orgs.length}`)

    let totalCandidates = 0
    let totalCreated = 0

    for (const org of orgs) {
      const settings = org.settings || {}
      const fee = Number(settings.ijarah_platform_fee ?? DEFAULT_IJARAH_FEE)
      const periodeHari = Number(settings.ijarah_platform_periode_hari ?? DEFAULT_IJARAH_PERIODE_HARI)

      const { rows: anggotaList } = await client.query(
        `SELECT a.id::text, a.nama, a.phone, a.user_id::text
         FROM kojasmat_anggota a
         WHERE a.org_id = $1 AND a.status = 'AKTIF'
           AND NOT EXISTS (SELECT 1 FROM kojasmat_akad_ijarah k WHERE k.anggota_id = a.id)`,
        [org.org_id]
      )

      totalCandidates += anggotaList.length
      console.log(`\nOrg ${org.org_id}: ${anggotaList.length} anggota AKTIF tanpa akad ijarah (tarif Rp${fee}/${periodeHari} hari)`)

      if (!args.apply || anggotaList.length === 0) continue

      for (const anggota of anggotaList) {
        await client.query(
          `INSERT INTO kojasmat_akad_ijarah (org_id, anggota_id, nominal_fee, periode_hari, tanggal_mulai, tagihan_berikutnya)
           VALUES ($1,$2,$3,$4,$5::date,$5::date + ($4 || ' days')::interval)
           ON CONFLICT (anggota_id) DO NOTHING`,
          [org.org_id, anggota.id, fee, periodeHari, args.rolloutDate]
        )
        totalCreated += 1
      }
    }

    console.log(`\nTotal kandidat: ${totalCandidates}`)
    if (!args.apply) {
      console.log('Dry-run mode. Re-run dengan --apply untuk benar-benar membuat akad + kirim notifikasi.')
    } else {
      console.log(`Akad dibuat: ${totalCreated}`)
      console.log('Catatan: notifikasi one-time ke anggota TIDAK dikirim otomatis oleh script ini —')
      console.log('kirim lewat kampanye WA/email terpisah menggunakan daftar anggota di atas.')
    }
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
