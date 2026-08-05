'use server'

// Kojasmat ERP Bridge — jurnal akuntansi syariah yang benar per jenis transaksi.
// Semua mapping CoA mengacu pada PSAK 105/106 dan IAI Koperasi Syariah.
//
// Kode akun TIDAK di-hardcode di sini — setiap koperasi bisa punya skema CoA
// berbeda. Akun untuk tiap peran (kas, simpanan pokok/wajib/sukarela, dana
// syirkah temporer, piutang pembiayaan, ujrah wakalah, dst) diambil dari
// kojasmat_account_mapping (satu baris per org), yang diatur sendiri oleh
// admin koperasi lewat UI Pengaturan Akun. Kalau suatu peran belum dipetakan,
// jurnal untuk peran itu di-skip non-fatal — transaksi tetap tercatat di
// modul Kojasmat, hanya belum masuk buku besar sampai admin melengkapi
// pemetaannya.

import { createJournalEntry } from '@/modules/accounting/actions/journal.actions'
import { getKojasmatAccountMapping, type KojasmatAccountRole } from '@/modules/kojasmat/lib/kojasmat-account-mapping.server'

async function postJurnal(
  orgId: string,
  debitRole: KojasmatAccountRole,
  creditRole: KojasmatAccountRole,
  amount: number,
  description: string,
  refType: string,
  refId: string,
) {
  if (amount <= 0) return
  const mapping = await getKojasmatAccountMapping(orgId)
  const debitId = mapping[debitRole]
  const creditId = mapping[creditRole]
  if (!debitId || !creditId) {
    // Peran akun belum dipetakan admin — skip non-fatal
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

const SIMPANAN_ROLE: Record<'POKOK' | 'WAJIB' | 'SUKARELA' | 'PROYEK' | 'HIBAH_NAMETAG' | 'HIBAH_MEMBERCARD' | 'HIBAH_KAJIAN' | 'HIBAH_BOP', KojasmatAccountRole> = {
  POKOK:    'simpanan_pokok',
  WAJIB:    'simpanan_wajib',
  SUKARELA: 'simpanan_sukarela',
  PROYEK:   'simpanan_proyek',
  HIBAH_NAMETAG: 'hibah_nametag',
  HIBAH_MEMBERCARD: 'hibah_membercard',
  HIBAH_KAJIAN: 'hibah_kajian',
  HIBAH_BOP: 'hibah_bop',
}

const DST_ROLE: Record<'MUDHARABAH' | 'MURABAHAH' | 'INAN', KojasmatAccountRole> = {
  MUDHARABAH: 'dst_mudharabah',
  MURABAHAH:  'dst_murabahah',
  INAN:       'dst_mudharabah',
}

// ─── SIMPANAN ─────────────────────────────────────────────────────────────────

/**
 * Setoran simpanan: Dr Kas → Cr Wadiah Anggota (Pokok/Wajib/Sukarela)
 */
export async function jurnalSetorSimpanan(
  orgId: string,
  jenis: 'POKOK' | 'WAJIB' | 'SUKARELA' | 'PROYEK' | 'HIBAH_NAMETAG' | 'HIBAH_MEMBERCARD' | 'HIBAH_KAJIAN' | 'HIBAH_BOP',
  jumlah: number,
  simpananId: string,
  keteranganExtra?: string,
) {
  await postJurnal(
    orgId, 'kas', SIMPANAN_ROLE[jenis], jumlah,
    `Setoran simpanan ${jenis}${keteranganExtra ? ` — ${keteranganExtra}` : ''}`,
    'KOJASMAT_SIMPANAN_SETOR', simpananId,
  )
}

/**
 * Biaya admin pendaftaran anggota baru: Dr Kas → Cr Pendapatan Administrasi
 */
export async function jurnalPendapatanBiayaAdmin(
  orgId: string,
  jumlah: number,
  pendaftaranId: string,
) {
  await postJurnal(
    orgId, 'kas', 'pendapatan_admin', jumlah,
    'Biaya admin pendaftaran anggota baru',
    'KOJASMAT_PENDAFTARAN_BAYAR', pendaftaranId,
  )
}

/**
 * Penarikan simpanan: Dr Simpanan Anggota → Cr Kas
 */
export async function jurnalTarikSimpanan(
  orgId: string,
  jenis: 'POKOK' | 'WAJIB' | 'SUKARELA' | 'PROYEK' | 'HIBAH_NAMETAG' | 'HIBAH_MEMBERCARD' | 'HIBAH_KAJIAN' | 'HIBAH_BOP',
  jumlah: number,
  simpananId: string,
  keteranganExtra?: string,
) {
  await postJurnal(
    orgId, SIMPANAN_ROLE[jenis], 'kas', jumlah,
    `Penarikan simpanan ${jenis}${keteranganExtra ? ` — ${keteranganExtra}` : ''}`,
    'KOJASMAT_SIMPANAN_TARIK', simpananId,
  )
}

// ─── PEMBIAYAAN PROYEK ────────────────────────────────────────────────────────

/**
 * Pemodal menyetor dana ke proyek: Dr Kas → Cr Dana Syirkah Temporer
 */
export async function jurnalPenerimaanDanaPemodal(
  orgId: string,
  jenisAkad: 'MUDHARABAH' | 'MURABAHAH' | 'INAN',
  jumlah: number,
  pembiayaanId: string,
  kodeProyek: string,
) {
  await postJurnal(
    orgId, 'kas', DST_ROLE[jenisAkad], jumlah,
    `Penerimaan dana pemodal proyek ${kodeProyek} (${jenisAkad})`,
    'KOJASMAT_PEMBIAYAAN', pembiayaanId,
  )
}

/**
 * Pembatalan pendanaan oleh pemodal sebelum proyek berjalan — reversal dari
 * jurnalPenerimaanDanaPemodal: Dr Dana Syirkah Temporer → Cr Kas
 */
export async function jurnalPembatalanPembiayaan(
  orgId: string,
  jenisAkad: 'MUDHARABAH' | 'MURABAHAH' | 'INAN',
  jumlah: number,
  pembiayaanId: string,
  kodeProyek: string,
) {
  await postJurnal(
    orgId, DST_ROLE[jenisAkad], 'kas', jumlah,
    `Pembatalan pendanaan proyek ${kodeProyek} (${jenisAkad})`,
    'KOJASMAT_PEMBIAYAAN_BATAL', pembiayaanId,
  )
}

/**
 * Pembatalan ujrah diwakilkan akad — reversal dari jurnalUjrahMudharabah/Murabahah:
 * Dr Ujrah Wakalah → Cr Kas
 */
export async function jurnalPembatalanUjrah(
  orgId: string,
  jenisAkad: string,
  jumlah: number,
  refId: string,
  kodeProyek: string,
) {
  const debitRole: KojasmatAccountRole = jenisAkad === 'MURABAHAH' ? 'ujrah_murabahah' : 'ujrah_mudharabah'
  await postJurnal(
    orgId, debitRole, 'kas', jumlah,
    `Pembatalan ujrah wakalah diwakilkan akad proyek ${kodeProyek}`,
    'KOJASMAT_UJRAH_BATAL', refId,
  )
}

/**
 * Penyaluran modal ke mudharib (koperasi bayar ke pengaju proyek):
 * Dr Piutang Pembiayaan → Cr Kas
 */
export async function jurnalPenyaluranModalMudharib(
  orgId: string,
  jumlah: number,
  proyekId: string,
  kodeProyek: string,
) {
  await postJurnal(
    orgId, 'piutang_pembiayaan', 'kas', jumlah,
    `Penyaluran modal ke mudharib proyek ${kodeProyek}`,
    'KOJASMAT_PENYALURAN', proyekId,
  )
}

// ─── UJRAH KOPERASI ───────────────────────────────────────────────────────────

/**
 * Penerimaan ujrah wakalah dari mudharib: Dr Kas → Cr Ujrah Wakalah Mudharabah
 */
export async function jurnalUjrahMudharabah(
  orgId: string,
  jumlah: number,
  refId: string,
  kodeProyek: string,
) {
  await postJurnal(
    orgId, 'kas', 'ujrah_mudharabah', jumlah,
    `Ujrah wakalah mudharabah proyek ${kodeProyek}`,
    'KOJASMAT_UJRAH', refId,
  )
}

/**
 * Penerimaan ujrah wakalah dari akad murabahah: Dr Kas → Cr Ujrah Wakalah Murabahah
 */
export async function jurnalUjrahMurabahah(
  orgId: string,
  jumlah: number,
  refId: string,
  kodeProyek: string,
) {
  await postJurnal(
    orgId, 'kas', 'ujrah_murabahah', jumlah,
    `Ujrah wakalah murabahah proyek ${kodeProyek}`,
    'KOJASMAT_UJRAH', refId,
  )
}

// ─── BAGI HASIL ───────────────────────────────────────────────────────────────

/**
 * Distribusi bagi hasil ke pemodal (shahibul maal): Dr Bagi Hasil → Cr Kas
 */
export async function jurnalDistribusiBagiHasil(
  orgId: string,
  jumlah: number,
  bagiHasilId: string,
  kodeProyek: string,
) {
  await postJurnal(
    orgId, 'bagi_hasil', 'kas', jumlah,
    `Distribusi bagi hasil proyek ${kodeProyek}`,
    'KOJASMAT_BAGI_HASIL', bagiHasilId,
  )
}

// ─── PERKEMBANGAN USAHA PROYEK (PENDAPATAN/BEBAN) ──────────────────────────────

/**
 * Pendapatan usaha dari proyek pembiayaan (dicatat mudharib di laporan perkembangan):
 * Dr Kas → Cr Pendapatan Usaha Proyek
 */
export async function jurnalPendapatanProyek(
  orgId: string,
  jumlah: number,
  transaksiId: string,
  kodeProyek: string,
  kategori: string,
) {
  await postJurnal(
    orgId, 'kas', 'pendapatan_proyek', jumlah,
    `Pendapatan proyek ${kodeProyek} — ${kategori}`,
    'KOJASMAT_PROYEK_PENDAPATAN', transaksiId,
  )
}

/**
 * Beban usaha dari proyek pembiayaan (dicatat mudharib di laporan perkembangan):
 * Dr Beban Usaha Proyek → Cr Kas
 */
export async function jurnalBebanProyek(
  orgId: string,
  jumlah: number,
  transaksiId: string,
  kodeProyek: string,
  kategori: string,
) {
  await postJurnal(
    orgId, 'beban_proyek', 'kas', jumlah,
    `Beban proyek ${kodeProyek} — ${kategori}`,
    'KOJASMAT_PROYEK_BEBAN', transaksiId,
  )
}
