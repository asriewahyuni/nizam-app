'use server'

// Klinik Pratama ERP Bridge — jurnal akuntansi per jenis transaksi klinik
// (konsultasi, tindakan, penjualan obat, dst — fungsi konkretnya dibangun di
// fase Kasir/Billing & Apotek).
//
// Kode akun TIDAK di-hardcode di sini — setiap klinik/grup klinik bisa punya
// skema CoA berbeda, bahkan berbeda per cabang. Akun untuk tiap peran (kas,
// pendapatan konsultasi/tindakan/obat, HPP obat, persediaan obat, piutang
// BPJS, dst) diambil dari klinik_account_mapping (fallback ke mapping
// default org-level kalau mapping spesifik cabang belum diset), diatur admin
// lewat UI Pengaturan Akun. Peran yang belum dipetakan menyebabkan seluruh
// jurnal di-skip non-fatal — transaksi tetap tercatat di modul Klinik, jurnal
// GL menyusul setelah admin melengkapi pemetaannya.
//
// Beda dari lib/erp-bridge/kojasmat-journals.ts: postJurnal di sini mendukung
// multi-baris (bukan cuma 1 pasang debit/kredit — tagihan klinik bisa berisi
// konsultasi + tindakan + obat + HPP sekaligus) dan SELALU meneruskan
// branch_id ke createJournalEntry — wajib supaya Laba Rugi per cabang bisa
// dihitung, karena multi-klinik adalah requirement utama modul ini.
//
// Dispensing obat (fase Apotek) WAJIB memanggil fungsi jurnal di sini SETELAH
// RPC pengurangan stok berhasil — bukan dari dalam RPC itu sendiri. Kalau
// jurnal diposting di dalam RPC yang sama, trigger check_closed_period()
// (supabase/migrations/1423_fiscal_period_explicit_link.sql) bisa
// me-rollback pengurangan stok saat periode fiskal tertutup — artinya
// penutupan buku bulan lalu bisa memblokir pemberian obat ke pasien hari ini.

import { createJournalEntry } from '@/modules/accounting/actions/journal.actions'
import { queryPostgres } from '@/lib/db/postgres'
import { getKlinikAccountMapping, type KlinikAccountRole } from '@/modules/klinik/lib/klinik-account-mapping.server'

export type KlinikJournalLine = {
  role: KlinikAccountRole
  debit: number
  credit: number
  memo?: string
}

/**
 * Posting jurnal multi-baris berbasis peran akun. Idempoten per
 * (org_id, reference_type, reference_id) — pola sama seperti
 * ERPBridge.recordCOGS (lib/erp-bridge/finances.ts) — supaya aksi yang
 * dipanggil ulang (retry setelah error jaringan, "Posting Jurnal Tertunda")
 * tidak menghasilkan jurnal dobel. Baris dengan role yang belum dipetakan
 * admin dibuang; kalau sisa baris < 2 atau tidak balance (karena sebagian
 * role belum dipetakan), seluruh jurnal di-skip non-fatal (return null) —
 * dipanggil ulang otomatis lewat "Posting Jurnal Tertunda" di UI Pengaturan
 * Akun setelah admin melengkapi mapping.
 */
export async function postJurnal(
  orgId: string,
  branchId: string | null,
  lines: KlinikJournalLine[],
  description: string,
  refType: string,
  refId: string,
): Promise<string | null> {
  const { rows: existingRows } = await queryPostgres<{ id: string }>(
    `SELECT id FROM journal_entries WHERE org_id = $1 AND reference_type = $2 AND reference_id = $3 LIMIT 1`,
    [orgId, refType, refId],
  )
  if (existingRows[0]) return existingRows[0].id

  const mapping = await getKlinikAccountMapping(orgId, branchId)

  const resolvedLines = lines
    .filter((line) => (line.debit || 0) > 0 || (line.credit || 0) > 0)
    .map((line) => ({
      account_id: mapping[line.role],
      debit: line.debit || 0,
      credit: line.credit || 0,
      memo: line.memo || description,
    }))
    .filter((line): line is { account_id: string; debit: number; credit: number; memo: string } => Boolean(line.account_id))

  if (resolvedLines.length < 2) return null

  const totalDebit = resolvedLines.reduce((s, l) => s + l.debit, 0)
  const totalCredit = resolvedLines.reduce((s, l) => s + l.credit, 0)
  if (Math.abs(totalDebit - totalCredit) > 0.01) return null

  const result = await createJournalEntry({
    org_id: orgId,
    branch_id: branchId ?? undefined,
    entry_date: new Date().toISOString().split('T')[0],
    description,
    reference_type: refType,
    reference_id: refId,
    auto_post: true,
    lines: resolvedLines,
  })
  return result && 'entryId' in result ? result.entryId : null
}
