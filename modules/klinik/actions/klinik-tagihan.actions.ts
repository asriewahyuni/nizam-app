'use server'

// Klinik Pratama — kasir & billing. Tagihan menggabungkan layanan (dipilih
// manual dari klinik_tarif_layanan) + obat (auto-tarik dari resep yang sudah
// DISPENSED untuk kunjungan yang sama, harga pakai products.selling_price —
// BUKAN average_cost yang dipakai HPP saat dispensing).
//
// HPP obat SUDAH diposting terpisah saat dispensing (Fase Apotek,
// reference_type='KLINIK_DISPENSING'). Di sini HANYA revenue yang diposting
// (Dr Kas/Piutang BPJS, Cr Pendapatan...) — bukan re-posting HPP, supaya
// tidak dobel.

import { revalidatePath } from 'next/cache'
import { queryPostgres } from '@/lib/db/postgres'
import { postJurnal, type KlinikJournalLine } from '@/lib/erp-bridge/klinik-journals'

export type KlinikTagihanLayananInput = { tarifLayananId: string; qty: number }

export async function createTagihan(input: {
  orgId: string
  branchId: string
  kunjunganId: string
  pasienId: string
  metodeBayar: 'tunai' | 'bpjs' | 'asuransi'
  layananItems: KlinikTagihanLayananInput[]
}): Promise<{ data: { id: string; totalTagihan: number } } | { error: string }> {
  const { rows: existingRows } = await queryPostgres<{ id: string }>(
    `SELECT id FROM public.klinik_tagihan WHERE kunjungan_id = $1 LIMIT 1`,
    [input.kunjunganId],
  )
  if (existingRows[0]) return { error: 'Kunjungan ini sudah punya tagihan.' }

  const layananDetails: Array<{ deskripsi: string; refId: string; qty: number; harga: number }> = []
  if (input.layananItems.length > 0) {
    const { rows: tarifRows } = await queryPostgres<{ id: string; nama_layanan: string; harga: string }>(
      `SELECT id::text, nama_layanan, harga::text FROM public.klinik_tarif_layanan WHERE id = ANY($1::uuid[])`,
      [input.layananItems.map((l) => l.tarifLayananId)],
    )
    const tarifMap = new Map(tarifRows.map((t) => [t.id, t]))
    for (const item of input.layananItems) {
      const tarif = tarifMap.get(item.tarifLayananId)
      if (!tarif) continue
      layananDetails.push({ deskripsi: tarif.nama_layanan, refId: tarif.id, qty: item.qty, harga: Number(tarif.harga) })
    }
  }

  const { rows: obatRows } = await queryPostgres<{ id: string; product_name: string; jumlah: string; selling_price: string }>(
    `SELECT rd.id::text, p.name AS product_name, rd.jumlah::text, COALESCE(p.selling_price, 0)::text AS selling_price
     FROM public.klinik_resep r
     JOIN public.klinik_resep_detail rd ON rd.resep_id = r.id
     JOIN public.products p ON p.id = rd.product_id
     WHERE r.kunjungan_id = $1 AND r.status = 'DISPENSED'`,
    [input.kunjunganId],
  )

  const totalLayanan = layananDetails.reduce((s, d) => s + d.qty * d.harga, 0)
  const totalObat = obatRows.reduce((s, r) => s + Number(r.jumlah) * Number(r.selling_price), 0)
  const totalTagihan = totalLayanan + totalObat

  try {
    const { rows: tagihanRows } = await queryPostgres<{ id: string }>(
      `INSERT INTO public.klinik_tagihan (org_id, branch_id, kunjungan_id, pasien_id, total_layanan, total_obat, total_tagihan, metode_bayar)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id::text`,
      [input.orgId, input.branchId, input.kunjunganId, input.pasienId, totalLayanan, totalObat, totalTagihan, input.metodeBayar],
    )
    const tagihanId = tagihanRows[0].id

    for (const d of layananDetails) {
      await queryPostgres(
        `INSERT INTO public.klinik_tagihan_detail (tagihan_id, jenis, deskripsi, ref_id, qty, harga_satuan, subtotal)
         VALUES ($1, 'layanan', $2, $3, $4, $5, $6)`,
        [tagihanId, d.deskripsi, d.refId, d.qty, d.harga, d.qty * d.harga],
      )
    }
    for (const r of obatRows) {
      const jumlah = Number(r.jumlah)
      const hargaSatuan = Number(r.selling_price)
      await queryPostgres(
        `INSERT INTO public.klinik_tagihan_detail (tagihan_id, jenis, deskripsi, ref_id, qty, harga_satuan, subtotal)
         VALUES ($1, 'obat', $2, $3, $4, $5, $6)`,
        [tagihanId, r.product_name, r.id, jumlah, hargaSatuan, jumlah * hargaSatuan],
      )
    }

    revalidatePath('/klinik')
    return { data: { id: tagihanId, totalTagihan } }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Gagal membuat tagihan.' }
  }
}

