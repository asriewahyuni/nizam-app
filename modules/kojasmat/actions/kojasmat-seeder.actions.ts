'use server'

// Kojasmat Dummy Data Seeder — data realistis tersync ke ERP core

import { queryPostgres } from '@/lib/db/postgres'
import { getInternalAuthSession } from '@/lib/auth/internal-auth.server'
import { ERPBridge } from '@/lib/erp-bridge/finances'
import { revalidatePath } from 'next/cache'

// ─── HELPERS ──────────────────────────────────────────────────────────────────

const today = () => new Date().toISOString().split('T')[0]
const daysAgo = (n: number) => {
  const d = new Date(); d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}

async function tryJurnal(orgId: string, amount: number, description: string, refId: string, refType: string) {
  try {
    const [debit, credit] = await Promise.all([
      ERPBridge.getDefaultAccount(orgId, '1-10001'),
      ERPBridge.getDefaultAccount(orgId, '4-10001'),
    ])
    if (!debit || !credit) return
    await ERPBridge.recordRevenue({
      orgId, amount,
      date: today(),
      description, referenceType: refType, referenceId: refId,
      debitAccountId: debit, creditAccountId: credit,
    })
  } catch (_) { /* non-fatal */ }
}

// ─── SEEDER UTAMA ─────────────────────────────────────────────────────────────

