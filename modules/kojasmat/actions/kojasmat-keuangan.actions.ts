'use server'

// Pencatatan cash flow proyek (pendapatan/beban) + laporan Laba/Rugi, Neraca,
// dan Cashflow per proyek pembiayaan — termasuk perhitungan potensi bagi hasil.

import { queryPostgres, connectPostgresClient } from '@/lib/db/postgres'
import { getInternalAuthSession } from '@/lib/auth/internal-auth.server'
import { revalidatePath } from 'next/cache'
import { jurnalPendapatanProyek, jurnalBebanProyek, jurnalDistribusiBagiHasil } from '@/lib/erp-bridge/kojasmat-journals'

// session.user.id bisa berisi legacy_user_id (Supabase UUID), bukan internal_auth_users.id.
// Gunakan fungsi ini untuk FK yang merujuk ke internal_auth_users(id) — mis. kolom
// created_by di kojasmat_simpanan_mutasi (yang lain tidak ada FK, tapi tetap dipakai
// di sini demi konsistensi data).
function getInternalUserId(session: { user: { id: string; user_metadata: Record<string, unknown> } }): string {
  return (session.user.user_metadata['internal_user_id'] as string | null) ?? session.user.id
}

export type KojasmatPemodalDenganPotensi = {
  id: string
  pemodal_id: string
  pemodal_nama: string
  jumlah: number
  porsi_pct: number
  kehadiran_akad: 'SENDIRI' | 'DIWAKILKAN'
  potensiBagiHasil: number
}

export type KojasmatProyekTransaksi = {
  id: string
  org_id: string
  proyek_id: string
  laporan_id?: string | null
  tanggal: string
  jenis: 'PENDAPATAN' | 'BEBAN'
  kategori: string
  keterangan?: string | null
  jumlah: number
  created_at: string
}