export type KlinikTagihan = {
  id: string
  kunjungan_id: string
  total_layanan: number
  total_obat: number
  total_tagihan: number
  metode_bayar: 'tunai' | 'bpjs' | 'asuransi'
  status: 'BELUM_BAYAR' | 'LUNAS' | 'VOID'
  tanggal_bayar: string | null
}

export type KlinikTagihanDetailRow = {
  id: string
  jenis: 'layanan' | 'obat'
  deskripsi: string
  qty: number
  harga_satuan: number
  subtotal: number
}

export async function getTagihanByKunjungan(kunjunganId: string): Promise<{ tagihan: KlinikTagihan; items: KlinikTagihanDetailRow[] } | null> {
  const { rows } = await queryPostgres<KlinikTagihan>(
    `SELECT id::text, kunjungan_id::text, total_layanan, total_obat, total_tagihan, metode_bayar, status, tanggal_bayar::text
     FROM public.klinik_tagihan WHERE kunjungan_id = $1 LIMIT 1`,
    [kunjunganId],
  )
  const tagihan = rows[0]
  if (!tagihan) return null

  const { rows: items } = await queryPostgres<KlinikTagihanDetailRow>(
    `SELECT id::text, jenis, deskripsi, qty, harga_satuan, subtotal FROM public.klinik_tagihan_detail WHERE tagihan_id = $1 ORDER BY created_at ASC`,
    [tagihan.id],
  )
  return { tagihan, items }
}

/**
 * Bangun baris jurnal pendapatan untuk sebuah tagihan (Dr Kas/Piutang BPJS,
 * Cr Pendapatan Konsultasi/Tindakan/Obat). Dipakai dari markTagihanLunas()
 * DAN retryPostUnpostedJournals() — supaya logic-nya satu tempat, tidak
 * terduplikasi antara jalur "bayar sekarang" dan jalur "posting tertunda".
 */
async function buildTagihanRevenueLines(
  tagihanId: string,
  metodeBayar: 'tunai' | 'bpjs' | 'asuransi',
  totalObat: number,
): Promise<KlinikJournalLine[]> {
  const { rows: layananByKategori } = await queryPostgres<{ kategori: string; total: string }>(
    `SELECT t.kategori, SUM(d.subtotal)::text AS total
     FROM public.klinik_tagihan_detail d
     JOIN public.klinik_tarif_layanan t ON t.id = d.ref_id
     WHERE d.tagihan_id = $1 AND d.jenis = 'layanan'
     GROUP BY t.kategori`,
    [tagihanId],
  )
  const totalKonsultasi = Number(layananByKategori.find((r) => r.kategori === 'Konsultasi')?.total || 0)
  const totalTindakanLain = layananByKategori
    .filter((r) => r.kategori !== 'Konsultasi')
    .reduce((s, r) => s + Number(r.total), 0)

  const debitRole = metodeBayar === 'bpjs' ? 'piutang_bpjs' : 'kas'
  const totalTagihan = totalKonsultasi + totalTindakanLain + totalObat

  const lines: KlinikJournalLine[] = [
    { role: debitRole, debit: totalTagihan, credit: 0, memo: `Pembayaran tagihan ${tagihanId}` },
  ]
  if (totalKonsultasi > 0) lines.push({ role: 'pendapatan_konsultasi', debit: 0, credit: totalKonsultasi, memo: 'Pendapatan konsultasi' })
  if (totalTindakanLain > 0) lines.push({ role: 'pendapatan_tindakan', debit: 0, credit: totalTindakanLain, memo: 'Pendapatan tindakan' })
  if (totalObat > 0) lines.push({ role: 'pendapatan_obat', debit: 0, credit: totalObat, memo: 'Pendapatan obat' })
  return lines
}