export async function seedKojasmatDummyData(orgId: string) {
  const session = await getInternalAuthSession()
  if (!session) return { error: 'Tidak terautentikasi' }

  // Cek sudah ada data
  const { rows: cek } = await queryPostgres(
    `SELECT COUNT(*) AS n FROM kojasmat_anggota WHERE org_id=$1`,
    [orgId]
  )
  if (Number(cek[0]?.n) > 0) {
    return { error: 'Data dummy sudah ada. Hapus data terlebih dahulu sebelum seed ulang.' }
  }

  // ─── 1. ANGGOTA ────────────────────────────────────────────────────────────

  const anggotaData = [
    { kode: 'KJM-001', nama: 'Ahmad Fauzi',    nik: '3374010101900001', phone: '08112345001', pekerjaan: 'Pedagang',        joined_at: daysAgo(300), status: 'AKTIF', is_verified: true },
    { kode: 'KJM-002', nama: 'Siti Rahayu',    nik: '3374010202890002', phone: '08112345002', pekerjaan: 'Ibu Rumah Tangga', joined_at: daysAgo(270), status: 'AKTIF', is_verified: true },
    { kode: 'KJM-003', nama: 'Budi Santoso',   nik: '3374010303850003', phone: '08112345003', pekerjaan: 'Penjahit',         joined_at: daysAgo(240), status: 'AKTIF', is_verified: true },
    { kode: 'KJM-004', nama: 'Dewi Lestari',   nik: '3374010404920004', phone: '08112345004', pekerjaan: 'Pedagang',         joined_at: daysAgo(30),  status: 'CALON', is_verified: false },
    { kode: 'KJM-005', nama: 'Hendra Wijaya',  nik: '3374010505800005', phone: '08112345005', pekerjaan: 'Laundry',          joined_at: daysAgo(200), status: 'AKTIF', is_verified: true },
  ]

  const anggotaMap: Record<string, string> = {} // kode → id

  for (const a of anggotaData) {
    const { rows } = await queryPostgres(
      `INSERT INTO kojasmat_anggota
         (org_id, kode_anggota, nama, nik, phone, pekerjaan, joined_at, status, is_verified)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id`,
      [orgId, a.kode, a.nama, a.nik, a.phone, a.pekerjaan, a.joined_at, a.status, a.is_verified]
    )
    const anggotaId = rows[0].id as string
    anggotaMap[a.kode] = anggotaId

    // Buat 3 rekening simpanan per anggota
    await queryPostgres(
      `INSERT INTO kojasmat_simpanan (org_id, anggota_id, jenis, saldo)
       VALUES ($1,$2,'POKOK',0),($1,$2,'WAJIB',0),($1,$2,'SUKARELA',0)`,
      [orgId, anggotaId]
    )
  }

  // ─── 2. SIMPANAN + MUTASI ──────────────────────────────────────────────────

  // Data simpanan: [kode_anggota, jenis, setoran[], keterangan]
  const simpananData: { kode: string; jenis: 'POKOK' | 'WAJIB' | 'SUKARELA'; setoran: { jumlah: number; tgl: string; ket: string }[] }[] = [
    // Ahmad Fauzi — Anggota tertua, simpanan banyak
    { kode: 'KJM-001', jenis: 'POKOK',    setoran: [{ jumlah: 500_000, tgl: daysAgo(300), ket: 'Simpanan pokok perdana' }] },
    { kode: 'KJM-001', jenis: 'WAJIB',    setoran: [
        { jumlah: 250_000, tgl: daysAgo(270), ket: 'Wajib Bln 1' },
        { jumlah: 250_000, tgl: daysAgo(240), ket: 'Wajib Bln 2' },
        { jumlah: 250_000, tgl: daysAgo(210), ket: 'Wajib Bln 3' },
        { jumlah: 250_000, tgl: daysAgo(180), ket: 'Wajib Bln 4' },
        { jumlah: 250_000, tgl: daysAgo(150), ket: 'Wajib Bln 5' },
        { jumlah: 250_000, tgl: daysAgo(120), ket: 'Wajib Bln 6' },
    ]},
    { kode: 'KJM-001', jenis: 'SUKARELA', setoran: [
        { jumlah: 500_000, tgl: daysAgo(200), ket: 'Tabungan ekstra' },
        { jumlah: 250_000, tgl: daysAgo(100), ket: 'Tabungan ekstra' },
    ]},

    // Siti Rahayu
    { kode: 'KJM-002', jenis: 'POKOK',    setoran: [{ jumlah: 500_000, tgl: daysAgo(270), ket: 'Simpanan pokok perdana' }] },
    { kode: 'KJM-002', jenis: 'WAJIB',    setoran: [
        { jumlah: 250_000, tgl: daysAgo(240), ket: 'Wajib Bln 1' },
        { jumlah: 250_000, tgl: daysAgo(210), ket: 'Wajib Bln 2' },
        { jumlah: 250_000, tgl: daysAgo(180), ket: 'Wajib Bln 3' },
        { jumlah: 250_000, tgl: daysAgo(150), ket: 'Wajib Bln 4' },
    ]},
    { kode: 'KJM-002', jenis: 'SUKARELA', setoran: [{ jumlah: 200_000, tgl: daysAgo(150), ket: 'Tabungan ekstra' }] },

    // Budi Santoso
    { kode: 'KJM-003', jenis: 'POKOK',    setoran: [{ jumlah: 500_000, tgl: daysAgo(240), ket: 'Simpanan pokok perdana' }] },
    { kode: 'KJM-003', jenis: 'WAJIB',    setoran: [
        { jumlah: 250_000, tgl: daysAgo(210), ket: 'Wajib Bln 1' },
        { jumlah: 250_000, tgl: daysAgo(180), ket: 'Wajib Bln 2' },
        { jumlah: 250_000, tgl: daysAgo(150), ket: 'Wajib Bln 3' },
        { jumlah: 250_000, tgl: daysAgo(120), ket: 'Wajib Bln 4' },
        { jumlah: 250_000, tgl: daysAgo(90),  ket: 'Wajib Bln 5' },
    ]},
    { kode: 'KJM-003', jenis: 'SUKARELA', setoran: [{ jumlah: 500_000, tgl: daysAgo(100), ket: 'Tabungan ekstra' }] },

    // Dewi Lestari — Calon, baru setor pokok
    { kode: 'KJM-004', jenis: 'POKOK',    setoran: [{ jumlah: 500_000, tgl: daysAgo(30), ket: 'Simpanan pokok perdana' }] },

    // Hendra Wijaya — paling banyak simpanan
    { kode: 'KJM-005', jenis: 'POKOK',    setoran: [{ jumlah: 500_000, tgl: daysAgo(200), ket: 'Simpanan pokok perdana' }] },
    { kode: 'KJM-005', jenis: 'WAJIB',    setoran: [
        { jumlah: 250_000, tgl: daysAgo(180), ket: 'Wajib Bln 1' },
        { jumlah: 250_000, tgl: daysAgo(150), ket: 'Wajib Bln 2' },
        { jumlah: 250_000, tgl: daysAgo(120), ket: 'Wajib Bln 3' },
        { jumlah: 250_000, tgl: daysAgo(90),  ket: 'Wajib Bln 4' },
        { jumlah: 250_000, tgl: daysAgo(60),  ket: 'Wajib Bln 5' },
        { jumlah: 250_000, tgl: daysAgo(30),  ket: 'Wajib Bln 6' },
        { jumlah: 250_000, tgl: daysAgo(7),   ket: 'Wajib Bln 7' },
        { jumlah: 250_000, tgl: today(),       ket: 'Wajib Bln 8' },
    ]},
    { kode: 'KJM-005', jenis: 'SUKARELA', setoran: [
        { jumlah: 1_000_000, tgl: daysAgo(100), ket: 'Tabungan bisnis' },
    ]},
  ]

  for (const item of simpananData) {
    const anggotaId = anggotaMap[item.kode]
    const { rows: [simpanan] } = await queryPostgres(
      `SELECT * FROM kojasmat_simpanan WHERE anggota_id=$1 AND jenis=$2`,
      [anggotaId, item.jenis]
    )
    if (!simpanan) continue

    let saldo = 0
    for (const s of item.setoran) {
      const sebelum = saldo
      saldo += s.jumlah
      await queryPostgres(
        `INSERT INTO kojasmat_simpanan_mutasi
           (org_id, simpanan_id, anggota_id, jenis_mutasi, jumlah, saldo_sebelum, saldo_sesudah, keterangan, tanggal, created_by)
         VALUES ($1,$2,$3,'SETOR',$4,$5,$6,$7,$8,$9)`,
        [orgId, simpanan.id, anggotaId, s.jumlah, sebelum, saldo, s.ket, s.tgl, session.user.id]
      )
      // ERP — jurnal setoran simpanan
      await tryJurnal(orgId, s.jumlah, `${s.ket} — ${item.kode} (${item.jenis})`, String(simpanan.id), 'KOJASMAT_SIMPANAN')
    }

    // Update saldo akhir
    await queryPostgres(
      `UPDATE kojasmat_simpanan SET saldo=$2, updated_at=NOW() WHERE id=$1`,
      [simpanan.id, saldo]
    )
  }

  // ─── 3. PELATIHAN ──────────────────────────────────────────────────────────

  const { rows: [pelatihan1] } = await queryPostgres(
    `INSERT INTO kojasmat_pelatihan
       (org_id, judul, deskripsi, instruktur, tanggal, lokasi, kuota, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'SELESAI')
     RETURNING id`,
    [orgId, 'Pelatihan Anggota Baru Batch 1',
     'Pembekalan dasar koperasi syariah: akad, simpanan, dan hak-kewajiban anggota',
     'Ust. M. Ridwan, S.E.I', daysAgo(180), 'Aula Koperasi Kojasmat', 20]
  )
  const { rows: [pelatihan2] } = await queryPostgres(
    `INSERT INTO kojasmat_pelatihan
       (org_id, judul, deskripsi, instruktur, tanggal, lokasi, kuota, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'TERJADWAL')
     RETURNING id`,
    [orgId, 'Pelatihan Manajemen Keuangan UMKM',
     'Pelatihan pengelolaan keuangan usaha: pencatatan, arus kas, dan laporan sederhana',
     'Ibu Rahma Andriani, M.M', daysAgo(-14), 'Balai Desa Maju Bersama', 25]
  )

  // Peserta pelatihan 1 (semua lulus → verified)
  for (const kode of ['KJM-001', 'KJM-002', 'KJM-003', 'KJM-005']) {
    await queryPostgres(
      `INSERT INTO kojasmat_pelatihan_peserta (org_id, pelatihan_id, anggota_id, status)
       VALUES ($1,$2,$3,'LULUS')`,
      [orgId, pelatihan1.id, anggotaMap[kode]]
    )
  }
  // Peserta pelatihan 2 (Dewi terdaftar, belum berlangsung)
  await queryPostgres(
    `INSERT INTO kojasmat_pelatihan_peserta (org_id, pelatihan_id, anggota_id, status)
     VALUES ($1,$2,$3,'TERDAFTAR')`,
    [orgId, pelatihan2.id, anggotaMap['KJM-004']]
  )

  // ─── 4. PROYEK ─────────────────────────────────────────────────────────────

  // PY-0001: Warung Makan Bu Siti — BERJALAN (sudah terpenuhi)
  const { rows: [py1] } = await queryPostgres(
    `INSERT INTO kojasmat_proyek
       (org_id, pengaju_id, kode_proyek, nama_proyek, deskripsi, jenis_akad,
        kebutuhan_modal, modal_terkumpul, ujrah_pct,
        durasi_bulan, tanggal_mulai, agunan, status)
     VALUES ($1,$2,'PY-0001','Warung Makan Bu Siti',
       'Pengembangan usaha warung makan dengan menu masakan Jawa. Modal untuk renovasi dan tambah peralatan masak.',
       'MUDHARABAH', 5000000, 5000000, 5, 6, $3, 'Sertifikat Tanah SHM No.1234', 'BERJALAN')
     RETURNING id`,
    [orgId, anggotaMap['KJM-002'], daysAgo(90)]
  )

  // PY-0002: Konveksi Pak Budi — OPEN
  const { rows: [py2] } = await queryPostgres(
    `INSERT INTO kojasmat_proyek
       (org_id, pengaju_id, kode_proyek, nama_proyek, deskripsi, jenis_akad,
        kebutuhan_modal, modal_terkumpul, ujrah_pct,
        durasi_bulan, agunan, status)
     VALUES ($1,$2,'PY-0002','Konveksi Pak Budi',
       'Pengembangan usaha konveksi seragam sekolah. Modal untuk 2 unit mesin jahit industri dan bahan baku awal.',
       'INAN', 15000000, 5000000, 4, 12, 'BPKB Motor Revo 2019', 'OPEN')
     RETURNING id`,
    [orgId, anggotaMap['KJM-003']]
  )

  // PY-0003: Usaha Ternak Ayam — REVIEW_DPS
  const { rows: [py3] } = await queryPostgres(
    `INSERT INTO kojasmat_proyek
       (org_id, pengaju_id, kode_proyek, nama_proyek, deskripsi, jenis_akad,
        kebutuhan_modal, modal_terkumpul, ujrah_pct,
        durasi_bulan, agunan, status)
     VALUES ($1,$2,'PY-0003','Usaha Ternak Ayam Kampung',
       'Pengembangan usaha ternak ayam kampung 500 ekor. Modal untuk kandang, bibit, dan pakan 3 bulan pertama.',
       'MUDHARABAH', 8000000, 0, 5, 6, 'Agunan berupa lahan kandang 200m²', 'REVIEW_DPS')
     RETURNING id`,
    [orgId, anggotaMap['KJM-001']]
  )

  // PY-0004: Laundry Hendra — SELESAI + UJRAH DIBAYARKAN
  const { rows: [py4] } = await queryPostgres(
    `INSERT INTO kojasmat_proyek
       (org_id, pengaju_id, kode_proyek, nama_proyek, deskripsi, jenis_akad,
        kebutuhan_modal, modal_terkumpul, ujrah_pct,
        durasi_bulan, tanggal_mulai, tanggal_selesai, agunan, status)
     VALUES ($1,$2,'PY-0004','Laundry Express Hendra',
       'Pengembangan usaha laundry kiloan: mesin cuci baru dan pengering. Sudah berjalan 6 bulan dan berhasil.',
       'MURABAHAH', 3000000, 3000000, 5, 6, $3, $4, 'BPKB Mesin Cuci Samsung', 'SELESAI')
     RETURNING id`,
    [orgId, anggotaMap['KJM-005'], daysAgo(200), daysAgo(20)]
  )

  // PY-0005: Toko Sembako Dewi — DRAFT
  await queryPostgres(
    `INSERT INTO kojasmat_proyek
       (org_id, pengaju_id, kode_proyek, nama_proyek, deskripsi, jenis_akad,
        kebutuhan_modal, modal_terkumpul, ujrah_pct,
        durasi_bulan, agunan, status)
     VALUES ($1,$2,'PY-0005','Toko Sembako Bu Dewi',
       'Modal awal untuk stok sembako: beras, minyak, gula, dan kebutuhan pokok lainnya.',
       'MURABAHAH', 10000000, 0, 5, 12, 'Tidak ada agunan (calon anggota)', 'DRAFT')`,
    [orgId, anggotaMap['KJM-004']]
  )

  // ─── 5. DPS REVIEW ─────────────────────────────────────────────────────────

  // PY-0001: disetujui
  await queryPostgres(
    `INSERT INTO kojasmat_dps_review (org_id, proyek_id, reviewer_id, keputusan, catatan, reviewed_at)
     VALUES ($1,$2,$3,'DISETUJUI','Proyek layak secara syariah. Akad mudharabah sesuai. Agunan memadai.',$4)`,
    [orgId, py1.id, session.user.id, daysAgo(120)]
  )
  // PY-0002: disetujui
  await queryPostgres(
    `INSERT INTO kojasmat_dps_review (org_id, proyek_id, reviewer_id, keputusan, catatan, reviewed_at)
     VALUES ($1,$2,$3,'DISETUJUI','Akad inan syariah compliant. Ujrah wakalah koperasi sudah transparan dan disepakati.',$4)`,
    [orgId, py2.id, session.user.id, daysAgo(14)]
  )
  // PY-0004: disetujui
  await queryPostgres(
    `INSERT INTO kojasmat_dps_review (org_id, proyek_id, reviewer_id, keputusan, catatan, reviewed_at)
     VALUES ($1,$2,$3,'DISETUJUI','Akad murabahah valid. Harga jual dan margin sudah transparan.',$4)`,
    [orgId, py4.id, session.user.id, daysAgo(210)]
  )

  // ─── 6. PEMBIAYAAN + SYNC ERP ──────────────────────────────────────────────

  // PY-0001 (BERJALAN): 3 pemodal → total 5M terpenuhi
  const pembiayaanPy1 = [
    { kode: 'KJM-001', jumlah: 2_000_000, porsi: 40 },
    { kode: 'KJM-005', jumlah: 1_500_000, porsi: 30 },
    { kode: 'KJM-003', jumlah: 1_500_000, porsi: 30 },
  ]
  for (const pm of pembiayaanPy1) {
    const { rows: [pmRow] } = await queryPostgres(
      `INSERT INTO kojasmat_pembiayaan (org_id, proyek_id, pemodal_id, jumlah, porsi_pct, status)
       VALUES ($1,$2,$3,$4,$5,'AKTIF') RETURNING id`,
      [orgId, py1.id, anggotaMap[pm.kode], pm.jumlah, pm.porsi]
    )
    await tryJurnal(orgId, pm.jumlah,
      `Pembiayaan PY-0001 dari ${pm.kode} — Warung Makan Bu Siti`,
      String(pmRow.id), 'KOJASMAT_PEMBIAYAAN')
  }

  // PY-0002 (OPEN): 1 pemodal sudah masuk, sisa 10M
  const { rows: [pmPy2] } = await queryPostgres(
    `INSERT INTO kojasmat_pembiayaan (org_id, proyek_id, pemodal_id, jumlah, porsi_pct, status)
     VALUES ($1,$2,$3,5000000,33.33,'AKTIF') RETURNING id`,
    [orgId, py2.id, anggotaMap['KJM-001']]
  )
  await tryJurnal(orgId, 5_000_000,
    'Pembiayaan PY-0002 dari KJM-001 — Konveksi Pak Budi',
    String(pmPy2.id), 'KOJASMAT_PEMBIAYAAN')

  // PY-0004 (SELESAI): 2 pemodal, proyek sudah selesai
  const pembiayaanPy4 = [
    { kode: 'KJM-002', jumlah: 1_800_000, porsi: 60 },
    { kode: 'KJM-001', jumlah: 1_200_000, porsi: 40 },
  ]
  for (const pm of pembiayaanPy4) {
    const { rows: [pmRow] } = await queryPostgres(
      `INSERT INTO kojasmat_pembiayaan (org_id, proyek_id, pemodal_id, jumlah, porsi_pct, status)
       VALUES ($1,$2,$3,$4,$5,'SELESAI') RETURNING id`,
      [orgId, py4.id, anggotaMap[pm.kode], pm.jumlah, pm.porsi]
    )
    await tryJurnal(orgId, pm.jumlah,
      `Pembiayaan PY-0004 dari ${pm.kode} — Laundry Hendra`,
      String(pmRow.id), 'KOJASMAT_PEMBIAYAAN')
  }

  // ─── 7. DISTRIBUSI PROFIT PY-0004 (Wakalah bil Ujrah) ───────────────────────
  // Model: 100% laba → pemodal proporsional. Koperasi terima ujrah = modal × ujrah_pct.
  // PY-0004 ujrah_pct=5%, modal=3.000.000 → ujrah koperasi = 150.000 (flat, per proyek)
  const labaProyekPy4  = 900_000
  const ujrahPctPy4    = 0.05
  const totalModalPy4  = 3_000_000
  const ujrahKoperasi  = totalModalPy4 * ujrahPctPy4  // 150.000

  // Pemodal PY-0004: KJM-002 60%, KJM-001 40% — keduanya mendapat 100% laba proporsional
  const bagiHasilPy4 = [
    { kode: 'KJM-002', porsi: 60, jumlah: labaProyekPy4 * 0.6 }, // 540k
    { kode: 'KJM-001', porsi: 40, jumlah: labaProyekPy4 * 0.4 }, // 360k
  ]

  for (const bh of bagiHasilPy4) {
    // ujrah_koperasi dibagi proporsional per baris pemodal (informatif)
    const ujrahBaris = ujrahKoperasi * (bh.porsi / 100)
    const { rows: [bhRow] } = await queryPostgres(
      `INSERT INTO kojasmat_bagi_hasil
         (org_id, proyek_id, pemodal_id, periode, laba_proyek, porsi_pct,
          hak_pemodal, ujrah_koperasi, status, dibayar_at)
       VALUES ($1,$2,$3,'2025-Q4',$4,$5,$6,$7,'DIBAYAR',$8)
       RETURNING id`,
      [orgId, py4.id, anggotaMap[bh.kode],
       labaProyekPy4, bh.porsi, bh.jumlah, ujrahBaris, today()]
    )

    // Tambahkan bagi hasil ke simpanan SUKARELA pemodal
    const { rows: [simpSuk] } = await queryPostgres(
      `SELECT * FROM kojasmat_simpanan WHERE anggota_id=$1 AND jenis='SUKARELA'`,
      [anggotaMap[bh.kode]]
    )
    if (simpSuk) {
      const sebelum = Number(simpSuk.saldo)
      const sesudah = sebelum + bh.jumlah
      await queryPostgres(
        `UPDATE kojasmat_simpanan SET saldo=$2, updated_at=NOW() WHERE id=$1`,
        [simpSuk.id, sesudah]
      )
      await queryPostgres(
        `INSERT INTO kojasmat_simpanan_mutasi
           (org_id, simpanan_id, anggota_id, jenis_mutasi, jumlah, saldo_sebelum,
            saldo_sesudah, keterangan, tanggal, created_by)
         VALUES ($1,$2,$3,'BAGI_HASIL',$4,$5,$6,$7,$8,$9)`,
        [orgId, simpSuk.id, anggotaMap[bh.kode],
         bh.jumlah, sebelum, sesudah,
         `Bagi hasil PY-0004 (Laundry Hendra) periode 2025-Q4`,
         today(), session.user.id]
      )
    }
    // ERP — catat penerimaan ujrah wakalah koperasi (bukan dari laba, tapi dari modal)
    await tryJurnal(orgId, ujrahBaris,
      `Ujrah wakalah koperasi PY-0004 dari ${bh.kode}`,
      String(bhRow.id), 'KOJASMAT_UJRAH')
  }

  // ─── 8. PENAWARAN ─────────────────────────────────────────────────────────

  // Penawaran PY-0002 (OPEN) ke anggota aktif yang belum biayai
  const penawaran = [
    { kode: 'KJM-002', status: 'TERKIRIM' },  // Siti belum baca
    { kode: 'KJM-005', status: 'DIBACA' },     // Hendra sudah baca
    { kode: 'KJM-003', status: 'BERMINAT' },   // Budi (pengaju sendiri, tapi sebagai pemodal juga boleh)
  ]
  for (const pn of penawaran) {
    await queryPostgres(
      `INSERT INTO kojasmat_penawaran (org_id, proyek_id, anggota_id, status)
       VALUES ($1,$2,$3,$4)`,
      [orgId, py2.id, anggotaMap[pn.kode], pn.status]
    )
  }

  revalidatePath('/kojasmat')
  return {
    data: {
      anggota: anggotaData.length,
      proyek: 5,
      pelatihan: 2,
      pembiayaan: pembiayaanPy1.length + 1 + pembiayaanPy4.length,
      bagi_hasil: bagiHasilPy4.length,
      penawaran: penawaran.length,
    }
  }
}
