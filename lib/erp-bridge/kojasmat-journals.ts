'use server'

// Kojasmat ERP Bridge — jurnal akuntansi syariah yang benar per jenis transaksi.
// Semua mapping CoA mengacu pada PSAK 105/106 dan IAI Koperasi Syariah.
//
// CoA Reference:
//   1101       — Kas Besar (ASET)
//   11-4001    — Piutang Mudharabah — Pembiayaan Aktif (ASET)
//   21-5001    — DST Murabahah (LIABILITAS)
//   21-5002    — DST Mudharabah (LIABILITAS)
//   21-6000    — Simpanan Sukarela / Wadiah (LIABILITAS)
//   22-1000    — Utang Bagi Hasil Belum Dibagikan (LIABILITAS)
//   31-1000    — Simpanan Pokok / Wadiah (LIABILITAS) — titipan anggota, bukan modal permanen
//   31-2000    — Simpanan Wajib / Wadiah (LIABILITAS) — titipan anggota, bukan modal permanen
//   32-1000    — Cadangan Koperasi (EKUITAS)
//   41-6001    — Ujrah Wakalah Murabahah (PENDAPATAN)
//   41-6002    — Ujrah Wakalah Mudharabah (PENDAPATAN)

import { ERPBridge } from './finances'
import { createJournalEntry } from '@/modules/accounting/actions/journal.actions'

const SIMPANAN_COA: Record<string, string> = {
  POKOK:    '31-1000',
  WAJIB:    '31-2000',
  SUKARELA: '21-6000',
}

const DST_COA: Record<string, string> = {
  MUDHARABAH: '21-5002',
  MURABAHAH:  '21-5001',
  INAN:       '21-5002',
}

async function getAcct(orgId: string, code: string): Promise<string | null> {
  return ERPBridge.getDefaultAccount(orgId, code)
}

async function postJurnal(
  orgId: string,
  debitCode: string,
  creditCode: string,
  amount: number,
  description: string,
  refType: string,
  refId: string,
) {
  if (amount <= 0) return
  const [debitId, creditId] = await Promise.all([
    getAcct(orgId, debitCode),
    getAcct(orgId, creditCode),
  ])
  if (!debitId || !creditId) {
    // CoA belum diinject untuk org ini — skip non-fatal
    return
  }
  await createJournalEntry({
    org_id: orgId,
    entry_date: new Date().toISOString().split('T')[0],
    description,
    reference_type: refType,
    reference_id: refId,
    auto_post: true,
    lines: [
      { account_id: debitId,  debit: amount, credit: 0,      memo: description },
      { account_id: creditId, debit: 0,      credit: amount, memo: description },
    ],
  })
}

// ─── SIMPANAN ─────────────────────────────────────────────────────────────────

/**
 * Setoran simpanan: Dr Kas (1101) → Cr Wadiah Anggota (31-1000/31-2000/21-6000 — semua LIABILITAS)
 */
export async function jurnalSetorSimpanan(
  orgId: string,
  jenis: 'POKOK' | 'WAJIB' | 'SUKARELA',
  jumlah: number,
  simpananId: string,
  keteranganExtra?: string,
) {
  const creditCode = SIMPANAN_COA[jenis]
  if (!creditCode) return
  await postJurnal(
    orgId, '1101', creditCode, jumlah,
    `Setoran simpanan ${jenis}${keteranganExtra ? ` — ${keteranganExtra}` : ''}`,
    'KOJASMAT_SIMPANAN_SETOR', simpananId,
  )
}

/**
 * Penarikan simpanan: Dr Simpanan Anggota → Cr Kas (1101)
 */
export async function jurnalTarikSimpanan(
  orgId: string,
  jenis: 'POKOK' | 'WAJIB' | 'SUKARELA',
  jumlah: number,
  simpananId: string,
  keteranganExtra?: string,
) {
  const debitCode = SIMPANAN_COA[jenis]
  if (!debitCode) return
  await postJurnal(
    orgId, debitCode, '1101', jumlah,
    `Penarikan simpanan ${jenis}${keteranganExtra ? ` — ${keteranganExtra}` : ''}`,
    'KOJASMAT_SIMPANAN_TARIK', simpananId,
  )
}

// ─── PEMBIAYAAN PROYEK ────────────────────────────────────────────────────────

/**
 * Pemodal menyetor dana ke proyek:
 *   Dr Kas (1101) → Cr Dana Syirkah Temporer (21-5002 Mudharabah / 21-5001 Murabahah)
 */
export async function jurnalPenerimaanDanaPemodal(
  orgId: string,
  jenisAkad: 'MUDHARABAH' | 'MURABAHAH' | 'INAN',
  jumlah: number,
  pembiayaanId: string,
  kodeProyek: string,
) {
  const creditCode = DST_COA[jenisAkad] ?? '21-5002'
  await postJurnal(
    orgId, '1101', creditCode, jumlah,
    `Penerimaan dana pemodal proyek ${kodeProyek} (${jenisAkad})`,
    'KOJASMAT_PEMBIAYAAN', pembiayaanId,
  )
}