export async function markTagihanLunas(
  orgId: string,
  branchId: string,
  tagihanId: string,
): Promise<{ success: true } | { error: string }> {
  const { rows } = await queryPostgres<{ id: string; status: string; total_obat: number; metode_bayar: 'tunai' | 'bpjs' | 'asuransi' }>(
    `SELECT id::text, status, total_obat, metode_bayar FROM public.klinik_tagihan WHERE id = $1 AND org_id = $2`,
    [tagihanId, orgId],
  )
  const tagihan = rows[0]
  if (!tagihan) return { error: 'Tagihan tidak ditemukan.' }
  if (tagihan.status !== 'BELUM_BAYAR') return { error: 'Tagihan ini sudah tidak berstatus belum bayar.' }

  const lines = await buildTagihanRevenueLines(tagihanId, tagihan.metode_bayar, Number(tagihan.total_obat))
  await postJurnal(orgId, branchId, lines, `Pembayaran tagihan klinik ${tagihanId}`, 'KLINIK_PEMBAYARAN', tagihanId)

  await queryPostgres(
    `UPDATE public.klinik_tagihan SET status = 'LUNAS', tanggal_bayar = NOW(), updated_at = NOW() WHERE id = $1`,
    [tagihanId],
  )

  revalidatePath('/klinik')
  return { success: true }
}