export async function catatTransaksiProyek(payload: {
  org_id: string
  proyek_id: string
  laporan_id?: string
  tanggal: string
  jenis: 'PENDAPATAN' | 'BEBAN'
  kategori: string
  keterangan?: string
  jumlah: number
}) {
  const session = await getInternalAuthSession()
  if (!session) return { error: 'Tidak terautentikasi' }
  if (!payload.jumlah || payload.jumlah <= 0) return { error: 'Jumlah harus lebih dari 0' }

  const { rows: [proyek] } = await queryPostgres(
    `SELECT kode_proyek FROM kojasmat_proyek WHERE id=$1`,
    [payload.proyek_id]
  )
  if (!proyek) return { error: 'Proyek tidak ditemukan' }

  const { rows } = await queryPostgres(
    `INSERT INTO kojasmat_proyek_transaksi
       (org_id, proyek_id, laporan_id, tanggal, jenis, kategori, keterangan, jumlah, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [
      payload.org_id, payload.proyek_id, payload.laporan_id ?? null,
      payload.tanggal, payload.jenis, payload.kategori,
      payload.keterangan ?? null, payload.jumlah, getInternalUserId(session),
    ]
  )
  const trx = rows[0] as KojasmatProyekTransaksi

  if (payload.jenis === 'PENDAPATAN') {
    await jurnalPendapatanProyek(payload.org_id, payload.jumlah, trx.id, proyek.kode_proyek, payload.kategori)
  } else {
    await jurnalBebanProyek(payload.org_id, payload.jumlah, trx.id, proyek.kode_proyek, payload.kategori)
  }

  revalidatePath('/kojasmat')
  return { data: trx }
}

export async function getTransaksiByProyek(proyekId: string): Promise<KojasmatProyekTransaksi[]> {
  const { rows } = await queryPostgres(
    `SELECT * FROM kojasmat_proyek_transaksi WHERE proyek_id=$1 ORDER BY tanggal DESC, created_at DESC`,
    [proyekId]
  )
  return rows as KojasmatProyekTransaksi[]
}

export type KojasmatLaporanKeuanganProyek = {
  proyek: {
    id: string
    kode_proyek: string
    nama_proyek: string
    kebutuhan_modal: number
    modal_terkumpul: number
    nisbah_pengaju: number
    nisbah_pemodal: number
    jenis_akad: string
    ujrah_nominal: number
    status: string
  }
  labaRugi: {
    totalPendapatan: number
    totalBeban: number
    rincianPendapatan: { kategori: string; jumlah: number }[]
    rincianBeban: { kategori: string; jumlah: number }[]
    labaBersih: number
  }
  neraca: {
    kas: number
    modalPemodal: number
    labaDitahan: number
    totalAset: number
    totalKewajibanEkuitas: number
  }
  cashflow: {
    kasMasukOperasional: number
    kasKeluarOperasional: number
    kasMasukPendanaan: number
    netCashflow: number
    saldoKasAkhir: number
  }
  bagiHasil: {
    nisbahPengaju: number
    nisbahPemodal: number
    potensiBagiHasilPemodal: number
    potensiBagiHasilPengaju: number
  }
  analisis: string[]
}

function fmtRp(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
}

export async function getLaporanKeuanganProyek(proyekId: string): Promise<KojasmatLaporanKeuanganProyek | null> {
  const { rows: [proyek] } = await queryPostgres(`SELECT * FROM kojasmat_proyek WHERE id=$1`, [proyekId])
  if (!proyek) return null

  const { rows: agregat } = await queryPostgres(
    `SELECT jenis, kategori, SUM(jumlah)::numeric AS total
     FROM kojasmat_proyek_transaksi
     WHERE proyek_id=$1
     GROUP BY jenis, kategori
     ORDER BY total DESC`,
    [proyekId]
  )

  const rincianPendapatan = agregat
    .filter(r => r.jenis === 'PENDAPATAN')
    .map(r => ({ kategori: r.kategori as string, jumlah: Number(r.total) }))
  const rincianBeban = agregat
    .filter(r => r.jenis === 'BEBAN')
    .map(r => ({ kategori: r.kategori as string, jumlah: Number(r.total) }))

  const totalPendapatan = rincianPendapatan.reduce((s, x) => s + x.jumlah, 0)
  const totalBeban = rincianBeban.reduce((s, x) => s + x.jumlah, 0)
  const labaBersih = totalPendapatan - totalBeban

  const modalTerkumpul = Number(proyek.modal_terkumpul)
  const saldoKasAkhir = modalTerkumpul + totalPendapatan - totalBeban

  const nisbahPengaju = Number(proyek.nisbah_pengaju ?? 30)
  const nisbahPemodal = Number(proyek.nisbah_pemodal ?? 70)
  const potensiBagiHasilPemodal = labaBersih > 0 ? labaBersih * nisbahPemodal / 100 : 0
  const potensiBagiHasilPengaju = labaBersih > 0 ? labaBersih * nisbahPengaju / 100 : 0

  const analisis: string[] = []
  if (totalPendapatan === 0 && totalBeban === 0) {
    analisis.push('Belum ada transaksi keuangan tercatat untuk proyek ini.')
  } else {
    const margin = totalPendapatan > 0 ? (labaBersih / totalPendapatan) * 100 : 0
    analisis.push(
      labaBersih >= 0
        ? `Proyek mencatatkan laba bersih ${fmtRp(labaBersih)} dengan margin ${margin.toFixed(1)}% dari total pendapatan.`
        : `Proyek mengalami rugi bersih ${fmtRp(Math.abs(labaBersih))} — beban melebihi pendapatan.`
    )
    if (rincianBeban.length > 0 && totalBeban > 0) {
      const terbesar = rincianBeban[0]
      analisis.push(
        `Komponen beban terbesar: ${terbesar.kategori} (${fmtRp(terbesar.jumlah)}, ${((terbesar.jumlah / totalBeban) * 100).toFixed(0)}% dari total beban).`
      )
    }
    if (modalTerkumpul > 0 && saldoKasAkhir < modalTerkumpul * 0.2) {
      analisis.push('Saldo kas proyek relatif rendah dibanding modal yang terkumpul — perlu monitoring likuiditas.')
    }
    if (labaBersih > 0) {
      analisis.push(
        `Jika laba ini dibagikan sesuai nisbah, pemodal berpotensi menerima ${fmtRp(potensiBagiHasilPemodal)} (${nisbahPemodal}%) dan pengaju ${fmtRp(potensiBagiHasilPengaju)} (${nisbahPengaju}%).`
      )
    }
  }

  return {
    proyek: {
      id: proyek.id,
      kode_proyek: proyek.kode_proyek,
      nama_proyek: proyek.nama_proyek,
      kebutuhan_modal: Number(proyek.kebutuhan_modal),
      modal_terkumpul: modalTerkumpul,
      nisbah_pengaju: nisbahPengaju,
      nisbah_pemodal: nisbahPemodal,
      jenis_akad: proyek.jenis_akad,
      ujrah_nominal: Number(proyek.ujrah_nominal),
      status: proyek.status,
    },
    labaRugi: { totalPendapatan, totalBeban, rincianPendapatan, rincianBeban, labaBersih },
    neraca: {
      kas: saldoKasAkhir,
      modalPemodal: modalTerkumpul,
      labaDitahan: labaBersih,
      totalAset: saldoKasAkhir,
      totalKewajibanEkuitas: modalTerkumpul + labaBersih,
    },
    cashflow: {
      kasMasukOperasional: totalPendapatan,
      kasKeluarOperasional: totalBeban,
      kasMasukPendanaan: modalTerkumpul,
      netCashflow: totalPendapatan - totalBeban + modalTerkumpul,
      saldoKasAkhir,
    },
    bagiHasil: { nisbahPengaju, nisbahPemodal, potensiBagiHasilPemodal, potensiBagiHasilPengaju },
    analisis,
  }
}

export async function getPemodalDenganPotensi(proyekId: string): Promise<KojasmatPemodalDenganPotensi[]> {
  const laporan = await getLaporanKeuanganProyek(proyekId)
  if (!laporan) return []

  const { rows } = await queryPostgres(
    `SELECT p.id, p.pemodal_id, a.nama AS pemodal_nama, p.jumlah, p.porsi_pct, p.kehadiran_akad
     FROM kojasmat_pembiayaan p
     LEFT JOIN kojasmat_anggota a ON a.id = p.pemodal_id
     WHERE p.proyek_id=$1 AND p.status='AKTIF'
     ORDER BY p.created_at ASC`,
    [proyekId]
  )

  return rows.map(r => ({
    id: r.id,
    pemodal_id: r.pemodal_id,
    pemodal_nama: r.pemodal_nama ?? '—',
    jumlah: Number(r.jumlah),
    porsi_pct: Number(r.porsi_pct),
    kehadiran_akad: r.kehadiran_akad,
    potensiBagiHasil: laporan.bagiHasil.potensiBagiHasilPemodal * Number(r.porsi_pct) / 100,
  }))
}

export async function distribusikanBagiHasil(proyekId: string) {
  const session = await getInternalAuthSession()
  if (!session) return { error: 'Tidak terautentikasi' }
  const actorId = getInternalUserId(session)

  const { rows: [proyek] } = await queryPostgres(`SELECT * FROM kojasmat_proyek WHERE id=$1`, [proyekId])
  if (!proyek) return { error: 'Proyek tidak ditemukan' }
  if (proyek.status === 'BAGI_HASIL') return { error: 'Bagi hasil untuk proyek ini sudah pernah diproses.' }

  const laporan = await getLaporanKeuanganProyek(proyekId)
  if (!laporan || laporan.labaRugi.labaBersih <= 0) {
    return { error: 'Belum ada laba bersih untuk dibagikan — harta proyek belum melebihi modal' }
  }

  const { rows: pembiayaan } = await queryPostgres(
    `SELECT id, pemodal_id, porsi_pct FROM kojasmat_pembiayaan WHERE proyek_id=$1 AND status='AKTIF'`,
    [proyekId]
  )
  if (pembiayaan.length === 0) return { error: 'Belum ada pemodal pada proyek ini' }

  const periode = new Date().toISOString().slice(0, 7)
  const totalPemodal = laporan.bagiHasil.potensiBagiHasilPemodal
  const totalDibagikan = totalPemodal + laporan.bagiHasil.potensiBagiHasilPengaju

  // Seluruh proses dibungkus satu transaksi supaya atomik — kalau satu pemodal
  // gagal di tengah loop (mis. rekening simpanan tidak ada), TIDAK ada baris
  // bagi_hasil/kredit saldo yang tersisa setengah jalan seperti yang sempat
  // terjadi sebelumnya (created_by dulu memakai session.user.id mentah, yang
  // bukan internal_auth_users.id, sehingga INSERT kojasmat_simpanan_mutasi
  // gagal FK setelah UPDATE saldo-nya sendiri sudah ter-commit).
  const client = await connectPostgresClient()
  let trxId: string | null = null
  try {
    await client.query('BEGIN')

    const { rows: [proyekLocked] } = await client.query(
      `SELECT status FROM kojasmat_proyek WHERE id=$1 FOR UPDATE`, [proyekId]
    )
    if (proyekLocked?.status === 'BAGI_HASIL') {
      throw new Error('Bagi hasil untuk proyek ini sudah pernah diproses.')
    }

    for (const pb of pembiayaan) {
      const hak = totalPemodal * Number(pb.porsi_pct) / 100
      await client.query(
        `INSERT INTO kojasmat_bagi_hasil
           (org_id, proyek_id, pemodal_id, periode, laba_proyek, porsi_pct, hak_pemodal, ujrah_koperasi, status, dibayar_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,0,'DIBAYAR',NOW())`,
        [proyek.org_id, proyekId, pb.pemodal_id, periode, laporan.labaRugi.labaBersih, pb.porsi_pct, hak]
      )

      // Kredit hak bagi hasil ke simpanan SUKARELA pemodal — tanpa ini status
      // 'DIBAYAR' di kojasmat_bagi_hasil tercatat tapi saldo anggota tidak pernah bertambah.
      if (hak > 0) {
        const { rows: [simpanan] } = await client.query(
          `SELECT id, saldo FROM kojasmat_simpanan WHERE anggota_id=$1 AND jenis='SUKARELA' FOR UPDATE`,
          [pb.pemodal_id]
        )
        if (!simpanan) throw new Error('Rekening simpanan sukarela salah satu pemodal tidak ditemukan')

        const sebelum = Number(simpanan.saldo)
        const sesudah = sebelum + hak
        await client.query(
          `UPDATE kojasmat_simpanan SET saldo=$2, updated_at=NOW() WHERE id=$1`,
          [simpanan.id, sesudah]
        )
        await client.query(
          `INSERT INTO kojasmat_simpanan_mutasi
             (org_id, simpanan_id, anggota_id, jenis_mutasi, jumlah, saldo_sebelum, saldo_sesudah, keterangan, tanggal, status, created_by)
           VALUES ($1,$2,$3,'BAGI_HASIL',$4,$5,$6,$7,CURRENT_DATE,'DISETUJUI',$8)`,
          [
            proyek.org_id, simpanan.id, pb.pemodal_id, hak, sebelum, sesudah,
            `Bagi hasil proyek ${proyek.kode_proyek} periode ${periode}`, actorId,
          ]
        )
      }
    }

    const trx = await client.query(
      `INSERT INTO kojasmat_proyek_transaksi
         (org_id, proyek_id, tanggal, jenis, kategori, keterangan, jumlah, created_by)
       VALUES ($1,$2,CURRENT_DATE,'BEBAN','Distribusi Bagi Hasil',$3,$4,$5) RETURNING id::text`,
      [
        proyek.org_id, proyekId,
        `Distribusi bagi hasil periode ${periode} ke ${pembiayaan.length} pemodal & pengaju`,
        totalDibagikan, actorId,
      ]
    )
    trxId = trx.rows[0].id

    await client.query(`UPDATE kojasmat_proyek SET status='BAGI_HASIL', updated_at=NOW() WHERE id=$1`, [proyekId])

    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    client.release()
    return { error: error instanceof Error ? error.message : 'Gagal memproses bagi hasil' }
  }
  client.release()

  try {
    await jurnalDistribusiBagiHasil(proyek.org_id, totalDibagikan, trxId!, String(proyek.kode_proyek))
  } catch (_) { /* jurnal non-fatal */ }

  revalidatePath('/kojasmat')
  return { data: { totalDibagikan, jumlahPemodal: pembiayaan.length } }
}
