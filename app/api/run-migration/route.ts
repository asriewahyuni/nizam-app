import { NextResponse } from 'next/server'
import { queryPostgres } from '@/lib/db/postgres'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function runAll() {
  const tables = [
    'koperasi_anggota',
    'koperasi_simpanan_pokok', 'koperasi_simpanan_wajib', 'koperasi_simpanan_sukarela',
    'koperasi_shahibul_maal', 'koperasi_mudharib', 'koperasi_sertifikasi_dps',
    'koperasi_pengurus', 'koperasi_akad_wakalah', 'koperasi_murabahah_transaksi',
    'koperasi_proyek', 'koperasi_investasi_proyek', 'koperasi_bagi_hasil', 'koperasi_shu',
  ]

  // Check existing tables
  const checks: any = await queryPostgres(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'koperasi_%'`
  )
  const existing = (checks || []).map((r: any) => r.table_name)
  const missing = tables.filter(t => !existing.includes(t))

  if (missing.length === 0) {
    return { message: 'All tables already exist', tables: existing }
  }

  await queryPostgres(`CREATE TABLE IF NOT EXISTS koperasi_anggota (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, kode_anggota VARCHAR(50) NOT NULL, nama VARCHAR(255) NOT NULL, nik VARCHAR(50), alamat TEXT, no_telepon VARCHAR(30), email VARCHAR(255), tanggal_daftar DATE NOT NULL DEFAULT CURRENT_DATE, status VARCHAR(20) NOT NULL DEFAULT 'AKTIF', is_tersertifikasi_dps BOOLEAN NOT NULL DEFAULT FALSE, simpanan_pokok DECIMAL(18,2) NOT NULL DEFAULT 0, simpanan_wajib_setoran DECIMAL(18,2) NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());`)
  await queryPostgres(`CREATE INDEX IF NOT EXISTS idx_koperasi_anggota_org ON koperasi_anggota(org_id)`)
  await queryPostgres(`CREATE INDEX IF NOT EXISTS idx_koperasi_anggota_status ON koperasi_anggota(org_id, status)`)
  await queryPostgres(`CREATE TABLE IF NOT EXISTS koperasi_simpanan_pokok (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, anggota_id UUID NOT NULL REFERENCES koperasi_anggota(id) ON DELETE CASCADE, jumlah DECIMAL(18,2) NOT NULL DEFAULT 0, tgl_bayar DATE NOT NULL DEFAULT CURRENT_DATE, metode VARCHAR(50) DEFAULT 'TUNAI', keterangan TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`)
  await queryPostgres(`CREATE TABLE IF NOT EXISTS koperasi_simpanan_wajib (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, anggota_id UUID NOT NULL REFERENCES koperasi_anggota(id) ON DELETE CASCADE, jumlah DECIMAL(18,2) NOT NULL DEFAULT 0, tgl_bayar DATE NOT NULL DEFAULT CURRENT_DATE, metode VARCHAR(50) DEFAULT 'TUNAI', bulan VARCHAR(7) NOT NULL, keterangan TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`)
  await queryPostgres(`CREATE TABLE IF NOT EXISTS koperasi_simpanan_sukarela (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, anggota_id UUID NOT NULL REFERENCES koperasi_anggota(id) ON DELETE CASCADE, jenis VARCHAR(10) NOT NULL DEFAULT 'SETORAN', jumlah DECIMAL(18,2) NOT NULL DEFAULT 0, tgl_transaksi DATE NOT NULL DEFAULT CURRENT_DATE, metode VARCHAR(50) DEFAULT 'TUNAI', keterangan TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`)
  await queryPostgres(`CREATE TABLE IF NOT EXISTS koperasi_shahibul_maal (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, anggota_id UUID NOT NULL REFERENCES koperasi_anggota(id) ON DELETE CASCADE, total_investasi DECIMAL(18,2) NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(org_id, anggota_id))`)
  await queryPostgres(`CREATE TABLE IF NOT EXISTS koperasi_mudharib (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, anggota_id UUID NOT NULL REFERENCES koperasi_anggota(id) ON DELETE CASCADE, keahlian TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(org_id, anggota_id))`)
  await queryPostgres(`CREATE TABLE IF NOT EXISTS koperasi_sertifikasi_dps (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, entity_type VARCHAR(20) NOT NULL, entity_id UUID NOT NULL, no_sertifikat VARCHAR(100) NOT NULL, tgl_terbit DATE NOT NULL, tgl_expired DATE NOT NULL, level VARCHAR(50) DEFAULT 'DASAR', penerbit VARCHAR(255) DEFAULT 'CORE iSEC', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`)
  await queryPostgres(`CREATE TABLE IF NOT EXISTS koperasi_pengurus (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, anggota_id UUID NOT NULL REFERENCES koperasi_anggota(id) ON DELETE CASCADE, jabatan VARCHAR(100) NOT NULL, tgl_menjabat DATE NOT NULL DEFAULT CURRENT_DATE, tgl_berakhir DATE, status VARCHAR(20) NOT NULL DEFAULT 'AKTIF', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(org_id, anggota_id, jabatan))`)
  await queryPostgres(`CREATE TABLE IF NOT EXISTS koperasi_akad_wakalah (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, nomor_akad VARCHAR(100) NOT NULL, shahibul_maal_id UUID NOT NULL REFERENCES koperasi_shahibul_maal(id) ON DELETE CASCADE, jenis_barang VARCHAR(255) NOT NULL, harga_barang DECIMAL(18,2) NOT NULL, ujrah_flat DECIMAL(5,4) NOT NULL DEFAULT 0.02, total_ujrah DECIMAL(18,2) NOT NULL, total_pembayaran DECIMAL(18,2) NOT NULL, jangka_wakalah INT NOT NULL DEFAULT 1, status VARCHAR(20) NOT NULL DEFAULT 'AKTIF', tgl_akad DATE NOT NULL DEFAULT CURRENT_DATE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(org_id, nomor_akad))`)
  await queryPostgres(`CREATE TABLE IF NOT EXISTS koperasi_murabahah_transaksi (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, akad_id UUID NOT NULL REFERENCES koperasi_akad_wakalah(id) ON DELETE CASCADE, pembeli_id UUID NOT NULL REFERENCES koperasi_anggota(id) ON DELETE CASCADE, harga_jual DECIMAL(18,2) NOT NULL, uang_muka DECIMAL(18,2) NOT NULL DEFAULT 0, sisa_angsuran DECIMAL(18,2) NOT NULL DEFAULT 0, jumlah_angsuran INT NOT NULL DEFAULT 1, angsuran_ke INT NOT NULL DEFAULT 0, status VARCHAR(20) NOT NULL DEFAULT 'AKTIF', tgl_transaksi DATE NOT NULL DEFAULT CURRENT_DATE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`)
  await queryPostgres(`CREATE TABLE IF NOT EXISTS koperasi_proyek (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, nama VARCHAR(255) NOT NULL, deskripsi TEXT, modal_dibutuhkan DECIMAL(18,2) NOT NULL DEFAULT 0, modal_terkumpul DECIMAL(18,2) NOT NULL DEFAULT 0, nisbah_mudharib DECIMAL(5,4) NOT NULL DEFAULT 0.50, durasi_bulan INT NOT NULL DEFAULT 1, tgl_mulai DATE, tgl_selesai DATE, status VARCHAR(20) NOT NULL DEFAULT 'DIAJUKAN', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`)
  await queryPostgres(`CREATE INDEX IF NOT EXISTS idx_koperasi_proyek_org ON koperasi_proyek(org_id)`)
  await queryPostgres(`CREATE TABLE IF NOT EXISTS koperasi_investasi_proyek (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), proyek_id UUID NOT NULL REFERENCES koperasi_proyek(id) ON DELETE CASCADE, shahibul_maal_id UUID NOT NULL REFERENCES koperasi_shahibul_maal(id) ON DELETE CASCADE, jumlah DECIMAL(18,2) NOT NULL, tgl_investasi DATE NOT NULL DEFAULT CURRENT_DATE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(proyek_id, shahibul_maal_id))`)
  await queryPostgres(`CREATE TABLE IF NOT EXISTS koperasi_bagi_hasil (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, proyek_id UUID NOT NULL REFERENCES koperasi_proyek(id) ON DELETE CASCADE, periode VARCHAR(7) NOT NULL, tgl_hitung DATE NOT NULL DEFAULT CURRENT_DATE, total_laba DECIMAL(18,2) NOT NULL DEFAULT 0, bagian_mudharib DECIMAL(18,2) NOT NULL DEFAULT 0, bagian_shahibul_maal DECIMAL(18,2) NOT NULL DEFAULT 0, status_distribusi VARCHAR(20) NOT NULL DEFAULT 'BELUM', distributed_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`)
  await queryPostgres(`CREATE TABLE IF NOT EXISTS koperasi_shu (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, tahun INT NOT NULL, total_shu DECIMAL(18,2) NOT NULL DEFAULT 0, cadangan DECIMAL(18,2) NOT NULL DEFAULT 0, anggota DECIMAL(18,2) NOT NULL DEFAULT 0, pengurus DECIMAL(18,2) NOT NULL DEFAULT 0, dana_sosial DECIMAL(18,2) NOT NULL DEFAULT 0, pendidikan DECIMAL(18,2) NOT NULL DEFAULT 0, tgl_hitung DATE NOT NULL DEFAULT CURRENT_DATE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(org_id, tahun))`)
  await queryPostgres(`CREATE OR REPLACE FUNCTION koperasi_generate_kode_anggota(p_org_id UUID) RETURNS VARCHAR(50) LANGUAGE plpgsql AS $$ BEGIN RETURN 'KOP-' || TO_CHAR(NOW(), 'YYMM') || '-' || LPAD((SELECT COUNT(*)+1 FROM koperasi_anggota WHERE org_id = p_org_id)::TEXT, 4, '0'); END; $$`)

  // Verify
  const verify: any = await queryPostgres(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'koperasi_%'`
  )
  const created = (verify || []).map((r: any) => r.table_name)

  return { message: `Migration done: ${missing.length} tables created`, created }
}

export async function GET() {
  try {
    const result = await runAll()
    return NextResponse.json(result)
  } catch (err: any) {
    console.error('Migration error:', err)
    return NextResponse.json({ error: err.message, stack: err.stack?.split('\n').slice(0, 3).join('\n') }, { status: 500 })
  }
}