export async function voidTagihan(
  orgId: string,
  branchId: string,
  tagihanId: string,
): Promise<{ success: true } | { error: string }> {
  const { rows } = await queryPostgres<{ id: string; status: string; kunjungan_id: string }>(
    `SELECT id::text, status, kunjungan_id::text FROM public.klinik_tagihan WHERE id = $1 AND org_id = $2`,
    [tagihanId, orgId],
  )
  const tagihan = rows[0]
  if (!tagihan) return { error: 'Tagihan tidak ditemukan.' }
  if (tagihan.status === 'VOID') return { error: 'Tagihan ini sudah void.' }

  if (tagihan.status === 'LUNAS') {
    const { createJournalEntry } = await import('@/modules/accounting/actions/journal.actions')

    // Ambil jurnal pendapatan asli untuk dibalik persis (tukar debit<->kredit tiap baris).
    const { rows: originalEntry } = await queryPostgres<{ id: string }>(
      `SELECT id::text FROM public.journal_entries WHERE org_id = $1 AND reference_type = 'KLINIK_PEMBAYARAN' AND reference_id = $2 LIMIT 1`,
      [orgId, tagihanId],
    )
    if (originalEntry[0]) {
      // Idempoten — kalau voidTagihan sempat gagal di tengah jalan (mis. koneksi
      // putus setelah baris ini tapi sebelum status berubah jadi VOID) dan
      // dipanggil ulang, jangan buat jurnal balik kedua kalinya.
      const { rows: existingVoid } = await queryPostgres<{ id: string }>(
        `SELECT id FROM public.journal_entries WHERE org_id = $1 AND reference_type = 'KLINIK_VOID' AND reference_id = $2 LIMIT 1`,
        [orgId, tagihanId],
      )
      if (!existingVoid[0]) {
        const { rows: lines } = await queryPostgres<{ account_id: string; debit: number; credit: number }>(
          `SELECT account_id::text, debit, credit FROM public.journal_lines WHERE entry_id = $1`,
          [originalEntry[0].id],
        )
        await createJournalEntry({
          org_id: orgId,
          branch_id: branchId,
          entry_date: new Date().toISOString().split('T')[0],
          description: `Void tagihan klinik ${tagihanId}`,
          reference_type: 'KLINIK_VOID',
          reference_id: tagihanId,
          auto_post: true,
          lines: lines.map((l) => ({ account_id: l.account_id, debit: l.credit, credit: l.debit })),
        })
      }
    }

    // Kembalikan stok obat yang sudah di-dispensing untuk kunjungan ini —
    // per batch, pakai batch_number yang tersimpan di klinik_resep_detail
    // saat dispensing (Fase Apotek). Resep yang stoknya sudah pernah
    // dikembalikan (retry setelah void sebelumnya gagal di tengah jalan)
    // di-exclude lewat NOT EXISTS supaya tidak dobel-retur.
    const { rows: dispensedItems } = await queryPostgres<{
      product_id: string; jumlah: string; batch_number: string | null; resep_id: string; warehouse_id: string
    }>(
      `SELECT rd.product_id::text, rd.jumlah::text, rd.batch_number, r.id::text AS resep_id, r.warehouse_id::text AS warehouse_id
       FROM public.klinik_resep r
       JOIN public.klinik_resep_detail rd ON rd.resep_id = r.id
       WHERE r.kunjungan_id = $1 AND r.status = 'DISPENSED'
         AND NOT EXISTS (
           SELECT 1 FROM public.stock_movements sm
           WHERE sm.org_id = $2 AND sm.reference_type = 'KLINIK_VOID_RETURN' AND sm.reference_id = r.id
         )`,
      [tagihan.kunjungan_id, orgId],
    )
    for (const item of dispensedItems) {
      await queryPostgres(
        `SELECT adjust_inventory_stock($1, $2, $3, $4, $5, NULL)`,
        [orgId, item.product_id, item.warehouse_id, Number(item.jumlah), item.batch_number],
      )
      await queryPostgres(
        `INSERT INTO public.stock_movements (org_id, branch_id, product_id, quantity, unit_price, reference_type, reference_id, notes)
         VALUES ($1, $2, $3, $4, 0, 'KLINIK_VOID_RETURN', $5, $6)`,
        [orgId, branchId, item.product_id, Number(item.jumlah), item.resep_id, `Retur obat — void tagihan ${tagihanId}`],
      )
    }

    // Reversal HPP — exclude entri yang sudah pernah dibalik (guard sama
    // seperti stok di atas).
    const { rows: dispensingEntries } = await queryPostgres<{ id: string }>(
      `SELECT DISTINCT je.id::text
       FROM public.journal_entries je
       WHERE je.org_id = $1 AND je.reference_type = 'KLINIK_DISPENSING'
         AND je.reference_id IN (SELECT id FROM public.klinik_resep WHERE kunjungan_id = $2)
         AND NOT EXISTS (
           SELECT 1 FROM public.journal_entries voided
           WHERE voided.org_id = $1 AND voided.reference_type = 'KLINIK_VOID_HPP' AND voided.reference_id = je.id
         )`,
      [orgId, tagihan.kunjungan_id],
    )
    for (const entry of dispensingEntries) {
      const { rows: dispensingLines } = await queryPostgres<{ account_id: string; debit: number; credit: number }>(
        `SELECT account_id::text, debit, credit FROM public.journal_lines WHERE entry_id = $1`,
        [entry.id],
      )
      await createJournalEntry({
        org_id: orgId,
        branch_id: branchId,
        entry_date: new Date().toISOString().split('T')[0],
        description: `Void HPP obat — tagihan ${tagihanId}`,
        reference_type: 'KLINIK_VOID_HPP',
        reference_id: entry.id,
        auto_post: true,
        lines: dispensingLines.map((l) => ({ account_id: l.account_id, debit: l.credit, credit: l.debit })),
      })
    }
  }

  await queryPostgres(`UPDATE public.klinik_tagihan SET status = 'VOID', updated_at = NOW() WHERE id = $1`, [tagihanId])
  revalidatePath('/klinik')
  return { success: true }
}