/**
 * Pembatalan pendanaan oleh pemodal sebelum proyek berjalan — reversal dari
 * jurnalPenerimaanDanaPemodal:
 *   Dr Dana Syirkah Temporer → Cr Kas (1101)
 */
export async function jurnalPembatalanPembiayaan(
  orgId: string,
  jenisAkad: 'MUDHARABAH' | 'MURABAHAH' | 'INAN',
  jumlah: number,
  pembiayaanId: string,
  kodeProyek: string,
) {
  const debitCode = DST_COA[jenisAkad] ?? '21-5002'
  await postJurnal(
    orgId, debitCode, '1101', jumlah,
    `Pembatalan pendanaan proyek ${kodeProyek} (${jenisAkad})`,
    'KOJASMAT_PEMBIAYAAN_BATAL', pembiayaanId,
  )
}

/**
 * Pembatalan ujrah diwakilkan akad — reversal dari jurnalUjrahMudharabah/Murabahah:
 *   Dr Ujrah Wakalah → Cr Kas (1101)
 */
export async function jurnalPembatalanUjrah(
  orgId: string,
  jenisAkad: string,
  jumlah: number,
  refId: string,
  kodeProyek: string,
) {
  const debitCode = jenisAkad === 'MURABAHAH' ? '41-6001' : '41-6002'
  await postJurnal(
    orgId, debitCode, '1101', jumlah,
    `Pembatalan ujrah wakalah diwakilkan akad proyek ${kodeProyek}`,
    'KOJASMAT_UJRAH_BATAL', refId,
  )
}

/**
 * Penyaluran modal ke mudharib (koperasi bayar ke pengaju proyek):
 *   Dr Piutang Mudharabah (11-4001) → Cr Kas (1101)
 */
export async function jurnalPenyaluranModalMudharib(
  orgId: string,
  jumlah: number,
  proyekId: string,
  kodeProyek: string,
) {
  await postJurnal(
    orgId, '11-4001', '1101', jumlah,
    `Penyaluran modal ke mudharib proyek ${kodeProyek}`,
    'KOJASMAT_PENYALURAN', proyekId,
  )
}

// ─── UJRAH KOPERASI ───────────────────────────────────────────────────────────

/**
 * Penerimaan ujrah wakalah dari mudharib:
 *   Dr Kas (1101) → Cr Ujrah Wakalah Mudharabah (41-6002)
 */
export async function jurnalUjrahMudharabah(
  orgId: string,
  jumlah: number,
  refId: string,
  kodeProyek: string,
) {
  await postJurnal(
    orgId, '1101', '41-6002', jumlah,
    `Ujrah wakalah mudharabah proyek ${kodeProyek}`,
    'KOJASMAT_UJRAH', refId,
  )
}

/**
 * Penerimaan ujrah wakalah dari akad murabahah:
 *   Dr Kas (1101) → Cr Ujrah Wakalah Murabahah (41-6001)
 */
export async function jurnalUjrahMurabahah(
  orgId: string,
  jumlah: number,
  refId: string,
  kodeProyek: string,
) {
  await postJurnal(
    orgId, '1101', '41-6001', jumlah,
    `Ujrah wakalah murabahah proyek ${kodeProyek}`,
    'KOJASMAT_UJRAH', refId,
  )
}

// ─── BAGI HASIL ───────────────────────────────────────────────────────────────

/**
 * Distribusi bagi hasil ke pemodal (shahibul maal):
 *   Dr Dana Syirkah Temporer (21-5002) → Cr Kas (1101)
 */
export async function jurnalDistribusiBagiHasil(
  orgId: string,
  jumlah: number,
  bagiHasilId: string,
  kodeProyek: string,
) {
  await postJurnal(
    orgId, '21-5002', '1101', jumlah,
    `Distribusi bagi hasil proyek ${kodeProyek}`,
    'KOJASMAT_BAGI_HASIL', bagiHasilId,
  )
}

// ─── PERKEMBANGAN USAHA PROYEK (PENDAPATAN/BEBAN) ──────────────────────────────

/**
 * Pendapatan usaha dari proyek pembiayaan (dicatat mudharib di laporan perkembangan):
 *   Dr Kas (1101) → Cr Pendapatan Usaha Proyek (41-7000)
 */
export async function jurnalPendapatanProyek(
  orgId: string,
  jumlah: number,
  transaksiId: string,
  kodeProyek: string,
  kategori: string,
) {
  await postJurnal(
    orgId, '1101', '41-7000', jumlah,
    `Pendapatan proyek ${kodeProyek} — ${kategori}`,
    'KOJASMAT_PROYEK_PENDAPATAN', transaksiId,
  )
}

/**
 * Beban usaha dari proyek pembiayaan (dicatat mudharib di laporan perkembangan):
 *   Dr Beban Usaha Proyek (51-7000) → Cr Kas (1101)
 */
export async function jurnalBebanProyek(
  orgId: string,
  jumlah: number,
  transaksiId: string,
  kodeProyek: string,
  kategori: string,
) {
  await postJurnal(
    orgId, '51-7000', '1101', jumlah,
    `Beban proyek ${kodeProyek} — ${kategori}`,
    'KOJASMAT_PROYEK_BEBAN', transaksiId,
  )
}