/** Cari transaksi klinik yang jurnalnya masih ter-skip (role akun belum lengkap dipetakan saat itu). */
export async function getUnpostedKlinikTransactions(orgId: string): Promise<{
  tagihanPending: Array<{ id: string; total_obat: number; metode_bayar: 'tunai' | 'bpjs' | 'asuransi' }>
  resepPending: Array<{ id: string; total_hpp: number }>
}> {
  const { rows: tagihanPending } = await queryPostgres<{ id: string; total_obat: number; metode_bayar: 'tunai' | 'bpjs' | 'asuransi' }>(
    `SELECT tg.id::text, tg.total_obat, tg.metode_bayar
     FROM public.klinik_tagihan tg
     WHERE tg.org_id = $1 AND tg.status = 'LUNAS'
       AND NOT EXISTS (SELECT 1 FROM public.journal_entries je WHERE je.org_id = $1 AND je.reference_type = 'KLINIK_PEMBAYARAN' AND je.reference_id = tg.id)`,
    [orgId],
  )
  const { rows: resepPending } = await queryPostgres<{ id: string; total_hpp: string }>(
    `SELECT r.id::text, COALESCE(SUM(rd.jumlah * rd.avg_cost_snapshot), 0)::text AS total_hpp
     FROM public.klinik_resep r
     JOIN public.klinik_resep_detail rd ON rd.resep_id = r.id
     WHERE r.org_id = $1 AND r.status = 'DISPENSED'
       AND NOT EXISTS (SELECT 1 FROM public.journal_entries je WHERE je.org_id = $1 AND je.reference_type = 'KLINIK_DISPENSING' AND je.reference_id = r.id)
     GROUP BY r.id`,
    [orgId],
  )
  return {
    tagihanPending,
    resepPending: resepPending.map((r) => ({ id: r.id, total_hpp: Number(r.total_hpp) })),
  }
}

/**
 * Posting ulang jurnal untuk transaksi klinik yang sebelumnya ter-skip
 * (role akun COA belum lengkap dipetakan saat transaksi terjadi). Aman
 * dipanggil berkali-kali — postJurnal() sendiri idempoten per
 * (reference_type, reference_id), dan di sini hanya transaksi yang memang
 * belum punya jurnal yang diproses.
 */
export async function retryPostUnpostedJournals(orgId: string, branchId: string): Promise<{ posted: number }> {
  const { tagihanPending, resepPending } = await getUnpostedKlinikTransactions(orgId)
  let posted = 0

  for (const t of tagihanPending) {
    const lines = await buildTagihanRevenueLines(t.id, t.metode_bayar, Number(t.total_obat))
    const entryId = await postJurnal(orgId, branchId, lines, `Pembayaran tagihan klinik ${t.id}`, 'KLINIK_PEMBAYARAN', t.id)
    if (entryId) posted += 1
  }

  for (const r of resepPending) {
    if (r.total_hpp <= 0) continue
    const entryId = await postJurnal(
      orgId,
      branchId,
      [
        { role: 'hpp_obat', debit: r.total_hpp, credit: 0, memo: `HPP obat resep ${r.id}` },
        { role: 'persediaan_obat', debit: 0, credit: r.total_hpp, memo: `HPP obat resep ${r.id}` },
      ],
      `HPP dispensing resep ${r.id}`,
      'KLINIK_DISPENSING',
      r.id,
    )
    if (entryId) posted += 1
  }

  revalidatePath('/klinik')
  return { posted }
}
